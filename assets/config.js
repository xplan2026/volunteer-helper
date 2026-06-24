// ======== 配置数据（可编辑） ========
const CONFIG = {
  student: {
    score: 513,
    subject: '物理类（物化生）',
    province: '重庆市',
    batchLine: 496,
    batchName: '特殊类型资格线（一本线）',
    deadline: '2025-06-30'
  },

  // 专业偏好（按优先级排序，权重 4/3/2/1）
  majors: [
    { id: 'bio-eng',   name: '生物工程',        weight: 4 },
    { id: 'tcm',       name: '中医学',           weight: 3 },
    { id: 'railway',   name: '铁路/轨道交通',     weight: 2 },
    { id: 'power',     name: '电力/电气工程',    weight: 1 }
  ],

  // 城市偏好（按优先级排序，权重 4/3/2/1）
  cities: [
    { id: 'cq', name: '重庆', weight: 4 },
    { id: 'sc', name: '四川', weight: 3 },
    { id: 'hb', name: '湖北', weight: 2 },
    { id: 'js', name: '江苏', weight: 1 }
  ],

  // ======== 院校录取数据 ========
  // 格式：{ 院校, 专业, 城市, 2024最低分, 2024位次, 标签 }
  // 说明：标 ★ 的是真实参考数据，其余为占位模板（等你确认后填充准确值）
  schools: [
    // -------- 重庆本地（生物工程） --------
    { school: '重庆大学 ★',  major: '生物工程', city: 'cq', cityName: '重庆', score: 532, rank: null, tag: 'rush',
      note: '985/211，往年分数线较高，建议冲' },
    { school: '重庆理工大学', major: '生物工程', city: 'cq', cityName: '重庆', score: 510, rank: null, tag: 'steady',
      note: '公办本科，生物工程有一定基础' },
    { school: '重庆师范大学', major: '生物工程', city: 'cq', cityName: '重庆', score: 502, rank: null, tag: 'steady',
      note: '师范类院校，生物方向' },
    { school: '重庆科技大学', major: '生物工程', city: 'cq', cityName: '重庆', score: 495, rank: null, tag: 'safe',
      note: '原重庆科技学院，生物工程可保底' },

    // -------- 重庆本地（中医学） --------
    { school: '重庆医科大学 ★', major: '中医学', city: 'cq', cityName: '重庆', score: 525, rank: null, tag: 'rush',
      note: '本地医学强校，中医学分数偏高' },
    { school: '重庆中医药学院', major: '中医学', city: 'cq', cityName: '重庆', score: 508, rank: null, tag: 'steady',
      note: '2023年新设，分数适中' },

    // -------- 重庆本地（电力/电气） --------
    { school: '重庆大学 ★',  major: '电气工程及其自动化', city: 'cq', cityName: '重庆', score: 540, rank: null, tag: 'rush',
      note: '985/211，电气王牌专业，分数很高' },
    { school: '重庆邮电大学 ★', major: '电气工程', city: 'cq', cityName: '重庆', score: 518, rank: null, tag: 'rush',
      note: '重邮工科强校，电气专业可冲' },
    { school: '重庆理工大学', major: '电气工程', city: 'cq', cityName: '重庆', score: 508, rank: null, tag: 'steady',
      note: '公办本科，电气专业稳妥' },
    { school: '重庆科技大学', major: '电气工程', city: 'cq', cityName: '重庆', score: 498, rank: null, tag: 'safe',
      note: '原重庆科技学院，电气可保底' },

    // -------- 重庆本地（铁路/轨道交通） --------
    { school: '重庆交通大学 ★', major: '轨道交通信号与控制', city: 'cq', cityName: '重庆', score: 510, rank: null, tag: 'steady',
      note: '交大特色专业，适合本地发展' },
    { school: '重庆交通大学', major: '交通运输类', city: 'cq', cityName: '重庆', score: 505, rank: null, tag: 'steady',
      note: '交大王牌，铁路/交通方向' },

    // -------- 四川 --------
    { school: '四川大学 ★',  major: '生物工程', city: 'sc', cityName: '四川', score: 530, rank: null, tag: 'rush',
      note: '985/211，需要冲一冲' },
    { school: '西南交通大学 ★', major: '轨道交通', city: 'sc', cityName: '四川', score: 520, rank: null, tag: 'rush',
      note: '211，铁路"黄埔军校"' },
    { school: '西南交通大学', major: '电气工程', city: 'sc', cityName: '四川', score: 522, rank: null, tag: 'rush',
      note: '交大电气也强' },
    { school: '成都中医药大学 ★', major: '中医学', city: 'sc', cityName: '四川', score: 515, rank: null, tag: 'rush',
      note: '中医名校，略高需冲' },
    { school: '四川农业大学', major: '生物工程', city: 'sc', cityName: '四川', score: 502, rank: null, tag: 'steady',
      note: '211，生物相关' },
    { school: '西华大学', major: '电气工程', city: 'sc', cityName: '四川', score: 498, rank: null, tag: 'safe',
      note: '工科院校，电气可保' },

    // -------- 湖北 --------
    { school: '华中科技大学 ★', major: '生物工程', city: 'hb', cityName: '湖北', score: 545, rank: null, tag: 'rush',
      note: '985，生物方向很强，分数差距大' },
    { school: '武汉理工大学 ★', major: '电气工程', city: 'hb', cityName: '湖北', score: 525, rank: null, tag: 'rush',
      note: '211，工科强校' },
    { school: '湖北中医药大学', major: '中医学', city: 'hb', cityName: '湖北', score: 508, rank: null, tag: 'steady',
      note: '中医药专业对口' },
    { school: '武汉工程大学', major: '生物工程', city: 'hb', cityName: '湖北', score: 498, rank: null, tag: 'safe',
      note: '工科院校，生物工程' },

    // -------- 江苏 --------
    { school: '东南大学 ★',  major: '生物工程', city: 'js', cityName: '江苏', score: 548, rank: null, tag: 'rush',
      note: '985，分数差距较大' },
    { school: '南京中医药大学 ★', major: '中医学', city: 'js', cityName: '江苏', score: 518, rank: null, tag: 'rush',
      note: '中医名校' },
    { school: '南京理工大学', major: '电气工程', city: 'js', cityName: '江苏', score: 525, rank: null, tag: 'rush',
      note: '211，工科' },
    { school: '南京工业大学', major: '生物工程', city: 'js', cityName: '江苏', score: 508, rank: null, tag: 'steady',
      note: '公办本科，生物化工方向' },
    { school: '南京工程学院', major: '电气工程', city: 'js', cityName: '江苏', score: 502, rank: null, tag: 'steady',
      note: '电力系统对口"亲儿子"' },
  ]
};
