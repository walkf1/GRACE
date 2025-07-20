-- Initialize the audit schema for GRACE
-- This script creates the necessary tables for the tamper-evident audit trail

-- Create the audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Create the audit_records table with cryptographic chaining support
CREATE TABLE IF NOT EXISTS audit.records (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  previous_hash VARCHAR(64),
  record_hash VARCHAR(64) NOT NULL,
  signature VARCHAR(512) NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit.records(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit.records(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit.records(action);

-- Create a view for audit verification
CREATE OR REPLACE VIEW audit.chain_verification AS
SELECT 
  a.id,
  a.timestamp,
  a.user_id,
  a.action,
  a.resource_id,
  a.record_hash,
  a.previous_hash,
  b.record_hash AS expected_previous_hash,
  CASE 
    WHEN a.previous_hash = b.record_hash OR (a.previous_hash IS NULL AND b.id IS NULL) 
    THEN 'VALID' 
    ELSE 'INVALID' 
  END AS chain_status
FROM audit.records a
LEFT JOIN audit.records b ON b.id = a.id - 1
ORDER BY a.id;

-- Create a function to verify the entire chain
CREATE OR REPLACE FUNCTION audit.verify_chain()
RETURNS TABLE (
  valid BOOLEAN,
  total_records BIGINT,
  valid_records BIGINT,
  invalid_records BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (COUNT(*) = SUM(CASE WHEN chain_status = 'VALID' THEN 1 ELSE 0 END)) AS valid,
    COUNT(*) AS total_records,
    SUM(CASE WHEN chain_status = 'VALID' THEN 1 ELSE 0 END) AS valid_records,
    SUM(CASE WHEN chain_status = 'INVALID' THEN 1 ELSE 0 END) AS invalid_records
  FROM audit.chain_verification;
END;
$$ LANGUAGE plpgsql;