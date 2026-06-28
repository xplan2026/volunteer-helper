# 志愿填报助手

重庆市高考志愿填报私人辅助工具，面向物理类考生，基于等位分筛选推荐学校。

## 核心功能

以考生分数（默认 513 分，特殊类型资格线 496 分）为基准，结合等位分换算，从 2025 年投档线数据中智能筛选可报考的学校与专业。

### 筛选逻辑

1. **分数范围**：等位分区间 479~529 分（基准分 -30 ~ +20），可在首页「筛选条件」中调整
2. **剔除地区**：默认排除西藏、内蒙、山西、河南、河北、湖南、广西、贵州、上海、安徽
3. **投档比上限**：默认 103%，排除退档风险高的学校
4. **专业限定**：默认聚焦生物工程、制药工程、通信工程、材料科学与工程、铁路相关专业

### 筛选策略（冲/稳/保）

基于等位分差值自动划分策略：

| 策略 | 条件 | 含义 |
|------|------|------|
| 🚀 冲刺 | 学校最低分 > 等位分 + 5 | 需要超常发挥，机会较小 |
| ⚖️ 稳妥 | 等位分 - 5 ≤ 最低分 ≤ 等位分 + 5 | 正常发挥有望录取 |
| 🛡️ 保底 | 最低分 < 等位分 - 5 | 基本确保录取 |

## 页面说明

所有功能集成在 `index.html` 单页应用中，通过左侧导航切换：

| 页面 | 说明 |
|------|------|
| 📊 总览 | 显示考生信息、筛选条件设置、项目目录结构、参考资料链接 |
| 📋 所有可选学校 | 浏览全部 2849 条可选学校数据，支持按专业/学校名/勾选状态筛选，勾选后保存到可选列表 |
| 📝 筛选方案 | 基于筛选条件展示推荐学校列表，勾选心仪学校并调整排序，支持导出 TXT |
| 📋 志愿方案 | 从已保存的方案按冲/稳/保三段展示，支持导出最终志愿方案 |

## 数据文件

| 文件 | 说明 |
|------|------|
| `data_bak/all_selectable_schools.json` | 经地区剔除后的全部可选学校（2849 条，已迁移到 Supabase） |
| `data_bak/available_selectable_schools.json` | 备选学校 = all 排除 selected 的差集（2775 条，已迁移到 Supabase） |
| `data_bak/selectable_schools.json` | 已选学校（已迁移到 Supabase） |
| `data_bak/selectable_schools.js` | 同上，JS 格式（已迁移到 Supabase） |
| `data_bak/DATA_RESOURCE_BAK.tar.gz` | 原始数据与中间步骤备份 |

## 使用流程

1. 打开页面，输入密码登录
2. 在「总览」页确认/调整筛选条件（剔除地区、投档比、分数范围、专业）
3. 进入「所有可选学校」浏览全部可选数据，勾选感兴趣的学校，点击保存
4. 进入「筛选方案」查看推荐列表，进一步勾选并调整排序，保存方案
5. 进入「志愿方案」查看冲/稳/保三段志愿分布，导出最终方案

## 部署

### Cloudflare Pages + GitHub Pages（静态模式）

1. 推送此仓库到 `github.com/xplan2026/volunteer-helper`
2. Cloudflare Pages 连接 GitHub 仓库
3. 设置自定义域名（可选）

### Supabase 云同步（可选增强）

启用后数据将自动同步到云端，多设备共享，无需手动导出/导入：

1. 在 [supabase.com](https://supabase.com) 创建免费项目，获取 `Project URL` 和 `anon public key`
2. 在 Supabase SQL Editor 中执行 `supabase/schema.sql` 建表
3. 在项目根目录 `.env` 文件中配置：
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```
4. 运行数据导入脚本：
   ```bash
   npm install @supabase/supabase-js
   node supabase/import_data.js
   ```
5. **环境变量注入**：前端 JS 无法直接读取 `.env`，需在构建/部署时注入：
   - **GitHub Actions**：在 workflow 中将 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 替换 `index.html` 中的 `<SUPABASE_URL>` / `<SUPABASE_ANON_KEY>` 占位符
   - **本地测试**：手动将 `index.html` 中的占位符替换为实际值，或将 `supabase-client.js` 中的兜底值替换为实际值
6. 部署后页面自动检测 Supabase，优先使用云端存储，不可用时回退 localStorage

> 详细方案见 [docs/supabase改造方案.md](docs/supabase改造方案.md)

### 访问控制

网站使用前端密码验证，密码设置在 `assets/config.js` 中（考生信息），`assets/app.js` 中验证。
