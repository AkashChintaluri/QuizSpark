aws_region     = "ap-south-1"
instance_type  = "t2.micro"
key_name       = "quizspark"
repository_url = "https://github.com/AkashChintaluri/QuizSpark.git"

# Supabase Configuration
supabase_url = "https://hntrpejpiboxnlbzrbbc.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudHJwZWpwaWJveG5sYnpyYmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNDA4NTMsImV4cCI6MjA1ODgxNjg1M30.J4R67CjTWG6WaTtAtuHNTmDFKGaGWvA4R1gWRBBmMDc"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
public_subnet_cidr = "10.0.1.0/24"

# S3 Configuration
frontend_bucket_name = "quizspark-frontend"
