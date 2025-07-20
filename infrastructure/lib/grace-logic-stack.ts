import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { GraceFoundationStack } from './grace-foundation-stack';

export interface GraceLogicStackProps extends cdk.NestedStackProps {
  vpc: ec2.IVpc;
  databaseSecret: cdk.aws_secretsmanager.ISecret;
  databaseEndpoint: string;
  databaseSecurityGroup: ec2.ISecurityGroup;
  isProduction?: boolean;
}

export class GraceLogicStack extends cdk.NestedStack {
  public readonly provenanceLogger: lambda.Function;

  // Helper function to prepare a Lambda layer
  private preparePsycopg2Layer(): string {
    const layerPath = path.join(__dirname, '../lambda/layers/psycopg2');
    const pythonPath = path.join(layerPath, 'python');
    
    // Create the python directory if it doesn't exist
    if (!fs.existsSync(pythonPath)) {
      fs.mkdirSync(pythonPath, { recursive: true });
    }
    
    // Check if we need to install the dependencies
    if (!fs.existsSync(path.join(pythonPath, 'psycopg2'))) {
      console.log('Installing psycopg2 for Lambda layer...');
      try {
        // Install the dependencies directly on the host system
        child_process.execSync(`pip install -r ${path.join(layerPath, 'requirements.txt')} -t ${pythonPath}`, {
          stdio: 'inherit'
        });
      } catch (error) {
        console.error('Failed to install psycopg2. Using pre-packaged version if available.');
      }
    }
    
    return layerPath;
  }

  constructor(scope: Construct, id: string, props: GraceLogicStackProps) {
    super(scope, id, props);

    // Determine if this is a production deployment
    const isProduction = props?.isProduction ?? false;
    const envSuffix = isProduction ? 'prod' : 'dev';

    // Use the resources passed from the parent stack
    const { vpc, databaseSecret, databaseSecurityGroup } = props;

    // Create a security group for the Lambda function
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'ProvenanceLoggerSecurityGroup', {
      vpc,
      description: 'Security group for the ProvenanceLogger Lambda function',
      allowAllOutbound: true
    });
    
    // Allow the Lambda function to connect to the database
    lambdaSecurityGroup.addEgressRule(
      databaseSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL'
    );
    
    // Allow inbound connections from the Lambda to the database
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL'
    );

    // Create a Lambda layer for psycopg2
    const layerPath = this.preparePsycopg2Layer();
    const psycopg2Layer = new lambda.LayerVersion(this, 'Psycopg2Layer', {
      code: lambda.Code.fromAsset(layerPath),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'A layer containing psycopg2 for PostgreSQL connections',
      layerVersionName: `grace-psycopg2-layer-${envSuffix}`
    });
    
    // Create the ProvenanceLogger Lambda function
    this.provenanceLogger = new lambda.Function(this, 'ProvenanceLogger', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/provenance_logger')),
      layers: [psycopg2Layer],
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        DATABASE_ENDPOINT: props.databaseEndpoint,
        ENVIRONMENT: isProduction ? 'production' : 'development'
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      description: 'Lambda function for logging provenance data with cryptographic chaining',
      functionName: `grace-provenance-logger-${envSuffix}`
    });

    // Grant the Lambda function permission to read the database secret
    databaseSecret.grantRead(this.provenanceLogger);

    // Output the Lambda function ARN
    new cdk.CfnOutput(this, 'ProvenanceLoggerArn', {
      value: this.provenanceLogger.functionArn,
      description: 'The ARN of the ProvenanceLogger Lambda function'
    });
  }
}