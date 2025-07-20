#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GraceFoundationStack } from '../lib/grace-foundation-stack';

const app = new cdk.App();

// Environment configuration
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: 'eu-west-2' // London region as specified in the architecture
};

// Create the foundation stack with core resources
const foundationStack = new GraceFoundationStack(app, 'GraceFoundationStack', {
  env,
  description: 'Core infrastructure for the GRACE project including PostgreSQL database, S3 bucket, and EventBridge bus'
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'GRACE');
cdk.Tags.of(app).add('Environment', 'Development');
cdk.Tags.of(app).add('ManagedBy', 'CDK');