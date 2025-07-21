import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

export interface GraceApiStackProps extends cdk.StackProps {
  ledgerBucketName: string;
  isProduction?: boolean;
}

export class GraceApiStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly api: apigateway.RestApi;
  public readonly chainVerifierFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: GraceApiStackProps) {
    super(scope, id, props);
    
    // Get isProduction flag from props
    const isProduction = props?.isProduction || false;

    // 1. Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'GraceUserPool', {
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add a client to the user pool
    const userPoolClient = this.userPool.addClient('GraceApiClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // 2. Create API Gateway with Cognito Authorizer
    this.api = new apigateway.RestApi(this, 'GraceApi', {
      restApiName: 'GRACE API',
      description: 'API for GRACE audit verification',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'GraceAuthorizer', {
      cognitoUserPools: [this.userPool],
    });

    // 3. Create ChainVerifier Lambda function
    this.chainVerifierFunction = new lambda.Function(this, 'ChainVerifierFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/chain_verifier')),
      environment: {
        LEDGER_BUCKET_NAME: props.ledgerBucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions to read from the ledger bucket
    this.chainVerifierFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket', 's3:GetObject'],
      resources: [
        `arn:aws:s3:::${props.ledgerBucketName}`,
        `arn:aws:s3:::${props.ledgerBucketName}/*`,
      ],
    }));

    // 4. Create API endpoint with Lambda integration
    const audits = this.api.root.addResource('audits');
    const datasetId = audits.addResource('{datasetId}');
    const verify = datasetId.addResource('verify');

    verify.addMethod('POST', 
      new apigateway.LambdaIntegration(this.chainVerifierFunction), {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'The URL of the API Gateway',
    });
  }
}