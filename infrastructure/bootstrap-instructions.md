# CDK Bootstrap Instructions

To properly bootstrap AWS CDK in your account, follow these steps:

## 1. Create an IAM Policy

```bash
aws iam create-policy \
  --policy-name GraceCdkBootstrapPolicy \
  --policy-document file://cdk-bootstrap-permissions.json
```

## 2. Attach the Policy to Your User

```bash
aws iam attach-user-policy \
  --user-name grace-kirocomp-user \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/GraceCdkBootstrapPolicy
```

## 3. Bootstrap CDK

```bash
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/eu-west-2
```

## 4. Deploy the Stack

```bash
npx cdk deploy --all
```

## Alternative: Use AWS CloudShell

If you don't want to modify IAM permissions, you can use AWS CloudShell which has the necessary permissions:

1. Log in to the AWS Console
2. Open CloudShell
3. Clone your repository
4. Run the bootstrap and deploy commands

## Note on Current Implementation

Until CDK bootstrapping is resolved, we're using direct AWS CLI commands to manage resources as implemented in:

- `create-s3-bucket.sh`: Creates the S3 bucket
- `update-s3-policy.sh`: Updates the bucket's environment and removal policy

These scripts implement the configurable removal policy using bucket tags:
- For production: `RemovalPolicy: RETAIN`
- For development: `RemovalPolicy: DESTROY`