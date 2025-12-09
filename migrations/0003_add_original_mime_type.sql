-- Add original_mime_type column to edits table to preserve original file format for downloads
ALTER TABLE edits ADD COLUMN original_mime_type text DEFAULT 'image/jpeg';
