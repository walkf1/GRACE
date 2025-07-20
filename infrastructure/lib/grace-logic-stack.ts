import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
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

    // Create the ProvenanceLogger Lambda function
    this.provenanceLogger = new lambda.Function(this, 'ProvenanceLogger', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/provenance_logger')),
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
    
    // Grant the Lambda function permission to use the RDS Data API
    this.provenanceLogger.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement'
      ],
      resources: ['*']
    }));
    
    // Grant the Lambda function permission to use the RDS Data API
    this.provenanceLogger.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'rds-data:ExecuteStatement',
        'rds-data:BatchExecuteStatement',
        'rds-data:BeginTransaction',
        'rds-data:CommitTransaction',
        'rds-data:RollbackTransaction'
      ],
      resources: ['*']
    }));

    // Output the Lambda function ARN
    new cdk.CfnOutput(this, 'ProvenanceLoggerArn', {
      value: this.provenanceLogger.functionArn,
      description: 'The ARN of the ProvenanceLogger Lambda function'
    });
  }
}