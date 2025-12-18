

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

  cluster_name      = "T3-Wagu-Matching-EKS"
  vpc_id            = data.aws_vpc.matching.id
  subnet_a_id       = data.aws_subnet.matching_private_a.id
  subnet_b_id       = data.aws_subnet.matching_private_b.id
  node_group_name_a = "T3-Wagu-Matching-NodeA"
  node_group_name_b = "T3-Wagu-Matching-NodeB"
  instance_types    = ["t3.medium"]
  desired_size      = 2
  max_size          = 3
  min_size          = 1
}
