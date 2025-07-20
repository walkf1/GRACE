import json
import os
import boto3
import psycopg2
import hashlib
import base64
import datetime

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

def log_provenance(conn, event_data):
    """Log provenance data to the database with cryptographic chaining"""
    cursor = conn.cursor()
    
    # Get the last hash from the database (if any)
    cursor.execute("SELECT hash FROM audit_records ORDER BY timestamp DESC LIMIT 1")
    result = cursor.fetchone()
    previous_hash = result[0] if result else None
    
    # Calculate the new hash
    current_hash = calculate_hash(event_data, previous_hash)
    
    # Insert the record
    timestamp = datetime.datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO audit_records (timestamp, event_data, hash, previous_hash) VALUES (%s, %s, %s, %s)",
        (timestamp, json.dumps(event_data), current_hash, previous_hash)
    )
    
    conn.commit()
    cursor.close()
    
    return {
        'timestamp': timestamp,
        'hash': current_hash
    }

def handler(event, context):
    """Lambda handler function"""
    try:
        # Connect to the database
        conn = get_db_connection()
        
        # Process the event
        result = log_provenance(conn, event)
        
        # Close the connection
        conn.close()
        
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