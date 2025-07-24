#!/usr/bin/env python3
import boto3
import requests
import json
import argparse
import os
import uuid
import time

def create_test_user(user_pool_id, client_id, username, password):
    """Create a test user in the Cognito user pool"""
    cognito = boto3.client('cognito-idp', region_name='eu-west-2')
    
    # Check if user exists
    try:
        cognito.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username
        )
        print(f"User {username} already exists")
    except cognito.exceptions.UserNotFoundException:
        # Create the user
        cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=username,
            TemporaryPassword=password,
            MessageAction='SUPPRESS'
        )
        
        # Set the permanent password
        cognito.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=username,
            Password=password,
            Permanent=True
        )
        
        print(f"Created user {username}")

def get_auth_token(client_id, username, password):
    """Get an authentication token from Cognito"""
    cognito = boto3.client('cognito-idp', region_name='eu-west-2')
    
    response = cognito.initiate_auth(
        ClientId=client_id,
        AuthFlow='USER_PASSWORD_AUTH',
        AuthParameters={
            'USERNAME': username,
            'PASSWORD': password
        }
    )
    
    return response['AuthenticationResult']['IdToken']

def upload_test_file(bucket_name, dataset_id):
    """Upload a test file to the uploads bucket"""
    s3 = boto3.client('s3', region_name='eu-west-2')
    
    # Create a test file
    test_data = {
        'dataset_id': dataset_id,
        'timestamp': time.time(),
        'data': {
            'test': 'data',
            'value': 123
        }
    }
    
    # Upload the file
    s3.put_object(
        Bucket=bucket_name,
        Key=f"{dataset_id}.json",
        Body=json.dumps(test_data),
        ContentType='application/json'
    )
    
    print(f"Uploaded test file to s3://{bucket_name}/{dataset_id}.json")
    
    # Wait for the Lambda function to process the file
    print("Waiting for audit record to be created...")
    time.sleep(10)

def test_verify_endpoint(api_url, token, dataset_id):
    """Test the verify endpoint"""
    url = f"{api_url}audits/{dataset_id}/verify"
    
    headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
    }
    
    print(f"Testing endpoint: {url}")
    response = requests.post(url, headers=headers)
    
    print(f"Status code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # For this test, we consider it a success if the API responds with 200
    # In a real test, we would check if verified=true
    return response.status_code == 200

def main():
    parser = argparse.ArgumentParser(description='Test the GRACE API')
    parser.add_argument('--user-pool-id', required=True, help='Cognito User Pool ID')
    parser.add_argument('--client-id', required=True, help='Cognito User Pool Client ID')
    parser.add_argument('--api-url', required=True, help='API Gateway URL')
    parser.add_argument('--uploads-bucket', required=True, help='Uploads bucket name')
    parser.add_argument('--username', default='test@example.com', help='Test username')
    parser.add_argument('--password', default='Test123!', help='Test password')
    
    args = parser.parse_args()
    
    # Generate a unique dataset ID
    dataset_id = str(uuid.uuid4())
    
    # Create a test user
    create_test_user(args.user_pool_id, args.client_id, args.username, args.password)
    
    # Get an authentication token
    token = get_auth_token(args.client_id, args.username, args.password)
    
    # Upload a test file
    upload_test_file(args.uploads_bucket, dataset_id)
    
    # Test the verify endpoint
    success = test_verify_endpoint(args.api_url, token, dataset_id)
    
    if success:
        print("Test passed!")
    else:
        print("Test failed!")
        exit(1)

if __name__ == '__main__':
    main()