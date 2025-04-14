#!/bin/bash

# Set environment variables for production
export VITE_API_URL=http://$(terraform output -raw public_ip):3000

# Build the application
npm run build

# Upload to S3
aws s3 sync dist/ s3://$FRONTEND_BUCKET_NAME --delete 