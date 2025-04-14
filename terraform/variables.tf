variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "key_name" {
  description = "Name of the SSH key pair"
  type        = string
}

variable "repository_url" {
  description = "GitHub repository URL for the application"
  type        = string
  default     = "https://github.com/AkashChintaluri/QuizSpark.git"
}

# Supabase Configuration
variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^https://[a-zA-Z0-9-]+\\.supabase\\.co$", var.supabase_url))
    error_message = "The supabase_url must be a valid Supabase project URL."
  }
}

variable "supabase_key" {
  description = "Supabase anon/public key"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^eyJ[a-zA-Z0-9-_]+\\.[a-zA-Z0-9-_]+\\.[a-zA-Z0-9-_]+$", var.supabase_key))
    error_message = "The supabase_key must be a valid JWT token."
  }
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "The vpc_cidr must be a valid CIDR block."
  }
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
  default     = "10.0.1.0/24"
  validation {
    condition     = can(cidrhost(var.public_subnet_cidr, 0))
    error_message = "The public_subnet_cidr must be a valid CIDR block."
  }
}

variable "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend hosting"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.frontend_bucket_name))
    error_message = "The bucket name must be lowercase, can contain periods and hyphens, and must start and end with a letter or number."
  }
}
