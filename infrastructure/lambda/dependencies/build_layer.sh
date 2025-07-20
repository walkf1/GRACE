#!/bin/bash
# Script to build the dependencies layer for the Lambda function

# Create the python directory if it doesn't exist
mkdir -p python

# Install the dependencies from requirements.txt into the python directory
python3 -m pip install -r ../db-init/requirements.txt -t python/

echo "Dependencies installed successfully in the python directory"