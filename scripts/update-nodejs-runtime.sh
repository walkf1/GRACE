#!/bin/bash

# Script to update Node.js 18.x Lambda functions to Node.js 20.x
# Usage: ./update-nodejs-runtime.sh [region]

REGION=${1:-"eu-west-2"}
echo "Updating Node.js 18.x Lambda functions in region: $REGION"

# Get all Lambda functions using Node.js 18.x
FUNCTIONS=$(aws lambda list-functions --region $REGION --output text --query "Functions[?Runtime=='nodejs18.x'].FunctionName")

if [ -z "$FUNCTIONS" ]; then
  echo "No Lambda functions using Node.js 18.x found in region $REGION"
  exit 0
fi

# Update each function to Node.js 20.x
for FUNCTION_NAME in $FUNCTIONS; do
  echo "Updating function: $FUNCTION_NAME"
  aws lambda update-function-configuration \
    --region $REGION \
    --function-name $FUNCTION_NAME \
    --runtime nodejs20.x
  
  # Check if update was successful
  if [ $? -eq 0 ]; then
    echo "Successfully updated $FUNCTION_NAME to Node.js 20.x"
  else
    echo "Failed to update $FUNCTION_NAME"
  fi
done

echo "Update process completed"