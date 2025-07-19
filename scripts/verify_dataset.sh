#!/bin/bash

# GRACE Dataset Verification Script
# This script downloads the GSE84465 dataset, calculates its hash, and uploads it to S3

# Set variables
DATASET_ID="GSE84465"
DATA_DIR="/Users/walkf1/Documents/GRACE/data/${DATASET_ID}"
S3_BUCKET="grace-kirocomp-data"
S3_PREFIX="datasets"
AWS_PROFILE="grace"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "=== GRACE Dataset Verification Process ==="
echo "Dataset: $DATASET_ID"
echo "Working directory: $DATA_DIR"
echo

# Step 1: Download the dataset
echo "Step 1: Downloading dataset from GEO..."
curl -L -o "${DATASET_ID}_RAW.tar" "https://www.ncbi.nlm.nih.gov/geo/download/?acc=${DATASET_ID}&format=file"

if [ $? -ne 0 ]; then
    echo "Error: Download failed"
    exit 1
fi

# Step 2: Calculate SHA256 hash
echo
echo "Step 2: Calculating SHA256 hash..."
ORIGINAL_HASH=$(shasum -a 256 "${DATASET_ID}_RAW.tar" | cut -d ' ' -f 1)
echo "Original hash: $ORIGINAL_HASH"

# Step 3: Upload to S3
echo
echo "Step 3: Uploading to S3 bucket..."
aws --profile "$AWS_PROFILE" s3 cp "${DATASET_ID}_RAW.tar" "s3://${S3_BUCKET}/${S3_PREFIX}/${DATASET_ID}_RAW.tar"

if [ $? -ne 0 ]; then
    echo "Error: Upload failed"
    exit 1
fi

# Step 4: Verify integrity
echo
echo "Step 4: Verifying integrity after upload..."
aws --profile "$AWS_PROFILE" s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/${DATASET_ID}_RAW.tar" "${DATASET_ID}_verification.tar"

if [ $? -ne 0 ]; then
    echo "Error: Download for verification failed"
    exit 1
fi

VERIFICATION_HASH=$(shasum -a 256 "${DATASET_ID}_verification.tar" | cut -d ' ' -f 1)
echo "Verification hash: $VERIFICATION_HASH"

# Compare hashes
if [ "$ORIGINAL_HASH" = "$VERIFICATION_HASH" ]; then
    echo
    echo "✅ Verification SUCCESSFUL: Hashes match"
    echo "Dataset integrity confirmed"
    
    # Update the manifest with the hash
    MANIFEST_PATH="/Users/walkf1/Documents/GRACE/docs/dataset_manifest.md"
    TODAY=$(date +"%Y-%m-%d")
    
    # Replace placeholder with actual hash
    sed -i '' "s/\[To be calculated during implementation\]/$ORIGINAL_HASH/g" "$MANIFEST_PATH"
    sed -i '' "s/\[Date\]/$TODAY/g" "$MANIFEST_PATH"
    
    echo "Manifest updated with hash information"
else
    echo
    echo "❌ Verification FAILED: Hashes do not match"
    echo "Original:    $ORIGINAL_HASH"
    echo "Verification: $VERIFICATION_HASH"
fi

echo
echo "=== Verification process complete ==="