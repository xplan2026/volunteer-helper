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

  // 专业偏好（按优先级排序）
  majors: [
    { id: 'bio-eng',   name: '生物工程',            weight: 4 },
    { id: 'railway',   name: '铁路',                weight: 3 },
    { id: 'power',     name: '电气及其自动化',       weight: 2 },
    { id: 'materials', name: '材料科学与工程',       weight: 1 }
  ]
};
