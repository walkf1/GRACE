# GRACE Infrastructure

This directory contains the AWS CDK code for deploying the GRACE infrastructure.

## Architecture

The GRACE infrastructure consists of the following components:

1. **GraceFoundationStack**: Core infrastructure components
   - Amazon VPC with public, private, and isolated subnets
   - Amazon RDS for PostgreSQL database for audit records
   - S3 bucket for data storage with event notifications
   - EventBridge bus for audit events

2. **Database Initialization**: Automated setup of the audit schema
   - Lambda function to initialize the PostgreSQL database
   - SQL scripts for creating the audit schema and tables
   - Custom resource to trigger initialization during deployment

## Deployment

To deploy the infrastructure:

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy the foundation stack
cdk deploy GraceFoundationStack
```

## Security Features

- VPC with isolated subnets for the database
- Security groups with least privilege access
- Encrypted database storage and connections
- Secrets Manager for database credentials
- S3 bucket with server-side encryption and public access blocked
- Event-driven audit trail for all data operations