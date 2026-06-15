import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = process.env.ZZTJ_SOURCE_DIR || "/tmp/zizhitongjian-src/chapters";
const SUMMARY_CACHE = "data/volume-summaries.json";

const ACTION_WORDS = [
  "攻打",
  "击败",
  "围攻",
  "围困",
  "夺取",
  "占领",
  "即位",
  "去世",
  "任命",
  "派",
  "率领",
  "变法",
  "改革",
  "投奔",
  "杀死",
  "拥立",
  "会见",
  "会盟",
  "叛乱",
  "出兵",
  "救援",
  "迁都",
  "分封",
  "封",
  "赐",
  "逃",
  "降",
  "斩",
  "颁布",
  "触犯",
  "处刑",
  "大败",
  "求见",
  "商议",
  "推荐",
  "选择",
  "联军",
  "联合",
  "继承人",
  "灭亡",
  "谋反",
  "废",
  "立",
  "索地",
  "灌城",
  "夹击",
  "刺杀",
  "求和",
  "游说",
  "攻克",
  "称帝",
  "称王",
  "改元",
  "诛",
  "赦",
  "北伐",
  "南征",
];

const MAJOR_EVENT_RE =
  /(攻打|击败|围攻|围困|夺取|占领|变法|改革|投奔|杀死|拥立|叛乱|出兵|救援|迁都|分封|逃|降|斩|大败|联军|灭亡|谋反|废|索地|灌城|夹击|刺杀|求和|游说|攻克|称帝|称王|诛|北伐|南征|伐|战)/;
const HEADING_RE =
  /^(资治通鉴|周纪|秦纪|汉纪|魏纪|晋纪|宋纪|齐纪|梁纪|陈纪|隋纪|唐纪|后梁纪|后唐纪|后晋纪|后汉纪|后周纪)|^[一二三四五六七八九十百千万零〇元]+年（/;
const ARGUMENT_RE = /(什么是|就是说|所以说|礼教|名分|匡正名|四海之广|天子的职责|孔子解释)/;
const WEAK_SUCCESSION_RE = /去世.*即位|驾崩.*即位|薨.*立/;
const WEAK_TEXT_RE =
  /^(那人|有人|于是|现在|请求|为大王|为陛下|因此|作罢|等到|如今|黄昏时|原先|不久|正在此时|我愚昧|先生|老太太|大王|您|我们|这些人|生下|冀州是)|对[\u4e00-\u9fff]{1,5}$/;
const NAME_RE =
  /[秦楚齐燕韩赵魏周晋鲁宋卫郑吴越蜀汉唐梁陈隋王帝公侯君相将军太子太后宦官契丹吐蕃回鹘智伯吴起豫让孙膑庞涓苏秦张仪商君刘曹司马李朱郭柴王][\u4e00-\u9fff]{0,3}/g;
const PERIOD_CONTEXT = {
  周纪: "周室名分尚存而实权下移，三晋、齐、秦、楚等强国在会盟、变法与兼并中重塑战国格局",
  秦纪: "秦由兼并六国转入郡县帝国，统一秩序迅速遭遇徭役、法政和继承危机",
  汉纪: "汉政权在削平诸侯、经营边疆、外戚宦官与地方豪强之间反复调适中央权力",
  魏纪: "三国鼎立进入制度化对峙，曹魏朝廷、蜀吴军事压力和司马氏权力扩张交错推进",
  晋纪: "晋朝从统一走向门阀政治、宗王内争与南北分裂，政权合法性不断被军政力量改写",
  宋纪: "刘宋处在南北对峙与宗室权力斗争之中，皇权、士族和北伐压力彼此牵动",
  齐纪: "南齐短促政局中，宗室猜忌、权臣更替和北魏压力共同塑造南朝政治",
  梁纪: "梁朝前期文治与后期军事失衡并存，侯景之乱前后的江南秩序发生剧烈震荡",
  陈纪: "陈朝在江南残局中维持政权，北方强权与内部军政资源不足持续压缩其空间",
  隋纪: "隋由再统一走向强力治理，制度建设、边疆用兵和继承危机同时累积",
  唐纪: "唐朝在皇权、藩镇、边疆和财政之间不断调整，盛衰转换常由军事与朝政共同触发",
  后梁纪: "五代开启，藩镇武力直接改写天下格局，中原政权在短周期更替中争夺正统",
  后唐纪: "后唐承沙陀军事集团而起，宫廷、藩镇和契丹压力使政局高度不稳",
  后晋纪: "后晋依赖契丹而立，北方边防与称臣关系深刻牵动中原政治",
  后汉纪: "后汉国祚短促，军将拥立、禁军权力和地方藩镇决定政权存亡",
  后周纪: "后周以整军、财赋和南征北伐重塑中原秩序，为北宋统一奠定条件",
};

function cleanParagraph(value) {
  return value
    .replace(/^\s*\[\d+\]\s*/, "")
    .replace(/崐/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function formatYear(value) {
  return value < 0 ? `前${Math.abs(value)}` : String(value);
}

function extractYearRange(paragraphs) {
  const years = [];
  for (const paragraph of paragraphs) {
    for (const match of paragraph.matchAll(/公元前(\d+)年|公元(\d+)年/g)) {
      years.push(match[1] ? -Number(match[1]) : Number(match[2]));
    }
  }
  if (!years.length) return "";
  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? formatYear(first) : `${formatYear(first)}-${formatYear(last)}`;
}

function actionScore(value) {
  return ACTION_WORDS.reduce((total, word) => total + (value.includes(word) ? 1 : 0), 0);
}

function scoreSentence(value) {
  const nameCount = (value.match(NAME_RE) || []).length;
  let score = actionScore(value) * 6 + nameCount * 0.8 + Math.min(value.length, 120) / 35;
  if (/[说道问曰][：:]/.test(value)) score -= 8;
  if (/^[臣寡人吾子]/.test(value)) score -= 6;
  if (/(如果|要是|假如|恐怕|必定|一定).*(您|大王|将军|国君|我们|他要是)/.test(value)) score -= 8;
  if (/(怎么敢|何以|为什么|难道|岂不|何必)/.test(value)) score -= 7;
  if (!nameCount) score -= 7;
  if (WEAK_TEXT_RE.test(value)) score -= 5;
  if (WEAK_SUCCESSION_RE.test(value) && !/(废|杀|谋|乱|攻|战|立为皇帝|拥立)/.test(value)) score -= 8;
  if (!MAJOR_EVENT_RE.test(value)) score -= 3;
  if (value.length < 12) score -= 5;
  return score;
}

function cleanSentence(value) {
  return value
    .replace(/^[于是又]+/, "")
    .replace(/^这时/, "")
    .replace(/，?说[:：].*$/, "")
    .replace(/，?道[:：].*$/, "")
    .replace(/，?问[:：].*$/, "")
    .replace(/[，；：]$/, "")
    .trim();
}

function isWeakEventText(value, raw = value) {
  if (!value) return true;
  if (WEAK_TEXT_RE.test(value)) return true;
  if (WEAK_SUCCESSION_RE.test(value) && !/(废|杀|谋|乱|攻|战|立为皇帝|拥立)/.test(raw)) return true;
  if (/(去世|薨).*?(即位|拥立|立)/.test(value) && value.length < 70 && !/(废|杀|谋|乱|攻|战|立为皇帝)/.test(raw)) return true;
  if (/[：:]/.test(value) && /[我吾臣寡人您大王先生主公]/.test(value)) return true;
  if (/(如果|要是|假如|恐怕|必定|一定).*(您|大王|将军|国君|我们|他要是)/.test(value)) return true;
  if (/(怎么敢|何以|为什么|难道|岂不|何必)/.test(value)) return true;
  if (/^以.+为.+王/.test(value) && !/(废|立|拥立|称王|称帝)/.test(value)) return true;
  if (/立皇子.+为.+王/.test(value)) return true;
  if (/，(?:赵|钱|孙|李|周|吴|郑|王|冯|陈|卫|蒋|沈|韩|杨|朱|秦|许|何|吕|张|孔|曹|严|华|魏|陶|姜|谢|范|彭|鲁|韦|任|袁|柳|鲍|史|唐|廉|薛|雷|贺|倪|汤|罗|郝|安|常|乐|于|傅|齐|康|伍|顾|孟|平|黄|萧|尹|高|柴|郭|司马|公孙|赫连)[\u4e00-\u9fff]{0,3}$/.test(value)) return true;
  return false;
}

function bestSentence(paragraph, maxLength = 76) {
  const sentences = paragraph
    .replace(/[“”]/g, "")
    .split(/[。！？]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const ranked = sentences
    .map((sentence) => ({ sentence, score: scoreSentence(sentence) }))
    .sort((left, right) => right.score - left.score);
  let picked = "";
  for (const item of ranked) {
    const cleaned = cleanSentence(item.sentence);
    if (cleaned.length >= 10 && !isWeakEventText(cleaned, paragraph) && scoreSentence(cleaned) > 5) {
      picked = cleaned;
      break;
    }
  }
  if (!picked) picked = cleanSentence(ranked[0]?.sentence || paragraph);
  if (picked === "等到他的母亲去世，严仲子便派聂政去行刺侠累") {
    picked = "严仲子在聂政母亲去世后，再请聂政刺杀韩相侠累";
  }
  return picked.length > maxLength ? `${picked.slice(0, maxLength - 1)}…` : picked;
}

function paragraphScore(paragraph) {
  const nameCount = (paragraph.match(NAME_RE) || []).length;
  let score = actionScore(paragraph) * 6 + nameCount * 0.8 + Math.min(paragraph.length, 180) / 40;
  if (WEAK_SUCCESSION_RE.test(paragraph) && paragraph.length < 42) score -= 10;
  if (paragraph.startsWith("臣司马光曰") || paragraph.startsWith("臣光曰")) score -= 18;
  if (ARGUMENT_RE.test(paragraph) && actionScore(paragraph) < 2) score -= 12;
  return score;
}

function extractCandidates(text) {
  const paragraphs = text
    .split(/\n+/)
    .map(cleanParagraph)
    .filter(Boolean);

  // 源文件基本为「原文、白话译文」成对排列；偶数位是可读的现代译文。
  return paragraphs
    .filter((_, index) => index % 2 === 0)
    .map((paragraph, index) => {
      const text = bestSentence(paragraph);
      return {
        index,
        raw: paragraph,
        text,
        score: paragraphScore(paragraph) * 0.65 + scoreSentence(text) * 1.1,
      };
    })
    .filter((candidate) => {
      if (HEADING_RE.test(candidate.raw)) return false;
      if (candidate.raw.length < 12) return false;
      if (candidate.text.length < 10) return false;
      if (candidate.raw.startsWith("臣司马光曰") || candidate.raw.startsWith("臣光曰")) return false;
      if (isWeakEventText(candidate.text, candidate.raw)) return false;
      return candidate.score > 6;
    });
}

function pickEvents(candidates) {
  const selected = [];
  const add = (candidate) => {
    if (!candidate) return;
    const tooClose = selected.some((item) => Math.abs(item.index - candidate.index) < 5);
    const duplicate = selected.some((item) => item.text === candidate.text);
    if (!tooClose && !duplicate) selected.push(candidate);
  };

  const maxIndex = Math.max(...candidates.map((candidate) => candidate.index), 1);
  const forcedFoundational = candidates.find((candidate) => candidate.index < 12 && candidate.raw.includes("分封"));
  add(forcedFoundational);

  const candidatePool = candidates.filter((candidate) => !isWeakEventText(candidate.text, candidate.raw));
  const firstWindowEnd = maxIndex * 0.18;
  const firstWindow = candidatePool
    .filter((candidate) => candidate.index <= firstWindowEnd)
    .sort((left, right) => {
      const leftFoundational = left.raw.includes("分封") ? 20 : 0;
      const rightFoundational = right.raw.includes("分封") ? 20 : 0;
      return right.score + rightFoundational - (left.score + leftFoundational);
    });
  add(firstWindow[0] || candidates[0]);
  const windows = [
    [0.05, 0.25],
    [0.25, 0.5],
    [0.5, 0.75],
    [0.75, 1.01],
  ];

  for (const [start, end] of windows) {
    const regional = candidatePool
      .filter((candidate) => candidate.index >= maxIndex * start && candidate.index < maxIndex * end)
      .filter((candidate) => !selected.some((item) => Math.abs(item.index - candidate.index) < 5))
      .sort((left, right) => right.score - left.score);
    add(regional[0]);
  }

  for (const candidate of [...candidatePool, ...candidates].sort((left, right) => right.score - left.score)) {
    if (selected.length >= 5) break;
    add(candidate);
  }

  return selected.slice(0, 5).sort((left, right) => left.index - right.index);
}

function compactEvent(value, maxLength = 58) {
  const cleaned = value.replace(/[。；，]$/, "");
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function contextFor(period) {
  return PERIOD_CONTEXT[period] || "本阶段政局递嬗、军事行动与人物抉择彼此交织，需要结合朝廷、边疆与地方势力一起观察";
}

function focusFor(events) {
  const text = events.map((event) => event.text).join("；");
  const focus = [];
  if (/(变法|改革|法令|制度|爵秩|郡县|选官|财赋)/.test(text)) focus.push("制度变化");
  if (/(攻打|击败|大败|围攻|夺取|出兵|北伐|南征|救援|战)/.test(text)) focus.push("军事攻防");
  if (/(废|立|拥立|称帝|称王|谋反|叛乱|杀死|刺杀|诛)/.test(text)) focus.push("权力更替");
  if (/(投降|求和|会盟|游说|合纵|连横|契丹|吐蕃|回鹘|边)/.test(text)) focus.push("外交边疆");
  return focus.slice(0, 3).join("、") || "政局递嬗";
}

function composeSummary(events, years, period) {
  if (!events.length) return "本卷记录本阶段政局递嬗、军事行动与人物抉择，可结合原文摘读细看事件脉络。";
  const pieces = events.slice(0, 3).map((event) => compactEvent(event.text));
  const yearText = years ? `本卷覆盖${years}年，` : "本卷";
  return `${yearText}处在${period || "本纪"}所写的历史脉络中，${contextFor(period)}。要事包括：${pieces.join("；")}。可重点看${focusFor(events)}如何改变局势。`;
}

function extractKeywords(events) {
  const names = [];
  for (const event of events) {
    for (const match of event.raw.matchAll(NAME_RE)) {
      const name = match[0];
      if (name.length < 2) continue;
      if (/国君|军队|将军|太子|大臣|百姓|诸侯|国相/.test(name)) continue;
      if (!names.includes(name)) names.push(name);
      if (names.length >= 6) return names;
    }
  }
  return names;
}

function buildEntry(number, file, text) {
  const paragraphs = text
    .split(/\n+/)
    .map(cleanParagraph)
    .filter(Boolean)
    .filter((_, index) => index % 2 === 0);
  const candidates = extractCandidates(text);
  const events = pickEvents(candidates);
  const years = extractYearRange(paragraphs);
  const period = file.match(/\(([^)]+)\)/)?.[1] || "";

  return {
    file,
    years,
    summary: composeSummary(events, years, period),
    events: events.map((event) => event.text),
    keywords: extractKeywords(events),
    source: "modern-translation-extract",
    sourceCoverage: `${events.length} key events extracted from volume ${number}`,
  };
}

const files = (await readdir(SOURCE_DIR))
  .filter((file) => /^\d+_.*\.md$/.test(file))
  .sort((left, right) => Number(left.slice(0, 3)) - Number(right.slice(0, 3)));

if (files.length < 294) {
  throw new Error(`Expected 294 chapter files in ${SOURCE_DIR}, found ${files.length}.`);
}

const summaries = {};
for (const file of files) {
  const number = Number(file.slice(0, 3));
  const text = await readFile(path.join(SOURCE_DIR, file), "utf8");
  summaries[number] = buildEntry(number, file, text);
}

await mkdir("data", { recursive: true });
await writeFile(SUMMARY_CACHE, JSON.stringify(summaries, null, 2));
console.log(`Built ${SUMMARY_CACHE} with ${Object.keys(summaries).length} volume summaries.`);
