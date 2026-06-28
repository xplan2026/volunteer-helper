# Supabase 改造方案

## 概述

将志愿填报助手从纯静态 localStorage + 手动文件下载的本地模式，改造为 Supabase PostgreSQL 云端数据库模式，实现数据在线持久化与多设备同步。

## 改造背景

### 原有问题
- 数据存储在浏览器 localStorage 中，清缓存即丢失
- 每次选择学校后需手动下载 JSON 文件再上传替换，操作繁琐
- 无法跨设备同步数据
- GitHub Pages 纯静态托管，不支持 SQLite 等本地数据库

### 为什么选 Supabase
- **免费额度充足**：500MB 数据库 + 5GB 带宽/月，个人使用完全够
- **前端直连**：通过 anon key 直接从浏览器 JS SDK 访问，无需自建后端
- **PostgreSQL 兼容**：支持关系查询、索引、RLS 策略
- **与 GitHub Pages 完美兼容**：纯静态托管 + 云端数据库，无需服务器

## 架构设计

```
┌─────────────────────┐     ┌──────────────────┐
│   GitHub Pages       │     │   Supabase        │
│                      │     │                   │
│  index.html          │────▶│  PostgreSQL        │
│  assets/app.js       │ anon│  ┌─────────────┐  │
│  assets/supabase-    │ key │  │ volunteer_   │  │
│    client.js         │     │  │   plans      │  │
│                      │     │  ├─────────────┤  │
│  (静态前端)          │     │  │ volunteer_   │  │
│                      │     │  │   settings   │  │
│  Fallback:           │     │  ├─────────────┤  │
│  localStorage        │     │  │ ...          │  │
│                      │     │  └─────────────┘  │
└─────────────────────┘     └──────────────────┘
```

### 数据流
1. 用户操作 → `app.js` 调用 `SupabaseAPI` → Supabase PostgreSQL
2. 若 Supabase 不可用 → 自动回退 `localStorage` → 不影响基本使用
3. Supabase 优先，localStorage 作为离线缓存和备份

## 数据库表设计

| 表名 | 用途 | 主键 |
|------|------|------|
| `volunteer_plans` | 志愿方案存储 | `id` (UUID) |
| `volunteer_settings` | 用户筛选设置（单行） | `id` (固定=1) |
| `volunteer_ratio_edits` | 投档率手动编辑 | `key` (school_code\|specialty_code) |
| `all_schools_checked` | "所有可选学校"页面勾选状态 | `key` |
| `volunteer_plan_checked` | "筛选方案"页面勾选状态 | `key` |
| `selectable_schools` | 已选学校列表 | `school_code, specialty_code` |
| `available_schools` | 备选学校列表（源数据） | `school_code, specialty_code` |

### 索引

```sql
CREATE INDEX idx_plans_updated ON volunteer_plans (updated_at DESC);
CREATE INDEX idx_available_school_name ON available_schools (school_name);
CREATE INDEX idx_available_specialty ON available_schools (specialty_name);
CREATE INDEX idx_available_score ON available_schools (min_score DESC);
```

### RLS 策略

所有表使用宽松策略 `FOR ALL USING (true) WITH CHECK (true)`，实际安全性依赖前端密码验证层。

> ⚠️ 注意：anon key 可被任何人从浏览器获取，因此 RLS 不限制访问。真正敏感的数据应使用 Service Role Key 在后端操作。

## 前端改造

### 新增文件

| 文件 | 说明 |
|------|------|
| `assets/supabase-client.js` | Supabase API 封装层，提供 `SupabaseAPI` 全局对象 |
| `supabase/schema.sql` | 数据库 DDL 建表脚本 |
| `supabase/import_data.js` | Node.js 数据导入脚本 |
| `docs/supabase改造方案.md` | 本方案文档 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `index.html` | 引入 Supabase CDN SDK + supabase-client.js |
| `assets/app.js` | 所有数据读写改为 async，优先 Supabase，回退 localStorage |
| `README.md` | 新增 Supabase 部署说明 |

### supabase-client.js 架构

```js
// 配置从 .env 引入，构建时注入
const SUPABASE_CONFIG = {
  url: '<SUPABASE_URL>',
  anonKey: '<SUPABASE_ANON_KEY>'
};

// 单例模式
function getSupabase() { ... }

// API 对象
const SupabaseAPI = {
  isAvailable(),
  getAvailableSchools(filters),
  removeFromAvailable(keys),
  getSelectableSchools(),
  addSelectableSchools(schools),
  getCheckedState(table),
  setCheckedState(table, checkedMap),
  getRatioEdits(),
  setRatioEdit(key, ratio),
  getSettings(),
  saveSettings(data),
  getPlans(),
  savePlan(plan),
  deletePlan(id),
  getSpecialties()
};
```

### 渐进增强模式

所有数据操作遵循以下模式：

```js
async function someDataOperation() {
  // 1. 优先尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      const result = await SupabaseAPI.someMethod();
      if (result !== null) { /* 成功 */ return; }
    } catch(e) { console.warn('Supabase 操作失败，回退:', e); }
  }
  // 2. 回退到 localStorage
  localStorage.setItem('key', JSON.stringify(data));
}
```

## 部署步骤

### 1. 创建 Supabase 项目
- 访问 [supabase.com](https://supabase.com) 注册/登录
- 创建新项目，记下 `Project URL` 和 `anon public key`

### 2. 执行建表脚本
- 在 Supabase Dashboard → SQL Editor
- 粘贴并执行 `supabase/schema.sql`

### 3. 导入初始数据
```bash
# 设置环境变量
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_KEY=your_service_role_key

# 安装依赖并运行
npm install @supabase/supabase-js
node supabase/import_data.js
```

### 4. 配置环境变量
在项目根目录 `.env` 文件中配置：
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 5. 部署前端
构建时需将 `.env` 中的变量注入到 `assets/supabase-client.js` 中。

对于 GitHub Pages，推荐使用 GitHub Actions 在构建时替换占位符，或使用 `.env` 文件 + 构建工具（如 Vite/webpack）注入环境变量。

## 安全考量

1. **前端密码验证层**：所有页面操作需先通过密码验证（cookie-based session）
2. **anon key 暴露风险**：anon key 会出现在浏览器网络请求中，这是 Supabase 设计的预期行为
3. **RLS 策略**：当前使用宽松策略，若需要更严格的安全，可按用户 ID 限制行访问
4. **数据备份**：前端仍保留 localStorage 写入作为离线缓存，并支持手动导出 JSON

## 与 localStorage 模式的对比

| 特性 | localStorage | Supabase |
|------|-------------|----------|
| 数据持久性 | 清缓存即丢失 | 永久存储 |
| 跨设备同步 | ❌ | ✅ |
| 数据量限制 | ~5MB | 500MB |
| 查询能力 | 全量遍历 | SQL 查询+索引 |
| 离线可用 | ✅ | ❌（有 localStorage 回退） |
| 部署复杂度 | 零配置 | 需创建 Supabase 项目 |
| 费用 | 免费 | 免费额度内免费 |

## 兼容性

- 浏览器需支持 ES6+（async/await, fetch）
- Supabase JS SDK v2 通过 CDN 加载
- 若 CDN 加载失败或 Supabase 不可用，自动降级为 localStorage 模式
- 两个模式的数据格式完全兼容
