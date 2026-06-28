-- ======== 数据库迁移 v2：新增招生人数 & 特殊要求编辑表 ========
-- 在 Supabase SQL Editor 中执行此文件即可（不删除现有数据）

-- 1. 招生人数编辑表
CREATE TABLE IF NOT EXISTS volunteer_enrollment_edits (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_enrollment_edits ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow all on volunteer_enrollment_edits'
    AND tablename = 'volunteer_enrollment_edits'
  ) THEN
    CREATE POLICY "Allow all on volunteer_enrollment_edits"
    ON volunteer_enrollment_edits FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. 特殊要求编辑表
CREATE TABLE IF NOT EXISTS volunteer_specialreq_edits (
  key           TEXT PRIMARY KEY,
  value         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_specialreq_edits ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow all on volunteer_specialreq_edits'
    AND tablename = 'volunteer_specialreq_edits'
  ) THEN
    CREATE POLICY "Allow all on volunteer_specialreq_edits"
    ON volunteer_specialreq_edits FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 验证
SELECT 'enrollment_edits' AS table_name, count(*) AS rows FROM volunteer_enrollment_edits
UNION ALL
SELECT 'specialreq_edits', count(*) FROM volunteer_specialreq_edits;
