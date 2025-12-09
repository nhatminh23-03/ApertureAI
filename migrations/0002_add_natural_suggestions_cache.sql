-- Add natural_suggestions_json column to edits table to cache Vision Analyst results
ALTER TABLE edits ADD COLUMN natural_suggestions_json text;
