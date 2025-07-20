import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
import { Construct } from 'constructs';

export class GraceFoundationStack extends cdk.Stack {
  // Public properties to expose resources to other stacks
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly dataBucket: s3.IBucket;
  public readonly auditEventBus: events.IEventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create a new, secure Amazon VPC
    this.vpc = new ec2.Vpc(this, 'GraceVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        }
      ]
    });

    // 2. Create a database security group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for PostgreSQL database',
      allowAllOutbound: true
    });

    // 3. Create an AWS Secrets Manager secret for database credentials
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: 'grace/database/credentials/v1',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'graceadmin' }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password'
      }
    });

    // 4. Create a standard Amazon RDS for PostgreSQL database instance
    this.database = new rds.DatabaseInstance(this, 'GraceDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL), // Cost-effective
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      multiAz: true,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(7),
      // Disable deletion protection for development environments
      deletionProtection: this.node.tryGetContext('isProduction') === 'true',
      databaseName: 'gracedb',
      publiclyAccessible: false
    });

    // 5. Import the existing S3 bucket for dataset storage
    this.dataBucket = s3.Bucket.fromBucketName(this, 'GraceDataBucket', 'grace-kirocomp-data');
    
    // Import or create the log bucket
    const logBucket = s3.Bucket.fromBucketName(this, 'GraceDataBucketLogs', 'grace-kirocomp-data-logs');

    // 6. Try to import the existing EventBridge bus or create a new one
    try {
      this.auditEventBus = events.EventBus.fromEventBusName(this, 'GraceAuditEventBus', 'grace-audit-events');
    } catch (error) {
      // If the bus doesn't exist, create a new one
      this.auditEventBus = new events.EventBus(this, 'GraceAuditEventBusNew', {
        eventBusName: 'grace-audit-events-new'
      });
      
      // Add archive for the event bus
      new events.CfnArchive(this, 'GraceEventArchive', {
        sourceArn: this.auditEventBus.eventBusArn,
        description: 'Archive for GRACE audit events',
        retentionDays: 365,
        archiveName: 'grace-audit-events-archive'
      });
    }

    // 7. Note: We can't configure event notifications for imported buckets
    // If needed, this would need to be done separately using the AWS CLI or console

    // Add tags to resources
    cdk.Tags.of(this.vpc).add('Project', 'GRACE');
    cdk.Tags.of(this.database).add('Project', 'GRACE');
    
    // Note: We can't add tags to imported resources
    // If needed, tags would need to be added separately using the AWS CLI or console

    // Create a layer with the SQL script
    const sqlLayer = new lambda.LayerVersion(this, 'SqlScriptLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../sql')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Layer containing SQL initialization scripts'
    });
    
    // Use a pre-built psycopg2 layer
    // This is a public layer ARN for psycopg2-binary in eu-west-2 (London)
    // Source: https://github.com/jetbridge/psycopg2-lambda-layer
    const psycopg2Layer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'Psycopg2Layer',
      'arn:aws:lambda:eu-west-2:898466741470:layer:psycopg2-py39:1'
    );
    
    // Create a Lambda function to initialize the database with the audit schema
    const dbInitFunction = new lambda.Function(this, 'DbInitFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/db-init')),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      securityGroups: [dbSecurityGroup],
      timeout: cdk.Duration.minutes(5),
      environment: {
        PYTHONPATH: '/var/runtime:/var/task:/opt:/opt/python'
      },
      layers: [sqlLayer, psycopg2Layer]
    });
    
    // Grant the Lambda function permissions to access the database secret
    this.databaseSecret.grantRead(dbInitFunction);
    
    // Create a custom resource to initialize the database
    const dbInitProvider = new cr.Provider(this, 'DbInitProvider', {
      onEventHandler: dbInitFunction,
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK
    });
    
    // Create the custom resource
    const dbInit = new cdk.CustomResource(this, 'DbInit', {
      serviceToken: dbInitProvider.serviceToken,
      properties: {
        SecretArn: this.databaseSecret.secretArn,
        SqlFilePath: '/opt/init-audit-schema.sql',
        Version: Date.now().toString() // Force update on each deployment
      }
    });
    
    // Ensure the database is created before initializing it
    dbInit.node.addDependency(this.database);

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'ID of the VPC'
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'Endpoint of the PostgreSQL database'
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'ARN of the database credentials secret'
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'Name of the S3 bucket for dataset storage'
    });

    new cdk.CfnOutput(this, 'AuditEventBusName', {
      value: this.auditEventBus.eventBusName,
      description: 'Name of the EventBridge bus for audit events'
    });
  }
}