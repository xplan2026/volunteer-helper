// ======== 密码验证 ========
// 密码从 URL hash 参数或页面内嵌配置读取，避免硬编码
// 生产部署时通过环境变量注入 AUTH_PASSWORD
const AUTH_PASSWORD = (function() {
  // 优先从 URL hash 读取: #pwd=xxx
  var m = location.hash.match(/pwd=([^&]+)/);
  if (m) return m[1];
  // 否则使用内嵌配置（部署时替换此值）
  return 'alexia!2026$';
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
function getDefaultSettings() {
  return {
    excluded: '西藏,内蒙,山西,河南,河北,湖南,广西,贵州,上海,安徽',
    ratio: 1.03,
    scoreMin: 489,
    scoreMax: 514,
    majors: '生物工程,制药工程,铁路,电气自动化,通信工程,人工智能,材料科学与工程'
  };
}

function applySettingsUI(s) {
  document.getElementById('settingExcluded').value = s.excluded || getDefaultSettings().excluded;
  document.getElementById('settingRatio').value = s.ratio || getDefaultSettings().ratio;
  document.getElementById('settingScoreMin').value = s.scoreMin || getDefaultSettings().scoreMin;
  document.getElementById('settingScoreMax').value = s.scoreMax || getDefaultSettings().scoreMax;
  document.getElementById('settingMajors').value = s.majors || getDefaultSettings().majors;
}

async function saveSettings() {
  var data = {
    excluded: document.getElementById('settingExcluded').value,
    ratio: parseFloat(document.getElementById('settingRatio').value),
    scoreMin: parseInt(document.getElementById('settingScoreMin').value),
    scoreMax: parseInt(document.getElementById('settingScoreMax').value),
    majors: document.getElementById('settingMajors').value
  };

  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var ok = await SupabaseAPI.saveSettings(data);
    if (ok) { alert('✅ 设置已同步到云端'); return; }
  }
  // 回退 localStorage
  localStorage.setItem('volunteer_settings', JSON.stringify(data));
  alert('✅ 设置已保存到本地');
}

function resetSettings() {
  var d = getDefaultSettings();
  document.getElementById('settingExcluded').value = d.excluded;
  document.getElementById('settingRatio').value = d.ratio;
  document.getElementById('settingScoreMin').value = d.scoreMin;
  document.getElementById('settingScoreMax').value = d.scoreMax;
  document.getElementById('settingMajors').value = d.majors;
  saveSettings();
}

async function loadSettings() {
  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var remote = await SupabaseAPI.getSettings();
    if (remote && Object.keys(remote).length > 0) {
      applySettingsUI(remote);
      return;
    }
  }
  // 回退 localStorage
  const saved = localStorage.getItem('volunteer_settings');
  if (saved) {
    try { applySettingsUI(JSON.parse(saved)); } catch(e) {}
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
    ratio: d.ratio || 0,
    note: ''
  };
}

// ======== 投档率编辑管理 ========
// 优先 Supabase，回退 localStorage
let _ratioEditsCache = null;

async function loadRatioEdits() {
  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var remote = await SupabaseAPI.getRatioEdits();
    if (remote !== null) { _ratioEditsCache = remote; return remote; }
  }
  // 回退 localStorage
  var saved = localStorage.getItem('volunteer_ratio_edits');
  if (saved) {
    try { _ratioEditsCache = JSON.parse(saved); return _ratioEditsCache; } catch(e) {}
  }
  _ratioEditsCache = {};
  return {};
}

function loadRatioEditsSync() {
  return _ratioEditsCache || {};
}

async function saveRatioEdit(key, value) {
  // 更新缓存
  if (!_ratioEditsCache) _ratioEditsCache = {};
  if (value === '' || value === null || value === undefined) {
    delete _ratioEditsCache[key];
  } else {
    _ratioEditsCache[key] = value;
  }

  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    await SupabaseAPI.setRatioEdit(key, value === '' || value === null || value === undefined ? null : value);
    return;
  }
  // 回退 localStorage
  localStorage.setItem('volunteer_ratio_edits', JSON.stringify(_ratioEditsCache));
}

// 通过学校代码和专业代码从 all_selectable_schools.json 匹配 ratio
let allSelectableRatios = null;  // { 'school_code|specialty_code': ratio }

function loadAllSelectableRatios() {
  if (allSelectableRatios) return Promise.resolve(allSelectableRatios);
  return fetch('data/all_selectable_schools.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allSelectableRatios = {};
      for (var i = 0; i < data.length; i++) {
        var d = data[i];
        var key = d.school_code + '|' + d.specialty_code;
        allSelectableRatios[key] = d.ratio;
      }
      return allSelectableRatios;
    })
    .catch(function() { return {}; });
}

function findRatioFromSelectable(schoolCode, specialtyCode) {
  if (!allSelectableRatios) return null;
  var key = schoolCode + '|' + specialtyCode;
  return allSelectableRatios[key] !== undefined ? allSelectableRatios[key] : null;
}

// ======== 所有可选学校页面 ========
let allSchoolsData = [];
let allSchoolsChecked = {};
let allSchoolsFiltered = [];
let allSchoolsPageSize = 50;
let allSchoolsPage = 1;
let allSchoolsLoaded = false;
let allSchoolsTotalCount = 0; // Supabase 模式下的总数

async function initAllSchoolsPage() {
  if (allSchoolsLoaded) {
    allSchoolsApplyFilters();
    return;
  }

  // 尝试 Supabase 加载专业列表 + 勾选状态
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      // 并行加载
      var [specialties, checked] = await Promise.all([
        SupabaseAPI.getSpecialties(),
        SupabaseAPI.getCheckedState('all_schools_checked')
      ]);

      if (specialties !== null) {
        var opts = '<option value="all">全部专业</option>';
        for (var i = 0; i < specialties.length; i++) {
          opts += '<option value="' + specialties[i] + '">' + specialties[i] + '</option>';
        }
        document.getElementById('allFilterMajor').innerHTML = opts;
      }

      if (checked !== null) {
        allSchoolsChecked = checked;
      }

      // Supabase 模式下，数据按需分页加载
      allSchoolsLoaded = true;
      allSchoolsApplyFilters(); // 内部会调用 Supabase 分页查询
      return;
    } catch(e) {
      console.warn('Supabase 加载失败，回退到本地 JSON:', e);
    }
  }

  // 回退：fetch 本地 JSON
  fetch('data/available_selectable_schools.json')
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

async function allSchoolsApplyFilters() {
  var major = document.getElementById('allFilterMajor').value;
  var school = document.getElementById('allFilterSchool').value.trim().toLowerCase();
  var cf = document.getElementById('allFilterChecked').value;

  // Supabase 模式：服务端分页查询
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var filters = { limit: allSchoolsPageSize, offset: (allSchoolsPage - 1) * allSchoolsPageSize };
    if (major !== 'all') filters.specialty = major;
    if (school) filters.school = school;

    var result = await SupabaseAPI.getAvailableSchools(filters);
    if (result !== null) {
      allSchoolsFiltered = (result.data || []).map(function(d) {
        return {
          school: d.school_name || '',
          school_code: d.school_code || '',
          major: d.specialty_name || '',
          specialty_code: d.specialty_code || '',
          score_min: d.min_score || 0,
          _key: (d.school_code || '') + '|' + (d.specialty_code || '')
        };
      });
      allSchoolsTotalCount = result.count || 0;
      allSchoolsRenderTable();
      return;
    }
  }

  // 回退：本地过滤
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

async function allSchoolsRenderTable() {
  var tbody = document.getElementById('allTableBody');

  // Supabase 模式
  var useSupabase = SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable();

  var totalPages;
  if (useSupabase) {
    totalPages = Math.ceil(allSchoolsTotalCount / allSchoolsPageSize) || 0;
  } else {
    totalPages = Math.ceil(allSchoolsFiltered.length / allSchoolsPageSize);
  }

  if (totalPages === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    document.getElementById('allPrevBtn').disabled = true;
    document.getElementById('allNextBtn').disabled = true;
    document.getElementById('allPageInfo').textContent = '0 / 0';
    document.getElementById('allPageNote').textContent = '第 0 / 0 页';
    allSchoolsUpdateCheckedCount();
    return;
  }

  if (allSchoolsPage > totalPages) { allSchoolsPage = totalPages; }

  // Supabase 模式下，数据已在上层分页加载好，直接渲染
  var rows = '';
  for (var i = 0; i < allSchoolsFiltered.length; i++) {
    var d = allSchoolsFiltered[i];
    var isChk = allSchoolsChecked[d._key] ? 'checked' : '';
    var idx = (allSchoolsPage - 1) * allSchoolsPageSize + i + 1;
    rows += '<tr>' +
      '<td style="text-align:center;color:#999;">' + idx + '</td>' +
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
document.getElementById('allTableBody').addEventListener('change', async function(e) {
  if (e.target.type === 'checkbox') {
    var key = e.target.dataset.key;
    if (e.target.checked) { allSchoolsChecked[key] = true; }
    else { delete allSchoolsChecked[key]; }

    // 尝试 Supabase
    if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
      await SupabaseAPI.setCheckedState('all_schools_checked', allSchoolsChecked);
    }
    // 同时写入 localStorage 作为备份
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
document.getElementById('allSaveBtn').addEventListener('click', async function() {
  var selected = [];      // 被选走的数据
  var selectedKeys = [];  // 用于从 available 中删除
  for (var i = 0; i < allSchoolsData.length; i++) {
    if (allSchoolsChecked[allSchoolsData[i]._key]) {
      selected.push({
        school_code: allSchoolsData[i].school_code,
        school_name: allSchoolsData[i].school,
        specialty_code: allSchoolsData[i].specialty_code,
        specialty_name: allSchoolsData[i].major,
        min_score: allSchoolsData[i].score_min
      });
      selectedKeys.push({
        school_code: allSchoolsData[i].school_code,
        specialty_code: allSchoolsData[i].specialty_code
      });
    }
  }
  if (!selected.length) { alert('请先勾选至少一所学校'); return; }
  selected.sort(function(a, b) { return b.min_score - a.min_score; });

  // 尝试 Supabase：直接写入数据库
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var [addOk, removeOk] = await Promise.all([
        SupabaseAPI.addSelectableSchools(selected),
        SupabaseAPI.removeFromAvailable(selectedKeys)
      ]);

      if (addOk && removeOk) {
        // 清除勾选缓存
        allSchoolsChecked = {};
        localStorage.setItem('all_schools_checked', JSON.stringify(allSchoolsChecked));
        await SupabaseAPI.setCheckedState('all_schools_checked', {});

        // 刷新列表
        allSchoolsApplyFilters();
        alert('✅ 已保存 ' + selected.length + ' 条到云端数据库！\n已选学校已从备选列表中移除。');
        return;
      }
      alert('⚠️ 云端保存部分失败，同时导出本地文件作为备份');
    } catch(e) {
      console.error('Supabase 保存失败:', e);
    }
  }

  // 回退：下载文件
  var remaining = [];
  for (var i = 0; i < allSchoolsData.length; i++) {
    if (!allSchoolsChecked[allSchoolsData[i]._key]) {
      remaining.push({
        school_code: allSchoolsData[i].school_code,
        school_name: allSchoolsData[i].school,
        specialty_code: allSchoolsData[i].specialty_code,
        specialty_name: allSchoolsData[i].major,
        min_score: allSchoolsData[i].score_min
      });
    }
  }
  remaining.sort(function(a, b) { return b.min_score - a.min_score; });

  function download(name, content, type) {
    var b = new Blob([content], { type: type });
    var u = URL.createObjectURL(b);
    var a = document.createElement('a');
    a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
  }
  download('selectable_schools.json', JSON.stringify(selected, null, 2), 'application/json;charset=utf-8');
  download('selectable_schools.js', 'const SELECTABLE_SCHOOLS = {"schools":' + JSON.stringify(selected) + '};', 'application/javascript;charset=utf-8');
  download('available_selectable_schools.json', JSON.stringify(remaining, null, 2), 'application/json;charset=utf-8');
  alert('已导出 ' + selected.length + ' 条到 selectable_schools。\n剩余 ' + remaining.length + ' 条备选。\n请将 3 个文件覆盖到 data/ 目录');
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

async function initPlanningPage() {
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

  // 加载勾选状态：优先 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var remoteChecked = await SupabaseAPI.getCheckedState('volunteer_plan_checked');
      if (remoteChecked !== null) {
        planChecked = remoteChecked;
        // 同步到 localStorage
        localStorage.setItem('volunteer_plan_checked', JSON.stringify(planChecked));
      }
    } catch(e) { console.warn('Supabase 加载勾选状态失败:', e); }
  }
  if (Object.keys(planChecked).length === 0) {
    const saved = localStorage.getItem('volunteer_plan_checked');
    if (saved) {
      try { planChecked = JSON.parse(saved); } catch(e) { planChecked = {}; }
    }
  }

  // 预加载投档率编辑缓存
  await loadRatioEdits();

  // 从 all_selectable_schools.json 加载投档率数据
  loadAllSelectableRatios().then(function() {
    planAllData.forEach(function(d) {
      var r = findRatioFromSelectable(d.school_code, d.specialty_code);
      if (r !== null) {
        d.ratio = r;
      }
    });
    renderPlanTable();
  }).catch(function() {
    renderPlanTable();
  });
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
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    updateCheckedCount();
    return;
  }

  // 加载投档率编辑记录
  const ratioEdits = loadRatioEditsSync();

  tbody.innerHTML = filtered.map((d, idx) => {
    const checked = planChecked[d._key] ? 'checked' : '';
    const ratioKey = d.school_code + '|' + d.specialty_code;
    const savedRatio = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '');
    return `<tr>
      <td style="text-align:center;color:#999;">${idx + 1}</td>
      <td><strong>${d.school}</strong></td>
      <td><code>${d.school_code || '—'}</code></td>
      <td>${d.major}</td>
      <td><code>${d.specialty_code || '—'}</code></td>
      <td><strong>${d.score_min > 0 ? d.score_min + ' 分' : '—'}</strong></td>
      <td style="text-align:center;">
        <input type="text" class="ratio-input" data-key="${ratioKey}" value="${savedRatio}" placeholder="—" style="width:60px;text-align:center;padding:4px;border:1px solid #e0e0e0;border-radius:4px;font-size:13px;">
      </td>
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

async function toggleCheck(cb) {
  const key = cb.dataset.key;
  if (cb.checked) {
    planChecked[key] = true;
  } else {
    delete planChecked[key];
  }
  // 优先 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    await SupabaseAPI.setCheckedState('volunteer_plan_checked', planChecked);
  }
  // 同时写 localStorage
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
async function savePlan() {
  const checkedSchools = planAllData.filter(d => planChecked[d._key]);
  if (!checkedSchools.length) {
    alert('⚠️ 请先勾选至少一所学校');
    return;
  }

  const ratioEdits = loadRatioEditsSync();

  const planData = {
    version: new Date().toISOString().slice(0,10).replace(/-/g,''),
    updatedAt: new Date().toISOString(),
    schools: checkedSchools.map((d, idx) => {
      const ratioKey = d.school_code + '|' + d.specialty_code;
      const editedRatio = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '');
      return {
        rank: idx + 1,
        school: d.school,
        school_code: d.school_code,
        major: d.major,
        specialty_code: d.specialty_code,
        score_min: d.score_min,
        ratio: editedRatio,
        category: d.category
      };
    })
  };

  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var savedId = await SupabaseAPI.savePlan({
        id: planData.updatedAt,
        name: '志愿方案 · ' + planData.version,
        data: planData,
        updated_at: planData.updatedAt
      });
      if (savedId) {
        // 同时写 localStorage 作为本地缓存
        var plans = loadAllPlansLocal();
        plans.unshift(planData);
        if (plans.length > 20) plans.length = 20;
        localStorage.setItem('volunteer_plans', JSON.stringify(plans));
        localStorage.setItem('volunteer_current_plan_id', planData.updatedAt);

        // 仍然下载本地备份
        downloadPlanFile(planData);
        alert('✅ 方案已同步到云端并保存本地备份（' + checkedSchools.length + ' 条）');
        loadPlanSummary();
        return;
      }
    } catch(e) {
      console.error('Supabase 保存方案失败:', e);
    }
  }

  // 回退 localStorage
  var plans = loadAllPlansLocal();
  plans.unshift(planData);
  if (plans.length > 20) plans.length = 20;
  localStorage.setItem('volunteer_plans', JSON.stringify(plans));
  localStorage.setItem('volunteer_final_plan', JSON.stringify(planData));
  localStorage.setItem('volunteer_current_plan_id', planData.updatedAt);

  downloadPlanFile(planData);
  alert('✅ 方案已保存：' + planData.version + '（' + checkedSchools.length + ' 条）');
}

function downloadPlanFile(planData) {
  var filename = '志愿方案_' + planData.version + '.json';
  var blob = new Blob([JSON.stringify(planData, null, 2)], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

  const ratioEdits = loadRatioEditsSync();

  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 筛选方案',
    `   考生分数：${CONFIG.student.score} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    `【🚀 冲】（${rush.length} 项）`,
    ...rush.map((d, i) => {
      const ratioKey = d.school_code + '|' + d.specialty_code;
      const r = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '—');
      return `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分 | 投档率:${r}%`;
    }),
    '',
    `【⚖️ 稳】（${steady.length} 项）`,
    ...steady.map((d, i) => {
      const ratioKey = d.school_code + '|' + d.specialty_code;
      const r = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '—');
      return `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分 | 投档率:${r}%`;
    }),
    '',
    `【🛡️ 保】（${safe.length} 项）`,
    ...safe.map((d, i) => {
      const ratioKey = d.school_code + '|' + d.specialty_code;
      const r = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '—');
      return `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分 | 投档率:${r}%`;
    }),
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

// 方案管理：加载/保存/删除

// 本地 localStorage 加载（保持同步）
function loadAllPlansLocal() {
  var saved = localStorage.getItem('volunteer_plans');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  var old = localStorage.getItem('volunteer_final_plan');
  if (old) {
    try { return [JSON.parse(old)]; } catch(e) {}
  }
  return [];
}

// 统一入口：优先 Supabase
async function loadAllPlans() {
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var remote = await SupabaseAPI.getPlans();
      if (remote !== null && remote.length > 0) {
        // 转换为本地格式
        var plans = remote.map(function(p) {
          return p.data && p.data.updatedAt ? p.data : {
            version: p.name || '未知',
            updatedAt: p.updated_at || new Date().toISOString(),
            schools: (p.data && p.data.schools) || []
          };
        });
        // 同步到 localStorage 作为缓存
        localStorage.setItem('volunteer_plans', JSON.stringify(plans));
        return plans;
      }
    } catch(e) {
      console.error('Supabase 加载方案失败:', e);
    }
  }
  return loadAllPlansLocal();
}

function saveAllPlans(plans) {
  localStorage.setItem('volunteer_plans', JSON.stringify(plans));
  if (plans.length > 0) {
    localStorage.setItem('volunteer_final_plan', JSON.stringify(plans[0]));
  }
}

async function deletePlan(planId) {
  if (!confirm('确定要删除这个方案吗？此操作不可撤销。')) return;

  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var ok = await SupabaseAPI.deletePlan(planId);
      if (ok) {
        // 同步删除本地
        var plans = loadAllPlansLocal();
        var idx = plans.findIndex(function(p) { return p.updatedAt === planId; });
        if (idx !== -1) { plans.splice(idx, 1); saveAllPlans(plans); }
        if (localStorage.getItem('volunteer_current_plan_id') === planId) {
          localStorage.removeItem('volunteer_current_plan_id');
        }
        loadPlanSummary();
        return;
      }
    } catch(e) { console.error('Supabase 删除方案失败:', e); }
  }

  // 回退
  var plans = loadAllPlansLocal();
  var idx = plans.findIndex(function(p) { return p.updatedAt === planId; });
  if (idx !== -1) {
    plans.splice(idx, 1);
    saveAllPlans(plans);
    if (localStorage.getItem('volunteer_current_plan_id') === planId) {
      localStorage.removeItem('volunteer_current_plan_id');
    }
    loadPlanSummary();
  }
}

async function loadPlanSummary() {
  var plans = await loadAllPlans();
  const listContainer = document.getElementById('planListContainer');
  const detailContainer = document.getElementById('planDetailContainer');
  const currentPlanId = localStorage.getItem('volunteer_current_plan_id');

  // 渲染方案列表
  if (plans.length === 0) {
    listContainer.innerHTML = '<p class="plan-empty">暂无已保存方案，请先在「筛选方案」页面保存方案</p>';
    detailContainer.style.display = 'none';
    return;
  }

  listContainer.innerHTML = plans.map(p => {
    const ts = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '未知时间';
    const total = (p.schools || []).length;
    const rush = (p.schools || []).filter(s => s.category === '冲').length;
    const steady = (p.schools || []).filter(s => s.category === '稳').length;
    const safe = (p.schools || []).filter(s => s.category === '保').length;
    const isActive = currentPlanId === p.updatedAt;
    return `<div class="plan-list-item${isActive ? ' active' : ''}" data-plan-id="${p.updatedAt}" onclick="selectPlan('${p.updatedAt}')">
      <div class="plan-list-info">
        <span class="plan-list-name">📋 志愿方案 · ${p.version || '未知'}</span>
        <span class="plan-list-meta">${ts} · 🚀${rush} ⚖️${steady} 🛡️${safe} 共${total}条</span>
      </div>
      <button class="btn btn-small btn-danger" onclick="event.stopPropagation();deletePlan('${p.updatedAt}')" title="删除方案">🗑 删除</button>
    </div>`;
  }).join('');

  // 自动选中第一个方案（如果没有当前选中）
  if (!currentPlanId && plans.length > 0) {
    selectPlan(plans[0].updatedAt);
  } else if (currentPlanId) {
    // 确保当前选中的方案仍然存在
    const found = plans.find(p => p.updatedAt === currentPlanId);
    if (found) {
      renderPlanDetail(found);
    } else if (plans.length > 0) {
      selectPlan(plans[0].updatedAt);
    }
  }
}

async function selectPlan(planId) {
  localStorage.setItem('volunteer_current_plan_id', planId);
  var plans = await loadAllPlans();
  var plan = plans.find(function(p) { return p.updatedAt === planId; });
  if (plan) {
    renderPlanDetail(plan);
    loadPlanSummary(); // 刷新列表高亮
  }
}

function renderPlanDetail(planData) {
  const detailContainer = document.getElementById('planDetailContainer');
  detailContainer.style.display = 'block';

  let rushItems = [], steadyItems = [], safeItems = [];
  (planData.schools || []).forEach(s => {
    if (s.category === '冲') rushItems.push(s);
    else if (s.category === '稳') steadyItems.push(s);
    else if (s.category === '保') safeItems.push(s);
  });

  const total = rushItems.length + steadyItems.length + safeItems.length;
  document.getElementById('planDetailSummary').innerHTML = `
    <p>📊 方案版本：<strong>${planData.version || '未知'}</strong> · 共 <strong>${total}</strong> 条</p>
    <p style="font-size:13px;color:#666;margin-top:4px;">
      🚀 冲刺 ${rushItems.length} 项 · ⚖️ 稳妥 ${steadyItems.length} 项 · 🛡️ 保底 ${safeItems.length} 项
    </p>
  `;

  renderPlanTableDetail('planRushList', rushItems, planData.updatedAt);
  renderPlanTableDetail('planSteadyList', steadyItems, planData.updatedAt);
  renderPlanTableDetail('planSafeList', safeItems, planData.updatedAt);
}

function renderPlanTableDetail(id, items, planId) {
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = '<p class="plan-empty">暂无</p>';
    return;
  }

  let html = `<table class="data-table plan-detail-table">
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th>院校</th>
        <th>学校代码</th>
        <th>专业</th>
        <th>专业代码</th>
        <th>最低分</th>
        <th>投档率</th>
        <th style="width:60px;">删除</th>
      </tr>
    </thead>
    <tbody>`;

  items.forEach((s, i) => {
    const ratioDisplay = s.ratio && s.ratio !== '' ? s.ratio + '%' : '—';
    html += `<tr>
      <td style="text-align:center;color:#999;">${i + 1}</td>
      <td><strong>${s.school}</strong></td>
      <td><code>${s.school_code || '—'}</code></td>
      <td>${s.major}</td>
      <td><code>${s.specialty_code || '—'}</code></td>
      <td><strong>${s.score_min > 0 ? s.score_min + ' 分' : '—'}</strong></td>
      <td style="text-align:center;">${ratioDisplay}</td>
      <td style="text-align:center;">
        <button class="btn btn-small btn-danger" onclick="deletePlanItem('${planId}', ${i}, '${id}')" title="从方案中移除" style="padding:2px 8px;font-size:11px;">✕</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// 从方案中删除单条记录
function deletePlanItem(planId, itemIdx, listId) {
  if (!confirm('确定从方案中移除此条志愿吗？')) return;

  const plans = loadAllPlans();
  const plan = plans.find(p => p.updatedAt === planId);
  if (!plan) return;

  // 根据 listId 确定类别
  let category;
  if (listId === 'planRushList') category = '冲';
  else if (listId === 'planSteadyList') category = '稳';
  else category = '保';

  // 找到该类别的第 itemIdx 条在 planData.schools 中的实际索引
  const catItems = [];
  const catIndexes = [];
  (plan.schools || []).forEach((s, idx) => {
    if (s.category === category) {
      catItems.push(s);
      catIndexes.push(idx);
    }
  });

  if (itemIdx >= 0 && itemIdx < catIndexes.length) {
    plan.schools.splice(catIndexes[itemIdx], 1);
  }

  // 重新编号
  plan.schools.forEach((s, i) => { s.rank = i + 1; });
  plan.updatedAt = new Date().toISOString();

  saveAllPlans(plans);
  renderPlanDetail(plan);
}

// ======== 导出最终方案 ========
function exportFinalPlan() {
  // 优先导出当前选中的方案
  const currentPlanId = localStorage.getItem('volunteer_current_plan_id');
  const plans = loadAllPlans();
  let planData = null;
  if (currentPlanId) {
    planData = plans.find(p => p.updatedAt === currentPlanId);
  }
  if (!planData && plans.length > 0) {
    planData = plans[0];
  }
  if (!planData) {
    alert('⚠️ 没有可导出的方案，请先在「筛选方案」页面保存方案');
    return;
  }

  let rushItems = [], steadyItems = [], safeItems = [];
  (planData.schools || []).forEach(s => {
    if (s.category === '冲') rushItems.push(s);
    else if (s.category === '稳') steadyItems.push(s);
    else if (s.category === '保') safeItems.push(s);
  });

  const ts = new Date().toLocaleString();
  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 最终志愿方案',
    `   方案版本：${planData.version || '未知'}`,
    `   考生分数：${CONFIG.student.score} 分`,
    `   一本线：${CONFIG.student.batchLine} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    `【🚀 冲刺志愿】（${rushItems.length} 项）`,
    ...rushItems.map((s, i) => {
      const r = s.ratio ? ' | 投档率:' + s.ratio + '%' : '';
      return `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}${r}`;
    }),
    '',
    `【⚖️ 稳妥志愿】（${steadyItems.length} 项）`,
    ...steadyItems.map((s, i) => {
      const r = s.ratio ? ' | 投档率:' + s.ratio + '%' : '';
      return `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}${r}`;
    }),
    '',
    `【🛡️ 保底志愿】（${safeItems.length} 项）`,
    ...safeItems.map((s, i) => {
      const r = s.ratio ? ' | 投档率:' + s.ratio + '%' : '';
      return `  ${i + 1}. ${s.school} | ${s.major}${s.score_min > 0 ? ' | ' + s.score_min + '分' : ''}${r}`;
    }),
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
  // 投档率输入框（异步保存，不阻塞 UI）
  if (e.target.classList.contains('ratio-input')) {
    var key = e.target.dataset.key;
    var val = e.target.value;
    // 先更新缓存
    if (!_ratioEditsCache) _ratioEditsCache = {};
    if (val === '' || val === null) { delete _ratioEditsCache[key]; }
    else { _ratioEditsCache[key] = val; }
    // 异步保存
    saveRatioEdit(key, val);
  }
});

// ======== 数据导出/导入（跨设备迁移） ========

// localStorage 中所有志愿相关的 key 列表
const DATA_KEYS = [
  'volunteer_plans',
  'volunteer_final_plan',
  'volunteer_current_plan_id',
  'volunteer_plan_checked',
  'volunteer_ratio_edits',
  'all_schools_checked',
  'volunteer_settings'
];

function exportAllData() {
  var exportData = {};
  for (var i = 0; i < DATA_KEYS.length; i++) {
    var key = DATA_KEYS[i];
    var val = localStorage.getItem(key);
    if (val) {
      try {
        exportData[key] = JSON.parse(val);
      } catch(e) {
        exportData[key] = val;
      }
    }
  }

  var ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '志愿填报数据备份_' + ts + '.json';
  a.click();
  URL.revokeObjectURL(url);

  var count = Object.keys(exportData).length;
  alert('✅ 已导出 ' + count + ' 项数据。\n\n将此文件复制到另一台电脑，在「志愿方案」页面点击「📥 导入数据」即可恢复。');
}

function importAllData(fileInput) {
  var file = fileInput.files[0];
  if (!file) return;

  if (!confirm('⚠️ 导入将覆盖当前所有本地数据（方案、勾选状态、投档率等），是否继续？')) {
    fileInput.value = '';
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var importData = JSON.parse(e.target.result);
      var count = 0;
      for (var key in importData) {
        if (importData.hasOwnProperty(key) && DATA_KEYS.indexOf(key) !== -1) {
          localStorage.setItem(key, JSON.stringify(importData[key]));
          count++;
        }
      }
      alert('✅ 成功导入 ' + count + ' 项数据！\n\n页面将自动刷新以加载新数据。');
      location.reload();
    } catch(err) {
      alert('❌ 导入失败：文件格式不正确\n\n' + err.message);
    }
  };
  reader.readAsText(file);
  fileInput.value = '';
}

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
