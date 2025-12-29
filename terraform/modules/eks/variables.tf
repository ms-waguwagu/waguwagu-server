variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.34"
}

variable "subnet_ids" {
  description = "List of subnet IDs for the EKS cluster"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID where the cluster and nodes will be deployed"
  type        = string
}

variable "node_group_name" {
  description = "Name of the EKS node group"
  type        = string
  default     = "main-node-group"
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

variable "disk_size" {
  description = "Root EBS volume size for worker nodes (GiB)"
  type        = number
  default     = 60
}

# Public Node Group Variables
variable "create_public_node_group" {
  description = "Whether to create a public node group for game servers"
  type        = bool
  default     = false
}

variable "public_node_group_name" {
  description = "Name of the public node group"
  type        = string
  default     = "public-node-group"
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the public node group"
  type        = list(string)
  default     = []
}

variable "public_instance_types" {
  description = "List of instance types for the public node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "public_desired_size" {
  description = "Desired number of public worker nodes"
  type        = number
  default     = 1
}

variable "public_max_size" {
  description = "Maximum number of public worker nodes"
  type        = number
  default     = 2
}

variable "public_min_size" {
  description = "Minimum number of public worker nodes"
  type        = number
  default     = 0
}
