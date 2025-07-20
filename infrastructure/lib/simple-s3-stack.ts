import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class SimpleS3Stack extends cdk.Stack {
  public readonly dataBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get the isProduction context variable
    const isProduction = this.node.tryGetContext('isProduction') === 'true';
    
    // Create S3 bucket with configurable removal policy
    this.dataBucket = new s3.Bucket(this, 'GraceDataBucket', {
      bucketName: 'grace-kirocomp-data',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Output the bucket name and removal policy
    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'Name of the S3 bucket for dataset storage'
    });

    new cdk.CfnOutput(this, 'RemovalPolicy', {
      value: isProduction ? 'RETAIN' : 'DESTROY',
      description: 'Removal policy for the S3 bucket'
    });
  }
}