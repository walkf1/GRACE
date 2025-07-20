import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as events from 'aws-cdk-lib/aws-events';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface GraceFoundationStackProps extends cdk.StackProps {
  isProduction?: boolean;
}

export class GraceFoundationStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseCluster;
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly dataBucket: s3.Bucket;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props?: GraceFoundationStackProps) {
    super(scope, id, props);
    
    // Determine if this is a production deployment
    const isProduction = props?.isProduction ?? false;

    // 1. Create a new, secure Amazon VPC
    this.vpc = new ec2.Vpc(this, 'GraceVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ]
    });

    // 2 & 3. Create database secret and Aurora PostgreSQL cluster
    // Use environment-specific names for resources
    const envSuffix = isProduction ? 'prod' : 'dev';
    
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: `grace/database/credentials-${envSuffix}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'graceadmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 16
      }
    });

    // Security group for the database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for the Aurora PostgreSQL database',
      allowAllOutbound: false
    });

    // Create the Aurora PostgreSQL Serverless v2 cluster
    this.database = new rds.DatabaseCluster(this, 'AuditDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3
      }),
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      securityGroups: [dbSecurityGroup],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MEDIUM),
        vpc: this.vpc,
        publiclyAccessible: false,
      },
      instances: 2,
      storageEncrypted: true,
      deletionProtection: isProduction,
      removalPolicy: isProduction ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
      // Enable the Data API
      enableDataApi: true
    });

    // 4. Create the S3 bucket for data storage
    this.dataBucket = new s3.Bucket(this, 'DataBucket', {
      bucketName: `grace-kirocomp-data-${envSuffix}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // 5. Create the EventBridge bus for audit events
    this.eventBus = new events.EventBus(this, 'AuditEventBus', {
      eventBusName: `grace-audit-events-${envSuffix}`
    });

    // Enable EventBridge notifications for the S3 bucket
    this.dataBucket.enableEventBridgeNotification();
    
    // Create a rule to forward S3 events to our custom event bus
    new events.Rule(this, 'S3EventsToCustomBus', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        resources: [this.dataBucket.bucketArn]
      },
      targets: [new targets.EventBus(this.eventBus)]
    });

    // Output the resources for reference
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${cdk.Stack.of(this).stackName}-VpcId`
    });
    
    // Export private subnet IDs for cross-stack references
    const privateSubnets = this.vpc.privateSubnets;
    for (let i = 0; i < privateSubnets.length; i++) {
      new cdk.CfnOutput(this, `PrivateSubnet${i+1}Id`, {
        value: privateSubnets[i].subnetId,
        description: `The ID of private subnet ${i+1}`,
        exportName: `${cdk.Stack.of(this).stackName}-PrivateSubnet${i+1}`
      });
    }

    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.database.clusterEndpoint.hostname,
      description: 'The endpoint of the Aurora PostgreSQL database cluster'
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'The ARN of the database credentials secret'
    });

    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'The name of the S3 data bucket'
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'The name of the EventBridge bus for audit events'
    });
  }
}