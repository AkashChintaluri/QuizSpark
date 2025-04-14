#!/bin/bash

# Install AWS CLI if not already installed
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
fi

# Fetch parameters from Parameter Store
export DATABASE_URL=$(aws ssm get-parameter --name "/quizspark/DATABASE_URL" --with-decryption --query "Parameter.Value" --output text)
export JWT_SECRET=$(aws ssm get-parameter --name "/quizspark/JWT_SECRET" --with-decryption --query "Parameter.Value" --output text)
export SUPABASE_URL=$(aws ssm get-parameter --name "/quizspark/SUPABASE_URL" --with-decryption --query "Parameter.Value" --output text)
export SUPABASE_KEY=$(aws ssm get-parameter --name "/quizspark/SUPABASE_KEY" --with-decryption --query "Parameter.Value" --output text)

# Start the server
node pgServer.js 