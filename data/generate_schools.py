#!/usr/bin/env python3
"""
重庆高考志愿填报 - 学校筛选数据生成脚本 v5

数据源：data/resource.json（2025年原始投档线数据，11349条）

筛选逻辑：
  1. 读取 resource.json（含 school, province, city, code, batch, major, score_min, ...）
  2. 剔除省市区域（EXCLUDED_PROVINCES）
  3. 截取最低录取分在 SCORE_LOWER ~ SCORE_UPPER 范围内（489~514）
  4. 仅保留 7 个目标专业
  5. 输出合并列表（不分一本/二本）

等位分换算说明：
  2026年513分 → 位次55,893 → 2025等位分 509 分（源自一分一段表）
  筛选区间：等位分 -20~+5 分 → 489 ~ 514 分

输出文件：
  - data/selectable_schools.json  — 结构化数据
  - data/selectable_schools.js    — 浏览器 JS 内联变量
"""
import json
import os

# ========== 参数定义 ==========
EQUIVALENT_SCORE = 509   # 2026年513分 → 2025等位分（位次55893）
SCORE_LOWER = 489        # 等位分 -20
SCORE_UPPER = 514        # 等位分 +5

EXCLUDED_PROVINCES = {"西藏", "内蒙", "内蒙古", "山西", "河南", "河北", "湖南", "广西", "贵州", "上海", "安徽"}
# 目标专业匹配规则：resource.json 中的专业名称
# 注意原名 "电气自动化" → "电气工程及其自动化"、"铁路" → "轨道交通信号与控制"
TARGET_MAJORS = [
    "生物工程",
    "制药工程",
    "轨道交通信号与控制",
    "电气工程及其自动化",
    "通信工程",
    "人工智能",
    "材料科学与工程"
]
# 同时包含以下专业关键字的也纳入（如各种带"（中外合作）"的电气工程及其自动化）
TARGET_MAJORS_PREFIX = {
    "电气工程及其自动化",   # 匹配 电气工程及其自动化(中外合作办学) 等
}


def main():
    data_dir = "/tmp/volunteer-helper/data"
    resource_path = os.path.join(data_dir, "resource.json")

    # 1. 读取数据源
    with open(resource_path, "r", encoding="utf-8") as f:
        all_data = json.load(f)
    print(f"数据源: {len(all_data)} 条原始记录")

    # 2. 剔除地区（排除省份，但保留 province=="" 的记录）
    filtered = [r for r in all_data if r["province"] == "" or r["province"] not in EXCLUDED_PROVINCES]
    print(f"剔除地区后: {len(filtered)} 条")

    # 3. 最低录取分 489~514
    filtered = [r for r in filtered if SCORE_LOWER <= r["score_min"] <= SCORE_UPPER]
    print(f"分数截取 {SCORE_LOWER}~{SCORE_UPPER} 后: {len(filtered)} 条")

    # 4. 仅保留目标专业（精确匹配 + 前缀匹配）
    def match_major(major):
        if major in TARGET_MAJORS:
            return True
        for prefix in TARGET_MAJORS_PREFIX:
            if major.startswith(prefix):
                return True
        return False
    filtered = [r for r in filtered if match_major(r["major"])]
    print(f"专业筛选（目标专业）后: {len(filtered)} 条")

    # 5. 排序
    filtered.sort(key=lambda x: (x["score_min"], x["province"], x["school"], x["major"]))

    # 6. 按专业分组（仅用于输出结构）
    by_major = {}
    for d in filtered:
        m = d["major"]
        if m not in by_major:
            by_major[m] = []
        by_major[m].append(d)
    for m in by_major:
        by_major[m].sort(key=lambda x: (x["score_min"], x["school"]))

    # 统计学校
    unique_schools = set(d["school"] for d in filtered)
    print(f"去重学校数: {len(unique_schools)} 所")
    for s in sorted(unique_schools):
        cnt = sum(1 for d in filtered if d["school"] == s)
        print(f"  {s}: {cnt} 个专业")

    # 7. 构造输出
    output = {
        "version": "5.0.0",
        "updated": "2026-06-26",
        "student": {
            "city": "重庆",
            "subject": "物理类（物化生）",
            "score_2026": 513,
            "rank_2026": 55893
        },
        "equivalent_score": {
            "description": "2026年513分(位次55893) → 2025等位分509分",
            "score_2026": 513,
            "rank_2026": 55893,
            "score_2025": EQUIVALENT_SCORE
        },
        "strategy_ranges": {
            "rush":  {"label": "冲",   "range": "512~517", "desc": "等位分+3~+8分"},
            "steady": {"label": "稳",  "range": "504~512", "desc": "等位分-5~+3分"},
            "safe":  {"label": "保",   "range": "484~504", "desc": "等位分-25~-5分"}
        },
        "filter_rules": {
            "score_range": f"{SCORE_LOWER}~{SCORE_UPPER}（等位分-20~+5）",
            "excluded_provinces": sorted(EXCLUDED_PROVINCES),
            "target_majors": TARGET_MAJORS
        },
        "total": len(filtered),
        "schools": filtered,
        "by_major": by_major
    }

    # 8. 输出 JSON
    json_path = os.path.join(data_dir, "selectable_schools.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 输出: {json_path}  ({len(filtered)} 条)")

    # 9. 输出 JS 内联变量
    js_content = f"// 自动生成 - selectable_schools.js\nconst SELECTABLE_SCHOOLS = {json.dumps(output, ensure_ascii=False)};\n"
    js_path = os.path.join(data_dir, "selectable_schools.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"✅ 输出: {js_path}")


if __name__ == "__main__":
    main()
