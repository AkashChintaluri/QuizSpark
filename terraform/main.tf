terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Ubuntu AMI Data Source
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

# Get the current AWS account ID
data "aws_caller_identity" "current" {}

# Get the default VPC
data "aws_vpc" "default" {
  default = true
}

# Get the default subnet
data "aws_subnet" "default" {
  vpc_id = data.aws_vpc.default.id
  availability_zone = "${var.aws_region}a"
}

# Get the default security group
data "aws_security_group" "quizspark_sg" {
  vpc_id = data.aws_vpc.default.id
  name   = "default"
}

# Get existing IAM role
data "aws_iam_role" "ec2_role" {
  name = "quizspark_ec2_role"
}

# Get existing IAM policies
data "aws_iam_policy" "ssm_policy" {
  name = "quizspark_ssm_policy"
}

data "aws_iam_policy" "s3_policy" {
  name = "quizspark_s3_policy"
}

# Get existing instance profile
data "aws_iam_instance_profile" "ec2_profile" {
  name = "quizspark_ec2_profile"
}

# EC2 Instance
resource "aws_instance" "quizspark" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = data.aws_subnet.default.id
  key_name      = var.key_name
  iam_instance_profile = data.aws_iam_instance_profile.ec2_profile.name

  vpc_security_group_ids = [data.aws_security_group.quizspark_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y nodejs npm
              npm install -g pm2
              mkdir -p /home/ubuntu/server
              cd /home/ubuntu/server
              npm init -y
              npm install express pg cors dotenv
              EOF

  tags = {
    Name = "quizspark"
  }
}

# Output the public IP of the EC2 instance
output "public_ip" {
  value = aws_instance.quizspark.public_ip
}

# Reference existing S3 bucket
data "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket_name
}

# Configure public access
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Add bucket policy for public read access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${data.aws_s3_bucket.frontend.arn}/*"
      },
    ]
  })
}

# Configure for static website hosting
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Output the website URL
output "frontend_url" {
  value = "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}"
}
