#!/bin/bash

# GRACE Infrastructure Deployment Script

# Exit on error
set -e

echo "=== GRACE Infrastructure Deployment ==="
echo "This script will deploy the GRACE infrastructure using AWS CDK"

# Check if running in production mode
if [ "$1" == "--production" ]; then
  ENVIRONMENT="production"
  IS_PRODUCTION="true"
  echo "Deploying to PRODUCTION environment"
else
  ENVIRONMENT="development"
  IS_PRODUCTION="false"
  echo "Deploying to DEVELOPMENT environment"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Bootstrap CDK (if needed)
echo "Bootstrapping CDK..."
npx cdk bootstrap

# Deploy with the appropriate context
echo "Deploying infrastructure..."
npx cdk deploy --all --context isProduction=$IS_PRODUCTION --require-approval never

echo "=== Deployment Complete ==="
echo "Environment: $ENVIRONMENT"
echo "S3 Bucket Removal Policy: $([ "$IS_PRODUCTION" == "true" ] && echo "RETAIN" || echo "DESTROY")"