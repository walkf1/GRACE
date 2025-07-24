# GRACE

**G**enerative **R**easoning **A**nd **C**omprehension **E**ngine

## Project Vision

GRACE is a high-trust platform designed to solve the reproducibility crisis in computational science by creating a verifiable, immutable audit trail for research data.

## Project Status

GRACE is being actively developed as an entry for the **Code with Kiro Hackathon**. The long-term vision for this platform is to bridge the gap between innovative technology and academic research by validating its capabilities on real-world scientific data. This work forms the basis of a candidate project for **The Royal Society's Entrepreneur in Residence scheme**.

## Core Features

- **Immutable S3 Ledger**: Creates tamper-proof audit records for all data operations using AWS S3 Object Lock and cryptographic hashing to ensure data integrity and provenance tracking
- **AI-powered Process Plausibility Score**: Leverages machine learning models to assess the likelihood that computational workflows produce scientifically valid results based on established patterns
- **Natural Language Query Agent**: Enables researchers to interact with their data audit trails using conversational queries, making complex provenance information accessible without technical expertise

## High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │   Lambda        │
│   (React)       │◄──►│   + Cognito      │◄──►│   Functions     │
│                 │    │   Authentication │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐             │
                       │   CloudTrail     │◄────────────┘
                       │   Event Stream   │
                       └──────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Uploads       │    │   Audit Handler  │    │   Ledger        │
│   S3 Bucket     │───►│   Lambda         │───►│   S3 Bucket     │
│   (Versioned)   │    │                  │    │   (Object Lock) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The architecture implements an "Immutable S3 Ledger" pattern where:
1. Data uploads trigger CloudTrail events
2. Audit Handler Lambda creates cryptographically-linked audit records
3. Chain Verifier Lambda validates audit trail integrity
4. All audit records are stored with S3 Object Lock for immutability

## Installation

### Backend Deployment

```bash
cd infrastructure
npm install
npm run build
cdk deploy GraceMvpStack GraceApiStack
```

### Frontend Deployment

```bash
cd frontend
npm install
npm start
```

## Usage

1. Upload research data files to the platform
2. Audit records are automatically created with cryptographic verification
3. Use the API or frontend to verify data integrity and provenance
4. Query audit trails using natural language interface

## Contributing

We welcome contributions to GRACE! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get involved.

## Licensing

This project is licensed under AGPL-3.0-only. For use in closed-source or proprietary commercial applications, please contact Frthst for a commercial license.

---

*GRACE is developed as part of the Code with Kiro Hackathon and represents a candidate project for The Royal Society's Entrepreneur in Residence scheme.*