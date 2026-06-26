// ======== 密码验证 ========
function checkPassword() {
  const pw = document.getElementById('passwordInput').value;
  if (pw === 'alexia!2026$') {
    document.cookie = 'auth_token=alexia!2026$; path=/; max-age=' + (7*24*60*60);
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    document.getElementById('loginError').textContent = '❌ 密码错误，请重试';
  }
}
document.getElementById('passwordInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });

// ======== 全局常量 ========
const MAJORS = ['生物工程','制药工程','铁路','电气自动化','通信工程','人工智能','材料科学与工程'];
const DATA_SOURCE = SELECTABLE_SCHOOLS;
const SAVED_DIR_PREFIX = 'data/main/';

// ======== 应用初始化 ========
function initApp() {
  renderDashboard();
  initDataTable();
  initSchoolsTable();
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
        const names = { dashboard:'📊 总览', data:'📋 数据表', schools:'🏫 院校推荐', planning:'📝 筛选方案', plan:'📋 志愿方案' };
        document.getElementById('breadcrumb').innerHTML = (names[page] || page) + ' <span>' + (page === 'data' ? '数据表' : page === 'dashboard' ? '总览' : names[page]?.split(' ')[1] || '') + '</span>';
        // 页面切换时的加载逻辑
        if (page === 'data') initDataTable();
        if (page === 'schools') initSchoolsTable();
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
  document.getElementById('settingMajors').value = MAJORS.join(',');
  saveSettings();
}

// 加载已保存的设置
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

// ======== 数据表页面 ========
let dataStore = [];
let dataFiltered = [];
let dataPageSize = 30;
let dataCurrentPage = 1;

function initDataTable() {
  dataStore = DATA_SOURCE.schools || [];
  if (!dataStore.length) {
    document.getElementById('dataTableBody').innerHTML =
      '<tr><td colspan="10" style="text-align:center;color:#999;padding:40px;">暂无数据</td></tr>';
    return;
  }
  initDataFilters();
  applyDataFilters();
}

function initDataFilters() {
  const majors = [...new Set(dataStore.map(d => d.major))].sort();
  document.getElementById('dataFilterMajor').innerHTML =
    '<option value="all">全部专业</option>' + majors.map(m => `<option value="${m}">${m}</option>`).join('');
  const provinces = [...new Set(dataStore.map(d => d.province))].sort();
  document.getElementById('dataFilterProvince').innerHTML =
    '<option value="all">全部省份</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
}

function applyDataFilters() {
  const major = document.getElementById('dataFilterMajor').value;
  const province = document.getElementById('dataFilterProvince').value;
  const school = document.getElementById('dataFilterSchool').value.trim().toLowerCase();
  dataFiltered = dataStore.filter(d => {
    if (major !== 'all' && d.major !== major) return false;
    if (province !== 'all' && d.province !== province) return false;
    if (school && !d.school.toLowerCase().includes(school)) return false;
    return true;
  });
  dataCurrentPage = 1;
  renderDataTable();
}

function renderDataTable() {
  const tbody = document.getElementById('dataTableBody');
  if (dataFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    document.getElementById('dataCountLabel').textContent = '共 0 条记录';
    document.getElementById('dataPageNote').textContent = '第 0 / 0 页';
    document.getElementById('dataPrevBtn').disabled = true;
    document.getElementById('dataNextBtn').disabled = true;
    document.getElementById('dataPageInfo').textContent = '0 / 0';
    return;
  }
  const totalPages = Math.ceil(dataFiltered.length / dataPageSize);
  const start = (dataCurrentPage - 1) * dataPageSize;
  const end = Math.min(start + dataPageSize, dataFiltered.length);
  const pageData = dataFiltered.slice(start, end);
  tbody.innerHTML = pageData.map(d => `
    <tr>
      <td><strong>${d.school}</strong></td>
      <td><code>${d.code || '—'}</code></td>
      <td><span class="batch-badge">${d.province}</span></td>
      <td>${d.city}</td>
      <td>${d.major}</td>
      <td><strong>${d.score_min > 0 ? d.score_min + ' 分' : '待填'}</strong></td>
      <td>${d.score_avg > 0 ? d.score_avg + ' 分' : '待填'}</td>
      <td>${d.plan_count > 0 ? d.plan_count + ' 人' : '待填'}</td>
      <td>${(d.ratio * 100).toFixed(1)}%</td>
      <td style="color:#999;font-size:12px;">${d.note || '—'}</td>
    </tr>
  `).join('');
  document.getElementById('dataCountLabel').textContent = `共 ${dataFiltered.length} 条记录`;
  document.getElementById('dataPageNote').textContent = `第 ${dataCurrentPage} 页 / 共 ${totalPages} 页`;
  document.getElementById('dataPageInfo').textContent = `${dataCurrentPage} / ${totalPages}`;
  document.getElementById('dataPrevBtn').disabled = dataCurrentPage <= 1;
  document.getElementById('dataNextBtn').disabled = dataCurrentPage >= totalPages;
}

function prevDataPage() { if (dataCurrentPage > 1) { dataCurrentPage--; renderDataTable(); } }
function nextDataPage() {
  const totalPages = Math.ceil(dataFiltered.length / dataPageSize) || 1;
  if (dataCurrentPage < totalPages) { dataCurrentPage++; renderDataTable(); }
}

document.addEventListener('change', e => {
  if (['dataFilterMajor','dataFilterProvince'].includes(e.target.id)) applyDataFilters();
});
document.addEventListener('input', e => {
  if (e.target.id === 'dataFilterSchool') applyDataFilters();
});


// ======== 院校推荐页面 ========
let schoolAllData = [];
let schoolFiltered = [];
let schoolPageSize = 30;
let schoolPage = 1;

function initSchoolsTable() {
  // 合并一本二本数据
  schoolAllData = [...(DATA_SOURCE.schools || [])];
  // 初始化筛选选项
  const majors = [...new Set(schoolAllData.map(d => d.major))].sort();
  document.getElementById('schoolFilterMajor').innerHTML =
    '<option value="all">全部专业</option>' + majors.map(m => `<option value="${m}">${m}</option>`).join('');
  const provinces = [...new Set(schoolAllData.map(d => d.province))].sort();
  document.getElementById('schoolFilterProvince').innerHTML =
    '<option value="all">全部省份</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');
  applySchoolFilters();
}

function applySchoolFilters() {
  const major = document.getElementById('schoolFilterMajor').value;
  const province = document.getElementById('schoolFilterProvince').value;
  const search = document.getElementById('schoolFilterSearch').value.trim().toLowerCase();
  schoolFiltered = schoolAllData.filter(d => {
    if (major !== 'all' && d.major !== major) return false;
    if (province !== 'all' && d.province !== province) return false;
    if (search && !d.school.toLowerCase().includes(search) && !d.major.toLowerCase().includes(search)) return false;
    return true;
  });
  schoolPage = 1;
  renderSchoolTable();
}

function renderSchoolTable() {
  const tbody = document.getElementById('schoolTableBody');
  if (schoolFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    document.getElementById('schoolCountLabel').textContent = '共 0 条记录';
    document.getElementById('schoolPageNote').textContent = '第 0 / 0 页';
    document.getElementById('schoolPrevBtn').disabled = true;
    document.getElementById('schoolNextBtn').disabled = true;
    document.getElementById('schoolPageInfo').textContent = '0 / 0';
    return;
  }
  const totalPages = Math.ceil(schoolFiltered.length / schoolPageSize);
  const start = (schoolPage - 1) * schoolPageSize;
  const end = Math.min(start + schoolPageSize, schoolFiltered.length);
  const pageData = schoolFiltered.slice(start, end);
  tbody.innerHTML = pageData.map(d => `
    <tr>
      <td><strong>${d.school}</strong></td>
      <td><span class="batch-badge">${d.province}</span></td>
      <td>${d.city}</td>
      <td>${d.major}</td>
      <td><span class="${d.batch === '一本' ? 'tag-rush' : 'tag-safe'}">${d.batch}</span></td>
      <td><strong>${d.score_min > 0 ? d.score_min + ' 分' : '待填'}</strong></td>
      <td>${(d.ratio * 100).toFixed(1)}%</td>
      <td style="color:#999;font-size:12px;">${d.note || '—'}</td>
    </tr>
  `).join('');
  document.getElementById('schoolCountLabel').textContent = `共 ${schoolFiltered.length} 条记录`;
  document.getElementById('schoolPageNote').textContent = `第 ${schoolPage} 页 / 共 ${totalPages} 页`;
  document.getElementById('schoolPageInfo').textContent = `${schoolPage} / ${totalPages}`;
  document.getElementById('schoolPrevBtn').disabled = schoolPage <= 1;
  document.getElementById('schoolNextBtn').disabled = schoolPage >= totalPages;
}

function prevSchoolPage() { if (schoolPage > 1) { schoolPage--; renderSchoolTable(); } }
function nextSchoolPage() {
  const totalPages = Math.ceil(schoolFiltered.length / schoolPageSize) || 1;
  if (schoolPage < totalPages) { schoolPage++; renderSchoolTable(); }
}

document.addEventListener('change', e => {
  if (['schoolFilterMajor','schoolFilterProvince'].includes(e.target.id)) applySchoolFilters();
});
document.addEventListener('input', e => {
  if (e.target.id === 'schoolFilterSearch') applySchoolFilters();
});

// ======== 筛选方案页面 ========
// 当前编辑的专业和数据
let planCurrentMajor = '';
let planSchools = {};  // { '生物工程': [...], ... }
// 策略标记存储: {'生物工程': { 'school|major|batch': 'rush'|'steady'|'safe'|'ignore', ... }}
let planStrategies = {};

function initPlanningPage() {
  renderMajorTabs();
  showPlanningMajorList();
  loadSavedPlans();
}

function renderMajorTabs() {
  const container = document.getElementById('planningMajorTabs');
  container.innerHTML = MAJORS.map(m => `
    <button class="major-tab" onclick="openPlanningMajor('${m}')">
      ${m} <span class="count" id="majorCount_${m}">(0)</span>
    </button>
  `).join('');
}

function showPlanningMajorList() {
  document.getElementById('planningMajorList').style.display = 'block';
  document.getElementById('planningMajorView').style.display = 'none';
  document.getElementById('planningCurrentMajor').textContent = '所有专业';
  loadSavedPlans();
}

function loadSavedPlans() {
  // 从localStorage读取已保存的标记（以后可改为从data/main/ 加载）
  const saved = localStorage.getItem('volunteer_plan_strategies');
  if (saved) {
    try { planStrategies = JSON.parse(saved); } catch(e) { planStrategies = {}; }
  }
  // 统计每个专业已有标记的学校数
  MAJORS.forEach(m => {
    const key = m;
    const count = planStrategies[key] ? Object.keys(planStrategies[key]).length : 0;
    const el = document.getElementById('majorCount_' + m);
    if (el) el.textContent = `(${count})`;
  });
}

function openPlanningMajor(major) {
  planCurrentMajor = major;
  document.getElementById('planningMajorList').style.display = 'none';
  document.getElementById('planningMajorView').style.display = 'block';
  document.getElementById('planningCurrentMajor').textContent = major;

  // 收集该专业的所有学校（去重：同一学校同一批次同一专业只保留一条）
  const allData = [...(DATA_SOURCE.schools || [])];
  const schools = allData.filter(d => d.major === major && !d.school.includes('★'));
  // 去重
  const seen = new Set();
  const unique = [];
  schools.forEach(d => {
    const key = d.school + '|' + d.major + '|' + d.batch;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(d);
    }
  });
  // 按批次和省份排序
  planSchools[major] = unique.sort((a, b) => {
    if (a.batch !== b.batch) return a.batch === '一本' ? -1 : 1;
    return a.province.localeCompare(b.province);
  });

  // 初始化省份筛选
  const provinces = [...new Set(unique.map(d => d.province))].sort();
  document.getElementById('planProvinceFilter').innerHTML =
    '<option value="all">全部省份</option>' + provinces.map(p => `<option value="${p}">${p}</option>`).join('');

  renderPlanTable();
}

function renderPlanTable() {
  const major = planCurrentMajor;
  let schools = planSchools[major] || [];
  if (!schools.length) {
    document.getElementById('planTableBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:#999;padding:40px;">暂无数据</td></tr>';
    return;
  }

  // 应用筛选
  const provFilter = document.getElementById('planProvinceFilter')?.value || 'all';
  let filtered = schools.filter(d => {
    if (provFilter !== 'all' && d.province !== provFilter) return false;
    return true;
  });

  const tbody = document.getElementById('planTableBody');
  const strategies = planStrategies[major] || {};

  tbody.innerHTML = filtered.map((d, idx) => {
    const key = d.school + '|' + d.major + '|' + d.batch;
    const st = strategies[key] || '';
    const stOpts = ['','rush','steady','safe','ignore'].map(v =>
      `<option value="${v}" ${st === v ? 'selected' : ''}>${
        v === '' ? '—' : v === 'rush' ? '🚀 冲' : v === 'steady' ? '⚖️ 稳' : v === 'safe' ? '🛡️ 保' : '⏭️ 忽略'
      }</option>`
    ).join('');

    return `<tr>
      <td style="text-align:center;color:#999;">${idx + 1}</td>
      <td><strong>${d.school}</strong></td>
      <td><span class="batch-badge">${d.province}</span></td>
      <td>${d.major}</td>
      <td><span class="${d.batch === '一本' ? 'tag-rush' : 'tag-safe'}">${d.batch}</span></td>
      <td>${d.score_min > 0 ? d.score_min + ' 分' : '—'}</td>
      <td>
        <select class="strategy-select" data-major="${major}" data-school="${d.school}" data-major-name="${d.major}" data-batch="${d.batch}" onchange="updateStrategy(this)">
          ${stOpts}
        </select>
      </td>
      <td>
        <div class="sort-arrows">
          <button onclick="moveRow(this, -1)" title="上移">▲</button>
          <button onclick="moveRow(this, 1)" title="下移">▼</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateStrategy(sel) {
  const major = sel.dataset.major;
  const school = sel.dataset.school;
  const mn = sel.dataset.majorName;
  const batch = sel.dataset.batch;
  const key = school + '|' + mn + '|' + batch;
  if (!planStrategies[major]) planStrategies[major] = {};
  planStrategies[major][key] = sel.value;
  // 实时保存到 localStorage
  localStorage.setItem('volunteer_plan_strategies', JSON.stringify(planStrategies));
  // 更新计数
  const count = Object.keys(planStrategies[major]).length;
  const el = document.getElementById('majorCount_' + major);
  if (el) el.textContent = `(${count})`;
}

function moveRow(btn, direction) {
  const tr = btn.closest('tr');
  const tbody = tr.parentElement;
  const idx = Array.from(tbody.children).indexOf(tr);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= tbody.children.length) return;

  // 交换 DOM
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

  // 更新数据顺序
  const major = planCurrentMajor;
  const schools = planSchools[major];
  if (schools) {
    const newOrder = Array.from(tbody.children).map(row => {
      const sel = row.querySelector('.strategy-select');
      const school = sel.dataset.school;
      const mn = sel.dataset.majorName;
      const batch = sel.dataset.batch;
      return schools.find(d => d.school === school && d.major === mn && d.batch === batch);
    }).filter(Boolean);
    planSchools[major] = newOrder;
  }
}

// ======== 保存筛选方案 ========
function savePlan() {
  const major = planCurrentMajor;
  const schools = planSchools[major];
  if (!schools || !schools.length) {
    alert('⚠️ 当前专业无数据');
    return;
  }

  const strategies = planStrategies[major] || {};

  // 构建保存数据：保留排序和策略标记
  const planData = {
    major: major,
    version: new Date().toISOString().slice(0,10).replace(/-/g,''),
    updatedAt: new Date().toISOString(),
    schools: schools.map((d, idx) => {
      const key = d.school + '|' + d.major + '|' + d.batch;
      return {
        rank: idx + 1,
        school: d.school,
        province: d.province,
        city: d.city,
        major: d.major,
        batch: d.batch,
        score_min: d.score_min,
        ratio: d.ratio,
        note: d.note,
        strategy: strategies[key] || ''
      };
    })
  };

  // 保存到 localStorage（模拟保存到 data/main/）
  const storageKey = 'volunteer_plan_' + major;
  localStorage.setItem(storageKey, JSON.stringify(planData));

  // 生成可下载的JSON
  const filename = `${SAVED_DIR_PREFIX}${major}-${planData.version}.json`;
  const blob = new Blob([JSON.stringify(planData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace('data/main/', '');
  a.click();
  URL.revokeObjectURL(url);

  alert(`✅ 方案已保存：${filename}\n（同时已保存到浏览器本地）`);
}

// ======== 导出TXT方案 ========
function exportPlanTxt() {
  const major = planCurrentMajor;
  const schools = planSchools[major];
  if (!schools || !schools.length) return;

  const strategies = planStrategies[major] || {};
  const ts = new Date().toLocaleString();

  const lines = [
    '══════════════════════════════════',
    `   志愿填报助手 — 筛选方案（${major}）`,
    `   考生分数：${CONFIG.student.score} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    ...schools.map((d, idx) => {
      const key = d.school + '|' + d.major + '|' + d.batch;
      const st = strategies[key] || '—';
      const stLabel = st === 'rush' ? '🚀 冲刺' : st === 'steady' ? '⚖️ 稳妥' : st === 'safe' ? '🛡️ 保底' : st === 'ignore' ? '⏭️ 忽略' : '—';
      return `${String(idx + 1).padStart(2)}. ${d.school} | ${d.major} | ${d.batch} | ${d.score_min > 0 ? d.score_min + '分' : '—'} | ${stLabel}`;
    }),
    '',
    '⚠️ 以上为 AI 辅助推荐，请结合招生计划最终确认'
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `志愿方案_${major}_${CONFIG.student.score}分.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ======== 导出JSON数据 ========
function exportPlanJSON() {
  savePlan(); // 复用保存逻辑
}

// ======== 志愿方案页面 ========
function loadPlanSummary() {
  const container = document.getElementById('planSummary');

  // 从 localStorage 读取所有已保存的plan
  let rushItems = [];
  let steadyItems = [];
  let safeItems = [];

  MAJORS.forEach(m => {
    const key = 'volunteer_plan_' + m;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        (data.schools || []).forEach(s => {
          if (s.strategy === 'rush') rushItems.push(s);
          else if (s.strategy === 'steady') steadyItems.push(s);
          else if (s.strategy === 'safe') safeItems.push(s);
        });
      } catch(e) {}
    }
  });

  container.innerHTML = `
    <div class="settings-card">
      <p>📊 共加载 <strong>${rushItems.length + steadyItems.length + safeItems.length}</strong> 条排序方案</p>
      <p style="font-size:13px;color:#666;margin-top:4px;">
        🚀 冲刺 ${rushItems.length} 项 · ⚖️ 稳妥 ${steadyItems.length} 项 · 🛡️ 保底 ${safeItems.length} 项
      </p>
    </div>
  `;

  renderPlanList('planRushList', rushItems, '🚀 冲刺');
  renderPlanList('planSteadyList', steadyItems, '⚖️ 稳妥');
  renderPlanList('planSafeList', safeItems, '🛡️ 保底');
}

function renderPlanList(id, items, label) {
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = '<p class="plan-empty">暂无</p>';
    return;
  }
  el.innerHTML = items.map((s, i) => `
    <div class="plan-item">
      <div class="plan-item-info">
        <span class="plan-item-school">${i + 1}. ${s.school}</span>
        <span class="plan-item-detail">${s.major} · ${s.batch} · ${s.province}${s.note ? ' · ' + s.note : ''}</span>
      </div>
      <span class="plan-item-score">${s.score_min > 0 ? s.score_min + '分' : '—'}</span>
    </div>
  `).join('');
}

// ======== 导出最终方案 ========
function exportFinalPlan() {
  let rushItems = [], steadyItems = [], safeItems = [];
  MAJORS.forEach(m => {
    const saved = localStorage.getItem('volunteer_plan_' + m);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        (data.schools || []).forEach(s => {
          if (s.strategy === 'rush') rushItems.push(s);
          else if (s.strategy === 'steady') steadyItems.push(s);
          else if (s.strategy === 'safe') safeItems.push(s);
        });
      } catch(e) {}
    }
  });

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
    ...rushItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major} | ${s.batch} | ${s.province}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
    '',
    `【⚖️ 稳妥志愿】（${steadyItems.length} 项）`,
    ...steadyItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major} | ${s.batch} | ${s.province}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
    '',
    `【🛡️ 保底志愿】（${safeItems.length} 项）`,
    ...safeItems.map((s, i) => `  ${i + 1}. ${s.school} | ${s.major} | ${s.batch} | ${s.province}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}`),
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
  if (['planProvinceFilter'].includes(e.target.id)) {
    renderPlanTable();
  }
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
  if (cookies['auth_token'] === 'alexia!2026$') {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  }
})();