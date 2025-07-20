# Lambda Dependencies Layer

This directory contains the structure for the Lambda dependencies layer.

## Manual Setup Instructions

To manually create the dependencies layer:

1. Create a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install the dependencies:
   ```bash
   pip install -r ../db-init/requirements.txt -t python/
   ```

3. The layer structure should be:
   ```
   python/
   ├── psycopg2/
   ├── psycopg2_binary.libs/
   └── ...
   ```

4. Deactivate the virtual environment:
   ```bash
   deactivate
   ```

## Alternative: Use a pre-built layer

For psycopg2-binary, you can also use a pre-built AWS Lambda layer ARN in your region.