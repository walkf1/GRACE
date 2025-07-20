#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GraceFoundationStack } from '../lib/grace-foundation-stack';
import { GraceLogicStack } from '../lib/grace-logic-stack';
import { GraceOrchestrationStack } from '../lib/grace-orchestration-stack';

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

// Create the logic stack as a nested stack
const logicStack = new GraceLogicStack(foundationStack, 'GraceLogicStack', {
  description: 'Business logic layer for the GRACE project including Lambda functions',
  vpc: foundationStack.vpc,
  databaseSecret: foundationStack.databaseSecret,
  databaseEndpoint: foundationStack.database.clusterEndpoint.hostname,
  databaseSecurityGroup: foundationStack.database.connections.securityGroups[0],
  isProduction
});

// Create the orchestration stack as a nested stack
const orchestrationStack = new GraceOrchestrationStack(foundationStack, 'GraceOrchestrationStack', {
  description: 'Orchestration layer for the GRACE project including Step Functions and EventBridge rules',
  provenanceLogger: logicStack.provenanceLogger,
  dataBucket: foundationStack.dataBucket,
  eventBus: foundationStack.eventBus,
  isProduction
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'GRACE');
cdk.Tags.of(app).add('Environment', isProduction ? 'Production' : 'Development');
cdk.Tags.of(app).add('ManagedBy', 'CDK');