###############################################
# External Secrets Operator (ESO) + IRSA
###############################################

locals {
  eso_namespace      = "external-secrets"
  eso_serviceaccount = "external-secrets"
  oidc_issuer        = replace(data.aws_eks_cluster.this.identity[0].oidc[0].issuer, "https://", "")
}

# (1) Namespace
resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = local.eso_namespace
  }
}

# (2) IAM Policy: Secrets Manager read
# ✅ 가장 안전: 특정 Secret ARN만 허용
variable "eso_secret_arns" {
  type        = list(string)
  description = "Secrets Manager Secret ARNs that ESO can read"
}

data "aws_iam_policy_document" "eso_sm_policy_doc" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]
    resources = var.eso_secret_arns
  }

  # (선택) Secret이 Customer Managed KMS Key로 암호화된 경우에만 필요
  # statement {
  #   effect    = "Allow"
  #   actions   = ["kms:Decrypt"]
  #   resources = ["<KMS_KEY_ARN>"]
  # }
}

resource "aws_iam_policy" "eso_sm_policy" {
  name   = "${local.cluster_name}-eso-sm-policy"
  policy = data.aws_iam_policy_document.eso_sm_policy_doc.json
}

# (3) Trust Policy: IRSA assume role (ESO SA만 허용)
data "aws_iam_policy_document" "eso_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer}:sub"
      values   = ["system:serviceaccount:${local.eso_namespace}:${local.eso_serviceaccount}"]
    }
  }
}

resource "aws_iam_role" "eso_role" {
  name               = "${local.cluster_name}-eso-role"
  assume_role_policy = data.aws_iam_policy_document.eso_assume.json
}

resource "aws_iam_role_policy_attachment" "eso_attach" {
  role       = aws_iam_role.eso_role.name
  policy_arn = aws_iam_policy.eso_sm_policy.arn
}

# (4) Kubernetes ServiceAccount (role-arn annotation)
resource "kubernetes_service_account" "eso_sa" {
  metadata {
    name      = local.eso_serviceaccount
    namespace = kubernetes_namespace.external_secrets.metadata[0].name
    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.eso_role.arn
    }
  }
}

# (5) Helm install ESO (SA는 우리가 만든 걸 사용)
resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  namespace  = kubernetes_namespace.external_secrets.metadata[0].name

 # ✅ Helm이 리소스 Ready 될 때까지 기다리게
  wait            = true
  wait_for_jobs   = true
  timeout         = 600 # seconds (10분 정도)
  atomic          = true
  cleanup_on_fail = true


  # 가급적 버전 고정 추천 (예: "0.10.5" 같은 식)
  # version = "..."

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "serviceAccount.create"
    value = "false"
  }

  set {
    name  = "serviceAccount.name"
    value = kubernetes_service_account.eso_sa.metadata[0].name
  }

  depends_on = [
    aws_iam_role_policy_attachment.eso_attach,
    kubernetes_service_account.eso_sa,

    # ✅ 같은 root에 있다면 추가!
    helm_release.alb_controller
  ]
}
