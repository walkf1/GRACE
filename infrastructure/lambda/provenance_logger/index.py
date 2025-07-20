import json
import os
import boto3
import hashlib
import base64
import datetime

# Initialize AWS clients
secretsmanager = boto3.client('secretsmanager')

def log_to_cloudwatch(message):
    """Log a message to CloudWatch"""
    print(json.dumps(message))

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

def log_provenance(event_data):
    """Log provenance data with cryptographic chaining"""
    # Use a fixed value for previous_hash in this simplified version
    previous_hash = "0" * 64
    
    # Calculate the new hash
    current_hash = calculate_hash(event_data, previous_hash)
    
    # Create the record
    timestamp = datetime.datetime.now().isoformat()
    record = {
        'timestamp': timestamp,
        'event_data': event_data,
        'hash': current_hash,
        'previous_hash': previous_hash
    }
    
    # Log the record to CloudWatch
    log_to_cloudwatch(record)
    
    return {
        'timestamp': timestamp,
        'hash': current_hash
    }

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
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error logging provenance',
                'error': str(e)
            })
        }