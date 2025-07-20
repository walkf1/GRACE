import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface GraceOrchestrationStackProps extends cdk.NestedStackProps {
  provenanceLogger: lambda.IFunction;
  dataBucket: s3.IBucket;
  eventBus: events.IEventBus;
  isProduction?: boolean;
}

export class GraceOrchestrationStack extends cdk.NestedStack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: GraceOrchestrationStackProps) {
    super(scope, id, props);

    // Determine if this is a production deployment
    const isProduction = props?.isProduction ?? false;
    const envSuffix = isProduction ? 'prod' : 'dev';

    // Create the first task that invokes the ProvenanceLogger Lambda function
    const logProvenanceTask = new tasks.LambdaInvoke(this, 'LogProvenance', {
      lambdaFunction: props.provenanceLogger,
      integrationPattern: sfn.IntegrationPattern.REQUEST_RESPONSE,
      payload: sfn.TaskInput.fromObject({
        'eventSource': 'S3',
        'eventType': 'ObjectCreated',
        'timestamp': sfn.JsonPath.stringAt('$.time'),
        'detail': sfn.JsonPath.stringAt('$.detail'),
        'resources': sfn.JsonPath.stringAt('$.resources')
      }),
      resultPath: '$.provenanceResult'
    });

    // Define a simple success state
    const successState = new sfn.Succeed(this, 'AuditSucceeded');

    // Connect the states
    const definition = logProvenanceTask.next(successState);

    // Create the state machine
    this.stateMachine = new sfn.StateMachine(this, 'AuditWorkflow', {
      definition,
      stateMachineName: `grace-audit-workflow-${envSuffix}`,
      timeout: cdk.Duration.minutes(5)
    });

    // Create an EventBridge rule to trigger the state machine on S3 object creation
    new events.Rule(this, 'S3ObjectCreatedRule', {
      eventBus: props.eventBus,
      description: 'Rule to trigger the audit workflow when a new object is created in the data bucket',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.dataBucket.bucketName]
          }
        }
      },
      targets: [new targets.SfnStateMachine(this.stateMachine)]
    });

    // Output the state machine ARN
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'The ARN of the audit workflow state machine'
    });
  }
}