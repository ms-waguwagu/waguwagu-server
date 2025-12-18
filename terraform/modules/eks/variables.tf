variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "subnet_a_id" {
  description = "Subnet ID for Node Group A"
  type        = string
}

variable "subnet_b_id" {
  description = "Subnet ID for Node Group B"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the cluster and nodes will be deployed"
  type        = string
}

variable "node_group_name_a" {
  description = "Name of the EKS node group A"
  type        = string
  default     = "node-group-a"
}

variable "node_group_name_b" {
  description = "Name of the EKS node group B"
  type        = string
  default     = "node-group-b"
}

variable "instance_types" {
  description = "List of instance types for the node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 3
}

variable "min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}
