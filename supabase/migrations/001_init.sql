-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 笔记分块向量表
CREATE TABLE IF NOT EXISTS note_chunks (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  notebook    TEXT NOT NULL DEFAULT '',
  section     TEXT NOT NULL DEFAULT '',
  page_title  TEXT NOT NULL DEFAULT '',
  page_id     TEXT NOT NULL DEFAULT '',
  page_url    TEXT,
  modified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 向量相似度检索索引（余弦距离）
CREATE INDEX IF NOT EXISTS idx_note_chunks_embedding
  ON note_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 按 page_id 查旧数据用
CREATE INDEX IF NOT EXISTS idx_note_chunks_page_id
  ON note_chunks (page_id);

-- 启用行级安全
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问（云函数用）
CREATE POLICY "service_role_all" ON note_chunks
  FOR ALL USING (true);
