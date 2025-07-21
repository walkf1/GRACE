import json
import os
import boto3
import hashlib
import base64
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

def verify_chain(dataset_id):
    """Verify the integrity of the audit chain for a given dataset"""
    ledger_bucket = os.environ['LEDGER_BUCKET_NAME']
    
    try:
        # List all audit records for the dataset
        prefix = f"audit/{dataset_id}/"
        response = s3_client.list_objects_v2(
            Bucket=ledger_bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return {
                'verified': False,
                'error': f"No audit records found for dataset {dataset_id}"
            }
        
        # Sort records by timestamp (assuming timestamp is part of the key)
        records = sorted(response['Contents'], key=lambda x: x['Key'])
        
        # Verify the chain
        previous_hash = None
        verified_records = []
        
        for record in records:
            # Get the record
            obj = s3_client.get_object(
                Bucket=ledger_bucket,
                Key=record['Key']
            )
            
            # Parse the record
            audit_record = json.loads(obj['Body'].read().decode('utf-8'))
            
            # Get the stored hash and previous hash
            stored_hash = audit_record.get('hash')
            stored_previous_hash = audit_record.get('previous_hash')
            
            # Verify previous hash matches
            if previous_hash != stored_previous_hash:
                return {
                    'verified': False,
                    'error': f"Chain broken at record {record['Key']}. Expected previous hash {previous_hash}, got {stored_previous_hash}"
                }
            
            # Calculate the hash
            calculated_hash = calculate_hash(audit_record['data'], previous_hash)
            
            # Verify the hash
            if calculated_hash != stored_hash:
                return {
                    'verified': False,
                    'error': f"Hash mismatch at record {record['Key']}. Expected {stored_hash}, calculated {calculated_hash}"
                }
            
            # Update previous hash for next iteration
            previous_hash = stored_hash
            
            # Add to verified records
            verified_records.append({
                'key': record['Key'],
                'timestamp': audit_record.get('timestamp'),
                'hash': stored_hash
            })
        
        return {
            'verified': True,
            'dataset_id': dataset_id,
            'record_count': len(verified_records),
            'records': verified_records
        }
    
    except Exception as e:
        return {
            'verified': False,
            'error': str(e)
        }

def handler(event, context):
    """Lambda handler function"""
    try:
        # Extract dataset ID from path parameters
        dataset_id = event['pathParameters']['datasetId']
        
        # Verify the chain
        result = verify_chain(dataset_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'verified': False,
                'error': str(e)
            })
        }