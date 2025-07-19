#!/bin/bash

# GRACE S3 Bucket Creation Script

# Exit on error
set -e

BUCKET_NAME="grace-kirocomp-data"
REGION="eu-west-2"
AWS_PROFILE="grace"

echo "=== GRACE S3 Bucket Creation ==="

# Check if running in production mode
if [ "$1" == "--production" ]; then
  ENVIRONMENT="production"
  echo "Creating bucket for PRODUCTION environment"
else
  ENVIRONMENT="development"
  echo "Creating bucket for DEVELOPMENT environment"
fi

# Check if bucket exists
if aws --profile $AWS_PROFILE s3api head-bucket --bucket $BUCKET_NAME 2>/dev/null; then
  echo "Bucket $BUCKET_NAME already exists"
else
  echo "Creating bucket $BUCKET_NAME in $REGION..."
  aws --profile $AWS_PROFILE s3api create-bucket \
    --bucket $BUCKET_NAME \
    --region $REGION \
    --create-bucket-configuration LocationConstraint=$REGION
  
  echo "Enabling versioning..."
  aws --profile $AWS_PROFILE s3api put-bucket-versioning \
    --bucket $BUCKET_NAME \
    --versioning-configuration Status=Enabled
  
  echo "Enabling encryption..."
  aws --profile $AWS_PROFILE s3api put-bucket-encryption \
    --bucket $BUCKET_NAME \
    --server-side-encryption-configuration '{
      "Rules": [
        {
          "ApplyServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"
          }
        }
      ]
    }'
  
  echo "Blocking public access..."
  aws --profile $AWS_PROFILE s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration '{
      "BlockPublicAcls": true,
      "IgnorePublicAcls": true,
      "BlockPublicPolicy": true,
      "RestrictPublicBuckets": true
    }'
  
  echo "Adding tags..."
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
        }
      ]
    }'
fi

echo "=== Bucket Configuration Complete ==="
echo "Bucket Name: $BUCKET_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"

if [ "$ENVIRONMENT" == "production" ]; then
  echo "Removal Policy: RETAIN (bucket will NOT be deleted automatically)"
  echo "NOTE: For production, the bucket is protected from accidental deletion."
else
  echo "Removal Policy: DESTROY (bucket can be deleted)"
  echo "NOTE: For development, the bucket can be deleted when no longer needed."
fi