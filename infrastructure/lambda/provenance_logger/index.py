import json
import os
import boto3
import hashlib
import base64
import datetime
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
secretsmanager = boto3.client('secretsmanager')
rds_data = boto3.client('rds-data')

def get_db_credentials():
    """Get database credentials from Secrets Manager"""
    secret_arn = os.environ['DATABASE_SECRET_ARN']
    
    # Get the secret
    secret_response = secretsmanager.get_secret_value(SecretId=secret_arn)
    secret = json.loads(secret_response['SecretString'])
    
    return secret_arn

def get_cluster_arn():
    """Get the Aurora cluster ARN"""
    # Extract the cluster identifier from the endpoint
    endpoint = os.environ['DATABASE_ENDPOINT']
    cluster_id = endpoint.split('.')[0]
    
    # Construct the cluster ARN
    region = os.environ.get('AWS_REGION', 'eu-west-2')
    account_id = os.environ.get('AWS_ACCOUNT_ID', '')
    
    return f"arn:aws:rds:{region}:{account_id}:cluster:{cluster_id}"

def ensure_audit_table_exists(secret_arn, cluster_arn):
    """Ensure the audit_records table exists in the database"""
    # SQL to create the table if it doesn't exist
    sql = """
    CREATE TABLE IF NOT EXISTS audit_records (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        event_data JSONB NOT NULL,
        hash VARCHAR(64) NOT NULL,
        previous_hash VARCHAR(64)
    );
    """
    
    try:
        # Execute the SQL statement
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database='postgres',
            sql=sql
        )
        logger.info("Table audit_records created or already exists")
        return response
    except Exception as e:
        logger.error(f"Error creating table: {str(e)}")
        raise

def calculate_hash(data, previous_hash=None):
    """Calculate a hash of the data, incorporating the previous hash if available"""
    # Create a JSON string of the data
    data_str = json.dumps(data, sort_keys=True)
    
    # If there's a previous hash, include it in the calculation
    if previous_hash:
        data_str = previous_hash + data_str
    
    # Calculate SHA-256 hash
    hash_obj = hashlib.sha256(data_str.encode())
    return base64.b64encode(hash_obj.digest()).decode()

def get_last_hash(secret_arn, cluster_arn):
    """Get the hash of the last record in the database"""
    sql = "SELECT hash FROM audit_records ORDER BY timestamp DESC LIMIT 1"
    
    try:
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database='postgres',
            sql=sql
        )
        
        # Check if we got any records
        if 'records' in response and len(response['records']) > 0:
            return response['records'][0][0]['stringValue']
        
        return None
    except Exception as e:
        logger.error(f"Error getting last hash: {str(e)}")
        return None

def log_provenance(event_data):
    """Log provenance data to the database with cryptographic chaining"""
    try:
        # Get the database credentials
        secret_arn = get_db_credentials()
        
        # Get the cluster ARN
        cluster_arn = get_cluster_arn()
        
        # Log the ARNs for debugging
        logger.info(f"Secret ARN: {secret_arn}")
        logger.info(f"Cluster ARN: {cluster_arn}")
        
        # Ensure the audit_records table exists
        ensure_audit_table_exists(secret_arn, cluster_arn)
        
        # Get the last hash from the database (if any)
        previous_hash = get_last_hash(secret_arn, cluster_arn)
        
        # Calculate the new hash
        current_hash = calculate_hash(event_data, previous_hash)
        
        # Insert the record
        timestamp = datetime.datetime.now().isoformat()
        event_data_json = json.dumps(event_data)
        
        sql = """
        INSERT INTO audit_records (timestamp, event_data, hash, previous_hash)
        VALUES (:timestamp, :event_data::jsonb, :hash, :previous_hash)
        RETURNING id
        """
        
        parameters = [
            {'name': 'timestamp', 'value': {'stringValue': timestamp}},
            {'name': 'event_data', 'value': {'stringValue': event_data_json}},
            {'name': 'hash', 'value': {'stringValue': current_hash}},
            {'name': 'previous_hash', 'value': {'stringValue': previous_hash if previous_hash else ''}}
        ]
        
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database='postgres',
            sql=sql,
            parameters=parameters
        )
        
        # Get the ID of the inserted record
        record_id = None
        if 'records' in response and len(response['records']) > 0:
            record_id = response['records'][0][0]['longValue']
        
        logger.info(f"Provenance record created with ID: {record_id}")
        
        return {
            'id': record_id,
            'timestamp': timestamp,
            'hash': current_hash,
            'previous_hash': previous_hash
        }
    except Exception as e:
        logger.error(f"Error in log_provenance: {str(e)}")
        raise

def handler(event, context):
    """Lambda handler function"""
    try:
        # Extract AWS account ID from the context
        if context:
            os.environ['AWS_ACCOUNT_ID'] = context.invoked_function_arn.split(':')[4]
        
        # Extract AWS region from the context
        if context:
            os.environ['AWS_REGION'] = context.invoked_function_arn.split(':')[3]
        
        # Process the event
        result = log_provenance(event)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Provenance logged successfully',
                'result': result
            })
        }
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error logging provenance',
                'error': str(e)
            })
        }