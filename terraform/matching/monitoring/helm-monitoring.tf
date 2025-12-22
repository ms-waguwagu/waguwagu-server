# =============================================================================
# Prometheus
# =============================================================================
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

# =============================================================================
# Grafana
# =============================================================================
resource "helm_release" "grafana" {
  name       = "grafana"
  namespace  = "monitoring"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"

  create_namespace = true

  values = [
    file("${path.module}/grafana-values.yaml")
  ]

  depends_on = [helm_release.prometheus]
}
