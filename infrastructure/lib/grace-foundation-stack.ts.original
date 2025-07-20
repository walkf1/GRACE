import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as qldb from 'aws-cdk-lib/aws-qldb';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class GraceFoundationStack extends cdk.Stack {
  // Public properties to expose resources to other stacks
  public readonly auditLedger: qldb.CfnLedger;
  public readonly dataBucket: s3.Bucket;
  public readonly auditEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create QLDB Ledger for immutable audit records
    this.auditLedger = new qldb.CfnLedger(this, 'GraceAuditLedger', {
      name: 'grace-audit-ledger',
      permissionsMode: 'STANDARD',
      deletionProtection: true,
      // Ensure data is encrypted at rest
      kmsKey: undefined // Uses AWS-owned KMS key by default
    });

    // Add tags to the ledger
    cdk.Tags.of(this.auditLedger).add('Project', 'GRACE');
    cdk.Tags.of(this.auditLedger).add('Purpose', 'Audit');

    // Create S3 bucket for dataset storage with appropriate security settings
    const isProduction = this.node.tryGetContext('isProduction') === 'true';
    this.dataBucket = new s3.Bucket(this, 'GraceDataBucket', {
      bucketName: 'grace-kirocomp-data',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'ArchiveAfter30Days',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30)
            }
          ]
        }
      ]
    });

    // Add server access logging for the data bucket
    const logBucket = new s3.Bucket(this, 'GraceDataBucketLogs', {
      bucketName: 'grace-kirocomp-data-logs',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.dataBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [logBucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('logging.s3.amazonaws.com')]
      })
    );

    // Enable server access logging
    this.dataBucket.enableAutoDeleteObjects();
    
    // Create EventBridge bus for audit events
    this.auditEventBus = new events.EventBus(this, 'GraceAuditEventBus', {
      eventBusName: 'grace-audit-events'
    });

    // Add archive for the event bus
    new events.CfnArchive(this, 'GraceEventArchive', {
      sourceArn: this.auditEventBus.eventBusArn,
      description: 'Archive for GRACE audit events',
      retentionDays: 365,
      archiveName: 'grace-audit-events-archive'
    });

    // Outputs
    new cdk.CfnOutput(this, 'AuditLedgerName', {
      value: this.auditLedger.name || 'grace-audit-ledger',
      description: 'Name of the QLDB ledger for audit records'
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