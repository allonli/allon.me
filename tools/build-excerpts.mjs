import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = process.env.ZZTJ_SOURCE_DIR || "/tmp/zizhitongjian-src/chapters";
const OUTPUT_FILE = "data/volume-excerpts.json";
const REPO_DIR = path.dirname(SOURCE_DIR);
const REPO_URL = "https://github.com/JY0284/zizhitongjian.git";

function ensureSource() {
  if (existsSync(SOURCE_DIR)) return;

  const clone = spawnSync("git", [
    "clone",
    "--depth",
    "1",
    "--filter=blob:none",
    "--sparse",
    REPO_URL,
    REPO_DIR,
  ], { stdio: "inherit" });
  if (clone.status !== 0) throw new Error("failed to clone source repository");

  const sparse = spawnSync("git", ["-C", REPO_DIR, "sparse-checkout", "set", "chapters"], {
    stdio: "inherit",
  });
  if (sparse.status !== 0) throw new Error("failed to checkout chapters");
}

function normalizeParagraph(paragraph) {
  return paragraph
    .replace(/^\s+/, "")
    .replace(/\r/g, "")
    .replace(/崐/g, "")
    .replace(/\s+/g, "")
    .replace(/^\[\d+\]/, "")
    .replace(/^【\d+】/, "")
    .trim();
}

function isHeading(paragraph) {
  return /^资治通鉴/.test(paragraph) ||
    /^[周秦汉魏晋宋齐梁陈隋唐后]+纪/.test(paragraph) ||
    /^后[梁唐晋汉周]纪/.test(paragraph);
}

function isUsefulClassical(paragraph) {
  if (paragraph.length < 34) return false;
  if (/[？?]/.test(paragraph) && paragraph.length < 56) return false;
  if (/公元|后周世宗|南唐主|后蜀主|司马光曰：我|这是说|翻译|白话/.test(paragraph)) return false;

  const classicalHits = (paragraph.match(/[曰之其以者也矣乎乃遂故夫]/g) || []).length;
  const modernHits = (paragraph.match(/[的了着们把]/g) || []).length;
  return classicalHits >= 4 && modernHits <= Math.max(3, Math.floor(paragraph.length / 45));
}

function trimToSentence(paragraph, maxLength = 230) {
  if (paragraph.length <= maxLength) return paragraph;
  const slice = paragraph.slice(0, maxLength);
  const cut = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？"),
    slice.lastIndexOf("；")
  );
  return (cut > 80 ? slice.slice(0, cut + 1) : slice).trim();
}

function selectByPosition(candidates) {
  const good = candidates
    .map((text, index) => ({ text: trimToSentence(text), index }))
    .filter((item) => item.text.length >= 42);

  if (good.length <= 5) return good;

  const targets = [0.04, 0.22, 0.46, 0.68, 0.9];
  const selected = [];
  const seen = new Set();

  for (const target of targets) {
    const wanted = Math.round((good.length - 1) * target);
    let best = null;
    for (let distance = 0; distance < good.length; distance += 1) {
      for (const candidateIndex of [wanted - distance, wanted + distance]) {
        const candidate = good[candidateIndex];
        if (!candidate || seen.has(candidate.index)) continue;
        best = candidate;
        break;
      }
      if (best) break;
    }
    if (best) {
      selected.push(best);
      seen.add(best.index);
    }
  }

  return selected.sort((a, b) => a.index - b.index);
}

function toTraditional(text) {
  const converted = spawnSync("opencc", ["-c", "s2t"], {
    input: text,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });

  if (converted.status !== 0) return text;
  return converted.stdout;
}

function extractClassicalParagraphs(markdown) {
  const paragraphs = markdown
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isHeading(line));

  const markerCounts = new Map();
  const candidates = [];
  let unmarkedParity = 0;

  for (const paragraph of paragraphs) {
    const marker = paragraph.match(/^　*\[(\d+)\]/);
    const clean = normalizeParagraph(paragraph);
    if (!clean || isHeading(clean)) continue;

    if (marker) {
      const key = marker[1];
      const count = (markerCounts.get(key) || 0) + 1;
      markerCounts.set(key, count);
      unmarkedParity = 0;
      if (count % 2 === 1 && isUsefulClassical(clean)) candidates.push(clean);
      continue;
    }

    if (unmarkedParity % 2 === 0 && isUsefulClassical(clean)) candidates.push(clean);
    unmarkedParity += 1;
  }

  return candidates;
}

function sourceUrl(filename) {
  return `https://github.com/JY0284/zizhitongjian/blob/main/chapters/${encodeURIComponent(filename)}`;
}

ensureSource();
const files = (await readdir(SOURCE_DIR))
  .filter((file) => /^\d{3}_.*\.md$/.test(file))
  .sort();

const output = [null];

for (const file of files) {
  const number = Number(file.slice(0, 3));
  const markdown = await readFile(path.join(SOURCE_DIR, file), "utf8");
  const selected = selectByPosition(extractClassicalParagraphs(markdown));
  const joined = selected.map((item) => item.text).join("\n---PASSAGE---\n");
  const traditional = toTraditional(joined)
    .split("\n---PASSAGE---\n")
    .map((text) => text.trim())
    .filter(Boolean);

  output[number] = {
    file,
    sourceUrl: sourceUrl(file),
    passageCount: traditional.length,
    chars: traditional.reduce((sum, text) => sum + text.length, 0),
    passages: traditional.map((text, index) => ({
      label: ["開卷", "承勢", "轉折", "深讀", "收束"][index] || `摘讀 ${index + 1}`,
      text,
    })),
  };
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`Built ${OUTPUT_FILE} for ${files.length} volumes.`);
