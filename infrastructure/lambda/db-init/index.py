import os
import json
import boto3
import psycopg2
import cfnresponse
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Lambda function to initialize the PostgreSQL database with the audit schema.
    This function is called by CloudFormation during stack creation/update.
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Extract properties from the event
    properties = event.get('ResourceProperties', {})
    secret_arn = properties.get('SecretArn')
    sql_file_path = properties.get('SqlFilePath', '/opt/init-audit-schema.sql')
    
    response_data = {}
    physical_id = f"db-init-{context.aws_request_id}"
    
    try:
        if event['RequestType'] == 'Delete':
            # Nothing to do on delete
            logger.info("Delete request - no action needed")
            cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
            return
        
        # Get database credentials from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=secret_arn)
        secret = json.loads(secret_response['SecretString'])
        
        # Connect to the database
        conn = psycopg2.connect(
            host=secret['host'],
            port=secret.get('port', 5432),
            dbname=secret.get('dbname', 'gracedb'),
            user=secret['username'],
            password=secret['password']
        )
        conn.autocommit = True
        
        # Read and execute the SQL file
        with open(sql_file_path, 'r') as f:
            sql_script = f.read()
        
        with conn.cursor() as cur:
            cur.execute(sql_script)
        
        conn.close()
        
        logger.info("Database initialization completed successfully")
        response_data['Message'] = "Database initialized successfully"
        cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
        
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        response_data['Error'] = str(e)
        cfnresponse.send(event, context, cfnresponse.FAILED, response_data, physical_id)