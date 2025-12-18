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

  cluster_name      = "T3-Wagu-Game-EKS"
  vpc_id            = data.aws_vpc.game.id
  subnet_a_id       = data.aws_subnet.game_private_a.id
  subnet_b_id       = data.aws_subnet.game_private_b.id
  node_group_name_a = "T3-Wagu-Game-NodeA"
  node_group_name_b = "T3-Wagu-Game-NodeB"
  instance_types    = ["t3.medium"]
  desired_size      = 2
  max_size          = 3
  min_size          = 1
}
