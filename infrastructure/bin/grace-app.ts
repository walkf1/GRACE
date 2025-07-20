#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GraceFoundationStack } from '../lib/grace-foundation-stack';
import { GraceLogicStack } from '../lib/grace-logic-stack';

const app = new cdk.App();

// Environment configuration
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: 'eu-west-2' // London region as specified in the architecture
};

// Determine if this is a production deployment
const isProduction = process.env.ENVIRONMENT === 'production';

// Create the foundation stack with core resources
const foundationStack = new GraceFoundationStack(app, 'GraceFoundationStack', {
  env,
  description: 'Core infrastructure for the GRACE project including PostgreSQL database, S3 bucket, and EventBridge bus',
  isProduction
});

// Create the logic stack with Lambda functions
const logicStack = new GraceLogicStack(app, 'GraceLogicStack', {
  env,
  description: 'Business logic layer for the GRACE project including Lambda functions',
  foundationStack,
  isProduction
});

// Add dependency to ensure the foundation stack is deployed first
logicStack.addDependency(foundationStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'GRACE');
cdk.Tags.of(app).add('Environment', isProduction ? 'Production' : 'Development');
cdk.Tags.of(app).add('ManagedBy', 'CDK');