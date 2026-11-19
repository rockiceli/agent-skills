> 本文件由 `SKILL.md` 拆分而来（只读参考，不单独作为技能入口）。
> 对应主文件：`SKILL.md`；小节：4. 必踩的坑 / 5. 验证：三层都要做 / 6. Windows 环境限制（会影响交付什么） / 7. 交付前清单

## 4. 必踩的坑

**① 像素字库只认部分 ASCII。**
自研 5×3 字库通常只含 `0-9 + - x ! / . : %` 和一部分大写字母。`D.text` 画中文、`Z`、`?` 会**静默渲染成空白**，不报错。
- 检查手段：写个正则扫所有 `D.text(ctx, '...')` 的字面量，逐字符比对白名单。
- 中文一律走 DOM 气泡（`position:fixed` + `transform: translate(-50%,-100%)`），别塞 canvas。
- 需要图标字符（z / ? / ♥）就用 `fillRect` 手工拼像素。

**② 隐藏窗口会冻结 `requestAnimationFrame`。**
`show: false` 的窗口 Chromium 认定不可见，rAF 直接停；`backgroundThrottling: false` 也救不回来。
**挪到屏幕外（如 x: -3200）同样会被 Windows 钳位，时灵时不灵。**
写自检 / 截图脚本时用：**屏幕内坐标 + `win.setOpacity(0)`** —— 可见但看不见，rAF 正常跑。

**③ 新增绘制代码时，`const st = pet.state` 这类"提前用到的局部变量"会炸。**
往 `draw()` 里插一段（比如"传送门画在小兽后面"）很容易把 `const st` 落到使用点之后 →
暂时性死区，一进绘制就 `ReferenceError: Cannot access 'st' before initialization`。
Node 桩测不出来（桩不校验顺序，只有真跑才炸），所以**改完绘制函数一定要跑一遍真机自检**。
同类还有：`U.sign()` / `U.clamp()` 之类辅助函数写错名字（`U.sign(0)` 返回 0 是正常的，别当成 bug）。

**④ `capturePage()` 拿的是合成器上一帧 —— 手动推帧后立刻截会截到几秒前的画面。**
截图脚本里如果用 `DP.tick(dt)` 快进状态，必须**等 100ms 以上再截**，否则截到的是旧帧
（表现为：debug 输出说 `state=away`，图里却还是站着的小兽 + 启动气泡）。

**⑤ 手动推帧（`DP.tick`）是验证长流程的关键工具。**
给它留一个出口，测试就能把 30 秒的动画压成一瞬间：

```js
DP.tick = function (dt) { update(dt || 0.05); draw(); return DP.debug(); };
// 测试里：
for (let i = 0; i < 600 && BD.desktop.debug().run; i++) BD.desktop.tick(0.2);
```

配套把 `DP.debug()` 做成一个纯数据快照（state/x/coat/run 进度/日志行数/gate 是否有），
DOM 里的东西（状态栏文本、HUD 行数）直接查 `document.getElementById(...).textContent`。

**⑥ `dispatchEvent` 会绕过命中测试 —— DOM 菜单的交互测试极易全部假阳性。**

这是「测试全绿、用户来报『右键菜单点了没反应』」的经典成因。

> 只要事件是用 `element.dispatchEvent(...)` 派发的，**即使那个元素此时 `display:none`、被别的元素完全盖住、
> 或者压根不在文档流里，`click` 照样会派发到它身上** —— 浏览器的命中测试（hit testing）根本不参与。
> 而真实鼠标点击是要过命中测试的：点到就到，盖住了就到不了。

实际踩的场景：`window.addEventListener('mousedown', ...)` 里不分青红皂白调 `closeMenu()`，
于是「按下」这一刻菜单已经被 `display:none` 了，紧随其后的 `click` 落到隐藏元素上 → 什么都不发生。
但因为测试是 `dispatchEvent` 自己排的事件序列，**旧断言一直是绿的**。

正确写法 —— mousedown 判断落点是不是在菜单里，是就不关：

```js
let menuBlockPat = false;
window.addEventListener('mousedown', function (e) {
  if (e.button === 2) return;                        // 右键交给 contextmenu
  menuBlockPat = !!(els.menu && els.menu.className === 'on' && els.menu.contains(e.target));
  if (!menuBlockPat) closeMenu();                    // 只有点在外面才关
});
window.addEventListener('mouseup', function (e) {
  const blocked = menuBlockPat; menuBlockPat = false;
  if (!dragging) return;
  const wasDrag = dragging.moved > 6; dragging = null;
  if (blocked || wasDrag || e.button !== 0) return;  // 点按钮别顺带触发"摸一下"
  pat(toLocal(e.clientX, e.clientY));
});
```

**测试必须同时断言三件事**，缺一个就拦不住这类 bug：
1. `contextmenu` 之后菜单 `class` 是展开的、按钮数量对；
2. `mousedown` 之后菜单**还活着**（`aliveAfterDown === true`）—— 这条就是专门抓上面的 bug 的；
3. `click` 之后菜单自动收起，**并且动作真的产生了副作用**（出征开始了 / 毛色变了 / 好感 +1 …）。

写个独立的 `menutest.js`：遍历菜单里每一个 `data-a`，走完整的 `contextmenu → mousedown → click` 序列，
把每个动作的效果打出来。比在 selftest 里加一条断言有用得多。

**顺带：菜单里有循环型按钮（换毛色/换形象/换装扮）时，确认「循环的集合不是空的」。**
实际踩过：新存档 `cosOwned` 是空数组，点「装扮」循环一圈什么都没穿上 —— 用户看到的就是「没效果」。
加一条阶梯解锁（`COS_LADDER`：喂够 N 个文件 / 出征 N 次解锁某件），**解锁即自动穿上**，
并写回主存档字段，让网页版也认。

**⑦ 装扮/装备要挂在「这一帧真正画出来的矩形」上，不能按素材格高度算。**

sprite 每帧内容高度不一样（`motionOf` 会挤压变形 `mv.sq`），所以：

```js
// ✘ 按素材格高度算 —— 伸懒腰那一帧皇冠会飘到头上方
const top = y - sheetH * sc - 1;
// ✘ 更糟：干脆写死数字 —— 围巾会被系到腰上
const G2 = { by: y - 10, ... };
```

让 `drawPixels` 把它真正画的矩形返回出来，装扮按比例挂上去：

```js
const box = D.drawPixels(ctx, x, y, sheet, o);   // → { x, y, w, h }
const G2 = {
  hx: cxx - 8, hy: top, hw: 16, hcx: cxx,
  bx: cxx - 7, by: top + Math.round(h * 0.38), bw: 14, bh: Math.round(h * 0.34),
  bBot: Math.round(top + h),                     // 脚底
};
```

**⑧ 白色装扮在白/透明底上等于隐形。**

`c_wings` 的颜色就是 `#ffffff`，桌宠窗口是透明背景 —— 画上去肉眼完全看不见，
用户会报「装扮没用」。任何白色/极浅色的贴图**必须自带深色描边**：

```js
D.px(ctx, bx - 6, wy - 1, 6, 5, '#2a2338');   // 先垫描边底（和 sprite 自动描边走同一个色）
```

同理，翅膀不要拍 `5×5` 实心方块（像贴纸），要画成阶梯状才有"翅膀"的形：

```js
for (let r = 0; r < 3; r++) { const w = r + 2; /* 2/3/4 格逐行加宽 */ }
```

**发现这类问题的唯一办法是放大看。** 窗口只有 480×330、小兽只有二十几像素，
`capturePage` 出来的图里装扮"有没有画上去"根本看不清 —— 写个纯 Python 的裁切放大脚本
（`zlib` + `struct` 手写 PNG 解码，不依赖 PIL），按 `x y w h scale` 裁一块放大 4~8 倍再 Read。
这一步在"装扮到底生效没有"的问题上是决定性的。

**⑨ 真机测试会被「磁盘上的持久化状态」污染 —— 表现为「第一次跑绿、之后一直红」。**

`clearStorageData({ storages: ['localstorage'] })` **只清 localStorage，清不掉磁盘上的文件**。
实际踩过：项目用一个 `xxx-share.json` 在浏览器和 Electron 之间中转存档，
截图脚本为了出图加载了全量素材（27 张）并存了盘，
之后所有真机测试都从 27 张起步 —— "点换形象应该 9→27" 的断言就再也成立不了。
而且它**稳定红**，很容易被误判成"功能坏了"，其实是测试自身不可复现。

写测试时先把所有跨进程持久状态显式隔离：

```js
const SHARE = path.join(ROOT, 'mochi-share.json');
const SHARE_BAK = SHARE + '.testbak';
function stashShare()   { try { fs.copyFileSync(SHARE, SHARE_BAK); fs.unlinkSync(SHARE); } catch (e) {} }
function restoreShare() { try { fs.copyFileSync(SHARE_BAK, SHARE); fs.unlinkSync(SHARE_BAK); } catch (e) {} }
// app.whenReady() 第一行 stashShare();   每个 app.exit 之前 restoreShare();
```

**验收方式：连跑 2~3 次，结果必须一模一样。** 只有第一次绿 = 一定有没隔离干净的持久状态。

**⑩ 任何"打断动作"都必须先归还它手上的资源 —— 否则状态机永久卡死。**

桌面宠物加了「两个角色自动互动」之后，20 次投喂测试里有 2 次挂在"食物没被吃掉"，
一开始当成 flake。真因是三段代码互相打架：

```js
// 拾取逻辑：只有手上没东西才去拿新的
if (!pet.food && queue.length && pet.state !== 'eat' && …) { pet.food = queue.shift(); setState('walk'); }
// 但它 idle 时又有这么一句：地上有吃的就啥也不干
case 'idle': if (foods.length || queue.length) break;
// 而互动直接改 state，把正走向饭盆的它拽走了 —— pet.food 却还挂着
startDuo() { pet.target = x - 10; setState('walk'); }
```

于是：互动演完 → 回 `idle` → idle 看到地上有吃的就 `break` → **既不吃手上的，也不去拿地上的**，死锁。

通用规则：**只要一个动作会 `setState()` 打断另一个动作，就必须做三件事之一 ——**
① 手上有资源时拒绝被打断（`if (pet.food) return;`）；
② 打断时把资源还回去（`queue.unshift(pet.food); pet.food = null;`）；
③ 被打断的一方在推进函数开头兜底让位（`if (pet.food) { duo = null; pet.target = pet.food.x; setState('walk'); }`）。
三者都要有，因为"打断"可能来自自动触发、用户点击、或者中途新到达的资源。
另外注意**同一帧里的执行顺序**：如果拾取逻辑排在打断检查之后，兜底要下一帧才生效（测试里要推两帧）。

**⑪ 换色时明度上限别给 1.0 —— 会被推成纯白、色相全丢。**

`lScale = Math.min(lmax / lDom, 0.92 / (maxLum * coat.lm))` 这类归一化里，
如果最终写 `Math.min(1, l * lScale)`，深色小兽提亮后整条调色板会撞到同一个白。
**上限取 0.95**：够亮，但保住一点明度差和色相。
改完要**按每个物种/每张皮肤逐一验证颜色两两不重复**（一行 `new Set(pal).size` 断言就够）。

**⑫ 别把"偶发红"当 flake 放过去 —— 先复现抓现场再决定。**

做法是临时在失败分支里 `console.log(JSON.stringify(debug()))` 拿一帧的完整快照，
然后跑 20 次抓一两次失败现场对照。本次就是这么从"疑似 flake"挖出真 bug（⑩）的。
反过来，真修好了要**连跑 20 次**才算数，别只跑 3 次就汇报。

**⑬ 有的 shell 里 `ELECTRON_RUN_AS_NODE` 是设着的 —— 用 `electron` 也会被当 Node 跑。**

表现为 `TypeError: Cannot read properties of undefined (reading 'disableHardwareAcceleration')`，
很容易被误判成 Electron 版本问题。跑法：

```bash
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/selftest.js
```

## 5. 验证：三层都要做

### 第 1 层 —— Node 桩跑（快、不进 GUI）

`tools/smoke.js` 的老套路：`vm.createContext` 造 window/document/localStorage 桩，手动泵 rAF 队列。
对桌面宠物特别要覆盖：

- 有 / 无 `window.BDshell` 两条路径（浏览器模式 vs Electron 模式）
- 首次喂食弹确认框 → 点「好」之后继续
- 文件夹被拒、未知后缀、0 字节文件
- `trash()` 真的被调用、参数是正确路径
- **换色/换形象**：`D.coat` 返回新对象但 `px` 引用不变；各种毛色算出的颜色互不相同
- **长流程走完整**：`goout → away → back` 三个状态都出现过、结算确实入账、结束后状态清空
- **批量跑 200~300 次**同一段生成逻辑，查稀有度分布 + "文案里的数字 == 实际入账的数字"
- **UI 真的有内容**：状态栏文本非空、进度条宽度是百分比、HUD 行数 ≤ 上限
- 桩里 `requestAnimationFrame` 要**入队而不是立即执行**，否则主循环递归爆栈：
  ```js
  sandbox.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
  // pump: 每帧 clock += 50ms，把队列取出来执行一遍（配合 dt 上限 0.05s）
  ```

### 第 2 层 —— 真机渲染器自检（验 DOM/canvas/CSP/IPC）

用 Electron 起一个 `opacity: 0` 的窗口加载页面，`console-message` / `preload-error` / `render-process-gone` 全挂上监听，
再用 `executeJavaScript` 抓状态、模拟交互、最后打印判定表。

脚本头几行就是 `require('electron').app.xxx`，所以必须 `electron tools/selftest.js`（写进 package.json 的 scripts），
**直接 node 跑会 `TypeError: Cannot read properties of undefined (reading 'disableHardwareAcceleration')`** ——
遇到这个报错别去查 Electron 版本，只是启动方式不对。

```js
// 每次都从干净存档跑，判定才可复现（Electron 的 localStorage 跨次保留）
win.webContents.session.clearStorageData({ storages: ['localstorage'] })
  .catch(() => {}).then(() => win.loadFile(page));
```

**`executeJavaScript` 的返回值必须能结构化克隆** —— 所以：
```js
// 会报 "An object could not be cloned"、且 JSON.stringify 会丢字段：
const asked = !!btn && btn.onclick;          // ✘ 返回的是函数！
const asked = !!(btn && btn.onclick);        // ✓
// 保险做法：页面里先 JSON.stringify，主进程 JSON.parse
JSON.parse(await win.webContents.executeJavaScript(`JSON.stringify((function(){ ... })())`))
```

**重载一次**再抓一遍，能验出「每次启动重复注入素材」这类只在第二次启动才暴露的问题。

### 第 3 层 —— 截图看

`capturePage()` 拿的是页面内容，**不受窗口透明度影响**，所以 `opacity: 0` 也能截。
大图贴进对话会被缩小看不清，用矩形裁切再读：

```js
await win.webContents.capturePage({ x: 0, y: 96, width: 580, height: 104 })   // 裁出 ~580 宽的近景
```

## 6. Windows 环境限制（会影响交付什么）

### 6.1 `.bat` / `.vbs` 里面**绝对不要写非 ASCII 字符**

这是实际炸过的坑，不是理论风险：

> Windows 脚本宿主（WSH）读 `.vbs` 时按**系统 ANSI 代码页**解码（中文 Windows 上是 GBK），
> **只有文件开头带 UTF-16LE BOM 才会按 Unicode 解析**。
> 无 BOM 的 UTF-8 + 中文 → 中文字节被错误解码 → 把字符串的收尾引号吃掉 →
> 双击报 `未结束的字符串常量` / `代码 800A0409`，脚本根本起不来。

**做法：把 `.bat` / `.vbs` 的内容限制成纯 ASCII**（注释和报错文字也用英文），
中文说明放到 README.md 里 —— Markdown 有编码声明，不经过 WSH 解析。

```bash
# 交付前扫一遍，必须是 0
python -c "d=open('x.vbs','rb').read(); print('非 ASCII 字节:', sum(1 for b in d if b>=128))"
```

顺带一起查：引号是否成对（偶数）、续行符 `_` 前面有没有空格。

> 如果非要在 `.vbs` 里保留中文，就写成 **UTF-16LE + BOM**（PowerShell 的 `Set-Content -Encoding Unicode`）。
> 但纯 ASCII 是唯一不需要测试就能确定正确的方案。

### 6.2 执行沙箱常把脚本通道全挡掉

本机实测被挡的：`cmd` / `cscript` / `wscript`（LOLBin 拦截）、`New-Object -ComObject WScript.Shell`（COM 拦截）。
所以 `.bat` / `.ps1` / `.vbs` / `.lnk` **一律无法实测**。

**不要用「先写个文本里带非法字符的 heredoc」去凑** —— 命令里出现 `cmd`/`cscript` 这些字样本身就会触发拦截。
要写多行文本就先 `Write` 成临时文件，再 `cat tmp >> target`。

**所以启动器要这么交付：**
1. 内容纯 ASCII（编码不再是变量）
2. 把脚本内部真正执行的那条命令**单独跑一遍验证**（例如 `.vbs` 里是 `electron.exe "<绝对路径>"`，就直接在 shell 里跑这条）
3. README 里明确写清「哪部分验证过、哪部分没验证过」，别含糊

主推路径写成可直接验证的形式，例如 `node_modules\electron\dist\electron.exe .`。

### 6.3 纯 stdlib 写 PNG（没装 PIL 时）

`tools/make-tray.py` 就是 16×16 像素图 ×2 放大 + zlib：

```python
import struct, zlib
raw = b"".join(b"\x00" + row for row in rows)          # 每行前面加 filter byte 0
def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)) \
    + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
```

## 7. 交付前清单

- [ ] `node tools/desktop-smoke.js` 全绿
- [ ] `selftest.js` 全绿（透明窗 / rAF 都很容易偶发，最好连跑 2~3 次）
- [ ] 面板高度和画布尺寸对得上（改窗口尺寸后，自检里写死的 `canvas.width + 'x' + canvas.height` 断言要同步改）
- [ ] 主项目原有测试仍然全绿（确认没回归）
- [ ] 真机启动一次：窗口 + 托盘 + 自动退出（加 `MOCHI_AUTOCLOSE=毫秒` + `MOCHI_VERBOSE=1` 环境变量做调试开关）
- [ ] `capturePage()` 截图确认：本体、所有"食物"图标、气泡在窗口边缘不被切、上下两块面板不重叠
- [ ] 字母白名单测试通过（新写的 `D.text` 字面量**每个字符**都在字库里，`W`/`Y` 这类缺失字母最容易漏）
- [ ] **`.bat` / `.vbs` 扫描非 ASCII 字节数 = 0**；脚本内那条命令单独跑一遍验证
- [ ] 把测试残留的运行时文件删掉（`mochi-share.json` 之类），让用户拿到的是干净初态
- [ ] README 写清「已验证 / 未验证」，别把没跑过的说成跑过了
