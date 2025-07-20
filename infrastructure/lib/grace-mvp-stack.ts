import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import * as path from 'path';

export interface GraceMvpStackProps extends cdk.StackProps {
  isProduction?: boolean;
}

export class GraceMvpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: GraceMvpStackProps) {
    super(scope, id, props);

    // Get isProduction flag from props
    const isProduction = props?.isProduction || false;
    
    // 1. S3 bucket for data uploads
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      versioned: true,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProduction,
    });

    // 2. S3 bucket for immutable ledger with Object Lock
    const ledgerBucket = new s3.Bucket(this, 'LedgerBucket', {
      versioned: true,
      objectLockEnabled: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      objectLockDefaultRetention: {
        mode: s3.ObjectLockRetention.GOVERNANCE,
        days: 365, // 1 year retention
      },
    });

    // 3. Lambda function for audit handling
    const auditHandler = new lambda.Function(this, 'AuditHandler', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/audit_handler')),
      environment: {
        LEDGER_BUCKET_NAME: ledgerBucket.bucketName,
      },
    });

    // Grant the Lambda function permissions to read from uploads bucket and write to ledger bucket
    uploadsBucket.grantRead(auditHandler);
    ledgerBucket.grantWrite(auditHandler);

    // Configure S3 event notification to trigger Lambda
    uploadsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED, 
      new s3n.LambdaDestination(auditHandler)
    );

    // Output the bucket names
    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'The name of the S3 bucket for data uploads',
    });

    new cdk.CfnOutput(this, 'LedgerBucketName', {
      value: ledgerBucket.bucketName,
      description: 'The name of the S3 bucket for the immutable ledger',
    });
  }
}