#!/bin/bash

# Set environment variables for production
export VITE_API_URL=http://$(terraform output -raw public_ip):3000
export VITE_SUPABASE_URL=https://hntrpejpiboxnlbzrbbc.supabase.co
export VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudHJwZWpwaWJveG5sYnpyYmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNDA4NTMsImV4cCI6MjA1ODgxNjg1M30.J4R67CjTWG6WaTtAtuHNTmDFKGaGWvA4R1gWRBBmMDc

# Build the application
npm run build

# Upload to S3
aws s3 sync dist/ s3://$FRONTEND_BUCKET_NAME --delete 