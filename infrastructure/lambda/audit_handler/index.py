import json
import os
import boto3
import hashlib
import base64
import time
from datetime import datetime

# Initialize AWS clients
s3_client = boto3.client('s3')

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

def get_latest_hash(bucket_name, dataset_id):
    """Get the latest hash for a dataset"""
    try:
        # List all audit records for the dataset
        prefix = f"audit/{dataset_id}/"
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return None
        
        # Sort records by timestamp (assuming timestamp is part of the key)
        records = sorted(response['Contents'], key=lambda x: x['Key'], reverse=True)
        
        # Get the latest record
        latest_record = s3_client.get_object(
            Bucket=bucket_name,
            Key=records[0]['Key']
        )
        
        # Parse the record
        audit_record = json.loads(latest_record['Body'].read().decode('utf-8'))
        
        return audit_record.get('hash')
    
    except Exception as e:
        print(f"Error getting latest hash: {str(e)}")
        return None

def extract_dataset_id(key):
    """Extract dataset ID from the object key"""
    # This is a simple implementation - adjust based on your naming convention
    filename = key.split('/')[-1]
    if '.' in filename:
        return filename.split('.')[0]
    return filename

def handler(event, context):
    """Lambda handler function"""
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # Get the ledger bucket name from environment variables
        ledger_bucket = os.environ['LEDGER_BUCKET_NAME']
        
        # Process each record in the event
        for record in event['Records']:
            # Get the bucket and key from the record
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            print(f"Processing file: s3://{bucket}/{key}")
            
            # Extract dataset ID from the key
            dataset_id = extract_dataset_id(key)
            
            # Get the object
            response = s3_client.get_object(
                Bucket=bucket,
                Key=key
            )
            
            # Read the object content
            content = response['Body'].read().decode('utf-8')
            
            # Try to parse as JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                # If not JSON, create a simple metadata object
                data = {
                    'filename': key,
                    'content_type': response.get('ContentType', 'application/octet-stream'),
                    'size': response.get('ContentLength', 0)
                }
            
            # Get the latest hash for this dataset
            previous_hash = get_latest_hash(ledger_bucket, dataset_id)
            
            # Create audit record
            timestamp = datetime.utcnow().isoformat()
            audit_record = {
                'dataset_id': dataset_id,
                'timestamp': timestamp,
                'source': {
                    'bucket': bucket,
                    'key': key
                },
                'data': data,
                'previous_hash': previous_hash
            }
            
            # Calculate hash
            hash_value = calculate_hash(data, previous_hash)
            audit_record['hash'] = hash_value
            
            # Store the audit record in the ledger bucket
            audit_key = f"audit/{dataset_id}/{timestamp}-{hash_value}.json"
            s3_client.put_object(
                Bucket=ledger_bucket,
                Key=audit_key,
                Body=json.dumps(audit_record),
                ContentType='application/json'
            )
            
            print(f"Created audit record: s3://{ledger_bucket}/{audit_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Audit records created successfully'
            })
        }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error creating audit records',
                'error': str(e)
            })
        }