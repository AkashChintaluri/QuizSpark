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

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get default subnet
data "aws_subnet" "default" {
  vpc_id = data.aws_vpc.default.id
  availability_zone = "${var.aws_region}a"
}

# Security Group
resource "aws_security_group" "quizspark_sg" {
  name        = "quizspark-sg"
  description = "Security group for QuizSpark application"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Application port"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "quizspark-sg"
  }
}

# EC2 Instance
resource "aws_instance" "quizspark" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  subnet_id     = data.aws_subnet.default.id
  key_name      = var.key_name

  vpc_security_group_ids = [aws_security_group.quizspark_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              apt-get install -y nodejs npm git nginx
              npm install -g pm2
              git clone ${var.repository_url} /app
              cd /app
              npm install --production
              npm run build
              cd server
              npm install --production
              # Update environment variables for Supabase
              echo "SUPABASE_URL=${var.supabase_url}" >> .env
              echo "SUPABASE_KEY=${var.supabase_key}" >> .env
              echo "PORT=3000" >> .env
              pm2 start pgServer.js --update-env
              EOF

  tags = {
    Name = "quizspark-server"
  }
}

# Outputs
output "public_ip" {
  value = aws_instance.quizspark.public_ip
}
