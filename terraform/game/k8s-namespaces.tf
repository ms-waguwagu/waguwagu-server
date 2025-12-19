resource "kubernetes_namespace" "game" {
  metadata {
    name = "game"
  }

  depends_on = [module.eks]
}
