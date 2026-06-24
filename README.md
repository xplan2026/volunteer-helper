# 志愿填报助手 🎯

重庆市高考志愿填报私人辅助工具。

## 使用场景

- 考生分数：513（物理类，超一本线 17 分）
- 意向专业：生物工程、中医学、铁路/轨道交通、电力/电气工程
- 意向城市：重庆、四川、湖北、江苏
- 截止日期：2025年6月30日

## 功能

| 功能 | 说明 |
|------|------|
| 📊 数据总览 | 分数、位次、省控线、倒计时 |
| 🏫 院校推荐 | 按专业/城市/策略筛选学校 |
| 📋 志愿方案 | 自动生成冲-稳-保三段推荐 |
| ⚖️ 对比工具 | 横向对比多个选择项 |

## 部署

### Cloudflare Pages + GitHub Pages

1. 推送此仓库到 `github.com/xplan2026/volunteer-helper`
2. Cloudflare Pages 连接 GitHub 仓库
3. 设置自定义域名（可选）
4. 站点纯静态，零后端

### 访问控制

网站使用前端密码验证，密码设置在 `assets/config.js` 中。

## 数据维护

- 录取数据：编辑 `assets/config.js` 中 `CONFIG.schools` 数组
- 考生信息：同上，修改 `CONFIG.student`
- 专业/城市偏好：修改 `CONFIG.majors` / `CONFIG.cities`

## 技术栈

- 纯静态 HTML + CSS + JavaScript
- 无第三方依赖
- Cloudflare Pages / GitHub Pages 部署
- 前端密码验证
