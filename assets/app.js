// ======== 密码验证 ========
// 密码从 URL hash 参数或页面内嵌配置读取，避免硬编码
// 生产部署时通过环境变量注入 AUTH_PASSWORD
const AUTH_PASSWORD = (function() {
  // 优先从 URL hash 读取: #pwd=xxx
  var m = location.hash.match(/pwd=([^&]+)/);
  if (m) return m[1];
  // 否则使用内嵌配置（部署时替换此值）
  return '__AUTH_PASSWORD_PLACEHOLDER__';
})();
const AUTH_TOKEN = AUTH_PASSWORD;

function checkPassword() {
  const pw = document.getElementById('passwordInput').value;
  if (pw === AUTH_PASSWORD) {
    document.cookie = 'auth_token=' + encodeURIComponent(AUTH_TOKEN) + '; path=/; max-age=' + (7*24*60*60);
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    document.getElementById('loginError').textContent = '❌ 密码错误，请重试';
  }
}
document.getElementById('passwordInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });

// ======== 全局常量 ========
const MAJORS = ['生物工程','制药工程','通信工程','材料科学与工程'];
const DATA_SOURCE = SELECTABLE_SCHOOLS;
const SAVED_DIR_PREFIX = 'data/main/';

// ======== 应用初始化 ========
function initApp() {
  renderDashboard();
  initAllSchoolsPage();
  initPlanningPage();
  loadPlanSummary();
  setupNavigation();
}

// ======== 导航切换 ========
function setupNavigation() {
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('page-' + page);
      if (target) {
        target.classList.add('active');
        const names = { dashboard:'📊 总览', allschools:'📋 所有可选学校', planning:'📝 筛选方案', plan:'📋 志愿方案' };
        document.getElementById('breadcrumb').innerHTML = (names[page] || page) + ' <span>' + (page === 'dashboard' ? '总览' : names[page]?.split(' ')[1] || '') + '</span>';
        if (page === 'allschools') initAllSchoolsPage();
        if (page === 'planning') initPlanningPage();
        if (page === 'plan') loadPlanSummary();
      }
    });
  });
}

// ======== 总览渲染 ========
function renderDashboard() {
  const s = CONFIG.student;
  document.getElementById('displayScore').textContent = s.score;
  document.getElementById('displaySubject').textContent = s.subject;
  document.getElementById('displayProvince').textContent = s.province;
  document.getElementById('displayBatchLine').textContent = s.batchLine;
  document.getElementById('displayDiff').textContent = s.score - s.batchLine;
  const deadline = new Date(s.deadline);
  const now = new Date();
  const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  document.getElementById('countdownDays').textContent = Math.max(0, diff);
}

// ======== 筛选设置 ========
function saveSettings() {
  localStorage.setItem('volunteer_settings', JSON.stringify({
    excluded: document.getElementById('settingExcluded').value,
    ratio: parseFloat(document.getElementById('settingRatio').value),
    scoreMin: parseInt(document.getElementById('settingScoreMin').value),
    scoreMax: parseInt(document.getElementById('settingScoreMax').value),
    majors: document.getElementById('settingMajors').value
  }));
  alert('✅ 设置已保存到本地');
}

function resetSettings() {
  document.getElementById('settingExcluded').value = '西藏,内蒙,山西,河南,河北,湖南,广西,贵州,上海,安徽';
  document.getElementById('settingRatio').value = '1.03';
  document.getElementById('settingScoreMin').value = '489';
  document.getElementById('settingScoreMax').value = '514';
  document.getElementById('settingMajors').value = '生物工程,制药工程,铁路,电气自动化,通信工程,人工智能,材料科学与工程';
  saveSettings();
}

function loadSettings() {
  const saved = localStorage.getItem('volunteer_settings');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      document.getElementById('settingExcluded').value = s.excluded || '西藏,内蒙,山西,河南,河北,湖南,广西,贵州,上海,安徽';
      document.getElementById('settingRatio').value = s.ratio || '1.03';
      document.getElementById('settingScoreMin').value = s.scoreMin || '489';
      document.getElementById('settingScoreMax').value = s.scoreMax || '514';
      document.getElementById('settingMajors').value = s.majors || MAJORS.join(',');
    } catch(e) {}
  }
}

// ======== 字段映射工具 ========
// 将原始数据字段映射到前端统一使用的字段名
function mapFields(d) {
  return {
    school: d.school_name || '',
    school_code: d.school_code || '',
    major: d.specialty_name || '',
    specialty_code: d.specialty_code || '',
    score_min: d.min_score || 0,
    // 以下字段数据中不存在，使用默认值
    province: '—',
    city: '—',
    batch: '—',
    score_avg: 0,
    plan_count: 0,
    ratio: 0,
    note: ''
  };
}

// ======== 所有可选学校页面 ========
let allSchoolsData = [];
let allSchoolsChecked = {};
let allSchoolsFiltered = [];
let allSchoolsPageSize = 50;
let allSchoolsPage = 1;
let allSchoolsLoaded = false;

function initAllSchoolsPage() {
  if (allSchoolsLoaded) {
    allSchoolsApplyFilters();
    return;
  }

  fetch('data/all_selectable_schools.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allSchoolsData = data.map(function(d) {
        return {
          school: d.school_name || '',
          school_code: d.school_code || '',
          major: d.specialty_name || '',
          specialty_code: d.specialty_code || '',
          score_min: d.min_score || 0,
          _key: (d.school_code || '') + '|' + (d.specialty_code || '')
        };
      });
      allSchoolsData.sort(function(a, b) { return b.score_min - a.score_min; });
      allSchoolsLoaded = true;

      var majorSet = {};
      var majors = [];
      for (var i = 0; i < allSchoolsData.length; i++) {
        if (!majorSet[allSchoolsData[i].major]) {
          majorSet[allSchoolsData[i].major] = true;
          majors.push(allSchoolsData[i].major);
        }
      }
      majors.sort();
      var opts = '<option value="all">全部专业</option>';
      for (var i = 0; i < majors.length; i++) {
        opts += '<option value="' + majors[i] + '">' + majors[i] + '</option>';
      }
      document.getElementById('allFilterMajor').innerHTML = opts;

      var saved = localStorage.getItem('all_schools_checked');
      if (saved) { try { allSchoolsChecked = JSON.parse(saved); } catch(e) {} }

      allSchoolsApplyFilters();
    })
    .catch(function(err) {
      console.error('加载所有可选学校数据失败:', err);
      document.getElementById('allTableBody').innerHTML =
        '<tr><td colspan="8" style="text-align:center;color:#d93025;padding:40px;">❌ 数据加载失败: ' + err.message + '</td></tr>';
    });
}

function allSchoolsApplyFilters() {
  var major = document.getElementById('allFilterMajor').value;
  var school = document.getElementById('allFilterSchool').value.trim().toLowerCase();
  var cf = document.getElementById('allFilterChecked').value;

  allSchoolsFiltered = [];
  for (var i = 0; i < allSchoolsData.length; i++) {
    var d = allSchoolsData[i];
    if (major !== 'all' && d.major !== major) continue;
    if (school && d.school.toLowerCase().indexOf(school) === -1) continue;
    if (cf === 'checked' && !allSchoolsChecked[d._key]) continue;
    if (cf === 'unchecked' && allSchoolsChecked[d._key]) continue;
    allSchoolsFiltered.push(d);
  }
  allSchoolsPage = 1;
  allSchoolsRenderTable();
}

function allSchoolsRenderTable() {
  var tbody = document.getElementById('allTableBody');
  if (allSchoolsFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    document.getElementById('allPrevBtn').disabled = true;
    document.getElementById('allNextBtn').disabled = true;
    document.getElementById('allPageInfo').textContent = '0 / 0';
    document.getElementById('allPageNote').textContent = '第 0 / 0 页';
    allSchoolsUpdateCheckedCount();
    return;
  }

  var totalPages = Math.ceil(allSchoolsFiltered.length / allSchoolsPageSize);
  if (allSchoolsPage > totalPages) allSchoolsPage = totalPages;
  var start = (allSchoolsPage - 1) * allSchoolsPageSize;
  var end = Math.min(start + allSchoolsPageSize, allSchoolsFiltered.length);

  var rows = '';
  for (var i = start; i < end; i++) {
    var d = allSchoolsFiltered[i];
    var isChk = allSchoolsChecked[d._key] ? 'checked' : '';
    rows += '<tr>' +
      '<td style="text-align:center;color:#999;">' + (i + 1) + '</td>' +
      '<td><strong>' + d.school + '</strong></td>' +
      '<td><code>' + (d.school_code || '—') + '</code></td>' +
      '<td>' + d.major + '</td>' +
      '<td><code>' + (d.specialty_code || '—') + '</code></td>' +
      '<td><strong>' + (d.score_min > 0 ? d.score_min + ' 分' : '—') + '</strong></td>' +
      '<td style="text-align:center;"><input type="checkbox" data-key="' + d._key + '" ' + isChk + '></td>' +
      '<td><div class="sort-arrows"><button data-dir="-1" title="上移">▲</button><button data-dir="1" title="下移">▼</button></div></td>' +
    '</tr>';
  }
  tbody.innerHTML = rows;

  document.getElementById('allPageNote').textContent = '第 ' + allSchoolsPage + ' 页 / 共 ' + totalPages + ' 页';
  document.getElementById('allPageInfo').textContent = allSchoolsPage + ' / ' + totalPages;
  document.getElementById('allPrevBtn').disabled = allSchoolsPage <= 1;
  document.getElementById('allNextBtn').disabled = allSchoolsPage >= totalPages;
  allSchoolsUpdateCheckedCount();
}

function allSchoolsUpdateCheckedCount() {
  document.getElementById('allCheckedCount').textContent = '已勾选 ' + Object.keys(allSchoolsChecked).length + ' 条';
}

// 事件委托：勾选
document.getElementById('allTableBody').addEventListener('change', function(e) {
  if (e.target.type === 'checkbox') {
    var key = e.target.dataset.key;
    if (e.target.checked) { allSchoolsChecked[key] = true; }
    else { delete allSchoolsChecked[key]; }
    localStorage.setItem('all_schools_checked', JSON.stringify(allSchoolsChecked));
    allSchoolsUpdateCheckedCount();
  }
});

// 事件委托：排序按钮
document.getElementById('allTableBody').addEventListener('click', function(e) {
  if (e.target.tagName === 'BUTTON' && e.target.dataset.dir) {
    var dir = parseInt(e.target.dataset.dir);
    var tr = e.target.closest('tr');
    var tbody = tr.parentElement;
    var children = tbody.children;
    var idx = Array.prototype.indexOf.call(children, tr);
    var swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= children.length) return;
    if (dir === -1) tbody.insertBefore(tr, children[swapIdx]);
    else tbody.insertBefore(tr, children[swapIdx].nextSibling || null);
  }
});

// 筛选
document.getElementById('allFilterMajor').addEventListener('change', allSchoolsApplyFilters);
document.getElementById('allFilterChecked').addEventListener('change', allSchoolsApplyFilters);
document.getElementById('allFilterSchool').addEventListener('input', allSchoolsApplyFilters);

// 分页
document.getElementById('allPrevBtn').addEventListener('click', function() {
  if (allSchoolsPage > 1) { allSchoolsPage--; allSchoolsRenderTable(); }
});
document.getElementById('allNextBtn').addEventListener('click', function() {
  var tp = Math.ceil(allSchoolsFiltered.length / allSchoolsPageSize) || 1;
  if (allSchoolsPage < tp) { allSchoolsPage++; allSchoolsRenderTable(); }
});

// 保存到可选列表
document.getElementById('allSaveBtn').addEventListener('click', function() {
  var out = [];
  for (var i = 0; i < allSchoolsData.length; i++) {
    if (allSchoolsChecked[allSchoolsData[i]._key]) {
      out.push({
        school_code: allSchoolsData[i].school_code,
        school_name: allSchoolsData[i].school,
        specialty_code: allSchoolsData[i].specialty_code,
        specialty_name: allSchoolsData[i].major,
        min_score: allSchoolsData[i].score_min
      });
    }
  }
  if (!out.length) { alert('请先勾选至少一所学校'); return; }
  out.sort(function(a, b) { return b.min_score - a.min_score; });

  function download(name, content, type) {
    var b = new Blob([content], { type: type });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
  }
  download('selectable_schools.json', JSON.stringify(out, null, 2), 'application/json;charset=utf-8');
  download('selectable_schools.js', 'const SELECTABLE_SCHOOLS = {"schools":' + JSON.stringify(out) + '};', 'application/javascript;charset=utf-8');
  alert('已导出 ' + out.length + ' 条。请覆盖到 data/ 目录');
});

// ======== 筛选方案页面 ========
let planAllData = [];
let planChecked = {};  // { 'school|major': true }

// 类别判定：冲 510-529, 稳 504-509, 保 479-503
function getCategory(score) {
  if (score >= 510) return '冲';
  if (score >= 504) return '稳';
  return '保';
}

function getCategoryTag(cat) {
  if (cat === '冲') return '<span class="tag-rush">🚀 冲</span>';
  if (cat === '稳') return '<span class="tag-steady">⚖️ 稳</span>';
  return '<span class="tag-safe">🛡️ 保</span>';
}

function initPlanningPage() {
  const allData = (DATA_SOURCE.schools || []).map(mapFields);
  // 去重
  const seen = new Set();
  planAllData = [];
  allData.forEach(d => {
    const key = d.school + '|' + d.major;
    if (!seen.has(key)) {
      seen.add(key);
      d.category = getCategory(d.score_min);
      d._key = key;
      planAllData.push(d);
    }
  });
  // 默认按 min_score 降序
  planAllData.sort((a, b) => b.score_min - a.score_min);

  // 初始化筛选
  const majors = [...new Set(planAllData.map(d => d.major))].sort();
  document.getElementById('planFilterMajor').innerHTML =
    '<option value="all">全部专业</option>' + majors.map(m => `<option value="${m}">${m}</option>`).join('');

  // 加载已保存的勾选状态
  const saved = localStorage.getItem('volunteer_plan_checked');
  if (saved) {
    try { planChecked = JSON.parse(saved); } catch(e) { planChecked = {}; }
  }

  renderPlanTable();
}

function renderPlanTable() {
  const major = document.getElementById('planFilterMajor').value;
  const school = document.getElementById('planFilterSchool').value.trim().toLowerCase();
  const checkFilter = document.getElementById('planFilterChecked').value;

  let filtered = planAllData.filter(d => {
    if (major !== 'all' && d.major !== major) return false;
    if (school && !d.school.toLowerCase().includes(school)) return false;
    if (checkFilter === 'checked' && !planChecked[d._key]) return false;
    if (checkFilter === 'unchecked' && planChecked[d._key]) return false;
    return true;
  });

  const tbody = document.getElementById('planTableBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    updateCheckedCount();
    return;
  }

  tbody.innerHTML = filtered.map((d, idx) => {
    const checked = planChecked[d._key] ? 'checked' : '';
    return `<tr>
      <td style="text-align:center;color:#999;">${idx + 1}</td>
      <td><strong>${d.school}</strong></td>
      <td>${d.major}</td>
      <td><strong>${d.score_min > 0 ? d.score_min + ' 分' : '—'}</strong></td>
      <td>${getCategoryTag(d.category)}</td>
      <td style="text-align:center;">
        <input type="checkbox" class="plan-checkbox" data-key="${d._key}" ${checked} onchange="toggleCheck(this)">
      </td>
      <td>
        <div class="sort-arrows">
          <button onclick="movePlanRow(this, -1)" title="上移">▲</button>
          <button onclick="movePlanRow(this, 1)" title="下移">▼</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  updateCheckedCount();
}

function toggleCheck(cb) {
  const key = cb.dataset.key;
  if (cb.checked) {
    planChecked[key] = true;
  } else {
    delete planChecked[key];
  }
  localStorage.setItem('volunteer_plan_checked', JSON.stringify(planChecked));
  updateCheckedCount();
}

function updateCheckedCount() {
  const count = Object.keys(planChecked).length;
  document.getElementById('planCheckedCount').textContent = `已勾选 ${count} 条`;
}

function movePlanRow(btn, direction) {
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  const idx = Array.from(tbody.children).indexOf(tr);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= tbody.children.length) return;

  if (direction === -1) {
    tbody.insertBefore(tr, tbody.children[swapIdx]);
  } else {
    if (tbody.children[swapIdx + 1]) {
      tbody.insertBefore(tr, tbody.children[swapIdx + 1]);
    } else {
      tbody.appendChild(tr);
    }
  }

  // 更新序号
  Array.from(tbody.children).forEach((row, i) => {
    const td = row.querySelector('td:first-child');
    if (td) td.textContent = i + 1;
  });

  // 更新 planAllData 中的顺序
  const newOrder = Array.from(tbody.children).map(row => {
    const cb = row.querySelector('.plan-checkbox');
    return cb ? cb.dataset.key : null;
  }).filter(Boolean);

  const orderMap = {};
  newOrder.forEach((key, i) => { orderMap[key] = i; });
  planAllData.sort((a, b) => {
    const oa = orderMap[a._key] !== undefined ? orderMap[a._key] : 9999;
    const ob = orderMap[b._key] !== undefined ? orderMap[b._key] : 9999;
    return oa - ob;
  });
}

// ======== 保存筛选方案 ========
function savePlan() {
  const checkedSchools = planAllData.filter(d => planChecked[d._key]);
  if (!checkedSchools.length) {
    alert('⚠️ 请先勾选至少一所学校');
    return;
  }

  const planData = {
    version: new Date().toISOString().slice(0,10).replace(/-/g,''),
    updatedAt: new Date().toISOString(),
    schools: checkedSchools.map((d, idx) => ({
      rank: idx + 1,
      school: d.school,
      school_code: d.school_code,
      major: d.major,
      specialty_code: d.specialty_code,
      score_min: d.score_min,
      category: d.category
    }))
  };

  localStorage.setItem('volunteer_final_plan', JSON.stringify(planData));

  const filename = `志愿方案_${planData.version}.json`;
  const blob = new Blob([JSON.stringify(planData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  alert(`✅ 方案已保存：${filename}（${checkedSchools.length} 条）`);
}

// ======== 导出TXT方案 ========
function exportPlanTxt() {
  const checkedSchools = planAllData.filter(d => planChecked[d._key]);
  if (!checkedSchools.length) {
    alert('⚠️ 请先勾选至少一所学校');
    return;
  }

  const ts = new Date().toLocaleString();
  const rush = checkedSchools.filter(d => d.category === '冲');
  const steady = checkedSchools.filter(d => d.category === '稳');
  const safe = checkedSchools.filter(d => d.category === '保');

  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 筛选方案',
    `   考生分数：${CONFIG.student.score} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    `【🚀 冲】（${rush.length} 项）`,
    ...rush.map((d, i) => `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分`),
    '',
    `【⚖️ 稳】（${steady.length} 项）`,
    ...steady.map((d, i) => `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分`),
    '',
    `【🛡️ 保】（${safe.length} 项）`,
    ...safe.map((d, i) => `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分`),
    '',
    '⚠️ 以上为 AI 辅助推荐，请结合招生计划最终确认'
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `志愿方案_${CONFIG.student.score}分.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ======== 志愿方案页面 ========
function loadPlanSummary() {
  const container = document.getElementById('planSummary');

  let rushItems = [];
  let steadyItems = [];
  let safeItems = [];

  // 从筛选方案的勾选数据中加载
  const saved = localStorage.getItem('volunteer_final_plan');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      (data.schools || []).forEach(s => {
        if (s.category === '冲') rushItems.push(s);
        else if (s.category === '稳') steadyItems.push(s);
        else if (s.category === '保') safeItems.push(s);
      });
    } catch(e) {}
  }

  container.innerHTML = `
    <div class="settings-card">
      <p>📊 共加载 <strong>${rushItems.length + steadyItems.length + safeItems.length}</strong> 条志愿方案</p>
      <p style="font-size:13px;color:#666;margin-top:4px;">
        🚀 冲刺 ${rushItems.length} 项 · ⚖️ 稳妥 ${steadyItems.length} 项 · 🛡️ 保底 ${safeItems.length} 项
      </p>
    </div>
  `;

  renderPlanList('planRushList', rushItems);
  renderPlanList('planSteadyList', steadyItems);
  renderPlanList('planSafeList', safeItems);
}

function renderPlanList(id, items) {
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = '<p class="plan-empty">暂无</p>';
    return;
  }
  el.innerHTML = items.map((s, i) => `
    <div class="plan-item">
      <div class="plan-item-info">
        <span class="plan-item-school">${i + 1}. ${s.school}</span>
        <span class="plan-item-detail">${s.major}</span>
      </div>
      <span class="plan-item-score">${s.score_min > 0 ? s.score_min + '分' : '—'}</span>
    </div>
  `).join('');
}

// ======== 导出最终方案 ========
function exportFinalPlan() {
  let rushItems = [], steadyItems = [], safeItems = [];
  const saved = localStorage.getItem('volunteer_final_plan');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      (data.schools || []).forEach(s => {
        if (s.category === '冲') rushItems.push(s);
        else if (s.category === '稳') steadyItems.push(s);
        else if (s.category === '保') safeItems.push(s);
      });
    } catch(e) {}
  }

  const ts = new Date().toLocaleString();
  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 最终志愿方案',
    `   考生分数：${CONFIG.student.score} 分`,
    `   一本线：${CONFIG.student.batchLine} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    `【🚀 冲刺志愿】（${rushItems.length} 项）`,
    ...rushItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
    '',
    `【⚖️ 稳妥志愿】（${steadyItems.length} 项）`,
    ...steadyItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
    '',
    `【🛡️ 保底志愿】（${safeItems.length} 项）`,
    ...safeItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
    '',
    '⚠️ 以上为 AI 辅助推荐，请结合招生计划最终确认'
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `最终志愿方案_${CONFIG.student.score}分.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ======== 监听筛选方案页面的筛选变化 ========
document.addEventListener('change', e => {
  if (['planFilterMajor', 'planFilterChecked'].includes(e.target.id)) {
    renderPlanTable();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'planFilterSchool') renderPlanTable();
});

// ======== 初始加载 ========
loadSettings();

// 自动登录：检查 cookie
(function() {
  const cookies = document.cookie.split('; ').reduce((acc, c) => {
    const [k, v] = c.split('=');
    acc[k] = v;
    return acc;
  }, {});
  if (cookies['auth_token'] === AUTH_TOKEN) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  }
})();
