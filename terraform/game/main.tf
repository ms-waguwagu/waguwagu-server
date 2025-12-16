provider "aws" {
  region = "ap-northeast-2"
}

data "aws_vpc" "game" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Game-VPC"]
  }
}

data "aws_subnet" "game_private_a" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Game-Private-Subnet-A"]
  }
}

data "aws_subnet" "game_private_b" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Game-Private-Subnet-B"]
  }
}

module "eks" {
  source = "../modules/eks"

  cluster_name    = "T3-Wagu-Game-EKS"
  vpc_id          = data.aws_vpc.game.id
  subnet_ids      = [data.aws_subnet.game_private_a.id, data.aws_subnet.game_private_b.id]
  node_group_name = "game-node-group"
  instance_types  = ["t3.medium"]
  desired_size    = 2
  max_size        = 3
  min_size        = 1
}
