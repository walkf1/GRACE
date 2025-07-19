const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  
  try {
    if (event.RequestType === 'Delete') {
      return await sendResponse(event, context, 'SUCCESS', {});
    }
    
    const bucketName = event.ResourceProperties.BucketName;
    const isProduction = event.ResourceProperties.IsProduction === 'true';
    const removalPolicy = isProduction ? 'RETAIN' : 'DESTROY';
    const environment = isProduction ? 'production' : 'development';
    
    // Update the bucket tags
    await s3.putBucketTagging({
      Bucket: bucketName,
      Tagging: {
        TagSet: [
          { Key: 'Project', Value: 'GRACE' },
          { Key: 'Environment', Value: environment },
          { Key: 'RemovalPolicy', Value: removalPolicy },
          { Key: 'ManagedBy', Value: 'CDK' }
        ]
      }
    }).promise();
    
    return await sendResponse(event, context, 'SUCCESS', {
      BucketName: bucketName,
      RemovalPolicy: removalPolicy,
      Environment: environment
    });
  } catch (error) {
    console.error('Error:', error);
    return await sendResponse(event, context, 'FAILED', {});
  }
};

async function sendResponse(event, context, responseStatus, responseData) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });
  
  console.log('Response body:', responseBody);
  
  const https = require('https');
  const url = require('url');
  
  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length
    }
  };
  
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log('Status code:', response.statusCode);
      resolve(responseData);
    });
    
    request.on('error', (error) => {
      console.log('send:', error);
      reject(error);
    });
    
    request.write(responseBody);
    request.end();
  });
}