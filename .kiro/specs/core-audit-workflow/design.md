# Core Audit Workflow Technical Design

## System Architecture Overview

The GRACE system implements a globally distributed architecture with a clear separation between static content delivery and dynamic data processing. The architecture follows these key principles:

1. Static content is served globally via CloudFront
2. Dynamic data is processed in the eu-west-2 (London) region
3. API Gateway with Lambda Proxy Integration handles all API requests
4. Step Functions orchestrate the audit workflow
5. React is used for the frontend application

## Component Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  CloudFront     │────▶│  S3 Bucket      │     │  API Gateway    │
│  Distribution   │     │  (Static Assets)│     │  (REST API)     │
│                 │     │                 │     │                 │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         │                                               │
         │                                               ▼
┌────────▼────────┐                           ┌─────────────────┐
│                 │                           │                 │
│  React          │                           │  Lambda         │
│  Application    │                           │  Functions      │
│  (Browser)      │                           │                 │
│                 │                           └────────┬────────┘
└────────┬────────┘                                    │
         │                                             │
         │                                             ▼
         │                                   ┌─────────────────┐
         │                                   │                 │
         └──────────────────────────────────▶│  Step Functions │
                                             │  (Workflow)     │
                                             │                 │
                                             └────────┬────────┘
                                                      │
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │                 │
                                            │  Aurora         │
                                            │  PostgreSQL     │
                                            │  (Audit Records)│
                                            │                 │
                                            └─────────────────┘
```

## Data Flow

1. **Static Content Delivery**:
   - User requests the GRACE application
   - CloudFront serves static assets (HTML, CSS, JS) from the nearest edge location
   - React application loads in the user's browser

2. **Dynamic Data Flow**:
   - React application makes API calls to API Gateway endpoints
   - API Gateway routes requests to appropriate Lambda functions
   - Lambda functions process requests and interact with backend services
   - Results are returned to the user via the same path

3. **Audit Workflow**:
   - User initiates an audit request via the React UI
   - Request is sent to API Gateway endpoint
   - Lambda function validates the request and starts a Step Functions execution
   - Step Functions orchestrate the audit workflow
   - Results are stored in Aurora PostgreSQL with cryptographic chaining
   - User is notified when the audit is complete

## API Design

### REST API Endpoints

| Endpoint                   | Method | Description                           | Auth Required |
|----------------------------|--------|---------------------------------------|--------------|
| /api/audits                | POST   | Create a new audit request            | Yes          |
| /api/audits                | GET    | List all audits for the current user  | Yes          |
| /api/audits/{id}           | GET    | Get details of a specific audit       | Yes          |
| /api/audits/{id}/status    | GET    | Check the status of an audit          | Yes          |
| /api/audits/{id}/results   | GET    | Get the results of a completed audit  | Yes          |

### API Gateway Configuration

- REST API with regional endpoint in eu-west-2
- Lambda Proxy Integration for all routes
- Cognito User Pool authorizer
- API key for rate limiting
- CORS enabled for frontend access

## Step Functions Workflow

```
Start
  │
  ▼
┌─────────────────┐
│ Validate        │
│ Audit Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process         │
│ Input Data      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify          │
│ Data Integrity  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute         │
│ Audit Logic     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │
│ Audit Report    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store Results   │
│ in PostgreSQL   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Notify User     │
└────────┬────────┘
         │
         ▼
       End
```

## Frontend Architecture

### React Component Structure

```
App
├── AuthProvider
│   └── PrivateRoute
├── Layout
│   ├── Header
│   ├── Sidebar
│   └── Footer
├── Pages
│   ├── Dashboard
│   ├── AuditRequest
│   ├── AuditList
│   └── AuditDetail
└── Components
    ├── AuditForm
    ├── StatusIndicator
    ├── ResultsViewer
    └── Notifications
```

### State Management

- React Context API for global state
- Local component state for UI-specific state
- API service modules for data fetching

## Security Implementation

1. **Authentication**:
   - Amazon Cognito User Pools for user management
   - JWT tokens for API authorization
   - Refresh token rotation

2. **Authorization**:
   - IAM roles for Lambda execution
   - Resource-based policies for Step Functions
   - Attribute-based access control for audit results

3. **Data Protection**:
   - TLS 1.2+ for all API communications
   - Server-side encryption for PostgreSQL data
   - Client-side encryption for sensitive user inputs
   - Application-level cryptographic chaining for audit records to ensure immutability

## Deployment Strategy

1. **Infrastructure Deployment**:
   - AWS CDK for infrastructure as code
   - Separate stacks for frontend and backend resources
   - Environment-specific configurations

2. **CI/CD Pipeline**:
   - AWS Amplify for frontend deployment
   - CodePipeline for backend deployment
   - Automated testing at each stage

## Future Improvements

1. **Advanced Caching**:
   - Implement API response caching
   - Add Redis cache for frequently accessed data
   - Optimize CloudFront cache behaviors

2. **Performance Optimizations**:
   - Implement Lambda provisioned concurrency
   - Add DynamoDB accelerator (DAX)
   - Optimize React bundle size