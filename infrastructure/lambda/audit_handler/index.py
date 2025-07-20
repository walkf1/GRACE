import json
import os
import boto3
import hashlib
import base64
import datetime
import uuid

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

def get_previous_hash():
    """Get the hash of the last record in the ledger bucket"""
    ledger_bucket = os.environ['LEDGER_BUCKET_NAME']
    
    try:
        # List objects in the ledger bucket
        response = s3_client.list_objects_v2(
            Bucket=ledger_bucket,
            MaxKeys=1,
            OrderBy='LastModified',
            Prefix='audit/'
        )
        
        # Check if we got any objects
        if 'Contents' in response and len(response['Contents']) > 0:
            # Get the latest object
            latest_key = response['Contents'][0]['Key']
            
            # Get the object metadata
            head_response = s3_client.head_object(
                Bucket=ledger_bucket,
                Key=latest_key
            )
            
            # Return the hash from the metadata
            if 'Metadata' in head_response and 'hash' in head_response['Metadata']:
                return head_response['Metadata']['hash']
        
        return None
    except Exception as e:
        print(f"Error getting previous hash: {str(e)}")
        return None

def handler(event, context):
    """Lambda handler function"""
    try:
        # Get the ledger bucket name
        ledger_bucket = os.environ['LEDGER_BUCKET_NAME']
        
        # Process each S3 event
        for record in event['Records']:
            # Extract S3 event data
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            # Get the object metadata
            response = s3_client.head_object(
                Bucket=bucket,
                Key=key
            )
            
            # Create the audit record
            audit_data = {
                'source_bucket': bucket,
                'source_key': key,
                'event_time': record['eventTime'],
                'object_size': response['ContentLength'],
                'object_etag': response['ETag'].strip('"'),
                'event_name': record['eventName'],
                'user_identity': record['userIdentity']['principalId']
            }
            
            # Get the previous hash
            previous_hash = get_previous_hash()
            
            # Calculate the new hash
            current_hash = calculate_hash(audit_data, previous_hash)
            
            # Create a unique ID for the audit record
            record_id = str(uuid.uuid4())
            timestamp = datetime.datetime.now().isoformat()
            
            # Create the audit record JSON
            audit_record = {
                'id': record_id,
                'timestamp': timestamp,
                'data': audit_data,
                'hash': current_hash,
                'previous_hash': previous_hash
            }
            
            # Save the audit record to the ledger bucket
            audit_key = f"audit/{timestamp}-{record_id}.json"
            
            s3_client.put_object(
                Bucket=ledger_bucket,
                Key=audit_key,
                Body=json.dumps(audit_record),
                ContentType='application/json',
                Metadata={
                    'hash': current_hash,
                    'previous_hash': previous_hash if previous_hash else ''
                },
                ObjectLockRetainUntilDate=datetime.datetime.now() + datetime.timedelta(days=365),
                ObjectLockMode='GOVERNANCE',
                ObjectLockLegalHoldStatus='OFF'
            )
            
            print(f"Audit record created: {audit_key}")
        
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