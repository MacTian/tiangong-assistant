-- supabase/migrations/002_rpc.sql

CREATE OR REPLACE FUNCTION search_note_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  notebook text,
  section text,
  page_title text,
  page_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.content,
    nc.notebook,
    nc.section,
    nc.page_title,
    nc.page_url,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM note_chunks nc
  WHERE 1 - (nc.embedding <=> query_embedding) > match_threshold
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
