import json
import os
import boto3
import hashlib
import base64
import datetime
import uuid

# Initialize AWS clients
secretsmanager = boto3.client('secretsmanager')
rds_data = boto3.client('rds-data')

def get_db_credentials():
    """Get database credentials from Secrets Manager"""
    secret_arn = os.environ['DATABASE_SECRET_ARN']
    
    # Get the secret
    secret_response = secretsmanager.get_secret_value(SecretId=secret_arn)
    secret = json.loads(secret_response['SecretString'])
    
    return secret_arn, secret

def ensure_audit_table_exists():
    """Ensure the audit_records table exists in the database"""
    secret_arn, secret = get_db_credentials()
    cluster_arn = os.environ.get('DATABASE_CLUSTER_ARN', 
                                 f"arn:aws:rds:{os.environ.get('AWS_REGION', 'eu-west-2')}:{os.environ.get('AWS_ACCOUNT_ID', '')}:cluster:{os.environ['DATABASE_ENDPOINT'].split('.')[0]}")
    database_name = os.environ.get('DATABASE_NAME', 'postgres')
    
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
    
    # Execute the SQL statement
    response = rds_data.execute_statement(
        resourceArn=cluster_arn,
        secretArn=secret_arn,
        database=database_name,
        sql=sql
    )
    
    return cluster_arn, secret_arn, database_name

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

def get_last_hash(cluster_arn, secret_arn, database_name):
    """Get the hash of the last record in the database"""
    sql = "SELECT hash FROM audit_records ORDER BY timestamp DESC LIMIT 1"
    
    try:
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database=database_name,
            sql=sql
        )
        
        # Check if we got any records
        if response['records'] and len(response['records']) > 0:
            return response['records'][0][0]['stringValue']
        
        return None
    except Exception as e:
        print(f"Error getting last hash: {str(e)}")
        return None

def log_provenance(event_data):
    """Log provenance data to the database with cryptographic chaining"""
    # Ensure the audit_records table exists
    cluster_arn, secret_arn, database_name = ensure_audit_table_exists()
    
    # Get the last hash from the database (if any)
    previous_hash = get_last_hash(cluster_arn, secret_arn, database_name)
    
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
    
    try:
        response = rds_data.execute_statement(
            resourceArn=cluster_arn,
            secretArn=secret_arn,
            database=database_name,
            sql=sql,
            parameters=parameters
        )
        
        # Get the ID of the inserted record
        record_id = None
        if response['records'] and len(response['records']) > 0:
            record_id = response['records'][0][0]['longValue']
        
        return {
            'id': record_id,
            'timestamp': timestamp,
            'hash': current_hash,
            'previous_hash': previous_hash
        }
    except Exception as e:
        print(f"Error inserting record: {str(e)}")
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
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error logging provenance',
                'error': str(e)
            })
        }