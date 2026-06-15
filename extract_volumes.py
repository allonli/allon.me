#!/usr/bin/env python3
"""解析《資治通鑑》EPUB 各卷，提取正文、注释、纪年等信息，生成 JSON 缓存。"""

import os
import json
import re
from bs4 import BeautifulSoup

EPUB_TEXT_DIR = "/Users/allonli/Downloads/資治通鑑.epub/OEBPS/Text"
CACHE_DIR = "/usr/local/code/allon.me/zztj-cache"

os.makedirs(CACHE_DIR, exist_ok=True)

def extract_volume(html_path, volume_num):
    """解析单个卷的 XHTML 文件，提取结构化信息。"""
    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    body = soup.body
    if not body:
        return None

    div = body.find("div")
    if not div:
        return None

    # 卷标题
    h1 = div.find("h1", class_="h1")
    title = h1.get_text(strip=True) if h1 else f"資治通鑑卷第{volume_num}"

    # 纪与时间范围
    h2 = div.find("h2", class_="h2")
    section_name = ""
    period_text = ""
    if h2:
        ji = h2.find("span", class_="ji")
        if ji:
            section_name = ji.get_text(strip=True)
        note = h2.find("span", class_="note")
        if note:
            period_text = note.get_text(strip=True)

    # 解析起讫年份
    start_year = None
    end_year = None
    year_count = None
    year_match = re.search(r'起[^盡]*盡[^，。；]*', period_text)
    if year_match:
        pass  # 太岁纪年，不是数字
    # 尝试从后文的 reign-title 中提取公元年份
    # 从 note4 中提取前xxx格式

    # 帝王名号
    emperor = ""
    emperor_note = ""
    emp_tag = div.find("p", class_="emperor")
    if emp_tag:
        emperor = emp_tag.b.get_text(strip=True) if emp_tag.b else emp_tag.get_text(strip=True)
        emp_note_span = emp_tag.find("span", class_="note")
        if emp_note_span:
            emperor_note = emp_note_span.get_text(strip=True)

    # 提取正文段落 (origin)
    origin_paragraphs = []
    for p in div.find_all("p", class_="origin"):
        text = p.get_text(strip=False)
        # 提取纯文本（去掉 HTML 标签但保留内容）
        clean = " ".join(text.split())
        origin_paragraphs.append(clean)

    # 提取臣光曰评论 (comment)
    comment_paragraphs = []
    for p in div.find_all("p", class_="comment"):
        text = p.get_text(strip=False)
        clean = " ".join(text.split())
        comment_paragraphs.append(clean)

    # 提取胡三省注（note class spans）
    hz_notes = []
    for note_span in div.find_all("span", class_="note"):
        text = note_span.get_text(strip=True)
        if text and len(text) > 2:
            hz_notes.append(text)

    # 提取小注（note1 class）
    minor_notes = []
    for note_p in div.find_all("p", class_="note1"):
        text = note_p.get_text(strip=True)
        if text:
            minor_notes.append(text)

    # 提取校勘记（note5 class）
    textual_notes = []
    for note_span in div.find_all("span", class_="note5"):
        text = note_span.get_text(strip=True)
        if text:
            textual_notes.append(text)

    # 提取纪年行 (reign-title)
    reign_years = []
    for rt in div.find_all("p", class_="reign-title"):
        rt_text = rt.get_text(strip=False)
        clean = " ".join(rt_text.split())
        # 提取年份编号如 (戊寅、前四○三)
        year_note = rt.find("span", class_="note")
        year_ids = []
        if year_note:
            note4s = year_note.find_all("span", class_="note4")
            for n4 in note4s:
                year_ids.append(n4.get_text(strip=True))
        reign_years.append({
            "title": rt.get_text().split("\n")[0].strip() if "\n" in rt.get_text() else rt.get_text(strip=True),
            "raw": clean,
            "year_ids": year_ids
        })

    # 提取年代范围
    all_years = set()
    for ry in reign_years:
        for yid in ry["year_ids"]:
            match = re.search(r'前(\d+)', yid)
            if match:
                all_years.add(int(match.group(1)))
            match2 = re.search(r'(\d+)', yid)  # 公元后年份
            if match2 and not yid.startswith('前'):
                val = int(match2.group(1))
                if val > 1:  # 排除干支编号
                    all_years.add(-val)  # 暂时不做 BC 转换

    # 确定起讫年份（公元年份）
    bc_years = []
    ad_years = []
    for ry in reign_years:
        for yid in ry["year_ids"]:
            match = re.search(r'前(?:四|三|二|一|○)?(\d+)', yid)
            if match:
                bc_years.append(int(match.group(1)))
            match2 = re.search(r'^(?![前])(\d+)$', yid.replace('○', '0'))
            # 更广泛的匹配

    # 更精确地提取年份
    start_year_str = ""
    end_year_str = ""
    for ry in reign_years:
        yids = ry.get("year_ids", [])
        for yid in yids:
            # 匹配 前xxx 格式
            bc_match = re.search(r'[前](?:[四三二一○]\s*)?(\d+)', yid)
            if bc_match:
                year_val = bc_match.group(1)
                if not start_year_str:
                    start_year_str = f"前{year_val}"
                end_year_str = f"前{year_val}"

    # 计算正文和注释字数
    main_text = "\n".join(origin_paragraphs)
    all_text = "\n".join(origin_paragraphs + comment_paragraphs)
    annotation_text = "\n".join(hz_notes + minor_notes + textual_notes)

    # 提取有代表性的原文片段（选前几段的 origin）
    sample_origin = []
    for p in div.find_all("p", class_="origin"):
        # 用 BeautifulSoup 提取带标签结构
        html_str = str(p)
        sample_origin.append(html_str)
        if len(sample_origin) >= 8:
            break

    sample_comments = []
    for p in div.find_all("p", class_="comment"):
        html_str = str(p)
        sample_comments.append(html_str)
        if len(sample_comments) >= 3:
            break

    # 用 BeautifulSoup 获取纯文本但不丢失结构的方式
    # 提取人物名（name class）
    person_names = set()
    for name_span in div.find_all("span", class_="name"):
        n = name_span.get_text(strip=True)
        if n and len(n) >= 2 and len(n) <= 4:
            person_names.add(n)

    return {
        "volume": volume_num,
        "title": title,
        "section": section_name,
        "period_text": period_text,
        "start_year_str": start_year_str,
        "end_year_str": end_year_str,
        "emperor": emperor,
        "emperor_note": emperor_note,
        "main_text_length": len(main_text),
        "annotation_text_length": len(annotation_text),
        "origin_count": len(origin_paragraphs),
        "comment_count": len(comment_paragraphs),
        "reign_years": reign_years,
        "origin_paragraphs": origin_paragraphs,
        "comment_paragraphs": comment_paragraphs,
        "hz_notes": hz_notes,
        "minor_notes": minor_notes,
        "textual_notes": textual_notes,
        "sample_origin": sample_origin,
        "sample_comments": sample_comments,
        "person_names": list(person_names),
        # 全文本用于后续分析
        "full_main_text": main_text,
        "full_annotation_text": annotation_text,
    }


def main():
    volume_map = {}
    # part0007.xhtml = 卷1, part0008.xhtml = 卷2, ..., part0300.xhtml = 卷294
    for vol_num in range(1, 295):
        part_num = vol_num + 6
        html_file = f"part{part_num:04d}.xhtml"
        html_path = os.path.join(EPUB_TEXT_DIR, html_file)
        if os.path.exists(html_path):
            print(f"处理卷 {vol_num}: {html_file}")
            data = extract_volume(html_path, vol_num)
            if data:
                volume_map[str(vol_num)] = data
                # 单卷缓存
                with open(os.path.join(CACHE_DIR, f"vol_{vol_num:03d}.json"), "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            print(f"警告: 卷 {vol_num} 文件不存在: {html_path}")

    # 总缓存
    with open(os.path.join(CACHE_DIR, "all_volumes.json"), "w", encoding="utf-8") as f:
        json.dump(volume_map, f, ensure_ascii=False, indent=2)

    print(f"\n完成！共处理 {len(volume_map)} 卷")
    print(f"缓存目录: {CACHE_DIR}")


if __name__ == "__main__":
    main()
