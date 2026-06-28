#!/usr/bin/env node
/**
 * 将「物理类·2026在渝招生计划.xlsx」转换为 JSON
 * 剔除第1行图片占位符、第2行分区标题等非表格内容
 * 以第3行为列头，第4行起为数据
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT = path.join(__dirname, '..', 'data_bak', '物理类·2026在渝招生计划.xlsx');
const OUTPUT = INPUT.replace(/\.xlsx$/i, '.json');

// ── 读取 ──
const wb = XLSX.readFile(INPUT);
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

if (raw.length < 4) {
  console.error('❌ 数据行不足，至少需要1行表头+1行数据');
  process.exit(1);
}

// ── 第3行是列头，第4行起是数据 ──
const headerRow = raw[2];   // 0-based index 2 = 第3行
const dataRows = raw.slice(3);

// 清洗列头：去除首尾空格、换行等
const headers = headerRow.map(h => String(h).trim().replace(/\s+/g, ''));

// ── 构建对象数组 ──
const records = dataRows.map((row, idx) => {
  const obj = {};
  headers.forEach((key, colIdx) => {
    if (!key) return; // 跳过空列头
    const val = row[colIdx];
    // 保留数字类型（年份、人数、分数等），其他转字符串
    if (typeof val === 'number') {
      obj[key] = val;
    } else if (val === undefined || val === null) {
      obj[key] = '';
    } else {
      obj[key] = String(val).trim();
    }
  });
  return obj;
});

// ── 统计信息 ──
console.log(`📊 列头数: ${headers.filter(Boolean).length}`);
console.log(`📊 数据行数: ${records.length}`);
console.log(`📊 总列数(含空): ${headers.length}`);

// ── 输出 JSON ──
fs.writeFileSync(OUTPUT, JSON.stringify(records, null, 2), 'utf-8');
const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2);
console.log(`✅ 已生成: ${OUTPUT} (${sizeMB} MB)`);
