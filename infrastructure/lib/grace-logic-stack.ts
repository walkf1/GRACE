import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { GraceFoundationStack } from './grace-foundation-stack';

export class GraceLogicStack extends cdk.Stack {
  public readonly provenanceLogger: lambda.Function;

  constructor(scope: Construct, id: string, foundationStack: GraceFoundationStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a secret for database credentials
    const dbSecret = new secretsmanager.Secret(this, 'GraceDbCredentials', {
      secretName: 'grace/db/credentials',
      description: 'Credentials for Aurora PostgreSQL database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'admin',
          dbname: 'grace_audit',
          host: foundationStack.auditDatabase.clusterEndpoint.hostname,
          port: foundationStack.auditDatabase.clusterEndpoint.port,
        }),
        generateStringKey: 'password',
        excludeCharacters: '/@"',
      },
    });

    // Create security group for Lambda to access RDS
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'ProvenanceLoggerSG', {
      vpc: foundationStack.vpc,
      description: 'Security group for ProvenanceLogger Lambda function',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to RDS
    foundationStack.auditDatabase.connections.allowFrom(
      lambdaSecurityGroup,
      ec2.Port.tcp(foundationStack.auditDatabase.clusterEndpoint.port),
      'Allow Lambda to connect to RDS'
    );

    // Create the Lambda function
    this.provenanceLogger = new lambda.Function(this, 'ProvenanceLogger', {
      functionName: 'ProvenanceLogger',
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('lambda/provenance_logger'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      vpc: foundationStack.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_ENDPOINT: foundationStack.auditDatabase.clusterEndpoint.hostname,
      },
    });

    // Grant Lambda permission to read the secret
    dbSecret.grantRead(this.provenanceLogger);

    // Output the Lambda function ARN
    new cdk.CfnOutput(this, 'ProvenanceLoggerArn', {
      value: this.provenanceLogger.functionArn,
      description: 'ARN of the ProvenanceLogger Lambda function',
      exportName: 'ProvenanceLoggerArn',
    });
  }
}