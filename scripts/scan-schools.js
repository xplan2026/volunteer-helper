#!/usr/bin/env node
/**
 * 志愿追踪 — 学校官网扫描脚本
 * 
 * 功能：
 * 1. 读取 志愿填报.json 中的学校列表
 * 2. 扫描各校官网，查找是否有招生/录取相关信息发布
 * 3. 检索重庆高考招生新信息
 * 4. 综合评估退档风险
 * 5. 输出结果到 data_bak/tracking-result.json
 * 
 * 使用方法：
 *   node scripts/scan-schools.js
 *   # 或通过 cron 每日自动执行
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ====== 配置 ======
const DATA_DIR = path.join(__dirname, '..', 'data_bak');
const VOLUNTEER_FILE = path.join(DATA_DIR, '志愿填报.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'tracking-result.json');

// 各高校官网映射
const SCHOOL_WEBSITES = {
  '深圳技术大学': 'https://www.sztu.edu.cn',
  '广州大学': 'https://www.gzhu.edu.cn',
  '广东工业大学': 'https://www.gdut.edu.cn',
  '华南农业大学': 'https://www.scau.edu.cn',
  '东莞理工学院': 'https://www.dgut.edu.cn',
  '佛山大学': 'https://www.fosu.edu.cn',
  '广东海洋大学': 'https://www.gdou.edu.cn',
  '五邑大学': 'https://www.wyu.edu.cn',
  '肇庆学院': 'https://www.zqu.edu.cn',
  '惠州学院': 'https://www.hzu.edu.cn',
  '岭南师范学院': 'https://www.lingnan.edu.cn',
  '北京师范大学珠海校区': 'https://www.bnuzh.edu.cn',
  '北京理工大学珠海校区': 'https://www.bitzh.edu.cn',
  '广东技术师范大学': 'https://www.gpnu.edu.cn',
  '韩山师范学院': 'https://www.hstc.edu.cn',
  '嘉应学院': 'https://www.jyu.edu.cn',
  '韶关学院': 'https://www.sgu.edu.cn',
  '广东石油化工学院': 'https://www.gdupt.edu.cn',
  '电子科技大学中山学院': 'https://www.zsc.edu.cn',
  '广州软件学院': 'https://www.seig.edu.cn',
  '广州应用科技学院': 'https://www.gzasc.edu.cn',
  '华南农业大学珠江学院': 'https://www.scauzhujiang.cn',
  '广东东软学院': 'https://www.nuit.edu.cn',
  '广东理工学院': 'https://www.gdlgxy.edu.cn',
  '广州工商学院': 'https://www.gzgs.edu.cn',
  '广州科技职业技术大学': 'https://www.gzkjxy.net',
  '广东工商职业技术大学': 'https://www.gdbtu.edu.cn',
  '广州理工学院': 'https://www.gzist.edu.cn',
  '东莞城市学院': 'https://www.ccdgut.edu.cn',
  '广州华立学院': 'https://www.hualixy.edu.cn',
  '湛江科技学院': 'https://www.zjkjxy.edu.cn',
  '广东科技学院': 'https://www.gdust.edu.cn',
  '广州城市理工学院': 'https://www.gcu.edu.cn',
  '广州南方学院': 'https://www.nfu.edu.cn',
  '广州新华学院': 'https://www.xhsysu.edu.cn',
  '广东外语外贸大学南国商学院': 'https://www.gwng.edu.cn',
};

// 招生相关关键词
const ADMISSION_KEYWORDS = [
  '招生', '录取', '分数线', '简章', '章程', '投档', '志愿',
  '录取查询', '录取结果', '招生计划', '招生信息', '招生公告',
  'admission', 'recruitment', 'enrollment'
];

// 退档预警相关关键词
const DANGER_KEYWORDS = [
  '退档', '不录取', '调剂', '专业受限', '身体条件', '单科成绩',
  '色盲', '色弱', '视力', '体检', '不招', '限制'
];

// ====== HTTP 请求工具 ======

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      let handled = false;
      const done = (result) => { if (!handled) { handled = true; resolve(result); } };
      res.on('readable', () => {
        let chunk;
        while (null !== (chunk = res.read())) {
          data += chunk;
          if (data.length > 50000) {
            req.destroy();
            done({ status: res.statusCode, body: data.substring(0, 50000), ok: res.statusCode >= 200 && res.statusCode < 400 });
            return;
          }
        }
      });
      res.on('end', () => done({ status: res.statusCode, body: data.substring(0, 50000), ok: res.statusCode >= 200 && res.statusCode < 400 }));
      res.on('error', (e) => done({ status: 0, ok: false, error: e.message }));
    });
    req.on('error', (e) => resolve({ status: 0, ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, error: 'timeout' }); });
  });
}

// ====== 扫描单所学校官网 ======

async function scanSchoolWebsite(schoolName, url) {
  const result = {
    school: schoolName,
    url: url,
    reachable: false,
    admissionMentioned: false,
    keywordHits: [],
    admissionPageFound: false,
    admissionUrl: null,
    dangerKeywords: [],
    summary: '',
    error: null
  };

  try {
    // 1. 探测官网首页
    const homeResp = await fetchUrl(url);
    if (!homeResp.ok) {
      result.error = `首页不可达 (HTTP ${homeResp.status})`;
      result.summary = '⚠️ 官网无法访问';
      return result;
    }
    result.reachable = true;
    const body = homeResp.body.toLowerCase();

    // 2. 搜索招生相关关键词
    const hits = ADMISSION_KEYWORDS.filter(kw => body.includes(kw.toLowerCase()));
    result.keywordHits = hits;

    // 3. 找疑似招生页面链接
    const linkPatterns = [
      /<a[^>]*href=["']([^"']*)["'][^>]*>.*?招生.*?<\/a>/gi,
      /<a[^>]*href=["']([^"']*)["'][^>]*>.*?录取.*?<\/a>/gi,
      /<a[^>]*href=["']([^"']*)["'][^>]*>.*?zsb?.*?<\/a>/gi,
    ];
    for (const pattern of linkPatterns) {
      const matches = [...homeResp.body.matchAll(pattern)];
      if (matches.length > 0) {
        // 取第一个匹配
        let firstUrl = matches[0][1];
        if (firstUrl && !firstUrl.startsWith('http')) {
          const baseUrl = new URL(url);
          firstUrl = new URL(firstUrl, baseUrl.origin).href;
        }
        result.admissionPageFound = true;
        result.admissionUrl = firstUrl;
        break;
      }
    }

    // 如果还没找到，试试常见招生路径
    if (!result.admissionPageFound) {
      const commonPaths = ['/zs', '/zsb', '/recruit', '/admission', '/zsw', '/招生'];
      for (const p of commonPaths) {
        const testUrl = url.replace(/\/$/, '') + p;
        const testResp = await fetchUrl(testUrl, 5000);
        if (testResp.ok) {
          result.admissionPageFound = true;
          result.admissionUrl = testUrl;
          break;
        }
      }
    }

    // 4. 检查退档风险关键词
    result.dangerKeywords = DANGER_KEYWORDS.filter(kw => body.includes(kw.toLowerCase()));

    // 5. 生成摘要
    if (hits.length > 0) {
      result.admissionMentioned = true;
      result.summary = `✅ 官网可访问，发现招生信息`;
      if (result.admissionPageFound) {
        result.summary += `，招生页面: ${result.admissionUrl}`;
      }
    } else {
      result.summary = `✅ 官网可访问，暂未发现招生公告`;
    }
    if (result.dangerKeywords.length > 0) {
      result.summary += ` ⚠️ 检出退档预警词: ${result.dangerKeywords.slice(0, 3).join(', ')}`;
    }
  } catch (e) {
    result.error = e.message;
    result.summary = `❌ 扫描出错: ${e.message}`;
  }

  return result;
}

// ====== 退档风险综合分析 ======

function assessRetirementRisk(volunteerData, scanResults) {
  const analysis = {
    overallRisk: 'low', // low / medium / high
    scoreAnalysis: null,
    batchLineCheck: null,
    riskFactors: [],
    suggestions: [],
    lastScanTime: new Date().toISOString()
  };

  const student = volunteerData.考生信息 || {};
  const score = student.成绩 || 0;
  const rank = student.排位 || 0;
  const batchLine = (student.省控线 || {}).分数线 || 0;
  const diff = score - batchLine;

  // 分数线分析
  analysis.batchLineCheck = {
    score,
    batchLine,
    diff,
    aboveLine: diff >= 0
  };

  if (diff < 0) {
    analysis.riskFactors.push(`成绩(${score}分)低于省控线(${batchLine}分)`);
    analysis.overallRisk = 'high';
  } else if (diff <= 10) {
    analysis.riskFactors.push(`成绩仅超省控线${diff}分，边缘分数`);
    analysis.overallRisk = 'medium';
  }

  // 检查冲刺志愿（前8个）的官网状态
  const rushSchools = volunteerData.志愿表.slice(0, 8) || [];
  const unreachable = rushSchools.filter(s => {
    const name = s.院校.replace(/\(.*\)/g, '');
    const r = scanResults.find(r => r.school === name);
    return r && !r.reachable;
  });
  if (unreachable.length > 0) {
    analysis.riskFactors.push(`${unreachable.length}个冲刺院校官网不可访问`);
  }

  // 检查退档关键词命中
  const schoolsWithDanger = scanResults.filter(r => r.dangerKeywords.length > 0);
  if (schoolsWithDanger.length > 0) {
    analysis.riskFactors.push(`${schoolsWithDanger.length}所学校检出退档相关关键词`);
    schoolsWithDanger.forEach(s => {
      analysis.suggestions.push(`注意 ${s.school} 可能涉及: ${s.dangerKeywords.join(', ')}`);
    });
  }

  // 综合判断
  if (analysis.overallRisk === 'high') {
    analysis.suggestions.unshift('⚠️ 强烈建议重新评估志愿方案，退档风险较高');
  } else if (analysis.overallRisk === 'medium') {
    analysis.suggestions.unshift('🔔 有一定退档风险，建议准备保底方案');
  } else {
    analysis.suggestions.unshift('✅ 当前方案退档风险较低');
  }

  return analysis;
}

// ====== 主流程 ======

async function main() {
  console.log('📡 开始扫描学校官网...');
  const startTime = Date.now();

  // 1. 读取志愿数据
  let volunteerData;
  try {
    volunteerData = JSON.parse(fs.readFileSync(VOLUNTEER_FILE, 'utf-8'));
  } catch (e) {
    console.error('❌ 无法读取志愿填报.json:', e.message);
    process.exit(1);
  }

  // 2. 提取去重后的学校列表
  const schoolSet = new Map(); // name -> displayName
  for (const item of volunteerData.志愿表 || []) {
    const cleanName = item.院校.replace(/\(.*\)/g, '');
    schoolSet.set(cleanName, item.院校);
  }

  const schools = Array.from(schoolSet.keys());
  console.log(`📋 共 ${schools.length} 所学校待扫描`);

  // 3. 扫描各校官网
  const scanResults = [];
  const MAX_CONCURRENT = 5;

  for (let i = 0; i < schools.length; i += MAX_CONCURRENT) {
    const batch = schools.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map(name => {
      const url = SCHOOL_WEBSITES[name];
      if (!url) {
        return Promise.resolve({
          school: name,
          url: null,
          reachable: false,
          admissionMentioned: false,
          keywordHits: [],
          admissionPageFound: false,
          admissionUrl: null,
          dangerKeywords: [],
          summary: '❓ 未知官网地址',
          error: 'no_url'
        });
      }
      console.log(`  [${i + batch.indexOf(name) + 1}/${schools.length}] 扫描: ${name} (${url})`);
      return scanSchoolWebsite(name, url);
    });
    const batchResults = await Promise.all(promises);
    scanResults.push(...batchResults);
  }

  // 4. 退档风险评估
  const riskAnalysis = assessRetirementRisk(volunteerData, scanResults);

  // 5. 汇总统计
  const reachableCount = scanResults.filter(r => r.reachable).length;
  const admissionCount = scanResults.filter(r => r.admissionMentioned).length;
  const dangerCount = scanResults.filter(r => r.dangerKeywords.length > 0).length;

  // 6. 输出结果
  const output = {
    scanTime: new Date().toISOString(),
    totalSchools: schools.length,
    scannedCount: scanResults.length,
    reachableCount,
    admissionFound: admissionCount,
    dangerDetected: dangerCount,
    schoolResults: scanResults,
    riskAnalysis,
    summary: {
      schoolStatus: `${reachableCount}/${schools.length} 所学校官网可达`,
      admissionInfo: `${admissionCount} 所学校检出招生关键词`,
      riskLevel: riskAnalysis.overallRisk === 'high' ? '⚠️ 高风险' : riskAnalysis.overallRisk === 'medium' ? '🔔 中风险' : '✅ 低风险',
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ 扫描完成！耗时 ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`📊 结果已保存: ${OUTPUT_FILE}`);
  console.log(`📊 ${output.summary.schoolStatus}`);
  console.log(`📊 ${output.summary.admissionInfo}`);
  console.log(`📊 ${output.summary.riskLevel}`);
}

main().catch(console.error);
