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

data "aws_subnet" "game_public_a" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Game-Public-Subnet-A"]
  }
}

data "aws_subnet" "game_public_b" {
  filter {
    name   = "tag:Name"
    values = ["T3-Wagu-Game-Public-Subnet-B"]
  }
}

module "eks" {
  source = "../modules/eks"

  cluster_name      = "T3-Wagu-Game-EKS"
  vpc_id            = data.aws_vpc.game.id
  subnet_ids      = [data.aws_subnet.game_private_a.id, data.aws_subnet.game_private_b.id]
  node_group_name = "game-node-group-v2"
  instance_types    = ["t3.medium"]
  disk_size       = 60
  desired_size      = 2
  max_size          = 3
  min_size          = 1

  # Public Node Group for Agones
  create_public_node_group = true
  public_node_group_name   = "game-public-node-group"
  public_subnet_ids        = [data.aws_subnet.game_public_a.id, data.aws_subnet.game_public_b.id]
  public_instance_types    = ["t3.medium"]
  public_desired_size      = 1
  public_max_size          = 3
  public_min_size          = 0
}


