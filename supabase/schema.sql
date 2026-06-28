-- 志愿填报助手 - Supabase 数据库表结构
-- 在 Supabase SQL Editor 中一次性执行此文件即可
-- 包含：建表 → 索引 → RLS 策略

-- ======== 清理旧表（如有） ========
DROP TABLE IF EXISTS volunteer_plan_checked CASCADE;
DROP TABLE IF EXISTS all_schools_checked CASCADE;
DROP TABLE IF EXISTS volunteer_ratio_edits CASCADE;
DROP TABLE IF EXISTS volunteer_settings CASCADE;
DROP TABLE IF EXISTS volunteer_plans CASCADE;
DROP TABLE IF EXISTS selectable_schools CASCADE;
DROP TABLE IF EXISTS available_schools CASCADE;

-- ======== 1. 志愿方案表 ========
CREATE TABLE volunteer_plans (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  name          TEXT NOT NULL DEFAULT '',
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on volunteer_plans" ON volunteer_plans FOR ALL USING (true) WITH CHECK (true);

-- ======== 2. 用户设置表（单行，upsert 模式） ========
CREATE TABLE volunteer_settings (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on volunteer_settings" ON volunteer_settings FOR ALL USING (true) WITH CHECK (true);

-- ======== 3. 投档率编辑表 ========
CREATE TABLE volunteer_ratio_edits (
  key           TEXT PRIMARY KEY,
  ratio         NUMERIC(5,1) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_ratio_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on volunteer_ratio_edits" ON volunteer_ratio_edits FOR ALL USING (true) WITH CHECK (true);

-- ======== 4. 可选学校勾选状态表 ========
CREATE TABLE all_schools_checked (
  key           TEXT PRIMARY KEY,
  checked       BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE all_schools_checked ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on all_schools_checked" ON all_schools_checked FOR ALL USING (true) WITH CHECK (true);

-- ======== 5. 筛选方案勾选状态表 ========
CREATE TABLE volunteer_plan_checked (
  key           TEXT PRIMARY KEY,
  checked       BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE volunteer_plan_checked ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on volunteer_plan_checked" ON volunteer_plan_checked FOR ALL USING (true) WITH CHECK (true);

-- ======== 6. 已选学校表 ========
CREATE TABLE selectable_schools (
  school_code     TEXT NOT NULL,
  school_name     TEXT NOT NULL,
  specialty_code  TEXT NOT NULL,
  specialty_name  TEXT NOT NULL,
  min_score       INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (school_code, specialty_code)
);
ALTER TABLE selectable_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on selectable_schools" ON selectable_schools FOR ALL USING (true) WITH CHECK (true);

-- ======== 7. 备选学校表 ========
CREATE TABLE available_schools (
  school_code     TEXT NOT NULL,
  school_name     TEXT NOT NULL,
  specialty_code  TEXT NOT NULL,
  specialty_name  TEXT NOT NULL,
  min_score       INTEGER NOT NULL,
  ratio           NUMERIC(5,1),
  PRIMARY KEY (school_code, specialty_code)
);
ALTER TABLE available_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on available_schools" ON available_schools FOR ALL USING (true) WITH CHECK (true);

-- ======== 索引 ========
CREATE INDEX idx_plans_updated ON volunteer_plans (updated_at DESC);
CREATE INDEX idx_available_school_name ON available_schools (school_name);
CREATE INDEX idx_available_specialty ON available_schools (specialty_name);
CREATE INDEX idx_available_score ON available_schools (min_score DESC);
