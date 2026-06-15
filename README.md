# allon.me

这是 `allon.me` 的静态首页，当前内容为《資治通鑑》294 卷全卷提要。

## 本地构建

```bash
python3 tools/build-epub-excerpts.py
node tools/build-site.mjs
python3 -m http.server 4173
```

访问 `http://127.0.0.1:4173/` 预览。

## 生成 294 卷 Markdown 总结

逐卷总结输出到 `zztj-volumes/`。续跑时默认跳过已存在文件：

```bash
python3 tools/generate-zztj-volume-md.py --start 146 --end 294
```

如需覆盖某一段卷目：

```bash
python3 tools/generate-zztj-volume-md.py --start 146 --end 294 --overwrite
```

脚本会同步生成 `zztj-volumes/index.md`，用于检查 294 卷是否齐全。

## 部署

远端 Nginx 根目录为：

```text
/var/www/allon-root
```

同步静态文件：

```bash
scp index.html root@106.14.134.49:/var/www/allon-root/index.html
scp -r assets root@106.14.134.49:/var/www/allon-root/
scp data/epub-index.json root@106.14.134.49:/var/www/allon-root/data/epub-index.json
scp -r data/original root@106.14.134.49:/var/www/allon-root/data/
```

## 数据说明

- 唯一文本来源为本地《資治通鑑》EPUB。
- 卷目索引位于 `data/epub-index.json`，完整原文按卷位于 `data/original/`；二者由 `tools/build-epub-excerpts.py` 从本地 EPUB 胡三省注本生成。
- 首页顶部为朝代卷数柱状图，点击朝代可切换当前浏览的朝代；页面默认选中周纪，当前选中哪个朝代就展示哪个朝代的总览面板。工具栏仅保留朝代标签切换，无搜索框。
- 页面卷题、起讫、开卷原文摘读、正文、胡注、绿色小注和统计数据均来自 EPUB。
- 朝代比例尺使用柱状图，纵轴以 90 卷为上限，柱高按各朝代卷数线性绘制。
- 首页卷目按桌面端卡片分页展示；点开卡片后在浮层中查看全宽本卷总结，并可切换到本卷原文。
- 本卷原文支持两种阅读模式：**分页**（transform 翻页，适合逐页精读）和**连续滚动**（原生 overflow 滚动，适合快速浏览）。竖排古文采用 `writing-mode: vertical-rl`，行文从右到左，分页翻页方向已适配。
- 浮层阅读器中的滚动条已全部隐藏（`.book-page` / `.vertical-reader` / `.original-page-viewport`）。

## GitHub

仓库地址：[https://github.com/allonli/allon.me](https://github.com/allonli/allon.me)
