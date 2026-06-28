/**
 * Supabase 客户端封装
 * 替代 localStorage + 手动文件下载，实现数据在线持久化
 *
 * 部署前需要：
 *   1. 在 Supabase 创建项目
 *   2. 执行 supabase/schema.sql 建表
 *   3. 运行 supabase/import_data.js 导入初始数据
 *   4. 在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_ANON_KEY
 *
 * 变量来源：
 *   - 本地开发：从 .env 文件读取（需构建工具注入）
 *   - 生产部署：通过 GitHub Actions 构建时注入环境变量
 *   - 兜底：使用下方 SUPABASE_CONFIG 中的占位值
 */

// Supabase 配置：优先从环境变量读取，兜底使用占位值
// 构建时通过替换 __SUPABASE_URL__ / __SUPABASE_ANON_KEY__ 占位符注入
const SUPABASE_CONFIG = {
  url: window.__SUPABASE_URL__ || 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: window.__SUPABASE_ANON_KEY__ || 'YOUR_ANON_KEY'
};

// 检测占位符是否已被替换为真实凭据
function isPlaceholderInjected() {
  var url = SUPABASE_CONFIG.url;
  // 占位符未被替换（仍是 __SUPABASE_URL__）或为兜底值，说明 CI 未注入真实凭据
  return url.indexOf('__SUPABASE_URL__') === -1 && url.indexOf('YOUR_PROJECT_ID') === -1;
}

let _sb = null;

function getSupabase() {
  if (_sb) return _sb;
  if (!isPlaceholderInjected()) {
    console.warn('⚠️ Supabase 凭据未注入，回退到 localStorage 模式');
    return null;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('⚠️ Supabase SDK 未加载，回退到 localStorage 模式');
    return null;
  }
  _sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return _sb;
}

// ======== 数据同步 API ========

const SupabaseAPI = {
  // 是否已配置 Supabase
  isAvailable: function() {
    return !!getSupabase();
  },

  // ======== 备选学校 ========
  getAvailableSchools: async function(filters) {
    const sb = getSupabase();
    if (!sb) return null;

    let query = sb.from('available_schools').select('*', { count: 'exact' });

    if (filters) {
      if (filters.specialty && filters.specialty !== 'all') {
        query = query.eq('specialty_name', filters.specialty);
      }
      if (filters.school) {
        query = query.ilike('school_name', '%' + filters.school + '%');
      }
      if (filters.limit) query = query.limit(filters.limit);
      if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      query = query.order('min_score', { ascending: false });
    }

    const { data, error, count } = await query;
    if (error) { console.error('获取备选学校失败:', error); return null; }
    return { data, count };
  },

  // 从备选学校中移除（选走了）
  removeFromAvailable: async function(keys) {
    const sb = getSupabase();
    if (!sb) return null;

    // keys: [{school_code, specialty_code}, ...]
    const filters = keys.map(k => `and(school_code.eq.${k.school_code},specialty_code.eq.${k.specialty_code})`).join(',');
    const { error } = await sb.from('available_schools').delete().or(filters);
    if (error) { console.error('移除备选学校失败:', error); return false; }
    return true;
  },

  // ======== 已选学校 ========
  getSelectableSchools: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from('selectable_schools')
      .select('*')
      .order('min_score', { ascending: false });

    if (error) { console.error('获取已选学校失败:', error); return null; }
    return data;
  },

  // 添加已选学校
  addSelectableSchools: async function(schools) {
    const sb = getSupabase();
    if (!sb) return null;

    const rows = schools.map(s => ({
      school_code: s.school_code,
      school_name: s.school_name,
      specialty_code: s.specialty_code,
      specialty_name: s.specialty_name,
      min_score: s.min_score
    }));

    const { error } = await sb.from('selectable_schools').upsert(rows, {
      onConflict: 'school_code,specialty_code'
    });
    if (error) { console.error('添加已选学校失败:', error); return false; }
    return true;
  },

  // ======== 勾选状态 ========
  getCheckedState: async function(table) {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from(table).select('key,checked');
    if (error) { console.error('获取勾选状态失败:', error); return null; }

    var result = {};
    for (var i = 0; i < data.length; i++) {
      result[data[i].key] = data[i].checked;
    }
    return result;
  },

  setCheckedState: async function(table, checkedMap) {
    const sb = getSupabase();
    if (!sb) return null;

    var rows = [];
    for (var key in checkedMap) {
      if (checkedMap.hasOwnProperty(key)) {
        rows.push({ key: key, checked: checkedMap[key] });
      }
    }

    if (rows.length === 0) return true;

    const { error } = await sb.from(table).upsert(rows, { onConflict: 'key' });
    if (error) { console.error('保存勾选状态失败:', error); return false; }
    return true;
  },

  // ======== 投档率编辑 ========
  getRatioEdits: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from('volunteer_ratio_edits').select('key,ratio');
    if (error) { console.error('获取投档率编辑失败:', error); return null; }

    var result = {};
    for (var i = 0; i < data.length; i++) {
      result[data[i].key] = data[i].ratio;
    }
    return result;
  },

  setRatioEdit: async function(key, ratio) {
    const sb = getSupabase();
    if (!sb) return null;

    const { error } = await sb.from('volunteer_ratio_edits').upsert(
      { key: key, ratio: ratio },
      { onConflict: 'key' }
    );
    if (error) { console.error('保存投档率编辑失败:', error); return false; }
    return true;
  },

  // ======== 招生人数编辑 ========
  getEnrollmentEdits: async function() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.from('volunteer_enrollment_edits').select('key,value');
    if (error) { console.error('获取招生人数编辑失败:', error); return null; }
    var result = {};
    for (var i = 0; i < data.length; i++) { result[data[i].key] = data[i].value; }
    return result;
  },

  setEnrollmentEdit: async function(key, value) {
    const sb = getSupabase();
    if (!sb) return null;
    const { error } = await sb.from('volunteer_enrollment_edits').upsert(
      { key: key, value: value },
      { onConflict: 'key' }
    );
    if (error) { console.error('保存招生人数编辑失败:', error); return false; }
    return true;
  },

  // ======== 特殊要求编辑 ========
  getSpecialReqEdits: async function() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.from('volunteer_specialreq_edits').select('key,value');
    if (error) { console.error('获取特殊要求编辑失败:', error); return null; }
    var result = {};
    for (var i = 0; i < data.length; i++) { result[data[i].key] = data[i].value; }
    return result;
  },

  setSpecialReqEdit: async function(key, value) {
    const sb = getSupabase();
    if (!sb) return null;
    const { error } = await sb.from('volunteer_specialreq_edits').upsert(
      { key: key, value: value },
      { onConflict: 'key' }
    );
    if (error) { console.error('保存特殊要求编辑失败:', error); return false; }
    return true;
  },

  // ======== 设置 ========
  getSettings: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from('volunteer_settings')
      .select('data')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') { console.error('获取设置失败:', error); return null; }
    return data ? data.data : {};
  },

  saveSettings: async function(settingsData) {
    const sb = getSupabase();
    if (!sb) return null;

    const { error } = await sb.from('volunteer_settings').upsert(
      { id: 1, data: settingsData },
      { onConflict: 'id' }
    );
    if (error) { console.error('保存设置失败:', error); return false; }
    return true;
  },

  // ======== 志愿方案 ========
  getPlans: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from('volunteer_plans')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) { console.error('获取方案失败:', error); return null; }
    return data;
  },

  savePlan: async function(plan) {
    const sb = getSupabase();
    if (!sb) return null;

    const name = plan.name || '';

    // 先查是否已有同名方案，有则 update，无则 insert
    const { data: existing } = await sb.from('volunteer_plans')
      .select('id').eq('name', name).maybeSingle();

    if (existing) {
      const { error } = await sb.from('volunteer_plans')
        .update({
          data: plan.data || {},
          updated_at: plan.updated_at || new Date().toISOString()
        })
        .eq('id', existing.id);
      if (error) { console.error('更新方案失败:', error); return null; }
      return existing.id;
    }

    const { data, error } = await sb.from('volunteer_plans')
      .insert({
        name: name,
        data: plan.data || {},
        updated_at: plan.updated_at || new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) { console.error('保存方案失败:', error); return null; }
    return data.id;
  },

  deletePlan: async function(id) {
    const sb = getSupabase();
    if (!sb) return null;

    const { error } = await sb.from('volunteer_plans').delete().eq('id', id);
    if (error) { console.error('删除方案失败:', error); return false; }
    return true;
  },

  // ======== 获取所有 ratio（投档率）字典 ========
  // 返回 { 'school_code|specialty_code': ratio } 格式
  getAllRatios: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    // 分页加载，available_schools 可能有上千条
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await sb.from('available_schools')
        .select('school_code,specialty_code,ratio')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) { console.error('获取投档率失败:', error); return null; }
      if (!data || data.length === 0) { hasMore = false; break; }
      allData = allData.concat(data);
      if (data.length < pageSize) hasMore = false;
      page++;
    }

    var result = {};
    for (var i = 0; i < allData.length; i++) {
      var key = allData[i].school_code + '|' + allData[i].specialty_code;
      result[key] = allData[i].ratio;
    }
    return result;
  },

  // ======== 获取所有专业列表 ========
  getSpecialties: async function() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.from('available_schools')
      .select('specialty_name')
      .order('specialty_name');

    if (error) { console.error('获取专业列表失败:', error); return null; }

    var set = {};
    var result = [];
    for (var i = 0; i < data.length; i++) {
      if (!set[data[i].specialty_name]) {
        set[data[i].specialty_name] = true;
        result.push(data[i].specialty_name);
      }
    }
    return result;
  }
};

// ======== 导出到 localStorage 兼容层（离线备份） ========
// 当 Supabase 不可用时，自动回退到 localStorage

function localStorageFallback() {
  return !SupabaseAPI.isAvailable();
}
