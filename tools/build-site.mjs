import { readFile, writeFile } from "node:fs/promises";

const EPUB_INDEX_CACHE = "data/epub-index.json";
const VOLUME_MD_DIR = "zztj-volumes";
const TOTAL_VOLUME_COUNT = 294;
const ERA_DEFS = [
  { id: "zhou", name: "周纪", start: 1, end: 5, years: "前403-前256", color: "#9f352a", focus: ["5 卷", "战国开篇", "周纪"], lens: "战国开局与名分瓦解" },
  { id: "qin", name: "秦纪", start: 6, end: 8, years: "前255-前207", color: "#7c4b26", focus: ["3 卷", "秦纪"], lens: "统一帝国的建立与速亡" },
  { id: "han", name: "汉纪", start: 9, end: 68, years: "前206-220", color: "#b8873b", focus: ["60 卷", "汉纪"], lens: "皇权、边疆与制度成形" },
  { id: "wei", name: "魏纪", start: 69, end: 78, years: "220-265", color: "#355d88", focus: ["10 卷", "魏纪"], lens: "三国格局与司马氏崛起" },
  { id: "jin", name: "晋纪", start: 79, end: 118, years: "265-419", color: "#356d68", focus: ["40 卷", "晋纪"], lens: "统一崩解、门阀与南北分裂" },
  { id: "song", name: "宋纪", start: 119, end: 134, years: "420-479", color: "#6d5a9e", focus: ["16 卷", "宋纪"], lens: "南朝军功政治与宗室内耗" },
  { id: "qi", name: "齐纪", start: 135, end: 144, years: "479-502", color: "#7c6840", focus: ["10 卷", "齐纪"], lens: "短命王朝的废立循环" },
  { id: "liang", name: "梁纪", start: 145, end: 166, years: "502-557", color: "#9b4f62", focus: ["22 卷", "梁纪"], lens: "文治表象下的军政危机" },
  { id: "chen", name: "陈纪", start: 167, end: 176, years: "557-589", color: "#3f6f8a", focus: ["10 卷", "陈纪"], lens: "江南偏安与隋统一压力" },
  { id: "sui", name: "隋纪", start: 177, end: 184, years: "589-617", color: "#8f5130", focus: ["8 卷", "隋纪"], lens: "再统一、急政与民力透支" },
  { id: "tang", name: "唐纪", start: 185, end: 265, years: "618-907", color: "#a55d20", focus: ["81 卷", "唐纪"], lens: "盛衰转换、藩镇与宦官" },
  { id: "houliang", name: "后梁纪", start: 266, end: 271, years: "907-923", color: "#7b342d", focus: ["6 卷", "后梁纪"], lens: "唐末藩镇逻辑的延续" },
  { id: "houtang", name: "后唐纪", start: 272, end: 279, years: "923-936", color: "#4c5f8a", focus: ["8 卷", "后唐纪"], lens: "沙陀集团入主中原" },
  { id: "houjin", name: "后晋纪", start: 280, end: 285, years: "936-947", color: "#5d6a4a", focus: ["6 卷", "后晋纪"], lens: "契丹压力与中原依附" },
  { id: "houhan", name: "后汉纪", start: 286, end: 289, years: "947-950", color: "#8b6234", focus: ["4 卷", "后汉纪"], lens: "禁军、功臣与短促政权" },
  { id: "houzhou", name: "后周纪", start: 290, end: 294, years: "951-959", color: "#2f6c63", focus: ["5 卷", "后周纪"], lens: "军政整顿与宋代前夜" }
];

const ERA_INTROS = {
  zhou: "周纪是《资治通鉴》全书的开端。司马光没有从周初写起，而是从周威烈王承认韩、赵、魏为诸侯写起，正说明他关心的不是单纯的朝代起点，而是政治秩序何以失守。这里的核心问题是名分、礼法与实力的错位：周天子仍在，诸侯名义仍存，真正决定局势的却已经是卿大夫、变法家、纵横家和能动员军政资源的强国。",
  qin: "秦纪篇幅不长，却压缩了统一帝国从完成到崩解的关键过程。秦的强大来自长期变法、军功爵制、郡县行政和严密法令；秦的失败也与这些工具的过度使用有关。读秦纪不能只看暴政和民变，还要看统一之后制度如何从战争状态转向治理状态，又为何没有完成这种转换。",
  han: "汉纪在全书中占据最大篇幅之一，是观察中国古代帝国制度成形的主轴。它从楚汉战争写到东汉灭亡，贯穿皇权确立、功臣处置、外戚宦官、边疆财政、经学政治、地方豪强和士人风气等主题。汉代不是静态的盛世样本，而是一个在扩张、调整、衰败和再造之间不断摆动的政治共同体。",
  wei: "魏纪承接东汉崩解后的三国格局，重点不只是曹魏与蜀吴的军事对抗，更是新权力如何在旧名分中寻找合法性。曹氏以禅代承接汉统，司马氏又在曹魏制度内部完成权力转移。卷中大量任免、征伐和朝议，实际都指向一个问题：乱世中的军事集团如何变成新的国家机器。",
  jin: "晋纪横跨西晋统一、八王之乱、永嘉之祸、东晋偏安和十六国交错，是全书最复杂的分裂时代之一。它的主线不是简单的王朝兴亡，而是宗室政治、门阀社会、胡汉政权、江南开发和北方军事力量长期缠绕。读晋纪要同时看中央失控、地方自保和文化秩序重组。",
  song: "宋纪进入南朝第一阶段，刘宋以军功起家，又迅速陷入皇族相残和权臣废立。江南政权表面承续晋室衣冠，内里却更依赖军府、寒人、宗室和边镇。它展示了南朝政治的基本困境：皇权要压制门阀和将帅，却又必须依靠他们维持疆域与财政。",
  qi: "齐纪篇幅较短，却把南朝短命王朝的节奏推到极端。萧道成代宋立齐，本想用更紧密的皇权重整秩序，但宗室猜忌、皇位更替和权臣崛起很快吞噬了制度空间。读齐纪的关键，是看一个新王朝如何在继承前代问题时，几乎没有时间建立新的稳定规则。",
  liang: "梁纪表面上是梁武帝文治、礼学和佛教兴盛的时代，深层却是南北对峙、士族结构、宗室藩屏和军政能力的持续失衡。梁朝的文化气象越盛，越能反衬军事与继承问题的积累；侯景之乱并不是突然降临，而是长期制度疲弱后的集中爆发。",
  chen: "陈纪写南朝最后一段。陈朝能够在侯景之乱后收拾江南残局，却始终面对北方政权整合后的压力。它的历史意义不在于开创新制度，而在于显示江南偏安政权在财政、军事、人才和地缘上的极限。隋的统一不是孤立事件，而是南北力量对比长期变化后的结果。",
  sui: "隋纪篇幅虽短，却是从长期分裂重新走向统一的关键桥段。隋完成南北整合、恢复中央集权、重建制度工程，但也在高强度征发、对外战争和继承危机中迅速耗尽民力。它像一座桥，连接南北朝的分裂秩序和唐代的帝国格局。",
  tang: "唐纪是《资治通鉴》后半部最宏阔的部分，从建国统一、贞观治理、武周改制、开元盛世，一直写到安史之乱、藩镇割据、宦官专权和唐亡。它展示的不是单线盛衰，而是一个大帝国在制度能力、财政结构、军事边防和政治伦理之间反复调适的过程。",
  houliang: "后梁纪进入五代。朱温代唐并没有终结唐末藩镇逻辑，只是把它推到中原王朝名义之下。后梁的政治基础是军事控制和对旧唐资源的再分配，因此继承、将帅、财政和对外战争都异常尖锐。它是五代乱局的开端，也是唐宋之间制度再造的反面教材。",
  houtang: "后唐纪以沙陀军事集团入主中原为核心。李存勖灭梁后拥有恢复唐名的象征资本，却很快败于财政、用人和内廷问题；明宗相对务实，但继承秩序仍旧脆弱。后唐说明，军事胜利可以夺取天下，却未必能直接转化为稳定治理。",
  houjin: "后晋纪的关键在契丹压力。石敬瑭借契丹之力建国，割让燕云，改变了此后数百年的北方边防格局。后晋内部仍是五代常见的禁军、藩镇和功臣矛盾，但外部依附关系让它的政治选择更受牵制。读后晋纪，要把中原兴亡与辽的崛起放在同一张地图里看。",
  houhan: "后汉纪极短，却充分暴露五代政权的脆弱。刘知远趁后晋崩溃而起，政权很快又被禁军、权臣和继承问题撕裂。它的意义在于承上启下：后晋亡于外部压力与内部失序，后汉亡于中央控制不足，而后周正是在这种连续失败中找到整顿方向。",
  houzhou: "后周纪是《资治通鉴》的收束。郭威、柴荣以军政整顿重建中原秩序，压制骄兵，整饬财政，推进对南北的战略经营。全书止于后周显德六年，恰在宋代统一前夜；司马光让读者看到的不是一个结束，而是长期乱局即将被新制度接管的前奏。"
};

function padStatic(number) {
  return String(number).padStart(3, "0");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtmlStatic(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtmlStatic(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\s*/u, "");
}

function frontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp("^" + key + ":\\s*\"?([^\"\\n]+)\"?\\s*$", "m"));
  return match ? match[1].trim() : "";
}

function plainFromMarkdown(markdown) {
  return String(markdown || "")
    .replace(/^---\n[\s\S]*?\n---\s*/u, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMarkdownSections(markdown) {
  const body = stripFrontmatter(markdown).replace(/\r/g, "");
  const sections = {};
  let current = "导言";
  sections[current] = [];
  for (const line of body.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
      continue;
    }
    if (/^#\s+/.test(line)) continue;
    sections[current].push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]),
  );
}

function sectionText(sections, names) {
  for (const name of names) {
    if (sections[name]) return sections[name];
  }
  return "";
}

function listItemsFromMarkdown(markdown, limit = 6) {
  const items = [];
  for (const line of String(markdown || "").split("\n")) {
    const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/);
    if (match) items.push(plainFromMarkdown(match[1]));
    if (items.length >= limit) break;
  }
  return items;
}

function keywordsFromSection(markdown) {
  return plainFromMarkdown(markdown)
    .split(/[、，,\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 12);
}

function renderMarkdownTable(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const headHtml = "<thead><tr>" + head.map((cell) => "<th>" + inlineMarkdown(cell) + "</th>").join("") + "</tr></thead>";
  const bodyHtml = body.length
    ? "<tbody>" + body.map((row) => "<tr>" + row.map((cell) => "<td>" + inlineMarkdown(cell) + "</td>").join("") + "</tr>").join("") + "</tbody>"
    : "";
  return '<div class="md-table"><table>' + headHtml + bodyHtml + "</table></div>";
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) {
        index += 1;
        continue;
      }
      const tag = level <= 2 ? "h4" : "h5";
      html.push("<" + tag + ">" + inlineMarkdown(heading[2]) + "</" + tag + ">");
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const parts = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        parts.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push("<blockquote>" + parts.map((item) => "<p>" + inlineMarkdown(item) + "</p>").join("") + "</blockquote>");
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      const tableLines = [];
      while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      html.push(renderMarkdownTable(tableLines));
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^\d+\.\s+(.+)$/);
        if (!item) break;
        items.push("<li>" + inlineMarkdown(item[1]) + "</li>");
        index += 1;
      }
      html.push("<ol>" + items.join("") + "</ol>");
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!item) break;
        items.push("<li>" + inlineMarkdown(item[1]) + "</li>");
        index += 1;
      }
      html.push("<ul>" + items.join("") + "</ul>");
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next) break;
      if (/^(#{1,6})\s+/.test(next) || next.startsWith(">") || /^\|.+\|$/.test(next) || /^\d+\.\s+/.test(next) || /^[-*]\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    html.push("<p>" + paragraph.map(inlineMarkdown).join("<br>") + "</p>");
  }

  return html.join("");
}

function clipPlain(text, maxLength) {
  const plain = normalizePunctuation(plainFromMarkdown(text));
  if (plain.length <= maxLength) return plain;
  const clipped = plain.slice(0, maxLength);
  const sentenceCut = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("；"), clipped.lastIndexOf("，"));
  return normalizePunctuation((sentenceCut > Math.floor(maxLength * 0.55) ? clipped.slice(0, sentenceCut) : clipped).replace(/[，、；：:,. ]+$/u, "") + "。");
}

function normalizePunctuation(text) {
  return String(text || "")
    .replace(/([。！？；，、：])\1+/gu, "$1")
    .replace(/[，、；：:,.]+([。！？])/gu, "$1")
    .replace(/([。！？])([，、；：:,.。！？]+)/gu, "$1")
    .replace(/([；，、：])。/gu, "。")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentenceText(text) {
  const cleaned = normalizePunctuation(text).replace(/[。！？；，、：:,. ]+$/u, "");
  return cleaned ? cleaned + "。" : "";
}

function phraseText(text) {
  return normalizePunctuation(text).replace(/[。！？；，、：:,. ]+$/u, "");
}

async function loadVolumeMdSummaries() {
  const entries = {};
  for (let number = 1; number <= TOTAL_VOLUME_COUNT; number += 1) {
    const markdown = await readFile(`${VOLUME_MD_DIR}/${padStatic(number)}.md`, "utf8");
    const sections = splitMarkdownSections(markdown);
    const body = stripFrontmatter(markdown).replace(/^#\s+.+?\n+/u, "");
    const bodyForRender = body.replace(/^##\s+一句话提要\s*\n[\s\S]*?(?=\n##\s+|$)/u, "").trim();
    const oneLine = plainFromMarkdown(sectionText(sections, ["一句话提要"]));
    const period = plainFromMarkdown(sectionText(sections, ["时间范围", "时间范围与纪元"]));
    const events = listItemsFromMarkdown(sectionText(sections, ["本卷大事"]), 8);
    const keywords = keywordsFromSection(sectionText(sections, ["关键词"]));
    const plain = plainFromMarkdown(body);
    entries[number] = {
      number,
      title: frontmatterValue(markdown, "title") || plainFromMarkdown((stripFrontmatter(markdown).match(/^#\s+(.+)$/m) || [])[1] || ""),
      section: frontmatterValue(markdown, "section"),
      period: period || frontmatterValue(markdown, "period"),
      oneLine,
      preview: clipPlain(oneLine || sectionText(sections, ["现代文详解", "历史背景"]) || plain, 180),
      background: clipPlain(sectionText(sections, ["历史背景"]), 360),
      events,
      keywords,
      html: renderMarkdown(bodyForRender),
      plain,
      charCount: plain.length,
      sections: Object.fromEntries(
        Object.entries(sections).map(([key, value]) => [key, plainFromMarkdown(value)]),
      )
    };
  }
  return entries;
}

function pickVolumeSamples(volumes, count) {
  if (volumes.length <= count) return volumes;
  const picked = new Map();
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.round(index * (volumes.length - 1) / (count - 1));
    picked.set(volumes[sourceIndex].number, volumes[sourceIndex]);
  }
  return Array.from(picked.values());
}

function volumeDetailForEra(volume, limit) {
  const eventText = (volume.events || [])
    .slice(0, 3)
    .map((event) => phraseText(clipPlain(event, 82)))
    .filter(Boolean)
    .join("；");
  const impact = phraseText(clipPlain(volume.sections?.["历史影响"] || "", Math.floor(limit / 3)));
  const relation = phraseText(clipPlain(volume.sections?.["与前后卷的关系"] || "", Math.floor(limit / 4)));
  const sentences = [
    sentenceText(`卷${volume.number}《${volume.title || "資治通鑑"}》：${phraseText(volume.oneLine || "")}`),
    eventText ? sentenceText(`大事包括${eventText}`) : "",
    impact ? sentenceText(`影响在于${impact}`) : "",
    relation ? sentenceText(`前后关系是${relation}`) : ""
  ].filter(Boolean).join("");
  return clipPlain(sentences, limit);
}

function buildEraNarrative(era, volumeMdSummaries) {
  const volumes = [];
  for (let number = era.start; number <= era.end; number += 1) {
    if (volumeMdSummaries[number]) volumes.push(volumeMdSummaries[number]);
  }
  const keywords = [...new Set(volumes.flatMap((volume) => volume.keywords || []))].slice(0, 12);
  const count = era.end - era.start + 1;
  const openingVolume = volumes[0];
  const closingVolume = volumes[volumes.length - 1];
  const allEvents = volumes.flatMap((volume) => volume.events || []);
  const axisEvents = allEvents
    .slice(0, 6)
    .map((item) => phraseText(clipPlain(item, 88)))
    .filter(Boolean);
  const opening = openingVolume ? phraseText(openingVolume.oneLine) : "本纪承接前代局势展开";
  const closing = closingVolume ? phraseText(closingVolume.oneLine) : "本纪又把问题交给下一阶段";
  const keywordText = keywords.length ? keywords.join("、") : era.focus.join("、");
  const intro = normalizePunctuation(ERA_INTROS[era.id] || `${era.name}是全书结构中的一个重要阶段，卷内叙事需要放在前后朝代的连续变化中理解。`);
  const mainLine = [
    sentenceText(`${era.name}覆盖${era.years}，共${count}卷，卷次为${era.start}至${era.end}`),
    sentenceText(`这一段在全书中的阅读主轴是“${era.lens}”`),
    sentenceText(`若把《资治通鉴》看作一条连续的政治观察线，${era.name}的价值就在于把制度、人物和局势变化放到同一套时间秩序中，而不是只给出孤立的兴亡结论`),
    intro
  ].join("");
  const phaseText = [
    sentenceText(`从开端看，${opening}`),
    sentenceText(`到收束处，${closing}`),
    sentenceText(`卷内反复出现的关键词包括${keywordText}`),
    sentenceText("这些词并不是标签装饰，而是阅读本纪时应当持续追问的线索：谁掌握兵权，谁能调动财政，谁在名义上合法，谁又在事实上决定局面"),
    axisEvents.length ? sentenceText(`若只抓事件线，本纪最醒目的连续节点包括：${axisEvents.join("；")}`) : sentenceText("本纪的事件线需要逐卷细读，重点在于把人物选择与制度环境同时放进视野"),
    sentenceText("这些节点之间往往并非单纯先后关系，而是彼此推动：一处任免会改变边镇态势，一次战败会撬动朝廷信任，一场宫廷斗争又可能让地方武力重新洗牌")
  ].join("");
  const mapTable = [
    "| 观察维度 | 读法提示 |",
    "| --- | --- |",
    `| 权力结构 | ${phraseText(era.lens)} |`,
    `| 事件线索 | ${axisEvents.slice(0, 3).join("；") || "逐卷观察任免、征伐与制度调整"} |`,
    `| 关键词 | ${keywordText} |`,
    `| 卷次范围 | 卷${era.start}至卷${era.end}，共${count}卷 |`
  ].join("\n");
  const readingQuote = `> 读${era.name}，重点不是记住所有人物和战事，而是看每一卷怎样把名义、兵权、财政和人心连成一条因果链。`;
  const readingSteps = [
    `1. **先看起讫**：把${era.years}和卷${era.start}至卷${era.end}放在一起，先确定这一纪在全书中的位置。`,
    `2. **再看冲突**：顺着“${era.lens}”这条线索，区分哪些事件是表层胜负，哪些事件改变了制度和权力结构。`,
    "3. **最后回到逐卷**：读具体卷目时，用本纪总览校准背景，再进入每卷的现代文详解和原文。"
  ].join("\n");

  let sampleCount = volumes.length <= 8 ? volumes.length : Math.min(18, Math.max(10, Math.ceil(volumes.length / 5)));
  let detailLimit = volumes.length <= 6 ? 390 : volumes.length <= 12 ? 300 : 205;
  let markdown = "";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const samples = pickVolumeSamples(volumes, sampleCount);
    const detailList = samples
      .map((volume) => `- **卷${volume.number}**：${volumeDetailForEra(volume, detailLimit)}`)
      .join("\n");
    markdown = normalizePunctuation([
      "## " + era.name + "总览",
      "### 一、时代主线",
      mainLine,
      "### 二、阶段推进",
      phaseText,
      "### 三、阅读地图",
      mapTable,
      "### 四、关键卷目",
      detailList,
      "### 五、阅读提示",
      readingQuote,
      readingSteps
    ].join("\n\n"));
    const length = plainFromMarkdown(markdown).length;
    if (length >= 2000 && length <= 4000) break;
    if (length < 2000) {
      sampleCount = Math.min(volumes.length, sampleCount + 3);
      detailLimit += 70;
    } else {
      sampleCount = Math.max(6, sampleCount - 3);
      detailLimit = Math.max(150, detailLimit - 45);
    }
  }

  let plain = plainFromMarkdown(markdown);
  if (plain.length > 4000) {
    const shortSamples = pickVolumeSamples(volumes, Math.min(10, volumes.length));
    const detailList = shortSamples
      .map((volume) => `- **卷${volume.number}**：${volumeDetailForEra(volume, 165)}`)
      .join("\n");
    markdown = normalizePunctuation([
      "## " + era.name + "总览",
      "### 一、时代主线",
      mainLine,
      "### 二、阶段推进",
      phaseText,
      "### 三、阅读地图",
      mapTable,
      "### 四、关键卷目",
      detailList,
      "### 五、阅读提示",
      readingQuote,
      readingSteps
    ].join("\n\n"));
    plain = plainFromMarkdown(markdown);
  }
  markdown = normalizePunctuation(markdown);
  plain = normalizePunctuation(plainFromMarkdown(markdown));
  const preview = clipPlain([mainLine, phaseText].join(""), 190);

  return {
    id: era.id,
    name: era.name,
    years: era.years,
    color: era.color,
    start: era.start,
    end: era.end,
    count,
    lens: era.lens,
    keywords,
    preview,
    markdown,
    html: renderMarkdown(markdown),
    plain,
    charCount: plain.length
  };
}

const epubIndex = JSON.parse(await readFile(EPUB_INDEX_CACHE, "utf8"));
const publicEpubIndex = epubIndex.map((item) => {
  if (!item) return item;
  const { file, sourceUrl, ...rest } = item;
  return rest;
});
const titles = epubIndex.map((item) => item?.title || "");
const summaries = Object.fromEntries(
  epubIndex
    .filter(Boolean)
    .map((item) => [
      item.number,
      {
        years: item.chapter,
        summary: item.summary || item.chapter || "",
        events: (item.previewBlocks || [])
          .filter((block) => block.kind === "origin")
          .slice(0, 5)
          .map((block) => block.mainText || block.text),
        keywords: [
          `正文${item.originCount || 0}段`,
          `胡注${item.commentCount || 0}段`,
          `小注${item.noteCount || 0}处`,
          `约${item.chars || 0}字`,
        ],
      },
    ]),
);
const excerpts = Object.fromEntries(
  epubIndex
    .filter(Boolean)
    .map((item) => [
      item.number,
      {
        passageCount: item.previewBlocks?.length || 0,
        chars: item.previewBlocks?.reduce((total, block) => total + block.text.length, 0) || 0,
        sourceUrl: "",
        sourceLabel: item.sourceLabel || "本地 EPUB",
        passages: (item.previewBlocks || []).map((block, index) => ({
          label: block.kind === "reign-title" ? "纪年" : block.kind === "comment" ? "胡注" : `正文 ${index + 1}`,
          text: block.text,
        })),
        blocks: item.previewBlocks || [],
      },
    ]),
);
const volumeMdSummaries = await loadVolumeMdSummaries();
const eraNarratives = Object.fromEntries(
  ERA_DEFS.map((era) => [era.id, buildEraNarrative(era, volumeMdSummaries)]),
);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>資治通鑑全卷提要 · allon.me</title>
  <meta name="description" content="《資治通鑑》294 卷：全部依据本地 EPUB 胡三省注本，保留正文、绿色小注与竖排阅读格式。" />
  <link rel="icon" href="assets/favicon.ico" />
  <link rel="icon" type="image/png" href="assets/favicon.png" />
  <style>
    :root {
      --paper: #f6f0e3;
      --paper-deep: #e6d8bf;
      --ink: #1e2328;
      --ink-soft: #4d5357;
      --muted: #70736c;
      --line: rgba(42, 35, 27, .16);
      --line-strong: rgba(42, 35, 27, .28);
      --red: #9f352a;
      --red-soft: #d8a29a;
      --teal: #356d68;
      --gold: #b8873b;
      --blue: #355d88;
      --white: #fffaf1;
      --shadow: 0 28px 80px rgba(48, 36, 23, .16);
      --shadow-soft: 0 12px 38px rgba(48, 36, 23, .11);
      --radius: 8px;
    }

    * { box-sizing: border-box; }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      color: var(--ink);
      background:
        linear-gradient(90deg, rgba(72, 49, 27, .035) 1px, transparent 1px),
        linear-gradient(180deg, rgba(72, 49, 27, .03) 1px, transparent 1px),
        var(--paper);
      background-size: 36px 36px;
      font-family: ui-serif, "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif;
      line-height: 1.72;
      text-rendering: optimizeLegibility;
    }

    a {
      color: inherit;
      text-decoration-color: rgba(159, 53, 42, .42);
      text-underline-offset: 4px;
    }

    button,
    input {
      font: inherit;
    }

    .site-shell {
      min-height: 100vh;
      overflow-x: clip;
    }

    .hero {
      position: relative;
      min-height: 680px;
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid rgba(42, 35, 27, .18);
      color: var(--white);
      background: #1e1b17 url("assets/zztj-hero.jpg") center / cover no-repeat;
      isolation: isolate;
    }

    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        linear-gradient(90deg, rgba(18, 16, 14, .9), rgba(18, 16, 14, .62) 44%, rgba(18, 16, 14, .18)),
        linear-gradient(180deg, rgba(14, 13, 12, .14), rgba(14, 13, 12, .68));
    }

    .hero-inner {
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto;
      padding: 46px 0 34px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 42px;
    }

    .topline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      color: rgba(255, 250, 241, .78);
      font-size: 14px;
    }

    .seal {
      display: inline-grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border: 1px solid rgba(255, 250, 241, .36);
      border-radius: 6px;
      background: rgba(159, 53, 42, .76);
      color: #fff7ee;
      font-weight: 700;
      line-height: 1.05;
    }

    .hero-copy {
      align-self: center;
      max-width: 760px;
    }

    .eyebrow {
      margin: 0 0 18px;
      color: rgba(255, 250, 241, .76);
      font-size: 15px;
    }

    .hero h1 {
      margin: 0;
      font-size: 78px;
      line-height: 1.02;
      font-weight: 800;
    }

    .hero-subtitle {
      max-width: 660px;
      margin: 24px 0 0;
      color: rgba(255, 250, 241, .84);
      font-size: 21px;
      line-height: 1.78;
    }

    .hero-meta {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      max-width: 930px;
    }

    .metric {
      min-height: 112px;
      padding: 18px 18px 16px;
      border: 1px solid rgba(255, 250, 241, .23);
      border-radius: var(--radius);
      background: rgba(34, 29, 23, .5);
      backdrop-filter: blur(12px);
    }

    .metric strong {
      display: block;
      font-size: 28px;
      line-height: 1.1;
    }

    .metric span {
      display: block;
      margin-top: 8px;
      color: rgba(255, 250, 241, .72);
      font-size: 13px;
      line-height: 1.5;
    }

    .wrap {
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      margin: 0 auto;
      padding: 14px 0;
      background: rgba(246, 240, 227, .9);
      border-bottom: 1px solid rgba(42, 35, 27, .12);
      backdrop-filter: blur(18px);
    }

    .toolbar-inner {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .era-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      width: 100%;
    }

    .era-tab {
      min-height: 38px;
      padding: 7px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 250, 241, .58);
      color: var(--ink-soft);
      cursor: pointer;
      transition: transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease;
    }

    .era-tab:hover {
      transform: translateY(-1px);
      border-color: rgba(159, 53, 42, .4);
      color: var(--ink);
    }

    .era-tab.is-active {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--white);
    }

    .intro {
      padding: 58px 0 30px;
      display: grid;
      grid-template-columns: .94fr 1.06fr;
      gap: 42px;
      align-items: end;
    }

    .intro h2 {
      margin: 0;
      font-size: 34px;
      line-height: 1.24;
    }

    .intro p {
      margin: 0;
      color: var(--ink-soft);
      font-size: 17px;
    }

    .timeline {
      margin: 0 0 48px;
      padding: 18px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      background: rgba(255, 250, 241, .62);
      box-shadow: 0 12px 34px rgba(62, 43, 24, .06);
    }

    .timeline-head {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: start;
      margin-bottom: 14px;
    }

    .timeline-head b {
      display: block;
      font-size: 17px;
      line-height: 1.35;
    }

    .timeline-head span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
    }

    .timeline-unit {
      flex: 0 0 auto;
      padding: 6px 9px;
      border: 1px solid var(--line);
      border-radius: 5px;
      color: var(--ink-soft);
      background: rgba(255, 250, 241, .68);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.3;
    }

    .timeline-scroll {
      overflow: visible;
      padding: 44px 0 8px;
    }

    .timeline-plot {
      min-width: 760px;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: end;
    }

    .timeline-axis {
      position: relative;
      height: 190px;
      border-right: 1px solid var(--line);
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 11px;
    }

    .axis-tick {
      position: absolute;
      right: 8px;
      transform: translateY(50%);
      white-space: nowrap;
    }

    .timeline-bars {
      position: relative;
      height: 190px;
      display: grid;
      grid-template-columns: repeat(16, minmax(34px, 1fr));
      gap: 7px;
      align-items: end;
      padding: 0 0 24px;
      border-bottom: 1px solid rgba(42, 35, 27, .3);
      background:
        linear-gradient(to top, rgba(42, 35, 27, .14) 1px, transparent 1px) 0 0 / 100% 55px,
        linear-gradient(to top, rgba(255, 250, 241, .48), rgba(255, 250, 241, .1));
    }

    .timeline-segment {
      position: relative;
      min-width: 0;
      height: 100%;
      display: flex;
      align-items: end;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      transition: opacity .18s ease, filter .18s ease;
    }

    .timeline-bar {
      width: min(100%, 44px);
      height: var(--h);
      min-height: 6px;
      border-radius: 5px 5px 2px 2px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--c) 88%, white), var(--c));
      box-shadow: inset 0 0 0 1px rgba(255, 250, 241, .34), 0 8px 18px rgba(62, 43, 24, .12);
      transition: transform .18s ease, filter .18s ease, box-shadow .18s ease;
    }

    .timeline-name {
      position: absolute;
      left: 50%;
      bottom: -2px;
      transform: translate(-50%, 100%);
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 11px;
      white-space: nowrap;
    }

    .timeline-segment:hover .timeline-bar,
    .timeline-segment:focus-visible .timeline-bar,
    .timeline-segment.is-active .timeline-bar {
      transform: translateY(-4px);
      filter: saturate(1.12);
      box-shadow: inset 0 0 0 1px rgba(255, 250, 241, .42), 0 12px 24px rgba(62, 43, 24, .18);
    }

    .timeline-tip {
      position: absolute;
      left: 50%;
      top: -38px;
      transform: translateX(-50%);
      white-space: nowrap;
      padding: 4px 8px;
      border-radius: 5px;
      background: rgba(31, 35, 40, .94);
      color: var(--white);
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 8px 18px rgba(31, 35, 40, .2);
    }

    .timeline-segment:hover .timeline-tip,
    .timeline-segment:focus-visible .timeline-tip {
      opacity: 1;
    }

    .timeline-legend {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .timeline-chip {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 34px;
      padding: 6px 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 250, 241, .62);
      color: var(--ink-soft);
      cursor: pointer;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      transition: border-color .18s ease, background .18s ease, color .18s ease;
    }

    .timeline-chip i {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 1px rgba(42, 35, 27, .14);
    }

    .timeline-chip:hover,
    .timeline-chip:focus-visible,
    .timeline-chip.is-active {
      border-color: rgba(159, 53, 42, .42);
      background: rgba(255, 250, 241, .92);
      color: var(--ink);
      outline: 0;
    }

    .reader-grid {
      display: block;
      padding-bottom: 72px;
    }

    .reader-panel {
      position: sticky;
      top: 92px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      background: rgba(255, 250, 241, .82);
      box-shadow: var(--shadow-soft);
      overflow: hidden;
    }

    .panel-head {
      padding: 22px 22px 18px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(159, 53, 42, .1), rgba(184, 135, 59, .1));
    }

    .panel-kicker {
      margin: 0 0 8px;
      color: var(--red);
      font-size: 13px;
      font-weight: 700;
    }

    .panel-title {
      margin: 0;
      font-size: 23px;
      line-height: 1.35;
    }

    .panel-body {
      padding: 20px 22px 22px;
    }

    .panel-summary {
      margin: 0;
      color: var(--ink-soft);
      font-size: 15px;
    }

    .panel-chapter {
      margin: 0 0 16px;
      padding: 12px 13px;
      border: 1px solid rgba(159, 53, 42, .18);
      border-radius: 6px;
      background: rgba(159, 53, 42, .055);
      color: #5b4030;
      font-size: 14px;
      line-height: 1.65;
    }

    .panel-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }

    .panel-stat {
      min-height: 70px;
      padding: 11px 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 250, 241, .64);
    }

    .panel-stat b {
      display: block;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 19px;
      line-height: 1.1;
    }

    .panel-stat span {
      display: block;
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .panel-stat.is-note b {
      color: DarkGreen;
    }

    .panel-source {
      margin: 14px 0 0;
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.55;
    }

    .mini-epub-preview {
      height: 260px;
      margin: 16px 0 0;
      padding: 15px 14px;
      border: 1px solid rgba(159, 53, 42, .24);
      border-radius: var(--radius);
      background: #fbf3df;
      overflow: hidden;
      box-shadow: inset 0 0 22px rgba(82, 55, 28, .06);
    }

    .event-block {
      margin-top: 16px;
      padding: 14px 0 2px;
      border-top: 1px solid var(--line);
    }

    .event-block b {
      display: block;
      margin-bottom: 8px;
      color: var(--ink);
      font-size: 15px;
    }

    .event-block ol {
      display: grid;
      gap: 7px;
      margin: 0;
      padding-left: 20px;
      color: var(--ink-soft);
      font-size: 14px;
      line-height: 1.58;
    }

    .panel-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }

    .read-button,
    .ghost-link,
    .overlay-close {
      border: 1px solid var(--line-strong);
      border-radius: var(--radius);
      cursor: pointer;
      transition: transform .18s ease, border-color .18s ease, background .18s ease;
    }

    .read-button {
      min-height: 46px;
      background: var(--ink);
      color: var(--white);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-weight: 700;
    }

    .read-button.is-secondary {
      background: rgba(255, 250, 241, .74);
      color: var(--ink);
    }

    .read-button:hover,
    .ghost-link:hover,
    .overlay-close:hover {
      transform: translateY(-1px);
      border-color: rgba(159, 53, 42, .46);
    }

    .ghost-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      grid-column: 1 / -1;
      min-height: 40px;
      padding: 8px 12px;
      background: rgba(255, 250, 241, .64);
      color: var(--ink-soft);
      font-size: 13px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      text-decoration: none;
    }

    .text-overlay[hidden] {
      display: none;
    }

    .text-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      padding: 30px 40px;
      background:
        radial-gradient(circle at 50% 8%, rgba(255, 250, 241, .18), transparent 28%),
        rgba(20, 17, 13, .66);
      backdrop-filter: blur(18px);
    }

    .text-dialog {
      width: min(1280px, 100%);
      height: min(880px, calc(100vh - 60px));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      border: 1px solid rgba(255, 250, 241, .2);
      border-radius: 12px;
      background: rgba(29, 24, 18, .76);
      box-shadow: 0 34px 130px rgba(0, 0, 0, .52);
      overflow: hidden;
    }

    .overlay-head {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 250, 241, .16);
      background: rgba(22, 19, 15, .82);
      backdrop-filter: blur(18px);
    }

    .overlay-head p {
      margin: 0 0 4px;
      color: rgba(255, 250, 241, .64);
      font-size: 12px;
      font-weight: 700;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .overlay-head h2 {
      margin: 0;
      color: var(--white);
      font-size: 21px;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .overlay-close {
      width: 42px;
      height: 42px;
      background: rgba(255, 250, 241, .08);
      color: var(--white);
      border-color: rgba(255, 250, 241, .24);
      font-size: 24px;
      line-height: 1;
    }

    .reader-switch {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(255, 250, 241, .18);
      border-radius: 999px;
      background: rgba(255, 250, 241, .08);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .reader-switch button {
      min-height: 34px;
      padding: 6px 13px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: rgba(255, 250, 241, .72);
      cursor: pointer;
      font-weight: 700;
    }

    .reader-switch button.is-active {
      background: var(--paper);
      color: var(--ink);
      box-shadow: 0 8px 20px rgba(0, 0, 0, .18);
    }

    .overlay-body {
      min-height: 0;
      padding: 22px;
      overflow: hidden;
      background:
        radial-gradient(circle at 50% 0%, rgba(255, 250, 241, .16), transparent 34%),
        linear-gradient(135deg, rgba(255, 250, 241, .06), rgba(255, 250, 241, .02));
    }

    .book-reader {
      min-height: 0;
      height: 100%;
    }

    .book-spread {
      position: relative;
      height: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0;
      filter: drop-shadow(0 28px 44px rgba(0, 0, 0, .34));
    }

    .book-spread::after {
      content: "";
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 50%;
      width: 32px;
      transform: translateX(-50%);
      background: linear-gradient(90deg, rgba(83, 61, 38, .2), rgba(255, 250, 241, .28) 48%, rgba(83, 61, 38, .18));
      opacity: .68;
      pointer-events: none;
    }

    .book-spread.is-original::after {
      display: none;
    }

    .book-page {
      min-width: 0;
      min-height: 0;
      padding: 36px 40px;
      background:
        linear-gradient(90deg, rgba(108, 83, 49, .04) 1px, transparent 1px),
        linear-gradient(180deg, rgba(108, 83, 49, .035) 1px, transparent 1px),
        #fbf3df;
      background-size: 30px 30px;
      color: #2f271f;
      overflow: auto;
    }

    .book-page:first-child {
      border-radius: 9px 0 0 9px;
      box-shadow: inset -18px 0 28px rgba(82, 55, 28, .09);
    }

    .book-page:last-child {
      border-radius: 0 9px 9px 0;
      box-shadow: inset 18px 0 28px rgba(82, 55, 28, .08);
    }

    .book-page-full {
      grid-column: 1 / -1;
      border-radius: 9px;
      box-shadow: inset 0 0 34px rgba(82, 55, 28, .08);
      overflow: hidden;
    }

    .book-page-kicker {
      margin-bottom: 10px;
      color: var(--red);
      font-size: 13px;
      font-weight: 800;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .book-page h3 {
      margin: 0 0 18px;
      font-size: 28px;
      line-height: 1.28;
    }

    .book-summary-text {
      margin: 0;
      color: var(--ink-soft);
      font-size: 18px;
      line-height: 1.9;
    }

    .book-events {
      display: grid;
      gap: 10px;
      margin: 16px 0 0;
      padding-left: 22px;
      color: var(--ink-soft);
      font-size: 16px;
      line-height: 1.7;
    }

    .summary-page {
      height: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 22px;
      overflow: hidden;
    }

    .summary-main {
      min-width: 0;
      overflow: auto;
      padding-right: 8px;
    }

    .summary-kicker {
      margin: 0 0 10px;
      color: var(--red);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 800;
    }

    .summary-main h3 {
      margin: 0 0 14px;
      color: var(--ink);
      font-size: 30px;
      line-height: 1.3;
    }

    .summary-range {
      margin: 0 0 16px;
      padding: 14px 16px;
      border: 1px solid rgba(159, 53, 42, .22);
      border-radius: 7px;
      background: rgba(159, 53, 42, .06);
      color: #56362d;
      font-size: 17px;
      line-height: 1.75;
    }

    .summary-copy {
      margin: 0;
      color: #3f342b;
      font-size: 17px;
      line-height: 1.95;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 18px 0;
    }

    .summary-stat {
      min-height: 76px;
      padding: 12px 13px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 250, 241, .6);
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
    }

    .summary-stat b {
      display: block;
      margin-bottom: 7px;
      color: var(--ink);
      font-size: 22px;
      line-height: 1.1;
    }

    .summary-stat.is-note b {
      color: DarkGreen;
    }

    .summary-events {
      display: grid;
      gap: 10px;
      margin: 18px 0 0;
      padding: 0;
      list-style: none;
    }

    .summary-events li {
      padding: 10px 0 10px 16px;
      border-left: 3px solid rgba(159, 53, 42, .36);
      color: #4d4036;
      font-size: 15px;
      line-height: 1.72;
    }

    .summary-page-md {
      grid-template-columns: minmax(0, 1fr);
    }

    .summary-page-md .summary-main {
      padding-right: 0;
    }

    .md-summary-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 18px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .md-summary-meta span {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(53, 109, 104, .1);
      color: #356d68;
      font-size: 12px;
      font-weight: 700;
    }

    .volume-md {
      max-width: 980px;
      color: #352b22;
    }

    .volume-md h4 {
      margin: 30px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(159, 53, 42, .18);
      color: #7f2e26;
      font-size: 21px;
      line-height: 1.35;
    }

    .volume-md h4:first-child {
      margin-top: 0;
    }

    .volume-md h5 {
      margin: 22px 0 9px;
      color: #4b3b2f;
      font-size: 17px;
      line-height: 1.4;
    }

    .volume-md p {
      margin: 0 0 14px;
      font-size: 16px;
      line-height: 1.95;
    }

    .volume-md ol,
    .volume-md ul {
      display: grid;
      gap: 10px;
      margin: 0 0 18px;
      padding-left: 24px;
      color: #43372d;
      font-size: 15px;
      line-height: 1.82;
    }

    .volume-md li::marker {
      color: var(--red);
      font-weight: 700;
    }

    .volume-md blockquote {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 4px solid rgba(53, 109, 104, .5);
      background: rgba(53, 109, 104, .075);
      color: #263e3b;
    }

    .volume-md blockquote p {
      margin-bottom: 8px;
      font-family: "Songti SC", "STSong", "Noto Serif CJK TC", serif;
    }

    .volume-md code {
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(42, 35, 27, .08);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: .92em;
    }

    .md-table {
      max-width: 100%;
      margin: 16px 0 20px;
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 250, 241, .62);
    }

    .md-table table {
      width: 100%;
      border-collapse: collapse;
      min-width: 560px;
      font-size: 14px;
      line-height: 1.65;
    }

    .md-table th,
    .md-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(42, 35, 27, .12);
      text-align: left;
      vertical-align: top;
    }

    .md-table th {
      color: #6c2b24;
      background: rgba(159, 53, 42, .06);
      font-weight: 800;
    }

    .book-source {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      height: 24px;
      margin-bottom: 16px;
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
    }

    .book-page.original-page {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
    }

    .book-source a {
      color: var(--red);
    }

    .vertical-reader {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      min-width: 0;
      min-height: 0;
      height: calc(100% - 40px);
      padding: 12px 8px 18px;
      overflow-x: auto;
      overflow-y: hidden;
      writing-mode: vertical-rl;
      -webkit-writing-mode: vertical-rl;
      text-orientation: mixed;
      line-height: 150%;
      letter-spacing: 0;
      scrollbar-color: rgba(159, 53, 42, .34) transparent;
      contain: size layout paint;
    }

    .vertical-reader .epub-text {
      height: 100%;
      min-width: max-content;
      color: #1f1b16;
      font-size: 20px;
      line-height: 150%;
    }

    .mini-epub-preview .vertical-reader {
      height: 100%;
      padding: 0;
      overflow: hidden;
      contain: layout paint;
    }

    .mini-epub-preview .epub-text {
      font-size: 15px;
    }

    .epub-text h1,
    .epub-text h2,
    .epub-text p {
      margin: 0;
      font-weight: normal;
    }

    .epub-text .origin {
      font-size: 1rem;
      text-indent: 2em;
      margin-bottom: .5em;
    }

    .epub-text .comment {
      color: navy;
      font-size: 1rem;
      text-indent: 2em;
      margin-inline-start: 2em;
      margin-bottom: .5em;
    }

    .epub-text .reign-title {
      color: SaddleBrown;
      font-size: 1rem;
      font-weight: bold;
    }

    .epub-text .emperor {
      font-size: 1rem;
      text-indent: 2em;
      margin-inline-start: 2em;
    }

    .epub-text .h1 {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .epub-text .h2 {
      font-size: 1rem;
    }

    .epub-text .note {
      color: DarkGreen;
      font-size: .75rem;
      font-weight: normal;
      margin-inline: .5em;
    }

    .epub-text .note1 {
      color: maroon;
      font-size: .75rem;
      margin-inline-start: 2.5em;
    }

    .epub-text .note2 {
      color: DimGray;
      font-size: .88rem;
      font-weight: bold;
      margin-block: .5em 1em;
      text-align: right;
    }

    .epub-text .note3 {
      color: DimGray;
      font-size: .6rem;
      line-height: 100%;
      text-align: right;
    }

    .epub-text .note4 {
      color: DimGray;
    }

    .epub-text .note5 {
      color: Purple;
      font-size: .75rem;
      margin-inline: .5em;
    }

    .epub-text .number {
      color: DimGray;
      font-size: .6rem;
      font-weight: bold;
      text-combine-upright: all;
      -webkit-text-combine: horizontal;
      margin-inline: .35em;
    }

    .epub-text .name {
      border-left: .12em solid currentColor;
    }

    .epub-text .name1 {
      border: .1em solid currentColor;
    }

    .epub-text .book-title {
      padding-left: .15em;
      margin-bottom: 0;
      background-image: url("assets/epub-image02.gif");
      background-repeat: repeat-y;
      background-size: 1em 1em;
      background-position: 0 0;
    }

    .reader-loading {
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 15px;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 18px;
    }

    .tag {
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(53, 109, 104, .1);
      color: var(--teal);
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 18px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }

    .section-head h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.3;
    }

    .section-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .era-summary-section {
      margin: 34px 0 38px;
      padding: 26px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .era-summary-panel {
      position: relative;
      min-height: 232px;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 18px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background:
        linear-gradient(135deg, rgba(255, 250, 241, .9), rgba(255, 250, 241, .58)),
        rgba(255, 250, 241, .7);
      box-shadow: 0 12px 32px rgba(62, 43, 24, .07);
      overflow: hidden;
    }

    .era-panel-rail {
      width: 100%;
      min-height: 100%;
      background: linear-gradient(180deg, color-mix(in srgb, var(--c) 86%, white), var(--c));
      box-shadow: inset -1px 0 rgba(255, 250, 241, .38);
    }

    .era-panel-main {
      min-width: 0;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 13px;
      padding: 22px 24px 20px 6px;
    }

    .era-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 18px;
    }

    .era-panel-head p {
      margin: 0 0 5px;
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.35;
    }

    .era-panel-head h2 {
      margin: 0;
      color: var(--ink);
      font-size: 27px;
      line-height: 1.25;
    }

    .era-summary-open {
      flex: 0 0 auto;
      min-height: 40px;
      padding: 8px 14px;
      border: 1px solid color-mix(in srgb, var(--c) 56%, rgba(42, 35, 27, .18));
      border-radius: var(--radius);
      background: var(--ink);
      color: var(--white);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: transform .18s ease, box-shadow .18s ease;
    }

    .era-summary-open:hover,
    .era-summary-open:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 10px 22px rgba(62, 43, 24, .16);
      outline: none;
    }

    .era-panel-lens {
      margin: 0;
      color: color-mix(in srgb, var(--c) 82%, var(--ink));
      font-size: 17px;
      font-weight: 700;
      line-height: 1.45;
    }

    .era-panel-preview {
      margin: 0;
      max-width: 900px;
      color: #4d4036;
      font-size: 16px;
      line-height: 1.78;
    }

    .era-panel-foot {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 18px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
    }

    .era-panel-foot > span {
      flex: 0 0 auto;
      font-weight: 800;
    }

    .era-reader-main .md-table {
      margin-top: 12px;
      margin-bottom: 22px;
    }

    .era-reader-main blockquote {
      border-left-color: color-mix(in srgb, var(--teal) 60%, var(--gold));
      background:
        linear-gradient(90deg, rgba(53, 109, 104, .1), rgba(184, 135, 59, .055));
    }

    .era-reader-main ol {
      counter-reset: reading-step;
      padding-left: 0;
      list-style: none;
    }

    .era-reader-main ol li {
      position: relative;
      padding: 11px 14px 11px 48px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: rgba(255, 250, 241, .56);
    }

    .era-reader-main ol li::before {
      counter-increment: reading-step;
      content: counter(reading-step);
      position: absolute;
      left: 13px;
      top: 13px;
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: var(--ink);
      color: var(--white);
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-weight: 800;
    }

    .era-reader-layout {
      height: 100%;
      display: grid;
      grid-template-columns: 230px minmax(0, 1fr);
      gap: 24px;
      overflow: hidden;
    }

    .era-reader-side {
      min-width: 0;
      padding-right: 14px;
      border-right: 1px solid var(--line);
      overflow: auto;
    }

    .era-reader-side h3 {
      margin: 0 0 12px;
      color: var(--ink);
      font-size: 24px;
      line-height: 1.25;
    }

    .era-reader-side p {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.62;
    }

    .era-reader-stats {
      display: grid;
      gap: 8px;
      margin: 16px 0 18px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .era-reader-stats span {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(255, 250, 241, .54);
      color: var(--ink-soft);
      font-size: 12px;
    }

    .era-reader-stats b {
      color: var(--ink);
      font-size: 13px;
    }

    .era-reader-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .era-reader-tags span {
      padding: 4px 7px;
      border-radius: 999px;
      background: rgba(53, 109, 104, .1);
      color: var(--teal);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 700;
    }

    .era-reader-main {
      min-width: 0;
      overflow: auto;
      padding-right: 8px;
    }

    .count-pill {
      min-width: 92px;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      color: var(--ink-soft);
      background: rgba(255, 250, 241, .58);
      text-align: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
    }

    .era-overview {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }

    .overview-item {
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 250, 241, .58);
    }

    .overview-item b {
      display: block;
      margin-bottom: 6px;
      color: var(--ink);
    }

    .overview-item span {
      color: var(--muted);
      font-size: 14px;
    }

    .volume-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .volume-card {
      position: relative;
      min-height: 430px;
      display: grid;
      grid-template-rows: auto auto minmax(150px, 1fr) auto;
      gap: 14px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: rgba(255, 250, 241, .72);
      box-shadow: 0 10px 24px rgba(62, 43, 24, .06);
      cursor: pointer;
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .volume-card:hover,
    .volume-card.is-selected {
      transform: translateY(-2px);
      border-color: rgba(159, 53, 42, .38);
      background: rgba(255, 250, 241, .94);
      box-shadow: var(--shadow-soft);
    }

    .volume-card.is-selected::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      border-radius: var(--radius) 0 0 var(--radius);
      background: var(--red);
    }

    .volume-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 10px;
    }

    .volume-no {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 54px;
      height: 32px;
      border-radius: 5px;
      background: var(--ink);
      color: var(--white);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
    }

    .volume-era {
      color: var(--muted);
      font-size: 13px;
      text-align: right;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .volume-card h3 {
      margin: 0 0 10px;
      font-size: 20px;
      line-height: 1.42;
    }

    .volume-card p {
      margin: 0;
      color: var(--ink-soft);
      font-size: 14px;
    }

    .volume-card p + p {
      margin-top: 9px;
      color: #5b4030;
    }

    .volume-summary {
      min-height: 104px;
      padding: 13px 14px;
      border: 1px solid rgba(159, 53, 42, .16);
      border-radius: 7px;
      background: rgba(255, 250, 241, .58);
      color: #4d3a2d;
      font-size: 14px;
      line-height: 1.75;
    }

    .volume-preview {
      height: 188px;
      padding: 14px 12px;
      border: 1px solid rgba(53, 109, 104, .26);
      border-radius: var(--radius);
      background: #fbf3df;
      overflow: hidden;
      box-shadow: inset 0 0 18px rgba(82, 55, 28, .05);
    }

    .volume-preview .vertical-reader {
      height: 100%;
      padding: 0;
      overflow: hidden;
      contain: layout paint;
    }

    .volume-preview .epub-text {
      font-size: 15px;
    }

    .volume-foot {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .volume-foot span {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(53, 109, 104, .08);
      color: #3f6d67;
      white-space: nowrap;
    }

    .progress {
      width: 92px;
      height: 6px;
      border-radius: 999px;
      background: rgba(42, 35, 27, .11);
      overflow: hidden;
    }

    .progress i {
      display: block;
      height: 100%;
      width: var(--w);
      border-radius: 999px;
      background: var(--c);
    }

    .pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 24px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .pager button {
      min-width: 38px;
      min-height: 38px;
      padding: 7px 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 250, 241, .7);
      color: var(--ink-soft);
      cursor: pointer;
    }

    .pager button:hover,
    .pager button.is-active {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--white);
    }

    .pager button:disabled {
      cursor: not-allowed;
      opacity: .46;
    }

    .empty-state {
      padding: 36px;
      border: 1px dashed var(--line-strong);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
      background: rgba(255, 250, 241, .42);
    }

    .footer {
      padding: 34px 0 46px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
    }

    .footer-inner {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: center;
    }

    .beian-link,
    .beian-proof {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ink-soft);
      text-decoration: none;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    .beian-proof img {
      width: 52px;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 4px;
      object-fit: cover;
      object-position: top center;
    }

    @media (max-width: 980px) {
      .hero {
        min-height: 620px;
      }

      .hero h1 {
        font-size: 58px;
      }

      .hero-meta {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .intro,
      .reader-grid {
        grid-template-columns: 1fr;
      }

      .era-tabs {
        justify-content: flex-start;
      }

      .reader-panel {
        position: static;
      }

      .book-reader {
        overflow: auto;
      }

      .book-spread {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100%;
      }

      .book-spread.is-original {
        height: 100%;
      }

      .book-spread::after {
        display: none;
      }

      .book-page:first-child,
      .book-page:last-child {
        border-radius: 9px;
        box-shadow: inset 0 0 28px rgba(82, 55, 28, .08);
      }
    }

    @media (max-width: 720px) {
      .hero {
        min-height: 620px;
      }

      .hero-inner,
      .wrap {
        width: min(100% - 28px, 1180px);
      }

      .topline {
        align-items: start;
        flex-direction: column;
      }

      .hero h1 {
        font-size: 44px;
      }

      .hero-subtitle {
        font-size: 17px;
      }

      .metric {
        min-height: 96px;
      }

      .intro {
        padding-top: 38px;
      }

      .intro h2 {
        font-size: 27px;
      }

      .timeline {
        padding: 14px;
      }

      .timeline-head {
        flex-direction: column;
      }

      .volume-grid,
      .era-overview {
        grid-template-columns: 1fr;
      }

      .section-head {
        align-items: start;
        flex-direction: column;
      }

      .text-overlay {
        padding: 10px;
      }

      .text-dialog {
        max-height: calc(100vh - 20px);
      }

      .overlay-head {
        grid-template-columns: 42px minmax(0, 1fr);
        padding: 10px;
      }

      .reader-switch {
        grid-column: 1 / -1;
        justify-self: stretch;
      }

      .reader-switch button {
        flex: 1;
      }

      .overlay-head h2 {
        font-size: 18px;
      }

      .overlay-body {
        padding: 10px;
      }

      .book-reader {
        height: calc(100vh - 126px);
      }

      .book-page {
        padding: 24px 22px;
      }

      .book-page h3 {
        font-size: 23px;
      }

      .book-summary-text {
        font-size: 16px;
      }

      .vertical-reader {
        height: calc(100% - 34px);
        padding: 4px 2px 10px;
      }

      .footer-inner {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="site-shell">
    <header class="hero">
      <div class="hero-inner">
        <div class="topline">
          <span class="seal">通<br>鑑</span>
        </div>

        <div class="hero-copy">
          <p class="eyebrow">司馬光編年巨著 · 上起周威烈王二十三年，下迄後周顯德六年</p>
          <h1>資治通鑑<br>全卷提要</h1>
          <p class="hero-subtitle">把 294 卷拆成可以浏览和反复回看的阅读地图：每卷卡片保留竖排原文摘读，点开后进入本卷总结与本卷原文。</p>
        </div>

        <div class="hero-meta" aria-label="全书概览">
          <div class="metric"><strong>294</strong><span>卷卷有入口，按朝代聚合。</span></div>
          <div class="metric"><strong>16</strong><span>纪：周、秦、汉、魏、晋至五代。</span></div>
          <div class="metric"><strong>1362</strong><span>年大势：前 403 至 959。</span></div>
          <div class="metric"><strong>原式</strong><span>正文、小注、胡注统一竖排阅读。</span></div>
        </div>
      </div>
    </header>

    <nav class="toolbar" aria-label="卷目筛选">
      <div class="wrap toolbar-inner">
        <div id="eraTabs" class="era-tabs"></div>
      </div>
    </nav>

    <main class="wrap">
      <section class="intro">
        <h2>不是目录堆叠，而是一张可读的历史地图。</h2>
        <p>页面以朝代为骨架，以卷为最小阅读单位。朝代柱图按卷数比例绘制；每卷卡片先给出现代总结与竖排摘读，点击后进入本卷总结和本卷原文。</p>
      </section>

      <section id="timeline" class="timeline" aria-label="朝代卷数柱状图"></section>

      <section id="eraSummarySection" class="era-summary-section" aria-label="当前朝代导览">
        <div id="eraSummaryPanel"></div>
      </section>

      <section class="reader-grid">
        <section>
          <div class="section-head">
            <div>
              <h2 id="volumeHeading">周纪 · 前403-前256</h2>
              <p id="volumeSubheading">按朝代浏览当前卷目。</p>
            </div>
            <div id="resultCount" class="count-pill">5 卷</div>
          </div>
          <div id="eraOverview" class="era-overview"></div>
          <div id="volumeGrid" class="volume-grid"></div>
          <div id="pagination" class="pager" aria-label="卷目分页"></div>
        </section>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap footer-inner">
        <a class="beian-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2026025626号</a>
        <a class="beian-proof" href="assets/beian.png" target="_blank" rel="noreferrer"><img src="assets/beian.png" alt="allon.me 备案证" /><span>备案证</span></a>
      </div>
    </footer>

    <div id="textOverlay" class="text-overlay" hidden>
      <section class="text-dialog" role="dialog" aria-modal="true" aria-labelledby="overlayTitle">
        <header class="overlay-head">
          <button id="overlayClose" class="overlay-close" type="button" aria-label="关闭阅读器">×</button>
          <div>
            <p id="overlayKicker">原文摘读</p>
            <h2 id="overlayTitle">資治通鑑</h2>
          </div>
          <div id="readerSwitch" class="reader-switch" aria-label="阅读内容切换"></div>
        </header>
        <div class="overlay-body">
          <div id="bookReader" class="book-reader"></div>
        </div>
      </section>
    </div>
  </div>

  <script>
    const epubVolumes = ${safeJson(publicEpubIndex)};
    const volumeTitles = ${safeJson(titles)};
    const volumeExcerpts = ${safeJson(excerpts)};
    const volumeSummaries = ${safeJson(summaries)};
    const volumeMdSummaries = ${safeJson(volumeMdSummaries)};
    const eraSummaries = ${safeJson(eraNarratives)};

    const eras = ${safeJson(ERA_DEFS)};

    const TOTAL_VOLUMES = 294;
    let selectedEra = "zhou";
    let selectedVolume = 1;
    let currentPage = 1;
    let readerVolume = 1;
    let readerMode = "summary";
    let activeLoadToken = "";
    const PAGE_SIZE = 12;
    const originalCache = new Map();

    const byId = (id) => document.getElementById(id);
    const findEra = (volume) => eras.find((era) => volume >= era.start && volume <= era.end);
    const pad = (number) => String(number).padStart(3, "0");
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const countFor = (era) => era.end - era.start + 1;
    const shareFor = (count) => count === TOTAL_VOLUMES ? "100" : ((count / TOTAL_VOLUMES) * 100).toFixed(count < 10 ? 1 : 0);

    function summaryFor(number, era) {
      const detail = volumeSummaries[number] || {};
      const source = epubVolumes[number] || {};
      return {
        years: detail.years || source.chapter || era.years,
        summary: detail.summary || source.summary || source.chapter || "",
        events: Array.isArray(detail.events) ? detail.events.slice(0, 5) : [],
        keywords: Array.isArray(detail.keywords) ? detail.keywords.slice(0, 6) : []
      };
    }

    const volumes = Array.from({ length: 294 }, (_, index) => {
      const number = index + 1;
      const era = findEra(number);
      const source = epubVolumes[number] || {};
      const local = number - era.start + 1;
      const total = era.end - era.start + 1;
      const detail = summaryFor(number, era);
      const mdSummary = volumeMdSummaries[number] || null;
      const keywords = mdSummary?.keywords?.length ? mdSummary.keywords.slice(0, 8) : detail.keywords;
      const events = mdSummary?.events?.length ? mdSummary.events.slice(0, 8) : detail.events;

      return {
        number,
        title: mdSummary?.title || source.title || volumeTitles[number] || "卷第" + number,
        chapter: mdSummary?.period || source.chapter || detail.years || "",
        file: source.file || "",
        sourceLabel: source.sourceLabel || "本地 EPUB 胡三省注本",
        startYear: source.startYear ?? null,
        endYear: source.endYear ?? null,
        rangeLabel: source.rangeLabel || "",
        blockCount: source.blockCount || 0,
        originCount: source.originCount || 0,
        commentCount: source.commentCount || 0,
        noteCount: source.noteCount || 0,
        nameCount: source.nameCount || 0,
        chars: source.chars || 0,
        previewBlocks: Array.isArray(source.previewBlocks) ? source.previewBlocks : [],
        era,
        local,
        total,
        mdSummary,
        summary: mdSummary?.oneLine || detail.summary,
        events,
        keywords,
        summaryYears: mdSummary?.period || detail.years,
        themes: [...new Set([era.name, ...keywords])].slice(0, 4),
        progress: clamp(Math.round((local / total) * 100), 4, 100)
      };
    });

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function matchesVolume(volume) {
      return volume.era.id === selectedEra;
    }

    function excerptFor(volume) {
      return volumeExcerpts[volume.number] || {
        passageCount: 1,
        chars: volume.summary.length,
        sourceUrl: "",
        sourceLabel: volume.sourceLabel,
        passages: [{ label: "开卷摘读", text: volume.summary }],
        blocks: volume.previewBlocks
      };
    }

    function shortPreview(text, maxLength = 88) {
      if (!text) return "";
      return text.length > maxLength ? text.slice(0, maxLength) + "……" : text;
    }

    function formatCount(value) {
      return Number(value || 0).toLocaleString("zh-CN");
    }

    function renderEpubBlocks(blocks) {
      const safeBlocks = Array.isArray(blocks) ? blocks : [];
      if (!safeBlocks.length) return '<p class="origin">本卷 EPUB 数据暂缺。</p>';
      return safeBlocks.map((block) => block.html || '<p class="' + escapeHtml(block.kind || "origin") + '">' + escapeHtml(block.text || "") + '</p>').join("");
    }

    function cleanEventText(text, maxLength = 72) {
      const cleaned = String(text || "")
        .replace(/^[0-9一二三四五六七八九十]+/, "")
        .replace(/\s+/g, "")
        .replace(/[。；;]+$/g, "");
      return shortPreview(cleaned, maxLength);
    }

    function impactFor(volume) {
      const impact = {
        zhou: "周室名分继续存在，但实际权力已向诸侯与卿大夫下移，战国秩序由此展开。",
        qin: "秦以兼并和郡县推进统一，也暴露出急政、继承和民力透支的长期风险。",
        han: "汉廷在皇权、功臣、外戚、边疆和财政之间反复调适，帝国制度逐步成形又不断承压。",
        wei: "三国格局进入制度重组阶段，曹魏政权与司马氏权力更替共同指向新的统一秩序。",
        jin: "统一与分裂交替出现，宗室、门阀和边疆力量共同塑造魏晋南北朝的长期格局。",
        song: "南朝军功政治与皇权内耗并行，江南政权的统治方式在动荡中成形。",
        qi: "短命王朝的更替显示出宗室猜忌、权臣废立和南朝制度压力。",
        liang: "梁朝文治、士族与佛教秩序背后，军政和继承问题不断积累。",
        chen: "江南偏安局面承受北方统一压力，南北对峙逐步走向隋的再统一。",
        sui: "隋完成再统一，却因征役、财政和继承危机迅速消耗统治基础。",
        tang: "唐代在皇权、边镇、财政、宦官和藩镇之间反复调整，盛衰转换由此展开。",
        houliang: "唐末藩镇逻辑延续到五代，中原主导权在军事集团之间快速转移。",
        houtang: "沙陀军事集团入主中原，财政、将帅和继承矛盾决定政权兴亡。",
        houjin: "契丹压力与中原政权的依附关系加深，北方边防格局发生重大变化。",
        houhan: "短促政权暴露禁军、功臣和中央秩序的失衡，后周兴起成为直接后果。",
        houzhou: "后周以军政整顿重建中原秩序，为宋代统一准备了制度和军事前提。"
      };
      return impact[volume.era.id] || "本卷的事件承接前后卷，体现编年史中权力、制度与人物选择的连续影响。";
    }

    function volumeRangeText(volume) {
      return volume.rangeLabel || (volume.chapter ? "本卷起讫：" + volume.chapter : "");
    }

    function modernSummaryFor(volume) {
      if (volume.mdSummary?.preview || volume.mdSummary?.oneLine) {
        return [volume.mdSummary.period || volumeRangeText(volume), volume.mdSummary.preview || volume.mdSummary.oneLine]
          .filter(Boolean)
          .join(" ");
      }
      const events = volume.events.map((event) => cleanEventText(event)).filter(Boolean);
      const first = events[0] ? "开篇记述“" + events[0] + "”" : "本卷承接前卷展开叙事";
      const next = events.slice(1, 4).map((event) => "“" + event + "”").join("、");
      const middle = next ? "，随后写到" + next + "等事。" : "。";
      return volumeRangeText(volume) + first + middle + "这些事件共同显示：" + impactFor(volume);
    }

    function originalUrl(volumeNumber) {
      return "data/original/" + pad(volumeNumber) + ".json";
    }

    async function loadOriginal(volumeNumber) {
      if (originalCache.has(volumeNumber)) return originalCache.get(volumeNumber);
      const response = await fetch(originalUrl(volumeNumber), { cache: "force-cache" });
      if (!response.ok) throw new Error("原文加载失败");
      const original = await response.json();
      originalCache.set(volumeNumber, original);
      return original;
    }

    function renderTabs() {
      byId("eraTabs").innerHTML = eras.map((era) => {
        const active = selectedEra === era.id ? " is-active" : "";
        return '<button class="era-tab' + active + '" type="button" data-era="' + era.id + '">' + escapeHtml(era.name) + '</button>';
      }).join("");

      document.querySelectorAll(".era-tab").forEach((button) => {
        button.addEventListener("click", () => {
          selectEra(button.dataset.era);
        });
      });
    }

    function selectEra(eraId) {
      selectedEra = eraId;
      currentPage = 1;
      const active = eras.find((era) => era.id === eraId);
      const firstMatch = volumes.find(matchesVolume);
      if (firstMatch) {
        selectedVolume = firstMatch.number;
      } else if (active) {
        selectedVolume = active.start;
      }
      render();
    }

    function renderTimeline() {
      const chartMax = Math.ceil(Math.max(...eras.map((era) => countFor(era))) / 10) * 10;
      const chartHeight = 160;
      const active = eras.find((era) => era.id === selectedEra) || eras[0];
      const activeCount = countFor(active);
      const activeText = active.name + " " + activeCount + " 卷 · 占全书 " + shareFor(activeCount) + "%";
      const segments = eras.map((era) => {
        const count = countFor(era);
        const share = shareFor(count);
        const height = Math.max(6, Math.round((count / chartMax) * chartHeight));
        const active = selectedEra === era.id ? " is-active" : "";
        return '<button class="timeline-segment' + active + '" type="button" data-era="' + era.id + '" aria-label="' + escapeHtml(era.name + "，" + count + "卷，占全书" + share + "%") + '" style="--h:' + height + 'px;--c:' + era.color + '">' +
          '<span class="timeline-bar" aria-hidden="true"></span>' +
          '<span class="timeline-name">' + escapeHtml(era.name.replace("纪", "")) + '</span>' +
          '<span class="timeline-tip">' + escapeHtml(era.name + " · " + count + "卷 · " + share + "%") + '</span>' +
        '</button>';
      }).join("");
      const legend = eras.map((era) => {
        const count = countFor(era);
        const active = selectedEra === era.id ? " is-active" : "";
        return '<button class="timeline-chip' + active + '" type="button" data-era="' + era.id + '" style="--c:' + era.color + '"><i aria-hidden="true"></i><span>' + escapeHtml(era.name + " " + count + "卷") + '</span></button>';
      }).join("");
      const axis = [
        { value: chartMax, pos: 100 },
        { value: Math.round(chartMax * 2 / 3), pos: 66.666 },
        { value: Math.round(chartMax / 3), pos: 33.333 },
        { value: 0, pos: 0 }
      ].map((tick) => '<span class="axis-tick" style="bottom:' + tick.pos + '%">' + tick.value + '</span>').join("");

      byId("timeline").innerHTML =
        '<div class="timeline-head">' +
          '<div><b>朝代卷数柱状图</b><span>纵轴以 ' + chartMax + ' 卷为上限，柱高按卷数线性绘制；下方图例保留精确卷数。</span></div>' +
          '<div class="timeline-unit">' + escapeHtml(activeText) + '</div>' +
        '</div>' +
        '<div class="timeline-scroll"><div class="timeline-plot"><div class="timeline-axis">' + axis + '</div><div class="timeline-bars">' + segments + '</div></div></div>' +
        '<div class="timeline-legend">' + legend + '</div>';

      document.querySelectorAll(".timeline-segment, .timeline-chip").forEach((button) => {
        button.addEventListener("click", () => selectEra(button.dataset.era));
      });
    }

    function renderEraSummaryPanel() {
      const era = eras.find((item) => item.id === selectedEra) || eras[0];
      const summary = eraSummaries[era.id] || {};
      const tags = (summary.keywords || []).slice(0, 6).map((keyword) => '<span>' + escapeHtml(keyword) + '</span>').join("");
      byId("eraSummaryPanel").innerHTML =
        '<article class="era-summary-panel" style="--c:' + era.color + '">' +
          '<div class="era-panel-rail" aria-hidden="true"></div>' +
          '<div class="era-panel-main">' +
            '<div class="era-panel-head">' +
              '<div>' +
                '<p>' + escapeHtml(era.years + " · " + countFor(era) + " 卷 · 占全书 " + shareFor(countFor(era)) + "%") + '</p>' +
                '<h2>' + escapeHtml(era.name + "总览") + '</h2>' +
              '</div>' +
              '<button class="era-summary-open" type="button" data-era-summary="' + era.id + '">阅读完整总览</button>' +
            '</div>' +
            '<p class="era-panel-lens">' + escapeHtml(era.lens) + '</p>' +
            '<p class="era-panel-preview">' + escapeHtml(summary.preview || "") + '</p>' +
            '<div class="era-panel-foot">' +
              '<div class="era-reader-tags">' + tags + '</div>' +
              '<span>' + escapeHtml("约 " + formatCount(summary.charCount || 0) + " 字") + '</span>' +
            '</div>' +
          '</div>' +
        '</article>';

      byId("eraSummaryPanel").querySelector("[data-era-summary]")?.addEventListener("click", () => openEraSummary(era.id));
    }

    function renderEraSummaryBook(summary) {
      const tags = (summary.keywords || []).slice(0, 10).map((keyword) => '<span>' + escapeHtml(keyword) + '</span>').join("");
      return '<div class="book-spread is-original">' +
        '<article class="book-page book-page-full">' +
          '<div class="era-reader-layout">' +
            '<aside class="era-reader-side">' +
              '<h3>' + escapeHtml(summary.name) + '</h3>' +
              '<p>' + escapeHtml(summary.lens || "") + '</p>' +
              '<div class="era-reader-stats">' +
                '<span><b>时间</b>' + escapeHtml(summary.years || "") + '</span>' +
                '<span><b>卷数</b>' + escapeHtml((summary.count || 0) + " 卷") + '</span>' +
                '<span><b>卷次</b>' + escapeHtml(summary.start + "-" + summary.end) + '</span>' +
                '<span><b>总览</b>' + escapeHtml(formatCount(summary.charCount || 0) + " 字") + '</span>' +
              '</div>' +
              '<div class="era-reader-tags">' + tags + '</div>' +
            '</aside>' +
            '<section class="era-reader-main volume-md">' + (summary.html || '<p>本纪总览暂缺。</p>') + '</section>' +
          '</div>' +
        '</article>' +
      '</div>';
    }

    function openEraSummary(eraId) {
      const summary = eraSummaries[eraId];
      if (!summary) return;
      const era = eras.find((item) => item.id === eraId) || summary;
      activeLoadToken = "era:" + eraId + ":" + Date.now();
      byId("overlayKicker").textContent = "朝代总览 · " + era.years + " · " + countFor(era) + " 卷";
      byId("overlayTitle").textContent = summary.name + " · " + summary.lens;
      byId("readerSwitch").innerHTML = "";
      byId("readerSwitch").hidden = true;
      byId("bookReader").innerHTML = renderEraSummaryBook(summary);
      byId("textOverlay").hidden = false;
      document.body.style.overflow = "hidden";
      byId("overlayClose").focus();
      resetBookPosition();
    }

    function renderOverview(filteredVolumes) {
      const active = eras.find((era) => era.id === selectedEra) || eras[0];
      const count = countFor(active);
      const focus = active.focus || ["全书通览"];
      const totalPages = Math.max(1, Math.ceil(filteredVolumes.length / PAGE_SIZE));
      currentPage = clamp(currentPage, 1, totalPages);
      byId("eraOverview").innerHTML = [
        '<div class="overview-item"><b>' + escapeHtml(active.name) + '</b><span>' + escapeHtml(active.years) + " · " + count + " 卷 · 占 " + shareFor(count) + "%</span></div>",
        '<div class="overview-item"><b>阅读主轴</b><span>' + escapeHtml(active.lens || "编年通览") + '</span></div>',
        '<div class="overview-item"><b>当前结果</b><span>' + filteredVolumes.length + " 卷 · 第 " + currentPage + "/" + totalPages + " 页</span></div>"
      ].join("");
      byId("volumeHeading").textContent = active.name + " · " + active.years;
      byId("volumeSubheading").textContent = "重点：" + focus.join(" / ");
      byId("resultCount").textContent = filteredVolumes.length + " 卷";
    }

    function renderReaderSwitch() {
      byId("readerSwitch").innerHTML = [
        { mode: "summary", label: "本卷总结" },
        { mode: "original", label: "本卷原文" }
      ].map((item) =>
        '<button type="button" class="' + (readerMode === item.mode ? "is-active" : "") + '" data-reader-mode="' + item.mode + '">' + item.label + '</button>'
      ).join("");

      byId("readerSwitch").querySelectorAll("[data-reader-mode]").forEach((button) => {
        button.addEventListener("click", () => openBookReader(readerVolume, button.dataset.readerMode));
      });
    }

    function renderSummaryBook(volume, excerpt) {
      const md = volume.mdSummary || {};
      const summaryHtml = md.html || '<p>' + escapeHtml(modernSummaryFor(volume)) + '</p>';
      const metaItems = [
        md.period || volumeRangeText(volume),
        md.charCount ? "摘要约 " + formatCount(md.charCount) + " 字" : "",
        md.keywords?.length ? md.keywords.slice(0, 4).join(" / ") : ""
      ].filter(Boolean);
      return '<div class="book-spread is-original">' +
        '<article class="book-page book-page-full">' +
          '<div class="summary-page summary-page-md">' +
            '<section class="summary-main">' +
              '<p class="summary-kicker">' + escapeHtml(volume.era.name + " · 第 " + volume.local + "/" + volume.total + " 卷") + '</p>' +
              '<h3>' + escapeHtml(volume.title) + '</h3>' +
              '<p class="summary-range">' + escapeHtml(md.oneLine || modernSummaryFor(volume)) + '</p>' +
              '<div class="md-summary-meta">' + metaItems.map((item) => '<span>' + escapeHtml(item) + '</span>').join("") + '</div>' +
              '<div class="summary-grid">' +
                '<div class="summary-stat"><b>' + formatCount(volume.originCount) + '</b><span>正文段</span></div>' +
                '<div class="summary-stat"><b>' + formatCount(volume.commentCount) + '</b><span>胡注段</span></div>' +
                '<div class="summary-stat is-note"><b>' + formatCount(volume.noteCount) + '</b><span>绿色小注 / 校注</span></div>' +
                '<div class="summary-stat"><b>' + formatCount(volume.chars) + '</b><span>全文字数</span></div>' +
              '</div>' +
              '<div class="volume-md">' + summaryHtml + '</div>' +
            '</section>' +
          '</div>' +
        '</article>' +
      '</div>';
    }

    function renderOriginalBook(volume, original) {
      const sourceLabel = original.sourceLabel || excerptFor(volume).sourceLabel || "本地 EPUB";
      const blocks = Array.isArray(original.blocks) && original.blocks.length ? original.blocks : volume.previewBlocks;
      const chars = original.chars || blocks.reduce((total, item) => total + (item.text || "").length, 0);
      return '<div class="book-spread is-original">' +
        '<article class="book-page book-page-full original-page">' +
          '<div class="book-source"><span>' + escapeHtml("本卷原文 · 全文 " + blocks.length + " 段 / 约 " + formatCount(chars) + " 字 · 绿色小注 " + formatCount(original.noteCount || volume.noteCount) + " 处") + '</span><span>' + escapeHtml(sourceLabel) + '</span></div>' +
          '<div class="vertical-reader"><div class="epub-text">' + renderEpubBlocks(blocks) + '</div></div>' +
        '</article>' +
      '</div>';
    }

    function renderLoadingBook(text) {
      return '<div class="book-spread is-original"><article class="book-page book-page-full"><div class="reader-loading">' + escapeHtml(text) + '</div></article></div>';
    }

    function resetBookPosition() {
      requestAnimationFrame(() => {
        byId("bookReader").scrollTop = 0;
        byId("bookReader").querySelectorAll(".book-page").forEach((page) => {
          page.scrollTop = 0;
          page.scrollLeft = 0;
        });
        byId("bookReader").querySelectorAll(".vertical-reader").forEach((reader) => {
          reader.scrollLeft = 0;
          reader.scrollTop = 0;
        });
      });
    }

    async function openBookReader(volumeNumber, mode = "summary") {
      const volume = volumes.find((item) => item.number === volumeNumber) || volumes[0];
      const excerpt = excerptFor(volume);
      readerVolume = volume.number;
      readerMode = mode;
      activeLoadToken = volume.number + ":" + mode + ":" + Date.now();
      const token = activeLoadToken;
      byId("overlayKicker").textContent = volume.era.name + " · 第 " + volume.local + "/" + volume.total + " 卷";
      byId("overlayTitle").textContent = pad(volume.number) + " · " + volume.title;
      byId("readerSwitch").hidden = false;
      renderReaderSwitch();
      byId("textOverlay").hidden = false;
      document.body.style.overflow = "hidden";
      byId("overlayClose").focus();

      if (mode === "summary") {
        byId("bookReader").innerHTML = renderSummaryBook(volume, excerpt);
        resetBookPosition();
        return;
      }

      byId("bookReader").innerHTML = renderLoadingBook("正在展开本卷原文…");
      try {
        const original = await loadOriginal(volume.number);
        if (activeLoadToken === token) {
          byId("bookReader").innerHTML = renderOriginalBook(volume, original);
          resetBookPosition();
        }
      } catch (error) {
        if (activeLoadToken === token) {
          byId("bookReader").innerHTML = renderLoadingBook("本卷原文暂时无法读取，已保留总结入口。");
        }
      }
    }

    function closeOriginal() {
      byId("textOverlay").hidden = true;
      document.body.style.overflow = "";
    }

    function renderVolumes(filteredVolumes) {
      const grid = byId("volumeGrid");
      if (!filteredVolumes.length) {
        grid.innerHTML = '<div class="empty-state">没有匹配的卷目。换一个关键词，或切回“全书”。</div>';
        byId("pagination").innerHTML = "";
        return;
      }

      const totalPages = Math.max(1, Math.ceil(filteredVolumes.length / PAGE_SIZE));
      currentPage = clamp(currentPage, 1, totalPages);
      const pageVolumes = filteredVolumes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

      grid.innerHTML = pageVolumes.map((volume) => {
        const previewBlocks = (volume.previewBlocks || []).slice(0, 4);
        const summary = modernSummaryFor(volume);
        return '<article class="volume-card" tabindex="0" role="button" data-volume="' + volume.number + '">' +
          '<div class="volume-top"><span class="volume-no">' + pad(volume.number) + '</span><span class="volume-era">' + escapeHtml(volume.era.name + " · 第 " + volume.local + "/" + volume.total + " 卷") + '</span></div>' +
          '<h3>' + escapeHtml(volume.title) + '</h3>' +
          '<p class="volume-summary">' + escapeHtml(shortPreview(summary, 128)) + '</p>' +
          '<div class="volume-preview"><div class="vertical-reader"><div class="epub-text">' + renderEpubBlocks(previewBlocks) + '</div></div></div>' +
          '<div class="volume-foot"><span>' + escapeHtml(volume.era.name) + '</span><span>正文' + formatCount(volume.originCount) + '段</span><span>胡注' + formatCount(volume.commentCount) + '段</span><span>小注' + formatCount(volume.noteCount) + '处</span></div>' +
        '</article>';
      }).join("");

      document.querySelectorAll(".volume-card").forEach((card) => {
        const select = () => {
          selectedVolume = Number(card.dataset.volume);
          openBookReader(selectedVolume, "summary");
        };
        card.addEventListener("click", select);
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            select();
          }
        });
      });

      renderPagination(filteredVolumes.length);
    }

    function renderPagination(totalItems) {
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      if (totalPages <= 1) {
        byId("pagination").innerHTML = "";
        return;
      }
      const pages = [];
      for (let page = 1; page <= totalPages; page += 1) {
        if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) {
          pages.push('<button type="button" class="' + (page === currentPage ? "is-active" : "") + '" data-page="' + page + '">' + page + '</button>');
        } else if (pages[pages.length - 1] !== '<span>…</span>') {
          pages.push('<span>…</span>');
        }
      }
      byId("pagination").innerHTML =
        '<button type="button" data-page="' + (currentPage - 1) + '" ' + (currentPage === 1 ? "disabled" : "") + '>上一页</button>' +
        pages.join("") +
        '<button type="button" data-page="' + (currentPage + 1) + '" ' + (currentPage === totalPages ? "disabled" : "") + '>下一页</button>';
      byId("pagination").querySelectorAll("button[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
          const targetPage = clamp(Number(button.dataset.page), 1, totalPages);
          if (targetPage === currentPage) return;
          currentPage = targetPage;
          render();
          byId("volumeHeading").scrollIntoView({ block: "start" });
        });
      });
    }

    function render() {
      renderTabs();
      renderTimeline();
      renderEraSummaryPanel();
      const filteredVolumes = volumes.filter(matchesVolume);
      renderOverview(filteredVolumes);
      if (!filteredVolumes.some((volume) => volume.number === selectedVolume) && filteredVolumes[0]) {
        selectedVolume = filteredVolumes[0].number;
      }
      renderVolumes(filteredVolumes);
    }

    byId("overlayClose").addEventListener("click", closeOriginal);
    byId("textOverlay").addEventListener("click", (event) => {
      if (event.target === byId("textOverlay")) closeOriginal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !byId("textOverlay").hidden) closeOriginal();
    });

    render();
  </script>
</body>
</html>
`;

await writeFile("index.html", html);
console.log(`Built index.html with ${titles.length - 1} volume titles.`);
