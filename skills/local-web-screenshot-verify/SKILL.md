---
name: local-web-screenshot-verify
description: 用本机Edge或Chrome无头模式给本地前端项目截图做视觉验证。当完成UI样式改动、要确认页面渲染、看看长什么样、截图给我看时使用。
agent_created: true
---

# 本地前端截图验证（Windows 无头浏览器）

改完前端样式后，**不要靠猜**。用本机已装的 Chromium 内核浏览器无头截图，自己看一眼再交付。

## 1. 找浏览器（按顺序试）

```bash
for p in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "/c/Program Files/Microsoft/Edge/Application/msedge.exe"; do
  [ -f "$p" ] && echo "FOUND $p"; done
```

Windows 上至少有一个 Edge，几乎总能成功。**不需要**装 playwright / puppeteer。

## 2. 基本命令

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --no-first-run \
  --user-data-dir="C:/Users/<你>/AppData/Local/Temp/shot-1" \
  --window-size=580,1000 --virtual-time-budget=5000 \
  --screenshot="C:/abs/path/out.png" \
  "file:///C:/abs/path/index.html"
```

- **`--screenshot` 必须是绝对路径**（相对路径不会落盘，且不报错，只会静默失败）。
- `--user-data-dir` 每次换一个新目录，避免与已开的浏览器实例抢锁。
- `--virtual-time-budget=5000` 让页面里的 `setTimeout` 跑到（毫秒）。截图在虚拟时间耗尽后触发。
- 想连交互态一起截（打开面板、切场景），就**复制一份 html 做截图专用副本**（如 `_shot.html`），在 `</body>` 前注入脚本改状态，再对副本截图；**不要**往生产代码里塞测试钩子。完事把副本删掉。

```bash
node -e "
const fs=require('fs');
let h=fs.readFileSync('index.html','utf8');
h=h.replace('</head>','<style>*{animation:none!important;transition:none!important}</style></head>');
const inject='<scr'+'ipt>window.addEventListener(\"load\",function(){setTimeout(function(){ var m=(location.hash||\"#1\").slice(1); /* 按 m 切状态 */ },250);});</scr'+'ipt>';
fs.writeFileSync('_shot.html', h.replace('</body>', inject+'</body>'));
"
# 然后分别截 "_shot.html#a" "_shot.html#b"
```
（脚本里写 `</script>` 会截断外层的 node -e 字符串，所以拆成 `'<scr'+'ipt>'`。）

## 3. 五个必踩的坑

1. **CSS 动画被冻在起始帧**：`--virtual-time-budget` 下 `@keyframes` 可能停在 `from` 状态。若 sheet/dialog 用了 `from{opacity:.5}` 这类入场动画，会拍成半透明，看起来像背景色丢失。→ 截图副本里注入 `*{animation:none!important;transition:none!important}`。
2. **截图尺寸 ≠ 布局视口**：`--window-size` 是截图画布大小，页面的 `height:100%` 可能解析成更小的布局视口（常见差 ~110px，底部露出 body 背景）。看到"内容没铺满"先怀疑这个，别急着改 CSS。宽度同理：如果 `#app{max-width:520px}` 而 window 只有 430，内容会被裁掉一半 —— 用 ≥580 的宽度截图才能看到完整布局，另用 430 宽验手机适配。
3. **页面太"高"会把底部的行切掉**：`--window-size=H` 高度不够时，截图只到 H 为止，**不会**报错也不会提示被裁。看到"某一行/某一块是空白"先量一下总高度（行高 × 行数 + 边距），把窗口开高一点重截，别急着改代码。
4. **游戏 / 有主循环的页面：你手动摆的状态会被主循环跑掉**。截图前的注入脚本里模拟了几秒游戏时间，主循环的 `requestAnimationFrame` 在剩下的虚拟时间里会继续推进，等你截图时状态早就变了（典型症状：日志/状态栏显示的是"结束之后"的内容，而画面还是"进行中"）。
   → 要么把该状态的时长设成极大值锁住（例如 `act.dur = 9999`），要么把主循环的 `update` 挂钩停掉，再截图。
5. **`</script>` 会截断 `node -e` 的外层字符串**：拼注入脚本时写成 `'<scr'+'ipt>'` / `'</scr'+'ipt>'`。
6. **截图副本必须放在原页面同一个目录**：页面里的 `<script src="../js/a.js">` 是相对路径。把 `sub/x.html` 的副本写到项目根目录（`_shot.html`）会让所有脚本 404，而浏览器**不报错**——你会看到"页面框架在、内容全空"（例：卡片容器是空的）。→ 副本一律写成 `sub/_shot-x.html`，完事再删。
7. **画布类页面的状态可能正好停在"瞬时帧"上**：靠 `sin(t)` 驱动的眨眼 / 抖动 / 闪烁，随手挑的 `t` 可能正好落在瞬时区间里，于是**每一张**截图都拍到了眨眼/闭眼。症状是"所有图里角色都长得不对，但代码明明没改"。→ 挑一个不在瞬时区间里的 `t`（算一下 `sin`），或直接给眨眼逻辑加相位偏移，让常用截图时间点落在稳定态。
8. **长截图里的像素小图会被 Read 工具缩掉**：一整屏 sprite sheet（8 行 × 6 列）× 大 `--window-size` 截下来后，Read 会把它缩放到宽度 ≤1080，5px 的像素点被压成 1px，根本看不清细节。→ 想检查像素画，**一次只放 1~4 个对象**、`--window-size` 刚好包住内容，或分成多张 `#hash` 页面分别截，而不是堆成一张巨型图。

## 4. 想看"某个 canvas / 某个组件放大后长什么样"

不要在浏览器里找缩放参数，直接在注入脚本里把它抄到一张放大的 canvas 上，铺满屏幕再截：

```js
var src = document.getElementById('game-canvas');
var big = document.createElement('canvas');
big.width = src.width * 4; big.height = src.height * 4;
big.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;image-rendering:pixelated';
var bc = big.getContext('2d');
bc.imageSmoothingEnabled = false;
bc.drawImage(src, 0, 0, big.width, big.height);
document.body.appendChild(big);
```

这比反复猜"这个像素块到底是什么"高效得多 —— 4 倍放大后能一眼看出是绘制 bug、是被遮挡、还是本来就长这样。

## 4.5 页面要 fetch 本地文件时（如读 manifest.json）必须先起服务器

不少游戏/应用在 `file://` 下会**静默跳过** `fetch`（浏览器安全策略）。这时截图里看到的是"没数据的样子"，
而不是代码错了。先起一个常驻的静态服务器：

```bash
# 用 run_in_background 起，否则 shell 结束后进程会被带走（页面变成"无法访问此网站"）
cd <项目目录> && python -m http.server 8791          # 后台常驻
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8791/index.html   # 200 才算好
```

然后对着 `http://127.0.0.1:8791/_shot.html#hash` 截图。**别用 `(... &)` 或 `nohup ... &` 起服务的写法** —— 工具调用一结束就没了。

## 4.6 页面一片黑/空白时，把浏览器端报错捞出来

`--dump-dom` + 注入的错误收集器，比反复猜快得多：

```bash
# 注入：window.addEventListener('error', e => errs.push(e.message+' @ '+file+':'+lineno))
# 再在 body 末尾加：setTimeout(()=>{document.title='ERR:'+(errs.join(' | ')||'none')},4500)
"$EDGE" --headless=new --disable-gpu --no-proxy-server --virtual-time-budget=15000 \
  --dump-dom "http://127.0.0.1:8791/_diag.html#state" 2>/dev/null | grep -o "<title>[^<]*</title>"
```

标题里就会带上 `TypeError: Cannot read properties of undefined ... @ state.js:323` 这种定位信息。
（拼注入脚本时别用 shell heredoc 夹引号，写成 `.py` 文件再执行，省掉一整轮转义地狱。）
**注意**：canvas 全黑通常不是"画错了"，而是**渲染函数抛异常**或**状态没初始化**（比如没先 `newGame` 就直接 render）。

## 5. 读图要点

截完用 Read 工具看图，逐项确认：① 布局有没有溢出/被裁；② 有没有大片空白（说明 flex 没撑满，值得补内容卡）；③ 文字对比度、字号；④ 图标是否真的画出来了（而不是空/黑块）；⑤ 深浅主题与目标风格是否一致。

## 6. 收尾

- 把关键截图整理进项目的 `preview/` 目录（如 `01-title.png`），其他临时文件删掉。
- `preview/` 只是产物，不要写进构建流程。
- 只做静态页面验证；需要点击、滚动、多页跳转等真实交互时改用 agent-browser / playwright。
