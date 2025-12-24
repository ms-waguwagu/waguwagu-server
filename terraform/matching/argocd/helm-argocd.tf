
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  namespace  = "argocd"

  values = [
    file("${path.module}/argocd-values.yaml")
  ]

  # 네임스페이스는 Terraform이 관리
  create_namespace = false

  depends_on = [
    kubernetes_namespace.argocd
  ]
}