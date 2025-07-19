#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3Stack } from '../lib/s3-stack';

const app = new cdk.App();

// Environment configuration
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: 'eu-west-2' // London region as specified in the architecture
};

// Create the S3 stack
new S3Stack(app, 'GraceS3Stack', {
  env,
  description: 'S3 bucket with configurable removal policy for the GRACE project'
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'GRACE');
cdk.Tags.of(app).add('ManagedBy', 'CDK');