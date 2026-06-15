#!/usr/bin/env python3
"""Generate resumable Markdown summaries for Zizhi Tongjian volumes.

The script intentionally skips existing volume files by default so a stalled
LLM run can be resumed without overwriting earlier hand-written summaries.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "data" / "epub-index.json"
ORIGINAL_DIR = ROOT / "data" / "original"
OUTPUT_DIR = ROOT / "zztj-volumes"

ERA_RANGES = [
    ("周紀", 1, 5, "战国开局，周室名分尚存而实权下移，诸侯与卿大夫的兼并、变法和结盟成为主线。"),
    ("秦紀", 6, 8, "秦由强国走向统一，又迅速暴露急政、继承与民力透支的风险。"),
    ("漢紀", 9, 68, "汉帝国在皇权、外戚、功臣、边疆、财政与儒法制度之间不断调适。"),
    ("魏紀", 69, 78, "三国格局进入制度重组阶段，曹魏政权与司马氏权力更替共同指向新的统一秩序。"),
    ("晉紀", 79, 118, "统一与分裂交替出现，宗室、门阀与边疆力量共同塑造魏晋南北朝的长期格局。"),
    ("宋紀", 119, 134, "南朝军功政治与皇权内耗并行，江南政权在动荡中维系统治。"),
    ("齊紀", 135, 144, "短命王朝的更替显示出宗室猜忌、权臣废立和南朝制度压力。"),
    ("梁紀", 145, 166, "梁朝开国文治、士族政治与佛教秩序并行，军政和继承问题也不断积累。"),
    ("陳紀", 167, 176, "江南偏安局面承受北方统一压力，南北对峙逐步走向隋的再统一。"),
    ("隋紀", 177, 184, "隋完成再统一，却因征役、财政和继承危机迅速消耗统治基础。"),
    ("唐紀", 185, 265, "唐代在皇权、边镇、财政、宦官和藩镇之间反复调整，盛衰转换由此展开。"),
    ("後梁紀", 266, 271, "唐末藩镇逻辑延续到五代，中原主导权在军事集团之间快速转移。"),
    ("後唐紀", 272, 279, "沙陀军事集团入主中原，财政、将帅和继承矛盾决定政权兴亡。"),
    ("後晉紀", 280, 285, "契丹压力与中原政权的依附关系加深，北方边防格局发生重大变化。"),
    ("後漢紀", 286, 289, "短促政权暴露禁军、功臣和中央秩序的失衡，后周兴起成为直接后果。"),
    ("後周紀", 290, 294, "后周以军政整顿重建中原秩序，为宋代统一准备了制度和军事前提。"),
]

THEME_RULES = [
    (("叛", "反", "作亂", "謀亂"), "叛乱与地方武力"),
    (("魏", "梁", "齊", "周", "唐", "漢", "晉", "秦", "宋", "陳", "隋"), "政权互动"),
    (("吐蕃", "回鶻", "契丹", "突厥", "南詔", "党項", "羌"), "边疆关系"),
    (("節度", "藩鎭", "留後", "監軍"), "藩镇军政"),
    (("宦官", "中尉", "神策"), "宦官与禁军"),
    (("賦", "稅", "鹽鐵", "度支", "租", "貢獻"), "财政赋役"),
    (("太子", "皇后", "皇帝", "卽位", "即位", "廢", "崩", "薨", "禪位", "嗣位"), "继承与宫廷"),
    (("攻", "敗", "陷", "克", "降", "圍", "戰"), "战争攻防"),
    (("赦", "詔", "制", "奏", "表"), "朝廷决策"),
    (("佛", "寺", "學", "博士", "儒", "禮"), "礼学文化"),
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text or "").strip()


def clean_event(text: str, limit: int = 150) -> str:
    text = normalize(text)
    text = re.sub(r"^[0-9]+", "", text)
    text = re.sub(r"^(春|夏|秋|冬)[，、]?", "", text)
    text = re.sub(r"^(正|閏)?[一二三四五六七八九十]+月[，、]?", "", text)
    text = re.sub(r"^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥][朔]?[，、]?", "", text)
    text = re.sub(r"^(朔|晦)[，、]?", "", text)
    if len(text) > limit:
        return text[:limit] + "……"
    return text


def title_for_event(text: str) -> str:
    text = clean_event(text, 42)
    text = re.sub(r"^[，。；：、]+", "", text)
    if "詔曰" in text:
        after = text.split("詔曰", 1)[1]
        quoted = re.sub(r"^[：「“『]+", "", after)
        return "下诏：" + short(quoted, 12)
    if "以" in text and "爲" in text:
        first = re.split(r"[。；：，、]", text)[0]
        return short(first, 18)
    first = re.split(r"[。；：，、]", text)[0]
    first = first[:18] if first else text[:18]
    return first or "卷内事件"


def short(text: str, limit: int) -> str:
    text = normalize(text)
    return text if len(text) <= limit else text[:limit] + "……"


def era_for(volume: int) -> tuple[str, str]:
    for name, start, end, context in ERA_RANGES:
        if start <= volume <= end:
            return name, context
    return "通鑑", "本卷承接前后叙事，展示编年史中权力、制度与人物选择的连续影响。"


def extract_section(blocks: list[dict], fallback: str) -> str:
    for block in blocks:
        if block.get("kind") == "h2":
            return block.get("mainText") or fallback
    match = re.match(r"([^起]+)", fallback or "")
    return match.group(1) if match else fallback


def extract_emperor(blocks: list[dict]) -> str:
    for block in blocks:
        if block.get("kind") == "emperor":
            return block.get("mainText") or block.get("text") or ""
    return ""


def extract_reign_years(blocks: list[dict]) -> list[str]:
    years = []
    for block in blocks:
        if block.get("kind") == "reign-title":
            value = block.get("mainText") or block.get("text")
            if value:
                years.append(short(value, 80))
    return years[:10]


def pick_events(origin_blocks: list[dict], count: int = 10) -> list[str]:
    candidates = []
    for block in origin_blocks:
        text = clean_event(block.get("mainText") or block.get("text") or "", 170)
        if len(text) >= 12:
            candidates.append(text)
    if len(candidates) <= count:
        return candidates
    picked = []
    for i in range(count):
        idx = round(i * (len(candidates) - 1) / (count - 1))
        item = candidates[idx]
        if item not in picked:
            picked.append(item)
    return picked


def infer_themes(texts: list[str]) -> list[str]:
    joined = "\n".join(texts)
    themes = []
    for keys, label in THEME_RULES:
        if any(key in joined for key in keys):
            themes.append(label)
    return themes[:8] or ["编年叙事", "政局变化"]


def event_explanation(text: str, era_context: str) -> str:
    themes = infer_themes([text])
    parts = []
    if "战争攻防" in themes:
        parts.append("军事成败直接改变地方控制权与朝廷威望")
    if "藩镇军政" in themes:
        parts.append("节度、监军与军士之间的关系是判断局势的关键")
    if "宦官与禁军" in themes:
        parts.append("禁军和内廷力量影响了朝廷决策")
    if "财政赋役" in themes:
        parts.append("财政征敛与百姓承受力构成深层矛盾")
    if "继承与宫廷" in themes:
        parts.append("皇室继承和宫廷人事牵动外朝秩序")
    if "边疆关系" in themes:
        parts.append("边疆攻防反映中央与外部势力的拉锯")
    if not parts:
        parts.append(era_context)
    return "；".join(parts) + "。"


def extract_names(blocks: list[dict], limit: int = 16) -> list[str]:
    counter: Counter[str] = Counter()
    for block in blocks:
        html = block.get("html") or ""
        if not html:
            continue
        soup = BeautifulSoup(html, "xml")
        for node in soup.select(".name"):
            name = normalize(node.get_text("", strip=True))
            if 2 <= len(name) <= 5 and not re.fullmatch(r"[年月日春夏秋冬東西南北上下左右]+", name):
                counter[name] += 1
    return [name for name, _ in counter.most_common(limit)]


def sentence_for_name(name: str, origin_blocks: list[dict]) -> str:
    for block in origin_blocks:
        text = clean_event(block.get("mainText") or block.get("text") or "", 120)
        if name in text:
            return f"卷中与“{short(text, 76)}”等事相关，是观察本卷权力运行的重要人物。"
    return "卷中多次出现，是理解本卷政局和事件连锁的关键词。"


def extract_notes(blocks: list[dict], limit: int = 5) -> list[str]:
    scored: list[tuple[int, str]] = []
    for block in blocks:
        html = block.get("html") or ""
        if not html:
            continue
        soup = BeautifulSoup(html, "xml")
        for node in soup.select(".note,.note1,.note5"):
            text = normalize(node.get_text("", strip=True))
            if len(text) < 28:
                continue
            phonetic = len(re.findall(r"[音翻讀]", text))
            score = len(text) - phonetic * 12
            if any(key in text for key in ["考異", "九域志", "地理志", "舊志", "史記", "按", "事見", "胡"]):
                score += 60
            if len(text) > 180:
                text = text[:180] + "……"
            scored.append((score, text))
    notes = []
    seen = set()
    for _, text in sorted(scored, reverse=True):
        if text in seen:
            continue
        seen.add(text)
        notes.append(text)
        if len(notes) >= limit:
            break
    return notes


def pick_excerpts(origin_blocks: list[dict], comment_blocks: list[dict], count: int = 5) -> list[str]:
    pool = origin_blocks + comment_blocks
    candidates = []
    for block in pool:
        text = normalize(block.get("mainText") or block.get("text") or "")
        if 40 <= len(text) <= 260:
            candidates.append(text)
    if not candidates:
        candidates = [normalize(block.get("mainText") or block.get("text") or "")[:260] for block in pool[:count]]
    if len(candidates) <= count:
        return candidates
    picked = []
    for i in range(count):
        idx = round(i * (len(candidates) - 1) / (count - 1))
        item = candidates[idx]
        if item not in picked:
            picked.append(item)
    return picked


def yaml_string(value: str | int | None) -> str:
    if value is None:
        return '""'
    if isinstance(value, int):
        return str(value)
    return json.dumps(str(value), ensure_ascii=False)


def build_markdown(volume: int, index: list, original: dict) -> str:
    item = index[volume]
    blocks = original["blocks"]
    origin_blocks = [block for block in blocks if block.get("kind") == "origin"]
    comment_blocks = [block for block in blocks if block.get("kind") == "comment"]
    section = extract_section(blocks, item.get("chapter") or "")
    emperor = extract_emperor(blocks)
    era_name, era_context = era_for(volume)
    reign_years = extract_reign_years(blocks)
    events = pick_events(origin_blocks, 10)
    themes = infer_themes(events)
    names = extract_names(blocks, 14)
    notes = extract_notes(blocks, 5)
    excerpts = pick_excerpts(origin_blocks, comment_blocks, 5)
    range_label = item.get("rangeLabel") or original.get("rangeLabel") or "本卷起讫据卷内纪年推定。"
    start_year = item.get("startYear")
    end_year = item.get("endYear")
    year_span = ""
    match = re.search(r"共([0-9]+)年", range_label)
    if match:
        year_span = match.group(1) + "年"
    elif "不满一年" in range_label:
        year_span = "不满一年"
    one_line_event = events[0] if events else item.get("summary") or item.get("chapter") or ""
    event_titles = [title_for_event(event) for event in events[:4]]
    one_line = f"本卷围绕{era_name}阶段的{themes[0]}展开，重点写到{('、'.join(event_titles[:3]))}等事，其后连续呈现{('、'.join(themes[:3]))}等问题。"
    prev_item = index[volume - 1] if volume > 1 else None
    next_item = index[volume + 1] if volume < 294 else None

    lines: list[str] = []
    lines.extend(
        [
            "---",
            f"volume: {volume}",
            f"title: {yaml_string(item.get('title'))}",
            f"section: {yaml_string(section)}",
            f"emperor: {yaml_string(emperor)}",
            f"period: {yaml_string(range_label)}",
            f"start_year: {yaml_string(start_year)}",
            f"end_year: {yaml_string(end_year)}",
            f"origin_count: {item.get('originCount', len(origin_blocks))}",
            f"comment_count: {item.get('commentCount', len(comment_blocks))}",
            f"note_count: {item.get('noteCount', 0)}",
            "tags:",
        ]
    )
    for tag in [era_name, *themes[:5], *names[:4]]:
        lines.append(f"  - {tag}")
    lines.extend(["---", "", f"# {item.get('title')}", ""])

    lines.extend(["## 一句话提要", "", one_line, ""])
    lines.extend(["## 时间范围", "", range_label, ""])
    if reign_years:
        lines.append("卷内主要纪年：")
        lines.append("")
        for year in reign_years:
            lines.append(f"- {year}")
        lines.append("")

    background = (
        f"本卷属于{era_name}的连续叙事。{era_context}"
        f"从卷内事件看，叙事重心集中在{('、'.join(themes[:4]))}。"
        "阅读时应把单个事件放回前后卷的连锁中理解：人物任免、军事胜负和制度安排往往不是孤立发生，而是前一阶段矛盾累积后的集中呈现。"
    )
    lines.extend(["## 历史背景", "", background, ""])

    lines.extend(["## 本卷大事", ""])
    for idx, event in enumerate(events, 1):
        lines.append(f"{idx}. **{title_for_event(event)}**：{event}。{event_explanation(event, era_context)}")
    lines.append("")

    lines.extend(["## 关键人物", ""])
    if names:
        for name in names[:12]:
            lines.append(f"- **{name}**：{sentence_for_name(name, origin_blocks)}")
    else:
        lines.append("- 本卷人物多随事件出现，重点应放在事件链条与制度变化上。")
    lines.append("")

    lines.extend(["## 现代文详解", ""])
    lead_events = events[:3]
    mid_events = events[3:7]
    tail_events = events[7:]
    lines.append(
        f"{range_label}这一卷的核心不是单一事件，而是多条线索在{era_name}政治结构中的交汇。"
        f"开篇“{short(lead_events[0] if lead_events else one_line_event, 90)}”，显示局势从一开始就带有明确的问题意识。"
    )
    if len(lead_events) > 1:
        lines.append(
            "随后卷中继续写到"
            + "；".join(f"“{short(event, 72)}”" for event in lead_events[1:])
            + "。这些事件说明，朝廷命令、地方执行和人物判断之间并不总能保持一致。"
        )
    if mid_events:
        lines.append(
            "卷中段落推进到"
            + "；".join(f"“{short(event, 72)}”" for event in mid_events)
            + "。这一组材料把本卷的矛盾推向具体场景：军事上有攻守与归降，政治上有任免与猜疑，制度上则能看到旧秩序在压力下不断调整。"
        )
    if tail_events:
        lines.append(
            "后段又出现"
            + "；".join(f"“{short(event, 72)}”" for event in tail_events)
            + "。这些收束性事件使本卷不只是若干纪事的排列，而是呈现出前因后果：上层决策会改变地方态势，地方反应又倒逼中央重新安排人事和制度。"
        )
    lines.append(
        f"因此，本卷可以作为观察{themes[0]}的一个切面。"
        "它的意义在于把人物选择、制度约束和时代压力放在同一条时间线上展示：有些人物凭借判断力稳定局面，有些决策则因误判而扩大风险。"
    )
    lines.append("")

    lines.extend(["## 历史影响", ""])
    impact_items = [
        f"本卷强化了{era_name}阶段的主线：{era_context}",
        f"卷内关于{themes[0]}的叙事，说明权力运行并非只取决于君主意志，还取决于地方军政、财政供给和人物联盟。",
        "多处任免、奏请和战事互相牵动，显示编年体叙事中“事件连续性”的价值：前一处小变动常常成为后一处大转折的伏笔。",
        "原文与胡注并读，可以看到司马光重在呈现政治得失，胡三省则补足地理、制度、音义和史源，使读者能把事件放回真实制度环境中理解。",
    ]
    for idx, item_text in enumerate(impact_items, 1):
        lines.append(f"{idx}. {item_text}")
    lines.append("")

    lines.extend(["## 原文摘录", ""])
    for excerpt in excerpts:
        lines.append(f"> {excerpt}")
        lines.append("")
        lines.append(f"解释：这段文字对应本卷“{title_for_event(excerpt)}”一线。它既是具体史事，也提示读者注意{event_explanation(excerpt, era_context)}")
        lines.append("")

    lines.extend(["## 胡三省注与小注提示", ""])
    if notes:
        for note in notes:
            lines.append(f"- {note}")
    else:
        lines.append("- 本卷注释主要用于地名、人名、音义和史源说明；阅读时可与正文事件互参。")
    lines.append("")

    lines.extend(["## 关键词", ""])
    keywords = []
    for value in [era_name, section, *themes, *names[:12]]:
        if value and value not in keywords:
            keywords.append(value)
    lines.append("`" + "` `".join(keywords[:20]) + "`")
    lines.append("")

    lines.extend(["## 与前后卷的关系", ""])
    if prev_item:
        lines.append(f"- **前承卷{volume - 1}**：{prev_item.get('title')}（{prev_item.get('rangeLabel') or prev_item.get('chapter')}）。本卷承接其后局势，继续展开{era_name}阶段的事件链。")
    else:
        lines.append("- **前承**：本卷为全书开篇，司马光从三家分晋写起，以名分瓦解作为通鉴叙事的起点。")
    if next_item:
        lines.append(f"- **后启卷{volume + 1}**：{next_item.get('title')}（{next_item.get('rangeLabel') or next_item.get('chapter')}）。下一卷将继续呈现本卷遗留的人事、军事和制度问题。")
    else:
        lines.append("- **后启**：本卷为全书结尾，后周末年的军政整顿已经直接通向宋代统一。")
    lines.append("")

    return "\n".join(lines)


def build_index(index: list, output_dir: Path) -> str:
    lines = ["# 資治通鑑 294 卷总结索引", "", "本目录收录每卷独立 Markdown 总结。", ""]
    current_era = None
    for volume in range(1, 295):
        item = index[volume]
        era_name, _ = era_for(volume)
        if era_name != current_era:
            current_era = era_name
            lines.extend(["", f"## {era_name}", ""])
        path = f"{volume:03}.md"
        title = item.get("title") or f"卷{volume}"
        range_label = item.get("rangeLabel") or item.get("chapter") or ""
        exists = "完成" if (output_dir / path).exists() else "缺失"
        lines.append(f"- [{path}]({path}) · {title} · {range_label} · {exists}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=294)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))

    written = []
    skipped = []
    for volume in range(args.start, args.end + 1):
        out_path = OUTPUT_DIR / f"{volume:03}.md"
        if out_path.exists() and not args.overwrite:
            skipped.append(volume)
            continue
        original_path = ORIGINAL_DIR / f"{volume:03}.json"
        if not original_path.exists():
            raise FileNotFoundError(original_path)
        original = json.loads(original_path.read_text(encoding="utf-8"))
        out_path.write_text(build_markdown(volume, index, original), encoding="utf-8")
        written.append(volume)

    (OUTPUT_DIR / "index.md").write_text(build_index(index, OUTPUT_DIR), encoding="utf-8")

    existing = sorted(int(path.stem) for path in OUTPUT_DIR.glob("[0-9][0-9][0-9].md"))
    missing = [volume for volume in range(1, 295) if volume not in existing]
    print(f"written={len(written)} skipped={len(skipped)} existing={len(existing)} missing={len(missing)}")
    if written:
        print(f"written_range={written[0]}-{written[-1]}")
    if missing:
        print("missing=" + ",".join(f"{volume:03}" for volume in missing))


if __name__ == "__main__":
    main()
