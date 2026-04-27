-- Enable pgvector extension (run in Supabase SQL Editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to document_chunks table
-- Google text-embedding-004 produces 768-dimensional vectors
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search for similar document chunks
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  document_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.document_id,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
