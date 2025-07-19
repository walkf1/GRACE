#!/bin/bash

# GRACE S3 Bucket Configuration Script

# Exit on error
set -e

BUCKET_NAME="grace-kirocomp-data"
AWS_PROFILE="grace"
CONFIG_FILE="s3-config.json"

echo "=== GRACE S3 Bucket Configuration ==="

# Check if environment is specified
if [ "$1" == "--production" ]; then
  ENVIRONMENT="production"
else
  ENVIRONMENT="development"
fi

# Read configuration from JSON file
REMOVAL_POLICY=$(jq -r ".$ENVIRONMENT.removalPolicy" $CONFIG_FILE)
DESCRIPTION=$(jq -r ".$ENVIRONMENT.description" $CONFIG_FILE)

echo "Configuring bucket for $ENVIRONMENT environment"
echo "Removal Policy: $REMOVAL_POLICY"
echo "Description: $DESCRIPTION"

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
      },
      {
        "Key": "Description",
        "Value": "'"$DESCRIPTION"'"
      }
    ]
  }'

echo "=== Bucket Configuration Complete ==="
echo "Bucket Name: $BUCKET_NAME"
echo "Environment: $ENVIRONMENT"
echo "Removal Policy: $REMOVAL_POLICY"