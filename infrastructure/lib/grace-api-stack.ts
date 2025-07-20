import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { GraceLogicStack } from './grace-logic-stack';

export class GraceApiStack extends cdk.Stack {
  public readonly apiEndpoint: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, logicStack: GraceLogicStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    const userPool = new cognito.UserPool(this, 'GraceUserPool', {
      userPoolName: 'grace-user-pool',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Create User Pool Client
    const userPoolClient = userPool.addClient('GraceUserPoolClient', {
      userPoolClientName: 'grace-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'GraceApi', {
      restApiName: 'GRACE API',
      description: 'API for GRACE audit trail',
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'GraceAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'grace-cognito-authorizer',
    });

    // Create /audits resource
    const auditsResource = api.root.addResource('audits');

    // Add POST method with Lambda integration and Cognito authorization
    auditsResource.addMethod('POST', 
      new apigateway.LambdaIntegration(logicStack.provenanceLogger, {
        proxy: true,
      }), {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Store outputs as class properties
    this.apiEndpoint = api.url;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    // Create CloudFormation outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'URL of the GRACE API',
      exportName: 'GraceApiEndpoint',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'ID of the Cognito User Pool',
      exportName: 'GraceUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'ID of the Cognito User Pool Client',
      exportName: 'GraceUserPoolClientId',
    });
  }
}