/**
 * 数据导入脚本：将本地 JSON 数据导入 Supabase
 *
 * 使用方法：
 *   1. 先在 Supabase SQL Editor 中执行 supabase/schema.sql 建表
 *   2. 在 .env 中配置 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY
 *   3. npm install @supabase/supabase-js
 *   4. node supabase/import_data.js
 *
 * 注意：需要 Service Role Key（不是 anon key）。
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 从 .env 文件加载配置
const env = {};
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(l => {
    const m = l.match(/^([^#][^=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL.includes('supabase.co')) {
  console.error('❌ SUPABASE_URL 未正确配置，请在 .env 中设置');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 测试所有表的连接
async function testConnection() {
  const tables = [
    'volunteer_plans',
    'volunteer_settings',
    'volunteer_ratio_edits',
    'all_schools_checked',
    'volunteer_plan_checked',
    'selectable_schools',
    'available_schools'
  ];
  let allOk = true;
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${t}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✅ ${t}`);
    }
  }
  return allOk;
}

// 导入备选学校数据
async function importAvailableSchools() {
  const filePath = path.join(__dirname, '..', 'data', 'all_selectable_schools.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`📦 读取到 ${data.length} 条备选学校数据`);

  // 排除已在 selectable_schools.json 中的数据
  const selectedPath = path.join(__dirname, '..', 'data', 'selectable_schools.json');
  let selectedKeys = new Set();
  if (fs.existsSync(selectedPath)) {
    const selected = JSON.parse(fs.readFileSync(selectedPath, 'utf-8'));
    selected.forEach(d => selectedKeys.add(d.school_code + '|' + d.specialty_code));
    console.log(`📋 已有 ${selected.length} 条已选学校，将排除`);
  }

  const rows = data
    .filter(d => !selectedKeys.has(d.school_code + '|' + d.specialty_code))
    .map(d => ({
      school_code: d.school_code,
      school_name: d.school_name,
      specialty_code: d.specialty_code,
      specialty_name: d.specialty_name,
      min_score: d.min_score,
      ratio: d.ratio || null
    }));

  console.log(`📤 准备导入 ${rows.length} 条记录`);

  const BATCH = 500;
  let imported = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('available_schools').upsert(batch, {
      onConflict: 'school_code,specialty_code'
    });
    if (error) {
      console.error(`  ❌ 批次 ${Math.floor(i / BATCH) + 1} 失败:`, error.message);
    } else {
      imported += batch.length;
      console.log(`  ✅ 批次 ${Math.floor(i / BATCH) + 1}: ${batch.length} 条`);
    }
  }
  console.log(`🎉 备选学校导入完成！共 ${imported} 条`);
}

// 导入已选学校数据
async function importSelectableSchools() {
  const filePath = path.join(__dirname, '..', 'data', 'selectable_schools.json');
  if (!fs.existsSync(filePath)) {
    console.log('⚠️ selectable_schools.json 不存在，跳过');
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`📦 读取到 ${data.length} 条已选学校数据`);

  const rows = data.map(d => ({
    school_code: d.school_code,
    school_name: d.school_name,
    specialty_code: d.specialty_code,
    specialty_name: d.specialty_name,
    min_score: d.min_score
  }));

  const BATCH = 500;
  let imported = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('selectable_schools').upsert(batch, {
      onConflict: 'school_code,specialty_code'
    });
    if (error) {
      console.error(`  ❌ 批次 ${Math.floor(i / BATCH) + 1} 失败:`, error.message);
    } else {
      imported += batch.length;
      console.log(`  ✅ 批次 ${Math.floor(i / BATCH) + 1}: ${batch.length} 条`);
    }
  }
  console.log(`🎉 已选学校导入完成！共 ${imported} 条`);
}

(async () => {
  console.log('🔍 测试 Supabase 连接...\n');
  const ok = await testConnection();

  if (!ok) {
    console.error('\n❌ 部分表不存在，请先在 Supabase SQL Editor 中执行 supabase/schema.sql');
    process.exit(1);
  }

  console.log('\n🚀 开始导入数据...\n');
  await importAvailableSchools();
  console.log('');
  await importSelectableSchools();
  console.log('\n✅ 全部导入完成！');
})();
