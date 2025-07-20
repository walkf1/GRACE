import json
import os
import boto3
import hashlib
import base64
import datetime
import psycopg2
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
secretsmanager = boto3.client('secretsmanager')

def get_db_connection():
    """Establish a connection to the PostgreSQL database using credentials from Secrets Manager"""
    secret_arn = os.environ['DATABASE_SECRET_ARN']
    
    # Get the secret
    secret_response = secretsmanager.get_secret_value(SecretId=secret_arn)
    secret = json.loads(secret_response['SecretString'])
    
    # Extract credentials
    username = secret['username']
    password = secret['password']
    host = os.environ['DATABASE_ENDPOINT']
    
    # Connect to the database
    conn = psycopg2.connect(
        host=host,
        user=username,
        password=password,
        database='postgres'  # Default database name
    )
    
    return conn

def ensure_audit_table_exists(conn):
    """Ensure the audit_records table exists in the database"""
    cursor = conn.cursor()
    
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
    cursor.execute(sql)
    conn.commit()
    cursor.close()

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

def get_last_hash(conn):
    """Get the hash of the last record in the database"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT hash FROM audit_records ORDER BY timestamp DESC LIMIT 1")
        result = cursor.fetchone()
        
        if result:
            return result[0]
        
        return None
    except Exception as e:
        logger.error(f"Error getting last hash: {str(e)}")
        return None
    finally:
        cursor.close()

def log_provenance(event_data):
    """Log provenance data to the database with cryptographic chaining"""
    conn = None
    try:
        # Connect to the database
        conn = get_db_connection()
        
        # Ensure the audit_records table exists
        ensure_audit_table_exists(conn)
        
        # Get the last hash from the database (if any)
        previous_hash = get_last_hash(conn)
        
        # Calculate the new hash
        current_hash = calculate_hash(event_data, previous_hash)
        
        # Insert the record
        cursor = conn.cursor()
        timestamp = datetime.datetime.now().isoformat()
        
        cursor.execute(
            "INSERT INTO audit_records (timestamp, event_data, hash, previous_hash) VALUES (%s, %s, %s, %s) RETURNING id",
            (timestamp, json.dumps(event_data), current_hash, previous_hash)
        )
        
        # Get the ID of the inserted record
        record_id = cursor.fetchone()[0]
        
        conn.commit()
        cursor.close()
        
        logger.info(f"Provenance record created with ID: {record_id}")
        
        return {
            'id': record_id,
            'timestamp': timestamp,
            'hash': current_hash,
            'previous_hash': previous_hash
        }
    except Exception as e:
        logger.error(f"Error in log_provenance: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def handler(event, context):
    """Lambda handler function"""
    try:
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