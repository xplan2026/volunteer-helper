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
    document.cookie = 'auth_token=' + AUTH_TOKEN + '; path=/; max-age=' + (7*24*60*60);
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
// SELECTABLE_SCHOOLS 来自 data_bak/selectable_schools.js（仅本地回退时使用）
const DATA_SOURCE = typeof SELECTABLE_SCHOOLS !== 'undefined' ? SELECTABLE_SCHOOLS : { schools: [] };

// ======== 应用初始化 ========
function initApp() {
  renderDashboard();
  initAllSchoolsPage();
  initPlanningPage();
  loadPlanSummary();
  initTrackingPage();
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
  // 兼容新旧字段名
  var scoreMinEl = document.getElementById('settingScoreMin') || document.getElementById('settingErbenMin');
  var scoreMaxEl = document.getElementById('settingScoreMax') || document.getElementById('settingErbenMax');
  if (scoreMinEl) scoreMinEl.value = s.scoreMin || getDefaultSettings().scoreMin;
  if (scoreMaxEl) scoreMaxEl.value = s.scoreMax || getDefaultSettings().scoreMax;
  document.getElementById('settingMajors').value = s.majors || getDefaultSettings().majors;
}

async function saveSettings() {
  var data = {
    excluded: document.getElementById('settingExcluded').value,
    ratio: parseFloat(document.getElementById('settingRatio').value),
    scoreMin: parseInt((document.getElementById('settingScoreMin') || document.getElementById('settingErbenMin')).value),
    scoreMax: parseInt((document.getElementById('settingScoreMax') || document.getElementById('settingErbenMax')).value),
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
  var scoreMinEl = document.getElementById('settingScoreMin') || document.getElementById('settingErbenMin');
  var scoreMaxEl = document.getElementById('settingScoreMax') || document.getElementById('settingErbenMax');
  if (scoreMinEl) scoreMinEl.value = d.scoreMin;
  if (scoreMaxEl) scoreMaxEl.value = d.scoreMax;
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
    enrollment_plan: d.enrollment_plan || '',
    special_requirement: d.special_requirement || '',
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

// ======== 招生人数编辑管理 ========
let _enrollmentEditsCache = null;

async function loadEnrollmentEdits() {
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var remote = await SupabaseAPI.getEnrollmentEdits();
    if (remote !== null) { _enrollmentEditsCache = remote; return remote; }
  }
  var saved = localStorage.getItem('volunteer_enrollment_edits');
  if (saved) {
    try { _enrollmentEditsCache = JSON.parse(saved); return _enrollmentEditsCache; } catch(e) {}
  }
  _enrollmentEditsCache = {};
  return {};
}

function loadEnrollmentEditsSync() {
  return _enrollmentEditsCache || {};
}

async function saveEnrollmentEdit(key, value) {
  if (!_enrollmentEditsCache) _enrollmentEditsCache = {};
  if (value === '' || value === null || value === undefined) {
    delete _enrollmentEditsCache[key];
  } else {
    _enrollmentEditsCache[key] = value;
  }
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    await SupabaseAPI.setEnrollmentEdit(key, value === '' || value === null || value === undefined ? null : value);
    return;
  }
  localStorage.setItem('volunteer_enrollment_edits', JSON.stringify(_enrollmentEditsCache));
}

// ======== 特殊要求编辑管理 ========
let _specialReqEditsCache = null;

async function loadSpecialReqEdits() {
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    var remote = await SupabaseAPI.getSpecialReqEdits();
    if (remote !== null) { _specialReqEditsCache = remote; return remote; }
  }
  var saved = localStorage.getItem('volunteer_specialreq_edits');
  if (saved) {
    try { _specialReqEditsCache = JSON.parse(saved); return _specialReqEditsCache; } catch(e) {}
  }
  _specialReqEditsCache = {};
  return {};
}

function loadSpecialReqEditsSync() {
  return _specialReqEditsCache || {};
}

async function saveSpecialReqEdit(key, value) {
  if (!_specialReqEditsCache) _specialReqEditsCache = {};
  if (value === '' || value === null || value === undefined) {
    delete _specialReqEditsCache[key];
  } else {
    _specialReqEditsCache[key] = value;
  }
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    await SupabaseAPI.setSpecialReqEdit(key, value === '' || value === null || value === undefined ? null : value);
    return;
  }
  localStorage.setItem('volunteer_specialreq_edits', JSON.stringify(_specialReqEditsCache));
}

// 通过学校代码和专业代码匹配 ratio（优先 Supabase，回退 fetch）
let allSelectableRatios = null;  // { 'school_code|specialty_code': ratio }

async function loadAllSelectableRatios() {
  if (allSelectableRatios) return allSelectableRatios;

  // 尝试 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var remote = await SupabaseAPI.getAllRatios();
      if (remote !== null && Object.keys(remote).length > 0) {
        allSelectableRatios = remote;
        return allSelectableRatios;
      }
    } catch(e) { console.warn('Supabase 加载 ratio 失败，回退本地:', e); }
  }

  console.log('[initAllSchoolsPage] 回退到 fetch 本地 JSON...');
  // 回退：fetch 本地 JSON
  try {
    var r = await fetch('data_bak/all_selectable_schools.json');
    var data = await r.json();
    allSelectableRatios = {};
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var key = d.school_code + '|' + d.specialty_code;
      allSelectableRatios[key] = d.ratio;
    }
    return allSelectableRatios;
  } catch(e) { return {}; }
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
  console.log('[initAllSchoolsPage] SupabaseAPI:', SupabaseAPI ? 'exists' : 'undefined', SupabaseAPI ? 'isAvailable:' + SupabaseAPI.isAvailable() : '');
  if (allSchoolsLoaded) {
    allSchoolsApplyFilters();
    return;
  }

  // 尝试 Supabase 加载专业列表 + 勾选状态
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    console.log('[initAllSchoolsPage] 尝试 Supabase 模式...');
    try {
      // 并行加载
      console.time('[initAllSchoolsPage] Supabase 请求');
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

      console.log('[initAllSchoolsPage] Supabase 成功，specialties:', specialties ? specialties.length : 'null', 'checked keys:', checked ? Object.keys(checked).length : 'null');
      // Supabase 模式下，数据按需分页加载
      allSchoolsLoaded = true;
      allSchoolsApplyFilters(); // 内部会调用 Supabase 分页查询
      return;
      console.timeEnd('[initAllSchoolsPage] Supabase 请求');
    } catch(e) {
      console.warn('Supabase 加载失败，回退到本地 JSON:', e);
    }
  }

  console.log('[initAllSchoolsPage] 回退到 fetch 本地 JSON...');
  // 回退：fetch 本地 JSON
  fetch('data_bak/available_selectable_schools.json')
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

    console.log('[allSchoolsApplyFilters] 查询 Supabase:', JSON.stringify(filters));
    var result = await SupabaseAPI.getAvailableSchools(filters);
    console.log('[allSchoolsApplyFilters] result:', result ? result.data.length + '条, 总数:' + result.count : 'null');
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
  if (allSchoolsPage > 1) { allSchoolsPage--; allSchoolsApplyFilters(); }
});
document.getElementById('allNextBtn').addEventListener('click', function() {
  var useSupabase = SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable();
  var totalPages = useSupabase
    ? Math.ceil(allSchoolsTotalCount / allSchoolsPageSize) || 1
    : Math.ceil(allSchoolsFiltered.length / allSchoolsPageSize) || 1;
  if (allSchoolsPage < totalPages) { allSchoolsPage++; allSchoolsApplyFilters(); }
});

// 保存到可选列表
document.getElementById('allSaveBtn').addEventListener('click', async function() {
  var checkedKeys = Object.keys(allSchoolsChecked).filter(function(k) { return allSchoolsChecked[k]; });
  if (!checkedKeys.length) { alert('请先勾选至少一所学校'); return; }

  // Supabase 模式：从数据库分页获取勾选数据的完整信息
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      // 收集所有勾选的学校数据（分页遍历 available_schools 表）
      var selected = [];
      var selectedKeys = [];
      var pageSize = 100;
      var page = 0;
      var hasMore = true;

      while (hasMore) {
        var result = await SupabaseAPI.getAvailableSchools({ limit: pageSize, offset: page * pageSize });
        if (!result || !result.data || result.data.length === 0) {
          hasMore = false;
          break;
        }
        for (var i = 0; i < result.data.length; i++) {
          var d = result.data[i];
          var key = d.school_code + '|' + d.specialty_code;
          if (allSchoolsChecked[key]) {
            selected.push({
              school_code: d.school_code,
              school_name: d.school_name,
              specialty_code: d.specialty_code,
              specialty_name: d.specialty_name,
              min_score: d.min_score
            });
            selectedKeys.push({
              school_code: d.school_code,
              specialty_code: d.specialty_code
            });
          }
        }
        if (result.data.length < pageSize) hasMore = false;
        page++;
      }

      if (!selected.length) { alert('⚠️ 未找到匹配的勾选数据，请刷新后重试'); return; }
      selected.sort(function(a, b) { return b.min_score - a.min_score; });

      // 并行执行：写入 selectable_schools + 从 available_schools 删除
      var [addOk, removeOk] = await Promise.all([
        SupabaseAPI.addSelectableSchools(selected),
        SupabaseAPI.removeFromAvailable(selectedKeys)
      ]);

      if (addOk && removeOk) {
        // 清除勾选状态
        allSchoolsChecked = {};
        localStorage.setItem('all_schools_checked', JSON.stringify(allSchoolsChecked));
        await SupabaseAPI.setCheckedState('all_schools_checked', {});

        // 刷新列表
        allSchoolsApplyFilters();
        alert('✅ 已保存 ' + selected.length + ' 条到云端数据库！\n已选学校已从备选列表中移除。');
        return;
      }
      alert('⚠️ 云端保存部分失败（add=' + addOk + ', remove=' + removeOk + '），同时导出本地文件作为备份');
    } catch(e) {
      console.error('Supabase 保存失败:', e);
      alert('❌ Supabase 操作失败: ' + e.message + '\n将导出本地文件作为备份');
    }
  }

  // 回退：从本地 allSchoolsData 收集数据
  var selectedLocal = [];
  var selectedKeysLocal = [];
  for (var i = 0; i < allSchoolsData.length; i++) {
    if (allSchoolsChecked[allSchoolsData[i]._key]) {
      selectedLocal.push({
        school_code: allSchoolsData[i].school_code,
        school_name: allSchoolsData[i].school,
        specialty_code: allSchoolsData[i].specialty_code,
        specialty_name: allSchoolsData[i].major,
        min_score: allSchoolsData[i].score_min
      });
      selectedKeysLocal.push({
        school_code: allSchoolsData[i].school_code,
        specialty_code: allSchoolsData[i].specialty_code
      });
    }
  }
  if (!selectedLocal.length) { alert('⚠️ 未找到勾选数据，请刷新后重试'); return; }
  selectedLocal.sort(function(a, b) { return b.min_score - a.min_score; });

  // 下载文件作为备份
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
  download('selectable_schools.json', JSON.stringify(selectedLocal, null, 2), 'application/json;charset=utf-8');
  download('selectable_schools.js', 'const SELECTABLE_SCHOOLS = {"schools":' + JSON.stringify(selectedLocal) + '};', 'application/javascript;charset=utf-8');
  download('available_selectable_schools.json', JSON.stringify(remaining, null, 2), 'application/json;charset=utf-8');
  alert('已导出 ' + selectedLocal.length + ' 条到 selectable_schools。\n剩余 ' + remaining.length + ' 条备选。\n请将 3 个文件覆盖到 data_bak/ 目录');
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
  // Supabase 模式：从 selectable_schools 表加载数据（实时反映保存操作）
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var remoteData = await SupabaseAPI.getSelectableSchools();
      if (remoteData !== null && remoteData.length > 0) {
        const seen = new Set();
        planAllData = [];
        remoteData.forEach(function(d) {
          var key = (d.school_name || '') + '|' + (d.specialty_name || '');
          if (!seen.has(key)) {
            seen.add(key);
            var item = mapFields(d);
            item.category = getCategory(item.score_min);
            item._key = key;
            planAllData.push(item);
          }
        });
        planAllData.sort(function(a, b) { return b.score_min - a.score_min; });
      }
    } catch(e) { console.warn('Supabase 加载 selectable_schools 失败:', e); }
  }

  // 回退：使用本地静态数据
  if (!planAllData || planAllData.length === 0) {
    var allData = (DATA_SOURCE.schools || []).map(mapFields);
    const seen = new Set();
    planAllData = [];
    allData.forEach(function(d) {
      var key = d.school + '|' + d.major;
      if (!seen.has(key)) {
        seen.add(key);
        d.category = getCategory(d.score_min);
        d._key = key;
        planAllData.push(d);
      }
    });
    planAllData.sort(function(a, b) { return b.score_min - a.score_min; });
  }

  // 初始化筛选
  var majors = [];
  var majorSet = {};
  for (var i = 0; i < planAllData.length; i++) {
    if (!majorSet[planAllData[i].major]) {
      majorSet[planAllData[i].major] = true;
      majors.push(planAllData[i].major);
    }
  }
  majors.sort();
  document.getElementById('planFilterMajor').innerHTML =
    '<option value="all">全部专业</option>' + majors.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');

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
    var saved = localStorage.getItem('volunteer_plan_checked');
    if (saved) {
      try { planChecked = JSON.parse(saved); } catch(e) { planChecked = {}; }
    }
  }

  // 预加载投档率/招生人数/特殊要求编辑缓存
  await Promise.all([loadRatioEdits(), loadEnrollmentEdits(), loadSpecialReqEdits()]);

  // 从 Supabase 加载投档率数据（回退本地 JSON）
  try {
    await loadAllSelectableRatios();
    planAllData.forEach(function(d) {
      var r = findRatioFromSelectable(d.school_code, d.specialty_code);
      if (r !== null) {
        d.ratio = r;
      }
    });
  } catch(e) { console.warn('加载 ratio 失败:', e); }
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
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#999;padding:40px;">暂无匹配记录</td></tr>';
    updateCheckedCount();
    return;
  }

  // 加载投档率编辑记录 + 招生人数编辑记录 + 特殊要求编辑记录
  const ratioEdits = loadRatioEditsSync();
  const enrollmentEdits = loadEnrollmentEditsSync();
  const specialReqEdits = loadSpecialReqEditsSync();

  tbody.innerHTML = filtered.map((d, idx) => {
    const checked = planChecked[d._key] ? 'checked' : '';
    const ratioKey = d.school_code + '|' + d.specialty_code;
    const savedRatio = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '');
    const savedEnrollment = enrollmentEdits[ratioKey] !== undefined ? enrollmentEdits[ratioKey] : (d.enrollment_plan || '');
    const savedSpecialReq = specialReqEdits[ratioKey] !== undefined ? specialReqEdits[ratioKey] : (d.special_requirement || '');
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
      <td style="text-align:center;">
        <input type="text" class="enrollment-input" data-key="${ratioKey}" value="${savedEnrollment}" placeholder="—" style="width:60px;text-align:center;padding:4px;border:1px solid #e0e0e0;border-radius:4px;font-size:13px;">
      </td>
      <td style="text-align:center;">
        <input type="text" class="specialreq-input" data-key="${ratioKey}" value="${savedSpecialReq}" placeholder="—" style="width:80px;text-align:center;padding:4px;border:1px solid #e0e0e0;border-radius:4px;font-size:12px;">
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
  const enrollmentEdits = loadEnrollmentEditsSync();
  const specialReqEdits = loadSpecialReqEditsSync();

  const planData = {
    version: new Date().toISOString().slice(0,10).replace(/-/g,''),
    updatedAt: new Date().toISOString(),
    schools: checkedSchools.map((d, idx) => {
      const ratioKey = d.school_code + '|' + d.specialty_code;
      const editedRatio = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '');
      const editedEnrollment = enrollmentEdits[ratioKey] !== undefined ? enrollmentEdits[ratioKey] : (d.enrollment_plan || '');
      const editedSpecialReq = specialReqEdits[ratioKey] !== undefined ? specialReqEdits[ratioKey] : (d.special_requirement || '');
      return {
        rank: idx + 1,
        school: d.school,
        school_code: d.school_code,
        major: d.major,
        specialty_code: d.specialty_code,
        score_min: d.score_min,
        ratio: editedRatio,
        enrollment_plan: editedEnrollment,
        special_requirement: editedSpecialReq,
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
        // 下载本地备份文件
        downloadPlanFile(planData);
        alert('✅ 方案已保存到云端（' + checkedSchools.length + ' 条）');
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
  const enrollmentEdits = loadEnrollmentEditsSync();
  const specialReqEdits = loadSpecialReqEditsSync();

  function formatExportLine(d, i) {
    const ratioKey = d.school_code + '|' + d.specialty_code;
    const r = ratioEdits[ratioKey] !== undefined ? ratioEdits[ratioKey] : (d.ratio > 0 ? (d.ratio * 100).toFixed(0) : '—');
    const enr = enrollmentEdits[ratioKey] !== undefined ? enrollmentEdits[ratioKey] : (d.enrollment_plan || '—');
    const sr = specialReqEdits[ratioKey] !== undefined ? specialReqEdits[ratioKey] : (d.special_requirement || '—');
    var line = `  ${i + 1}. ${d.school} | ${d.major} | ${d.score_min}分 | 投档率:${r}%`;
    if (enr !== '—') line += ` | 招生:${enr}`;
    if (sr !== '—') line += ` | 要求:${sr}`;
    return line;
  }

  const lines = [
    '══════════════════════════════════',
    '   志愿填报助手 — 筛选方案',
    `   考生分数：${CONFIG.student.score} 分`,
    `   生成时间：${ts}`,
    '══════════════════════════════════',
    '',
    `【🚀 冲】（${rush.length} 项）`,
    ...rush.map(formatExportLine),
    '',
    `【⚖️ 稳】（${steady.length} 项）`,
    ...steady.map(formatExportLine),
    '',
    `【🛡️ 保】（${safe.length} 项）`,
    ...safe.map(formatExportLine),
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
        // 转换为本地格式，保留 Supabase UUID id
        return remote.map(function(p) {
          if (p.data && p.data.updatedAt) {
            p.data._supabaseId = p.id;  // 保留 Supabase UUID
            return p.data;
          }
          return {
            version: p.name || '未知',
            updatedAt: p.updated_at || new Date().toISOString(),
            schools: (p.data && p.data.schools) || [],
            _supabaseId: p.id
          };
        });
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
    const planId = p._supabaseId || p.updatedAt;
    const isActive = currentPlanId === planId;
    return `<div class="plan-list-item${isActive ? ' active' : ''}" data-plan-id="${planId}" onclick="selectPlan('${planId}')">
      <div class="plan-list-info">
        <span class="plan-list-name">📋 志愿方案 · ${p.version || '未知'}</span>
        <span class="plan-list-meta">${ts} · 🚀${rush} ⚖️${steady} 🛡️${safe} 共${total}条</span>
      </div>
      <button class="btn btn-small btn-danger" onclick="event.stopPropagation();deletePlan('${planId}')" title="删除方案">🗑 删除</button>
    </div>`;
  }).join('');

  // 自动选中第一个方案（如果没有当前选中）
  if (!currentPlanId && plans.length > 0) {
    selectPlan(plans[0]._supabaseId || plans[0].updatedAt);
  } else if (currentPlanId) {
    // 确保当前选中的方案仍然存在
    const found = plans.find(p => (p._supabaseId || p.updatedAt) === currentPlanId);
    if (found) {
      renderPlanDetail(found);
    } else if (plans.length > 0) {
      selectPlan(plans[0]._supabaseId || plans[0].updatedAt);
    }
  }
}

async function selectPlan(planId) {
  localStorage.setItem('volunteer_current_plan_id', planId);
  var plans = await loadAllPlans();
  var plan = plans.find(function(p) { return (p._supabaseId || p.updatedAt) === planId; });
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

  var pid = planData._supabaseId || planData.updatedAt;
  renderPlanTableDetail('planRushList', rushItems, pid);
  renderPlanTableDetail('planSteadyList', steadyItems, pid);
  renderPlanTableDetail('planSafeList', safeItems, pid);
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
        <th>招生人数</th>
        <th>特殊要求</th>
        <th style="width:60px;">删除</th>
      </tr>
    </thead>
    <tbody>`;

  items.forEach((s, i) => {
    const ratioDisplay = s.ratio && s.ratio !== '' ? s.ratio + '%' : '—';
    const enrollmentDisplay = s.enrollment_plan && s.enrollment_plan !== '' ? s.enrollment_plan : '—';
    const specialReqDisplay = s.special_requirement && s.special_requirement !== '' ? s.special_requirement : '—';
    html += `<tr>
      <td style="text-align:center;color:#999;">${i + 1}</td>
      <td><strong>${s.school}</strong></td>
      <td><code>${s.school_code || '—'}</code></td>
      <td>${s.major}</td>
      <td><code>${s.specialty_code || '—'}</code></td>
      <td><strong>${s.score_min > 0 ? s.score_min + ' 分' : '—'}</strong></td>
      <td style="text-align:center;">${ratioDisplay}</td>
      <td style="text-align:center;">${enrollmentDisplay}</td>
      <td style="text-align:center;font-size:12px;">${specialReqDisplay}</td>
      <td style="text-align:center;">
        <button class="btn btn-small btn-danger" onclick="deletePlanItem('${planId}', ${i}, '${id}')" title="从方案中移除" style="padding:2px 8px;font-size:11px;">✕</button>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  el.innerHTML = html;
}

// 从方案中删除单条记录
async function deletePlanItem(planId, itemIdx, listId) {
  if (!confirm('确定从方案中移除此条志愿吗？')) return;

  var plans = await loadAllPlans();
  var plan = plans.find(function(p) { return (p._supabaseId || p.updatedAt) === planId; });
  if (!plan) return;

  // 根据 listId 确定类别
  var category;
  if (listId === 'planRushList') category = '冲';
  else if (listId === 'planSteadyList') category = '稳';
  else category = '保';

  // 找到该类别的第 itemIdx 条在 planData.schools 中的实际索引
  var catIndexes = [];
  (plan.schools || []).forEach(function(s, idx) {
    if (s.category === category) catIndexes.push(idx);
  });

  if (itemIdx >= 0 && itemIdx < catIndexes.length) {
    plan.schools.splice(catIndexes[itemIdx], 1);
  }

  // 重新编号
  plan.schools.forEach(function(s, i) { s.rank = i + 1; });
  plan.updatedAt = new Date().toISOString();

  // 保存到 Supabase
  if (SupabaseAPI && SupabaseAPI.isAvailable && SupabaseAPI.isAvailable()) {
    try {
      var savedId = await SupabaseAPI.savePlan({
        id: plan._supabaseId || plan.updatedAt,
        name: '志愿方案 · ' + (plan.version || '未知'),
        data: plan,
        updated_at: plan.updatedAt
      });
      if (savedId) {
        renderPlanDetail(plan);
        return;
      }
    } catch(e) { console.error('Supabase 更新方案失败:', e); }
  }

  // 回退 localStorage
  saveAllPlans(plans);
  renderPlanDetail(plan);
}

// ======== 导出最终方案 ========
async function exportFinalPlan() {
  // 优先导出当前选中的方案
  const currentPlanId = localStorage.getItem('volunteer_current_plan_id');
  const plans = await loadAllPlans();
  let planData = null;
  if (currentPlanId) {
    planData = plans.find(function(p) { return (p._supabaseId || p.updatedAt) === currentPlanId; });
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

  function formatFinalLine(s, i) {
    var line = `  ${i + 1}. ${s.school} | ${s.major}`;
    if (s.score_min > 0) line += ' | ' + s.score_min + '分';
    if (s.ratio && s.ratio !== '') line += ' | 投档率:' + s.ratio + '%';
    if (s.enrollment_plan && s.enrollment_plan !== '') line += ' | 招生:' + s.enrollment_plan;
    if (s.special_requirement && s.special_requirement !== '') line += ' | 要求:' + s.special_requirement;
    return line;
  }

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
    ...rushItems.map(formatFinalLine),
    '',
    `【⚖️ 稳妥志愿】（${steadyItems.length} 项）`,
    ...steadyItems.map(formatFinalLine),
    '',
    `【🛡️ 保底志愿】（${safeItems.length} 项）`,
    ...safeItems.map(formatFinalLine),
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
  // 招生人数输入框
  if (e.target.classList.contains('enrollment-input')) {
    var key2 = e.target.dataset.key;
    var val2 = e.target.value;
    if (!_enrollmentEditsCache) _enrollmentEditsCache = {};
    if (val2 === '' || val2 === null) { delete _enrollmentEditsCache[key2]; }
    else { _enrollmentEditsCache[key2] = val2; }
    saveEnrollmentEdit(key2, val2);
  }
  // 特殊要求输入框
  if (e.target.classList.contains('specialreq-input')) {
    var key3 = e.target.dataset.key;
    var val3 = e.target.value;
    if (!_specialReqEditsCache) _specialReqEditsCache = {};
    if (val3 === '' || val3 === null) { delete _specialReqEditsCache[key3]; }
    else { _specialReqEditsCache[key3] = val3; }
    saveSpecialReqEdit(key3, val3);
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
  'volunteer_enrollment_edits',
  'volunteer_specialreq_edits',
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

// ======== 志愿填报追踪页面 ========
// 志愿数据对象
let trackingData = null;
let trackingScanResult = null;

// 预判策略：根据排位判断冲/稳/保
function classifyStrategy(seq) {
  // 前8个为冲刺，9-15为稳妥，16-60为保底
  if (seq <= 8) return { label: '🚀 冲刺', cls: 'rush' };
  if (seq <= 15) return { label: '⚖️ 稳妥', cls: 'steady' };
  return { label: '🛡️ 保底', cls: 'safe' };
}

// 加载志愿数据
async function loadTrackingData() {
  try {
    const resp = await fetch('data_bak/志愿填报.json');
    if (!resp.ok) throw new Error('无法加载数据文件');
    trackingData = await resp.json();
    return true;
  } catch(e) {
    console.warn('志愿数据加载失败:', e.message);
    return false;
  }
}

// 加载 Subagent 扫描结果
async function loadTrackingScanResult() {
  try {
    const resp = await fetch('data_bak/tracking-result.json');
    if (!resp.ok) throw new Error('暂无扫描结果');
    trackingScanResult = await resp.json();
    return true;
  } catch(e) {
    console.warn('扫描结果加载失败:', e.message);
    return false;
  }
}

// 获取学校的官网扫描状态
function getSchoolScanStatus(schoolName) {
  if (!trackingScanResult || !trackingScanResult.schoolResults) return null;
  // 去掉括号后缀匹配
  var cleanName = schoolName.replace(/\(.*\)/g, '');
  return trackingScanResult.schoolResults.find(function(r) {
    return r.school === cleanName;
  }) || null;
}

// 搜索过滤函数
function filterTrackingData(searchTerm, strategyFilter) {
  if (!trackingData || !trackingData.志愿表) return [];
  var results = trackingData.志愿表;
  if (searchTerm) {
    var kw = searchTerm.trim().toLowerCase();
    results = results.filter(function(item) {
      return item.院校.toLowerCase().indexOf(kw) !== -1;
    });
  }
  if (strategyFilter && strategyFilter !== 'all') {
    results = results.filter(function(item) {
      return classifyStrategy(item.序号).cls === strategyFilter;
    });
  }
  return results;
}

// 渲染追踪表格
function renderTrackingTable(filtered) {
  var tbody = document.getElementById('trackingTableBody');
  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#999;">📭 无匹配结果</td></tr>';
    document.getElementById('trackingTotalCount').textContent = '0';
    return;
  }

  var html = '';
  var colors = { rush: '#fff0f0', steady: '#fff8e7', safe: '#f0fff4' };

  filtered.forEach(function(item) {
    var strategy = classifyStrategy(item.序号);
    var majors = Array.isArray(item.专业) ? item.专业.join('、') : '—';
    // 超过5个专业折叠显示
    var majorsDisplay = item.专业.length > 3
      ? '<span class="majors-short">' + item.专业.slice(0,3).join('、') + '</span><span class="majors-toggle" style="color:#4a90d9;cursor:pointer;font-size:12px;" onclick="this.previousElementSibling.style.display=\'none\';this.nextElementSibling.style.display=\'inline\';"> 展开全部</span><span class="majors-full" style="display:none;">' + item.专业.join('、') + '</span>'
      : majors;

    // 官网状态
    var scanInfo = getSchoolScanStatus(item.院校);
    var siteStatus, noteText;
    if (!scanInfo) {
      siteStatus = '<span style="color:#999;">⏳ 待扫描</span>';
      noteText = '—';
    } else if (scanInfo.error === 'no_url') {
      siteStatus = '<span style="color:#999;">❓ 未知官网</span>';
      noteText = '暂未收录官网';
    } else if (!scanInfo.reachable) {
      siteStatus = '<span style="color:#e74c3c;">🚫 不可达</span>';
      noteText = '官网访问失败';
    } else if (scanInfo.admissionMentioned) {
      siteStatus = '<span style="color:#27ae60;">📢 有招生信息</span>';
      noteText = scanInfo.admissionUrl
        ? '<a href="' + scanInfo.admissionUrl + '" target="_blank" style="color:#2980b9;">查看</a>'
        : '已检测到招生关键词';
    } else {
      siteStatus = '<span style="color:#7f8c8d;">✅ 正常</span>';
      noteText = '官网可达，未发现招生公告';
    }

    html += '<tr style="background:' + (colors[strategy.cls] || '#fff') + ';">';
    html += '<td style="padding:8px 6px;text-align:center;">' + item.序号 + '</td>';
    html += '<td style="padding:8px 6px;text-align:left;font-weight:500;">' + item.院校 + '</td>';
    html += '<td style="padding:8px 6px;text-align:center;">' + item.专业组 + '</td>';
    html += '<td style="padding:8px 6px;text-align:left;max-width:300px;">' + majorsDisplay + '</td>';
    html += '<td style="padding:8px 6px;text-align:center;">' + strategy.label + '</td>';
    html += '<td style="padding:8px 6px;text-align:center;">' + siteStatus + '</td>';
    html += '<td style="padding:8px 6px;text-align:center;font-size:12px;color:#555;">' + noteText + '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
  document.getElementById('trackingTotalCount').textContent = filtered.length;
}

// 渲染 Subagent 执行状态
function renderSubagentStatus() {
  var statusDiv = document.getElementById('subagentStatus');
  if (!statusDiv) return;

  if (!trackingScanResult) {
    statusDiv.innerHTML = '<p class="plan-empty">⏳ 等待 Subagent 返回结果...</p>';
    return;
  }

  var sr = trackingScanResult;
  var timeAgo = getTimeAgo(sr.scanTime);
  var riskColor = sr.riskAnalysis.overallRisk === 'high' ? '#e74c3c'
    : sr.riskAnalysis.overallRisk === 'medium' ? '#f39c12'
    : '#27ae60';

  var html = '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">';
  html += '  <div class="stat-box" style="background:#f0f8ff;border-radius:8px;padding:12px;text-align:center;">';
  html += '    <div style="font-size:24px;font-weight:bold;color:#2980b9;">' + sr.reachableCount + '/' + sr.totalSchools + '</div>';
  html += '    <div style="font-size:12px;color:#666;">官网可达</div>';
  html += '  </div>';
  html += '  <div class="stat-box" style="background:#f0fff4;border-radius:8px;padding:12px;text-align:center;">';
  html += '    <div style="font-size:24px;font-weight:bold;color:#27ae60;">' + sr.admissionFound + '</div>';
  html += '    <div style="font-size:12px;color:#666;">发现招生信息</div>';
  html += '  </div>';
  html += '  <div class="stat-box" style="background:#fff0f0;border-radius:8px;padding:12px;text-align:center;">';
  html += '    <div style="font-size:24px;font-weight:bold;color:#e74c3c;">' + sr.dangerDetected + '</div>';
  html += '    <div style="font-size:12px;color:#666;">退档预警</div>';
  html += '  </div>';
  html += '  <div class="stat-box" style="background:#fff8e7;border-radius:8px;padding:12px;text-align:center;">';
  html += '    <div style="font-size:14px;font-weight:bold;color:' + riskColor + ';">' + sr.summary.riskLevel + '</div>';
  html += '    <div style="font-size:12px;color:#666;">综合风险</div>';
  html += '  </div>';
  html += '</div>';

  html += '<div style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:8px;">';
  html += '🕐 上次扫描: ' + timeAgo + ' &nbsp;|&nbsp; ';
  html += '📡 ' + sr.summary.schoolStatus;
  html += '</div>';

  statusDiv.innerHTML = html;
}

// 渲染退档风险评估
function renderRiskAnalysis() {
  var riskDiv = document.getElementById('riskAnalysisContent');
  if (!riskDiv) return;
  if (!trackingScanResult || !trackingScanResult.riskAnalysis) {
    riskDiv.innerHTML = '<p class="plan-empty">暂无退档风险评估数据</p>';
    return;
  }

  var ra = trackingScanResult.riskAnalysis;
  var riskColor = ra.overallRisk === 'high' ? '#e74c3c'
    : ra.overallRisk === 'medium' ? '#f39c12'
    : '#27ae60';

  var html = '';

  // 分数线信息
  if (ra.batchLineCheck) {
    var bl = ra.batchLineCheck;
    html += '<div style="margin-bottom:12px;">';
    html += '  <strong>📊 分数线信息</strong><br>';
    html += '  成绩: <strong>' + bl.score + '</strong> 分 · ';
    html += '  省控线: <strong>' + bl.batchLine + '</strong> 分 · ';
    html += '  超出: <span style="color:' + (bl.diff >= 0 ? '#27ae60' : '#e74c3c') + ';font-weight:bold;">' + bl.diff + '</span> 分';
    html += '</div>';
  }

  // 风险因素
  if (ra.riskFactors && ra.riskFactors.length > 0) {
    html += '<div style="margin-bottom:12px;">';
    html += '  <strong>⚠️ 风险因素</strong>';
    html += '  <ul style="margin:4px 0 0 16px;font-size:13px;">';
    ra.riskFactors.forEach(function(f) {
      html += '<li>' + f + '</li>';
    });
    html += '  </ul>';
    html += '</div>';
  } else {
    html += '<div style="margin-bottom:12px;color:#27ae60;">✅ 暂未发现明显风险因素</div>';
  }

  // 建议
  if (ra.suggestions && ra.suggestions.length > 0) {
    html += '<div style="margin-bottom:8px;">';
    html += '  <strong>💡 建议</strong>';
    html += '  <ul style="margin:4px 0 0 16px;font-size:13px;">';
    ra.suggestions.forEach(function(s) {
      html += '<li>' + s + '</li>';
    });
    html += '  </ul>';
    html += '</div>';
  }

  riskDiv.innerHTML = html;
}

// 格式化时间差
function getTimeAgo(isoTime) {
  if (!isoTime) return '未知';
  var t = new Date(isoTime);
  var now = new Date();
  var diff = Math.floor((now - t) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  return Math.floor(diff / 86400) + ' 天前';
}

// 更新考生信息
function renderTrackingStudentInfo() {
  if (!trackingData || !trackingData.考生信息) return;
  var s = trackingData.考生信息;
  document.getElementById('trackingStudentName').textContent = s.姓名 || '—';
  document.getElementById('trackingStudentId').textContent = s.考生号 || '—';
  document.getElementById('trackingStudentScore').textContent = s.成绩 || '—';
  document.getElementById('trackingStudentRank').textContent = s.排位 || '—';
  document.getElementById('trackingStudentSubject').textContent = s.科类 || '—';
  document.getElementById('trackingBatchLine').textContent = (s['省控线'] && s['省控线'].分数线) || '—';
}

// 刷新追踪数据
function refreshTrackingData() {
  var searchVal = document.getElementById('trackingSearch').value;
  var filterVal = document.getElementById('trackingFilter').value;
  var filtered = filterTrackingData(searchVal, filterVal);
  renderTrackingTable(filtered);
}

// 初始化追踪页面
async function initTrackingPage() {
  var ok = await loadTrackingData();
  var scanOk = await loadTrackingScanResult();

  if (ok) {
    renderTrackingStudentInfo();
    refreshTrackingData();
    renderSubagentStatus();
    renderRiskAnalysis();
  } else {
    document.getElementById('trackingTableBody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#f00;">❌ 数据加载失败，请检查 data_bak/志愿填报.json 是否存在</td></tr>';
  }

  // 搜索和筛选事件绑定
  var searchInput = document.getElementById('trackingSearch');
  var filterSelect = document.getElementById('trackingFilter');
  if (searchInput) searchInput.addEventListener('input', refreshTrackingData);
  if (filterSelect) filterSelect.addEventListener('change', refreshTrackingData);
}

// ======== 导航中注册追踪页面 ========
(function() {
  var origSetup = setupNavigation;
  setupNavigation = function() {
    origSetup();
    var trackingLinks = document.querySelectorAll('.sidebar-nav a[data-page="tracking"]');
    trackingLinks.forEach(function(link) {
      link.addEventListener('click', function(e) {
        var names = { dashboard:'📊 总览', allschools:'📋 所有可选学校', planning:'📝 筛选方案', plan:'📋 志愿方案', tracking:'🔍 志愿填报追踪' };
        var breadcrumb = document.getElementById('breadcrumb');
        if (breadcrumb && this.dataset.page === 'tracking') {
          breadcrumb.innerHTML = (names[this.dataset.page] || this.dataset.page) + ' <span></span>';
        }
        if (this.dataset.page === 'tracking' && !trackingData) {
          initTrackingPage();
        }
      });
    });
  };
})();

// ======== 初始加载 ========
loadSettings();

// 自动登录：检查 cookie
(function() {
  const cookies = document.cookie.split('; ').reduce((acc, c) => {
    const [k, v] = c.split('=');
    acc[k] = v;
    return acc;
  }, {});
  if (decodeURIComponent(cookies['auth_token'] || '') === AUTH_TOKEN || cookies['auth_token'] === AUTH_TOKEN) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  }
})();
