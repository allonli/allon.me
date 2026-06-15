# CLAUDE.md

## 项目概述

`allon.me` 是一个静态单页网站，核心内容为《資治通鑑》294 卷全卷提要。页面以朝代为骨架、以卷为最小阅读单位，提供浏览、阅读和竖排原文展示功能。

## 技术栈

- 纯静态 HTML + CSS + JS，无框架依赖
- 数据以 JSON 形式内联在 `<script>` 标签中
- 原文按卷存储在 `data/original/001.json` ~ `data/original/294.json`
- 部署到 Nginx 静态目录 `/var/www/allon-root`

## 文件结构

```
index.html              # 唯一页面，包含完整 HTML/CSS/JS
data/
  epub-index.json       # EPUB 卷目索引（卷号、标题、起讫、统计数据等）
  original/             # 每卷完整原文 JSON（blocks 数组，含竖排 HTML）
zztj-volumes/           # 每卷 Markdown 总结（001.md ~ 294.md）
zztj-cache/             # 构建缓存（all_volumes.json 和各卷 JSON）
tools/
  build-epub-excerpts.py   # 从本地 EPUB 提取原文和索引
  build-site.mjs           # 构建 site：嵌入卷总结 + 生成朝代总览
  build-summaries.mjs      # 生成卷摘要
  build-excerpts.mjs       # 生成卷摘录
  generate-zztj-volume-md.py  # 逐卷生成 Markdown 总结
```

## 页面结构

### Header（hero 区）
- 标题："資治通鑑全卷提要"
- 四个统计数据卡片：294 卷、16 纪、1362 年、原式竖排

### 工具栏（toolbar）
- 粘性定位，仅包含 16 个朝代标签按钮（周纪~后周纪）
- **无搜索框**，筛选仅通过点击朝代标签切换

### 主内容区
1. **时间轴柱状图**：16 个朝代按卷数比例绘制，点击切换朝代
2. **朝代总览面板**：当前选中朝代概览，含关键词和「阅读完整总览」按钮
3. **卷目网格**：每卷一张卡片，包含卷号、标题、现代总结、竖排原文摘读预览
4. **分页器**：每页 12 卷

### 浮层阅读器
- 点击卷卡片打开浮层
- 两种模式：「本卷总结」（Markdown 渲染）和「本卷原文」（竖排阅读）
- 本卷原文支持子模式切换：
  - **分页模式**：transform 翻页，左右箭头/键盘翻页，带进度条和页码显示（如"第 3 / 8 页"）
  - **连续滚动**：原生 `overflow-x: auto` 滚动，隐藏翻页按钮和进度条，显示"连续滚动"
- 竖排古文 `writing-mode: vertical-rl`，行文从右到左。分页时 offset=0 起始于最右侧（文本开头），offset 增大向左翻页
- 分页模式通过 `setOriginalOffset` 操作 `--original-offset` CSS 变量驱动 `translateX`
- 滚轮事件：分页模式拦截并触发翻页（60px 阈值 + 180ms 锁定），连续模式放行原生滚动
- 滚动条在浮层内完全隐藏（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`），适用于 `.book-page`、`.vertical-reader`、`.original-page-viewport`
- 朝代总览也有独立浮层

## 关键 JS 数据结构

- `epubVolumes`：每卷原文元数据（标题、起讫、block 统计、预览 HTML 等）
- `volumeExcerpts`：每卷原文摘录段落
- `volumeSummaries`：每卷简略总结（年份、事件、关键词）
- `volumeMdSummaries`：每卷 Markdown 格式详细总结（来自 `zztj-volumes/`）
- `eras`：16 个朝代定义（id、name、start、end、years、color、lens）
- `eraSummaries`：每朝代总览（Markdown 格式，含阅读地图和关键卷目）
- `volumes`：运行时由以上数据合并生成的 294 卷完整数组

## 本地开发

```bash
# 构建（如需更新数据）
python3 tools/build-epub-excerpts.py
node tools/build-site.mjs

# 启动本地服务器
python3 -m http.server 4173
```

访问 `http://127.0.0.1:4173/`

## 部署

同步到远端 Nginx：

```bash
scp index.html root@106.14.134.49:/var/www/allon-root/index.html
scp -r assets root@106.14.134.49:/var/www/allon-root/
scp data/epub-index.json root@106.14.134.49:/var/www/allon-root/data/epub-index.json
scp -r data/original root@106.14.134.49:/var/www/allon-root/data/
```

## 设计约定

- 配色使用 CSS 自定义属性，古代纸张风格（米黄底、深墨色文字）
- 竖排原文使用 `writing-mode: vertical-rl`，保留 EPUB 原始 HTML 样式类
- 响应式断点：980px、720px
- 所有中文文本使用宋体系列字体，UI 控件使用无衬线字体
