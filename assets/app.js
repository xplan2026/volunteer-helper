// ======== 密码验证 ========
function checkPassword() {
  const pw = document.getElementById('passwordInput').value;
  if (pw === (CONFIG.auth?.password || 'alexia!2026$')) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    document.getElementById('loginError').textContent = '❌ 密码错误，请重试';
  }
}
document.getElementById('passwordInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });

// ======== 应用初始化 ========
function initApp() {
  renderDashboard();
  renderSchools();
  setupNavigation();
}

// ======== 导航切换 ========
function setupNavigation() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page)?.classList.add('active');
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

  // 倒计时
  const deadline = new Date(s.deadline);
  const now = new Date();
  const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  document.getElementById('countdownDays').textContent = Math.max(0, diff);

  // 专业列表
  const ml = document.getElementById('majorsList');
  ml.innerHTML = CONFIG.majors.map((m, i) =>
    `<li>${i + 1}. ${m.name} ${m.weight ? `（权重: ${m.weight}）` : ''}</li>`
  ).join('');

  // 城市列表
  const cl = document.getElementById('citiesList');
  cl.innerHTML = CONFIG.cities.map((c, i) =>
    `<li>${i + 1}. ${c.name} ${c.weight ? `（权重: ${c.weight}）` : ''}</li>`
  ).join('');
}

// ======== 院校推荐渲染 ========
let filteredSchools = [];

function getSchools() {
  return CONFIG.schools;
}

function renderSchools() {
  const majorFilter = document.getElementById('filterMajor')?.value || 'all';
  const cityFilter = document.getElementById('filterCity')?.value || 'all';
  const strategyFilter = document.getElementById('filterStrategy')?.value || 'all';

  const score = CONFIG.student.score;

  filteredSchools = getSchools().filter(s => {
    if (majorFilter !== 'all' && s.id !== majorFilter) {
      // match by major name
    }
    if (cityFilter !== 'all' && s.city !== cityFilter) return false;
    if (strategyFilter !== 'all') {
      if (strategyFilter === 'rush' && s.tag !== 'rush') return false;
      if (strategyFilter === 'steady' && s.tag !== 'steady') return false;
      if (strategyFilter === 'safe' && s.tag !== 'safe') return false;
    }
    return true;
  });

  // 按匹配度排序：同策略内 stable 优先
  filteredSchools.sort((a, b) => b.score - a.score);

  const tbody = document.getElementById('schoolList');
  const note = document.getElementById('schoolCountNote');

  if (filteredSchools.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:40px;">暂无匹配的院校数据</td></tr>';
    note.textContent = '共 0 条记录';
    return;
  }

  tbody.innerHTML = filteredSchools.map(s => {
    const diff = s.score - score;
    const tagHtml = s.tag === 'rush' ? '<span class="tag-rush">🚀 冲刺</span>'
      : s.tag === 'steady' ? '<span class="tag-steady">⚖️ 稳妥</span>'
      : '<span class="tag-safe">🛡️ 保底</span>';

    const scoreDiff = diff > 0 ? `+${diff}` : diff;
    const matchPct = calcMatch(s);
    const barClass = matchPct >= 70 ? 'match-high' : matchPct >= 40 ? 'match-mid' : 'match-low';

    return `<tr>
      <td><strong>${s.school}</strong><br><span style="font-size:12px;color:#999;">${s.note}</span></td>
      <td>${s.major}</td>
      <td>${s.cityName}</td>
      <td>${s.score}${s.score ? ` (${scoreDiff})` : '—'}</td>
      <td>${s.rank || '—'}</td>
      <td>${tagHtml}</td>
      <td>
        <div class="match-bar-bg"><div class="match-bar-fill ${barClass}" style="width:${matchPct}%"></div></div>
        ${matchPct}%
      </td>
    </tr>`;
  }).join('');

  note.textContent = `共 ${filteredSchools.length} 条记录`;
}

function calcMatch(s) {
  const score = CONFIG.student.score;
  const diff = s.score - score;
  if (!diff && diff !== 0) return 50;
  if (diff > 10) return Math.max(5, 30 - diff * 2);       // 差太多 → 低匹配
  if (diff > 0) return Math.max(30, 60 - diff * 3);         // 略高 → 可冲
  if (diff >= -5) return 80 + diff * 2;                     // 差不多 → 高匹配
  if (diff >= -15) return 60 + diff * 1.5;                   // 略低 → 稳妥
  return 95;                                                  // 很低 → 保底
}

// 监听筛选变化
document.addEventListener('change', e => {
  if (['filterMajor', 'filterCity', 'filterStrategy'].includes(e.target.id)) {
    renderSchools();
  }
});

// ======== 志愿方案生成 ========
function generatePlan() {
  const score = CONFIG.student.score;
  const all = getSchools();

  const planRush = all.filter(s => s.tag === 'rush').sort((a, b) => a.score - b.score);
  const planSteady = all.filter(s => s.tag === 'steady').sort((a, b) => b.score - a.score);
  const planSafe = all.filter(s => s.tag === 'safe').sort((a, b) => b.score - a.score);

  renderPlanList('planRushList', planRush, '🚀');
  renderPlanList('planSteadyList', planSteady, '⚖️');
  renderPlanList('planSafeList', planSafe, '🛡️');
}

function renderPlanList(id, items, emoji) {
  const el = document.getElementById(id);
  if (items.length === 0) {
    el.innerHTML = '<p class="plan-empty">暂无推荐</p>';
    return;
  }
  el.innerHTML = items.map(s => `
    <div class="plan-item">
      <div class="plan-item-info">
        <span class="plan-item-school">${s.school}</span>
        <span class="plan-item-detail">${s.major} · ${s.cityName} · ${s.note}</span>
      </div>
      <span class="plan-item-score">${s.score}分</span>
    </div>
  `).join('');
}

// ======== 导出方案 ========
function exportPlan() {
  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 推荐方案',
    `   考生分数：${CONFIG.student.score} 分`,
    `   一本线：${CONFIG.student.batchLine} 分`,
    `   生成时间：${new Date().toLocaleString()}`,
    '══════════════════════════════════',
    '',
    '【🚀 冲刺志愿】',
    ...getTagSchools('rush').map(s => `  ${s.school} | ${s.major} | ${s.score}分`),
    '',
    '【⚖️ 稳妥志愿】',
    ...getTagSchools('steady').map(s => `  ${s.school} | ${s.major} | ${s.score}分`),
    '',
    '【🛡️ 保底志愿】',
    ...getTagSchools('safe').map(s => `  ${s.school} | ${s.major} | ${s.score}分`),
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

function getTagSchools(tag) {
  return getSchools().filter(s => s.tag === tag);
}

// ======== 数据表页面 ========
let dataStore = [];           // 当前显示的完整数据
let dataFiltered = [];        // 筛选后的数据
let dataPageSize = 20;        // 每页显示条数
let dataCurrentPage = 1;      // 当前页码
let dataBatch = 'yiben';      // 当前批次 yiben/erben

// 加载 JSON 数据
async function loadData(batch) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">⏳ 加载数据中…</td></tr>';

  try {
    const resp = await fetch(`data/${batch}_schools.json`);
    if (!resp.ok) throw new Error('数据文件未找到');
    const data = await resp.json();
    dataStore = data.schools || [];
    dataBatch = batch;

    // 初始化筛选器选项
    initDataFilters();

    // 应用筛选
    applyDataFilters();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#d93025;padding:40px;">❌ 加载失败：${e.message}</td></tr>`;
  }
}

// 初始化筛选器选项
function initDataFilters() {
  // 专业
  const majors = [...new Set(dataStore.map(d => d.major))].sort();
  const majorSel = document.getElementById('dataFilterMajor');
  majorSel.innerHTML = '<option value="all">全部专业</option>' +
    majors.map(m => `<option value="${m}">${m}</option>`).join('');

  // 省份
  const provinces = [...new Set(dataStore.map(d => d.province))].sort();
  const provSel = document.getElementById('dataFilterProvince');
  provSel.innerHTML = '<option value="all">全部省份</option>' +
    provinces.map(p => `<option value="${p}">${p}</option>`).join('');
}

// 应用筛选
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

// 渲染数据表格
function renderDataTable() {
  const tbody = document.getElementById('dataTableBody');
  const note = document.getElementById('dataPageNote');

  if (dataFiltered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    document.getElementById('dataCountLabel').textContent = '共 0 条记录';
    note.textContent = '第 0 / 0 页';
    updatePagination();
    return;
  }

  const totalPages = Math.ceil(dataFiltered.length / dataPageSize);
  const start = (dataCurrentPage - 1) * dataPageSize;
  const end = Math.min(start + dataPageSize, dataFiltered.length);
  const pageData = dataFiltered.slice(start, end);

  tbody.innerHTML = pageData.map(d => `
    <tr>
      <td><span class="school-name">${d.school}</span></td>
      <td>${d.major}</td>
      <td><span class="province-badge">${d.province}</span></td>
      <td>${d.city}</td>
      <td><strong>${d.score}</strong> 分</td>
      <td>${(d.ratio * 100).toFixed(1)}%</td>
      <td style="color:#999;font-size:12px;">${d.note || '—'}</td>
    </tr>
  `).join('');

  document.getElementById('dataCountLabel').textContent =
    `共 ${dataFiltered.length} 条记录（${dataBatch === 'yiben' ? '一本' : '二本'}）`;
  note.textContent = `第 ${dataCurrentPage} 页 / 共 ${totalPages} 页`;
  updatePagination();
}

// 分页控件
function updatePagination() {
  const totalPages = Math.ceil(dataFiltered.length / dataPageSize) || 1;
  document.getElementById('dataPageInfo').textContent = `${dataCurrentPage} / ${totalPages}`;
  document.getElementById('dataPrevBtn').disabled = dataCurrentPage <= 1;
  document.getElementById('dataNextBtn').disabled = dataCurrentPage >= totalPages;
}

function prevDataPage() {
  if (dataCurrentPage > 1) {
    dataCurrentPage--;
    renderDataTable();
  }
}

function nextDataPage() {
  const totalPages = Math.ceil(dataFiltered.length / dataPageSize) || 1;
  if (dataCurrentPage < totalPages) {
    dataCurrentPage++;
    renderDataTable();
  }
}

// ======== 数据表筛选事件绑定 ========
document.addEventListener('change', e => {
  if (['dataFilterMajor', 'dataFilterProvince'].includes(e.target.id)) {
    applyDataFilters();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'dataFilterSchool') {
    applyDataFilters();
  }
});

// Tab 切换
document.addEventListener('click', e => {
  if (e.target.classList.contains('data-tab')) {
    document.querySelectorAll('.data-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    loadData(e.target.dataset.batch);
  }
});

// 修改导航切换，进入数据表页时加载数据
const origSetup = setupNavigation;
setupNavigation = function() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const page = link.dataset.page;
      document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + page)?.classList.add('active');

      // 进入数据表页时加载
      if (page === 'data') {
        loadData('yiben');
      }
    });
  });
};
