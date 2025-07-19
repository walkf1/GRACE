#!/bin/bash

# GRACE S3 Bucket Policy Update Script

# Exit on error
set -e

BUCKET_NAME="grace-kirocomp-data"
AWS_PROFILE="grace"

echo "=== GRACE S3 Bucket Policy Update ==="

# Check if running in production mode
if [ "$1" == "--production" ]; then
  ENVIRONMENT="production"
  REMOVAL_POLICY="RETAIN"
  echo "Updating bucket for PRODUCTION environment (RETAIN policy)"
else
  ENVIRONMENT="development"
  REMOVAL_POLICY="DESTROY"
  echo "Updating bucket for DEVELOPMENT environment (DESTROY policy)"
fi

# Update the tags to reflect the environment and removal policy
echo "Updating bucket tags..."
aws --profile $AWS_PROFILE s3api put-bucket-tagging \
  --bucket $BUCKET_NAME \
  --tagging '{
    "TagSet": [
      {
        "Key": "Project",
        "Value": "GRACE"
      },
      {
        "Key": "Environment",
        "Value": "'"$ENVIRONMENT"'"
      },
      {
        "Key": "ManagedBy",
        "Value": "CLI"
      },
      {
        "Key": "RemovalPolicy",
        "Value": "'"$REMOVAL_POLICY"'"
      }
    ]
  }'

echo "=== Bucket Policy Update Complete ==="
echo "Bucket Name: $BUCKET_NAME"
echo "Environment: $ENVIRONMENT"
echo "Removal Policy: $REMOVAL_POLICY"

if [ "$ENVIRONMENT" == "production" ]; then
  echo "NOTE: For production, the bucket is protected from accidental deletion."
else
  echo "NOTE: For development, the bucket can be deleted when no longer needed."
fi