provider "aws" {
  region = "ap-northeast-2"
}

data "aws_vpc" "matching" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Matching-VPC"]
  }
}

data "aws_subnet" "matching_private_a" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Matching-Private-Subnet-A"]
  }
}

data "aws_subnet" "matching_private_b" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Matching-Private-Subnet-B"]
  }
}

module "eks" {
  source = "../modules/eks"

  cluster_name    = "T3-Wagu-Matching-EKS"
  vpc_id          = data.aws_vpc.matching.id
  subnet_ids      = [data.aws_subnet.matching_private_a.id, data.aws_subnet.matching_private_b.id]
  node_group_name = "matching-node-group"
  instance_types  = ["t3.medium"]
  desired_size    = 2
  max_size        = 3
  min_size        = 1
}
