resource "helm_release" "prometheus" {
  name       = "prometheus"
  namespace  = "monitoring"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "prometheus"

  create_namespace = true

  values = [
    file("${path.module}/prometheus-values.yaml")
  ]
}
