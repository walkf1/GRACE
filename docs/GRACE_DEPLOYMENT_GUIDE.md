# GRACE Deployment Guide

This guide provides step-by-step instructions for setting up and deploying the GRACE project with global availability using AWS Amplify and CloudFront.

## Prerequisites

1. **AWS Account Setup**
   - Configured AWS CLI with the "grace" profile
   - IAM user with appropriate permissions

2. **Development Environment**
   - Node.js and npm installed
   - AWS Amplify CLI installed
   - Git for version control

## Installation Steps

### 1. Install Required Tools

```bash
# Install Node.js and npm (using Homebrew on macOS)
brew install node

# Install AWS Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify CLI with AWS profile
amplify configure
```

### 2. Initialize Amplify Project

```bash
# Navigate to project directory
cd /Users/walkf1/Documents/GRACE

# Initialize Amplify
amplify init

# When prompted:
# - Enter a name for the project: grace
# - Enter a name for the environment: dev
# - Choose your default editor
# - Choose the type of app: javascript
# - Choose the framework: react
# - Source directory path: src
# - Distribution directory path: build
# - Build command: npm run build
# - Start command: npm start
# - Select the AWS profile to use: grace
```

### 3. Add Authentication (Optional)

```bash
amplify add auth

# Choose default configuration or customize as needed
```

### 4. Add API (GraphQL or REST)

```bash
amplify add api

# For GraphQL:
# - Select GraphQL
# - Provide API name: graceapi
# - Choose authorization type
# - Choose schema template or provide custom schema
```

### 5. Add Storage (If Needed)

```bash
amplify add storage

# Choose between S3 (content) or DynamoDB (database)
# Configure access permissions
```

### 6. Add Hosting with CloudFront

```bash
amplify add hosting

# Select "Hosting with Amplify Console"
# Choose "Continuous deployment"
# Connect to your GitHub repository when prompted
```

### 7. Add AI/ML Capabilities

```bash
amplify add predictions

# Choose capabilities:
# - Identify text
# - Identify entities
# - Convert speech to text
# - Convert text to speech
# - Interpret text
# - Custom model inference
```

### 8. Deploy Your Application

```bash
# Push all configured resources to the cloud
amplify push

# Publish the application (frontend + backend)
amplify publish
```

## Verification Steps

1. **Verify CloudFront Distribution**
   ```bash
   aws cloudfront list-distributions --profile grace
   ```

2. **Test Global Access**
   - Use tools like [Pingdom](https://tools.pingdom.com) to test from different locations
   - Verify low latency access from both UK and US regions

3. **Monitor Performance**
   ```bash
   # Set up CloudWatch dashboard
   aws cloudwatch get-dashboard --dashboard-name GraceMonitoring --profile grace
   ```

## Common Issues and Troubleshooting

1. **Deployment Failures**
   - Check CloudFormation logs in the AWS Console
   - Run `amplify status` to see resource status

2. **Performance Issues**
   - Verify CloudFront cache settings
   - Check for API throttling or Lambda cold starts

3. **Permission Problems**
   - Review IAM roles created by Amplify
   - Check resource policies for S3 buckets and APIs

## Maintenance and Updates

1. **Update Amplify Project**
   ```bash
   amplify update [resource-name]
   ```

2. **Pull Latest Backend Environment**
   ```bash
   amplify pull
   ```

3. **Add New Features**
   ```bash
   amplify add [category]
   ```

## Cost Management

1. **Monitor Costs**
   - Set up AWS Budgets for the project
   - Use Cost Explorer to analyze spending

2. **Optimize Resources**
   - Review and adjust provisioned capacity
   - Implement lifecycle policies for S3
   - Configure TTL for DynamoDB items

## Security Best Practices

1. **Regular Updates**
   ```bash
   npm audit fix
   amplify update
   ```

2. **Access Reviews**
   - Periodically review IAM permissions
   - Rotate access keys

3. **Enable Monitoring**
   ```bash
   amplify add monitoring
   ```

## Conclusion

Following this deployment guide will establish a globally available infrastructure for the GRACE project, optimized for both development in the UK and access from the US for judging purposes.