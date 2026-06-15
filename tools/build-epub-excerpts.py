#!/usr/bin/env python3
import json
import os
import re
from pathlib import Path
from bs4 import BeautifulSoup

EPUB_DIR = Path(os.environ.get("ZZTJ_EPUB_DIR", "/Users/allonli/Downloads/資治通鑑.epub"))
TEXT_DIR = EPUB_DIR / "OEBPS" / "Text"
OUTPUT_INDEX = Path("data/epub-index.json")
ORIGINAL_DIR = Path("data/original")
SOURCE_LABEL = "本地 EPUB 胡三省注本"
CONTENT_CLASSES = {"h1", "h2", "note1", "note2", "note3", "emperor", "reign-title", "origin", "comment"}
NOTE_CLASSES = {"note", "note1", "note2", "note3", "note4", "note5"}
YEAR_DIGITS = {
    "〇": "0",
    "○": "0",
    "零": "0",
    "Ｏ": "0",
    "一": "1",
    "二": "2",
    "三": "3",
    "四": "4",
    "五": "5",
    "六": "6",
    "七": "7",
    "八": "8",
    "九": "9",
    "0": "0",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
}


def classes_for(tag) -> list[str]:
    value = tag.get("class") or []
    if isinstance(value, str):
        return value.split()
    return list(value)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def main_text_without_notes(tag) -> str:
    clone = BeautifulSoup(str(tag), "xml")
    root = clone.find(tag.name)
    if root is None:
        return normalize_text(tag.get_text("", strip=True))
    for node in root.select(",".join(f".{cls}" for cls in NOTE_CLASSES)):
        node.decompose()
    return normalize_text(root.get_text("", strip=True))


def year_number(value: str) -> int | None:
    if not value:
        return None
    if value.isdigit():
        return int(value)
    digits = "".join(YEAR_DIGITS.get(char, "") for char in value)
    if digits:
        return int(digits)
    return None


def extract_year(text: str) -> int | None:
    match = re.search(r"、(前)?([〇○零Ｏ一二三四五六七八九0-9]{2,4})", text)
    if not match:
        return None
    number = year_number(match.group(2))
    if number is None:
        return None
    return -number if match.group(1) else number


def year_label(year: int | None) -> str:
    if year is None:
        return ""
    return f"公元前{abs(year)}年" if year < 0 else f"公元{year}年"


def range_label(start_year: int | None, end_year: int | None) -> str:
    if start_year is None or end_year is None:
        return ""
    span = abs(end_year - start_year) + 1
    if start_year == end_year:
        return f"本卷系于{year_label(start_year)}，不满一年。"
    return f"本卷起自{year_label(start_year)}，至{year_label(end_year)}，共{span}年。"


def block_kind(tag) -> str:
    classes = classes_for(tag)
    for cls in classes:
        if cls in {"origin", "comment", "reign-title", "emperor", "note1", "note2", "note3", "h1", "h2"}:
            return cls
    return tag.name


def class_attr(tag) -> str:
    classes = [cls for cls in classes_for(tag) if cls in CONTENT_CLASSES]
    return " ".join(classes)


def sanitize_tag(tag) -> str:
    name = tag.name if tag.name in {"h1", "h2", "p"} else "p"
    classes = class_attr(tag)
    class_part = f' class="{classes}"' if classes else ""
    id_part = f' id="{tag.get("id")}"' if tag.get("id") else ""
    return f"<{name}{class_part}{id_part}>{tag.decode_contents()}</{name}>"


def parse_volume(volume: int) -> dict:
    file_name = f"part{volume + 6:04}.xhtml"
    path = TEXT_DIR / file_name
    if not path.exists():
        raise FileNotFoundError(path)
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "xml")
    title = soup.select_one("h1.h1")
    chapter = soup.select_one("h2.h2")
    title_text = normalize_text(title.get_text("", strip=True)) if title else f"資治通鑑卷第{volume}"
    chapter_text = normalize_text(chapter.get_text("", strip=True)) if chapter else ""

    blocks = []
    for tag in soup.body.select("h1.h1,h2.h2,p.note1,p.note2,p.note3,p.emperor,p.reign-title,p.origin,p.comment"):
        text = normalize_text(tag.get_text("", strip=True))
        if not text:
            continue
        html = sanitize_tag(tag)
        blocks.append({"kind": block_kind(tag), "text": text, "mainText": main_text_without_notes(tag), "html": html})

    origin_blocks = [item for item in blocks if item["kind"] == "origin"]
    comment_blocks = [item for item in blocks if item["kind"] == "comment"]
    note_count = sum(len(BeautifulSoup(item["html"], "xml").select(".note,.note1,.note2,.note3,.note4,.note5")) for item in blocks)
    name_count = sum(len(BeautifulSoup(item["html"], "xml").select(".name,.name1")) for item in blocks)

    preview_blocks = []
    for item in blocks:
        if item["kind"] in {"reign-title", "origin", "comment"}:
            preview_blocks.append(item)
        if len([b for b in preview_blocks if b["kind"] in {"origin", "comment"}]) >= 8:
            break
    if not preview_blocks:
        preview_blocks = blocks[:8]

    years = [extract_year(item["text"]) for item in blocks if item["kind"] == "reign-title"]
    years = [item for item in years if item is not None]
    start_year = years[0] if years else None
    end_year = years[-1] if years else None

    summary_text = "；".join((item.get("mainText") or item["text"]) for item in origin_blocks[:3])
    if len(summary_text) > 160:
        summary_text = summary_text[:160] + "……"

    original = {
        "sourceLabel": SOURCE_LABEL,
        "title": title_text,
        "chapter": chapter_text,
        "startYear": start_year,
        "endYear": end_year,
        "rangeLabel": range_label(start_year, end_year),
        "blockCount": len(blocks),
        "originCount": len(origin_blocks),
        "commentCount": len(comment_blocks),
        "noteCount": note_count,
        "nameCount": name_count,
        "chars": sum(len(item["text"]) for item in blocks),
        "blocks": blocks,
    }
    ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
    (ORIGINAL_DIR / f"{volume:03}.json").write_text(json.dumps(original, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    return {
        "number": volume,
        "sourceLabel": SOURCE_LABEL,
        "title": title_text,
        "chapter": chapter_text,
        "startYear": start_year,
        "endYear": end_year,
        "rangeLabel": range_label(start_year, end_year),
        "summary": summary_text,
        "blockCount": len(blocks),
        "originCount": len(origin_blocks),
        "commentCount": len(comment_blocks),
        "noteCount": note_count,
        "nameCount": name_count,
        "chars": original["chars"],
        "previewBlocks": preview_blocks,
    }


if not TEXT_DIR.exists():
    raise SystemExit(f"EPUB text directory not found: {TEXT_DIR}")

index = [None]
for volume in range(1, 295):
    index.append(parse_volume(volume))

OUTPUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Built {OUTPUT_INDEX} and {ORIGINAL_DIR} from EPUB with {len(index) - 1} volumes.")
