import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3Stack extends cdk.Stack {
  public readonly dataBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get the isProduction context variable
    const isProduction = this.node.tryGetContext('isProduction') === 'true';
    
    // Create the S3 bucket with configurable removal policy
    this.dataBucket = new s3.Bucket(this, 'GraceDataBucket', {
      bucketName: 'grace-kirocomp-data',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create a custom resource to update the bucket tags
    const tagUpdateFunction = new cdk.aws_lambda.Function(this, 'TagUpdateFunction', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: cdk.aws_lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3();
        const cfn = new AWS.CloudFormation();
        
        exports.handler = async (event, context) => {
          console.log('Event:', JSON.stringify(event));
          
          try {
            if (event.RequestType === 'Delete') {
              return await sendResponse(event, context, 'SUCCESS', {});
            }
            
            const bucketName = event.ResourceProperties.BucketName;
            const isProduction = event.ResourceProperties.IsProduction === 'true';
            const removalPolicy = isProduction ? 'RETAIN' : 'DESTROY';
            const environment = isProduction ? 'production' : 'development';
            
            // Update the bucket tags
            await s3.putBucketTagging({
              Bucket: bucketName,
              Tagging: {
                TagSet: [
                  { Key: 'Project', Value: 'GRACE' },
                  { Key: 'Environment', Value: environment },
                  { Key: 'RemovalPolicy', Value: removalPolicy },
                  { Key: 'ManagedBy', Value: 'CDK' }
                ]
              }
            }).promise();
            
            return await sendResponse(event, context, 'SUCCESS', {
              BucketName: bucketName,
              RemovalPolicy: removalPolicy,
              Environment: environment
            });
          } catch (error) {
            console.error('Error:', error);
            return await sendResponse(event, context, 'FAILED', {});
          }
        };
        
        async function sendResponse(event, context, responseStatus, responseData) {
          const responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
            PhysicalResourceId: context.logStreamName,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: responseData
          });
          
          console.log('Response body:', responseBody);
          
          const https = require('https');
          const url = require('url');
          
          const parsedUrl = url.parse(event.ResponseURL);
          const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: 'PUT',
            headers: {
              'content-type': '',
              'content-length': responseBody.length
            }
          };
          
          return new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
              console.log('Status code:', response.statusCode);
              resolve(responseData);
            });
            
            request.on('error', (error) => {
              console.log('send:', error);
              reject(error);
            });
            
            request.write(responseBody);
            request.end();
          });
        }
      `),
      timeout: cdk.Duration.seconds(30),
    });
    
    // Grant the function permissions to update bucket tags
    tagUpdateFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['s3:GetBucketTagging', 's3:PutBucketTagging'],
      resources: [this.dataBucket.bucketArn],
    }));
    
    // Create a custom resource to update the bucket tags
    const tagUpdater = new cdk.CustomResource(this, 'BucketTagUpdater', {
      serviceToken: new cdk.aws_cloudformation.CustomResourceProvider(this, 'TagUpdaterProvider', {
        codeDirectory: cdk.aws_lambda.Code.fromAsset('lambda').path,
        runtime: cdk.aws_cloudformation.CustomResourceProviderRuntime.NODEJS_18_X,
        policyStatements: [{
          Effect: 'Allow',
          Action: ['s3:GetBucketTagging', 's3:PutBucketTagging'],
          Resource: [this.dataBucket.bucketArn],
        }],
      }).serviceToken,
      properties: {
        BucketName: this.dataBucket.bucketName,
        IsProduction: isProduction ? 'true' : 'false',
        UpdateTimestamp: new Date().toISOString(), // Force update on each deployment
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'DataBucketName', {
      value: this.dataBucket.bucketName,
      description: 'Name of the S3 bucket for dataset storage'
    });

    new cdk.CfnOutput(this, 'RemovalPolicy', {
      value: isProduction ? 'RETAIN' : 'DESTROY',
      description: 'Removal policy for the S3 bucket'
    });
    
    new cdk.CfnOutput(this, 'Environment', {
      value: isProduction ? 'production' : 'development',
      description: 'Environment configuration'
    });
  }
}