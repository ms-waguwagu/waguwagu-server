variable "region" {
  type    = string
  default = "ap-northeast-2"
}

provider "aws" {
  region = var.region
}
