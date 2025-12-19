resource "helm_release" "agones" {
  name       = "agones"
  repository = "https://agones.dev/chart/stable"
  chart      = "agones"

  namespace        = "agones-system"
  create_namespace = true

  # 설치 안정화
  wait          = true
  wait_for_jobs = true
  timeout       = 900
  atomic        = true
  cleanup_on_fail = true

  # values 파일 사용 (repo에 이미 있는 파일)
  values = [
    file("${path.module}/../../k8s/agones/agones-value.yaml")
  ]

  # EKS 먼저 떠야 하니까
  depends_on = [
  module.eks,
  kubernetes_namespace.game,
  helm_release.alb_controller
]

}