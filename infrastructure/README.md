# GRACE Infrastructure

This directory contains the AWS CDK code for deploying the GRACE project infrastructure.

## Architecture Overview

The GRACE infrastructure consists of the following key components:

1. **QLDB Ledger**: An immutable ledger for storing audit records
2. **S3 Bucket**: For storing datasets and audit artifacts
3. **EventBridge Bus**: For event-driven communication between components
4. **Bedrock Flows**: For orchestrating AI-powered audit workflows

## Stack Structure

- **GraceFoundationStack**: Core infrastructure components (QLDB, S3, EventBridge)
- **BedrockFlowStack**: Bedrock Flow orchestration and Lambda functions

## Deployment Instructions

### Prerequisites

- Node.js 14.x or later
- AWS CDK v2
- AWS CLI configured with appropriate credentials

### Installation

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-NUMBER/REGION

# Synthesize CloudFormation templates
cdk synth

# Deploy the stacks
cdk deploy --all
```

### Important Notes

- The infrastructure is configured to deploy to the `eu-west-2` (London) region
- The S3 bucket has versioning enabled and is configured with appropriate security settings
- The QLDB ledger has deletion protection enabled
- Bedrock Flows is currently in preview and may have limitations

## Key Architectural Decisions

1. **Orchestration**: Using Amazon Bedrock Flows for AI workflow integration
2. **Analytics**: Direct QLDB Query via Lambda for the MVP implementation
3. **Roadmap**: Phased approach with Nitro Enclaves as a stretch goal