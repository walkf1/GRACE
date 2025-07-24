# GRACE API Deployment

## Overview

This document describes the deployment of the GRACE API stack, which provides a secure API for verifying the integrity of audit chains stored in the immutable ledger.

## Components

The GraceApiStack includes the following components:

1. **Amazon Cognito User Pool**
   - Manages user identities and authentication
   - Provides secure tokens for API access

2. **Amazon API Gateway**
   - Exposes a RESTful API for audit verification
   - Secured with Cognito authorizer
   - Includes CORS support for web clients

3. **ChainVerifier Lambda Function**
   - Written in Python 3.9
   - Verifies the integrity of audit chains
   - Has permissions to read from the ledger bucket

4. **API Endpoints**
   - `POST /audits/{datasetId}/verify` - Verifies the integrity of an audit chain for a specific dataset

## Deployment

The GraceApiStack was successfully deployed to the eu-west-2 (London) region. The deployment created all the necessary resources and configured them to work together.

### Deployment Outputs

- **API URL**: https://5lcgg0rum2.execute-api.eu-west-2.amazonaws.com/prod/
- **User Pool ID**: eu-west-2_53X9OrVM8
- **User Pool Client ID**: 5b99dpuhlmrvvh3vehu8tu244s

## Testing

An end-to-end test was performed to verify the functionality of the API:

1. Created a test user in the Cognito User Pool
2. Authenticated and obtained a token
3. Uploaded a test file to the uploads bucket
4. Called the verify endpoint with the dataset ID
5. Verified that the API responded with a 200 status code

The test was successful, confirming that the API is properly deployed and accessible.

## Next Steps

1. **Configure S3 Event Notifications**: Ensure that the AuditHandler Lambda function is triggered when files are uploaded to the uploads bucket.
2. **Verify Audit Record Creation**: Confirm that audit records are being created in the ledger bucket.
3. **Enhance Error Handling**: Add more robust error handling to the ChainVerifier Lambda function.
4. **Add More API Endpoints**: Implement additional endpoints for managing datasets and viewing audit records.
5. **Implement Monitoring**: Set up CloudWatch alarms and dashboards to monitor the API's performance and health.