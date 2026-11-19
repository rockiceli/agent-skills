---
name: electron-desktop-pet
description: 把网页canvas项目包成Electron桌面宠物：透明置顶、屏幕溜达、拖文件吃掉、状态栏HUD、换形象。当要改成桌面宠物、桌面挂件、拖文件喂它、给网页做Electron壳时使用。
agent_created: true
---

## 索引（渐进披露，按需展开正文）

- 0. 先决定三件事
- 1. 目录骨架
- 2. 主进程要点
- 3. 复用老项目的渲染（关键手法）
- 3.1 想整体放大？别改绘制代码
- 3.2 `file://` 下读不了本地素材（fetch 被拦）
- 3.3 换色变体：别再生成一套图，用 HSL 换色
- 3.4 要「有自己的生活 / 下副本」但又不许占内存？用文字叙事
- 4. 必踩的坑
- 5. 验证：三层都要做
- 第 1 层 —— Node 桩跑（快、不进 GUI）
- 第 2 层 —— 真机渲染器自检（验 DOM/canvas/CSP/IPC）

# 网页项目 → Electron 桌面宠物

核心原则：**thin shell**。原项目的渲染/逻辑/存档一行不改，新加一层透明窗口 + 一层复用它的覆盖页。
这样既不用重新画素材，也不会把主项目搞坏。

## 0. 先决定三件事

| 决定 | 推荐值 | 为什么 |
|---|---|---|
| 窗口形态 | 窄条贴屏幕右下角（如 460×190；**要放状态栏/文字 HUD 就得加高，实测 480×330 够用**），无边框、透明、`alwaysOnTop`、`skipTaskbar` | 全屏透明窗会挡住桌面点击；窄条只占一小块 |
| 点不点得到 | 默认**可交互**（能拖文件、能右键），菜单里给「鼠标穿透」开关 | 穿透后点不到它了，**必须留托盘图标当救命入口** |
| 删不删文件 | 默认**移进系统回收站**（`shell.trashItem`），首次先弹确认 | 不可逆删除是灾难；确认一次后就记住 |

## 1. 目录骨架

```
项目根/
├── desktop.html          ← 透明页：canvas + 气泡 + 右键菜单（DOM 画中文，canvas 画中文会糊）
└── desktop/
    ├── main.js           ← 透明窗 + 托盘 + 回收站 + 文件选择 + IPC
    ├── preload.js        ← contextBridge 只暴露 window.BDshell
    ├── tray.png          ← 托盘图标（用 Python 现画，别调生成模型）
    └── tools/
        ├── make-tray.py  ← 纯 Python 写 PNG（zlib + struct，见下）
        ├── selftest.js   ← 真机自检（关键！见第 5 节）
        └── shot.js       ← 截图
```

装 Electron（国内网络必看）：

```bash
npm i electron --save-dev --no-audit --no-fund
# 若 node_modules/electron/dist/electron.exe 不存在，npm 那步只装了 JS 包，二进制没下：
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## 2. 主进程要点

```js
app.disableHardwareAcceleration();   // Windows 透明窗 + GPU 合成偶发黑底；画布小，关掉无代价

win = new BrowserWindow({
  transparent: true, frame: false, resizable: false, movable: false,
  hasShadow: false, skipTaskbar: true, alwaysOnTop: true,
  backgroundColor: '#00000000',
  webPreferences: {
    preload, contextIsolation: true, nodeIntegration: false,
    sandbox: false,               // 只有 preload 需要 require('fs') 时才关
    backgroundThrottling: false,  // 没焦点时也要继续跑动画
  },
});
```

- 拖动不要用系统 `-webkit-app-region: drag`（会和 canvas 里的鼠标事件打架）。
  自己在页面里算 `screenX` 位移，`ipcMain.on('bd:move')` → `win.setPosition(x+dx, y+dy)`。
- **只让主窗口能移动**：`if (e.sender !== win.webContents) return;`（游戏窗口也挂了同一个 preload 时必需）。
- 鼠标穿透：`win.setIgnoreMouseEvents(true, { forward: true })` —— forward 让 hover 还有效，但点击穿到桌面。
- 回收站：`await shell.trashItem(p)`，包 try/catch 返回 boolean。先 `fs.statSync(p).isDirectory()` 挡掉文件夹。
- 托盘：`tray.png` 用 `nativeImage.createFromPath`，为空就 `createEmpty()` 兜底（别让 createTray 抛异常拖死启动）。

托盘菜单至少要有：把它叫出来 / 鼠标穿透（checkbox）/ 置顶（checkbox）/ 退出。
**穿透是单向门，托盘是唯一的回头路。**

## 3. 复用老项目的渲染（关键手法）

```js
// 1) 本体直接调原项目的绘制函数，含它的皮肤/换装/动作系统
D.drawPet(ctx, x, y, { species: ST.speciesOf(), dir, pose, t, act: pose });

// 2) 动作别新增素材：用原项目已有的程序化形变表
D.motionOf(act, t)   // {sq, bob, lean, shake} —— 挤压/起伏/前倾/抖动
// pose 传 'eat'/'walk'/'sleep'，自定义精灵图也能吃到形变

// 3) 属性写进原主存档，桌面宠物和主项目就是同一只
s.pet.full = clamp(s.pet.full + gain, 0, 100);
ST.save();

// 4) 掉落的"食物"图标用像素原语现画，按扩展名分类，不下载任何图标
```

### 3.1 想整体放大？别改绘制代码

如果原绘制函数不支持缩放（部件式绘制常见），用**逻辑像素**方案：

```js
const SCALE = 2;
W = Math.round(innerWidth / SCALE); H = Math.round(innerHeight / SCALE);
cv.width = W; cv.height = H;                 // 画布只有窗口一半大
```
```css
#cv { width:100%; height:100%; image-rendering: pixelated; }
```

代价：**所有鼠标事件都是屏幕像素，进逻辑世界前必须 `/ SCALE`**。容易漏的地方：
`getBoundingClientRect()` 定位 DOM 气泡、右键菜单坐标、drag/drop 的 `clientX`、点击命中判定。
漏一个就表现为"点不到""气泡跑到窗外"。

### 3.2 `file://` 下读不了本地素材（fetch 被拦）

主进程读文件转 data URL 递进页面：

```js
// main: ipcMain.handle('bd:assets', () => items.map(it => ({
//   name, kind, data: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') })));
// 页面: A.loadUrl(it.data).then(sp => A.add(it.name, sp, ...))
```

**必须去重，且要分清两件事**：
- 「素材已在库里」→ 不要再 add（否则每次启动 +N 条，顶到上限撑大存档）
- 「皮肤映射是否还在」→ 丢了要补 `useAsSkin`（清过缓存 / 换过存档的情况）

只判前者会导致皮肤永远不生效；只判后者会导致存档长胖。

### 3.3 换色变体：别再生成一套图，用 HSL 换色

「多几种宠物样式」这类需求，最快的做法是**换色**而不是出新图：

```js
D.COATS = [
  { k:'plain', n:'原色' },
  { k:'cream', n:'奶油', dh:  6, sm:0.62, lm:1.22 },   // 相对色相 + 饱和度/明度乘数
  { k:'gold',  n:'鎏金', hAbs:44, hSpread:0.35, sm:1.35, lm:1.06 },  // 绝对色相
];

D.coat = function (sp, coat) {          // 浅拷贝 + 只换颜色数组
  if (!coat || coat === 'plain') return sp;
  const out = {}; for (const k in sp) out[k] = sp[k];
  out.px = sp.px;                       // ★ 像素数据共用同一份引用 → 内存开销 0
  if (sp.custom && sp.pal) out.pal = sp.pal.map(c => tint(c, coat));
  else if (sp.c) { out.c = {}; for (const k in sp.c) out.c[k] = tint(sp.c[k], coat); }
  return out;
};
```

要点：
- **色相要用绝对值**（`hAbs`）→ 鎏金/薄荷这类"明确想要某个色"的；**相对值**（`dh`）适合"稍微偏一点"（奶油/墨色）。
  用相对色相加 45° 去调橘色，会得到黄绿色 —— 实际踩过。
- 保留一点原始色差：`h = hAbs + (原h - 基准h) * hSpread`，否则整只糊成一块纯色。
- 页面里按「物种 + 毛色」缓存一只（`coatCache`），别每帧 `D.coat()`，并**在换色/换形象时主动失效缓存**。

**★ 基准色相一定要从素材算，不要写死。** 这是「换了毛色却看不出变化」的头号原因：

写代码时底色基准照着内置物种写死成 42°（橙），后来用户换成 meowa 生成的深绿皮肤（主色相 141°），
色差压根没被推走 —— 视觉上等于没换色。正确做法是**从调色板按像素出现次数取主色，再取它的色相**：

```js
D.coatDominant = (pal, px) => {          // 出现次数最多的那个颜色 = 主体色
  const cnt = new Map(); for (const i of px) if (i > 0) cnt.set(i, (cnt.get(i)||0)+1);
  let best = -1, n = 0; for (const [i,c] of cnt) if (c > n) { n = c; best = i; }
  return pal[best] || pal[1];
};
D.coatBaseHue = (pal, px) => rgbToHsl(hexToRgb(D.coatDominant(pal, px))).h;
```

配套两个 cap，否则会出现「鎏金直接糊成纯白」：

```js
// 1) 色相差值要封顶，不然原本是红的角色会被推到完全不相关的色区
h = hAbs + clamp(hDiff, -cap, cap);
// 2) 亮度缩放上限要把 lm 也算进去 —— 只按 lmax/lDom 算会漏掉本身就很亮的部分
lScale = Math.min(lmax / lDom, 0.92 / (maxLum * coat.lm));
```

回归测试里造一个「深绿主体 + 更亮的奶油色角尖」的合成 sprite，断言：换了毛色调色板**确实变了**、
最亮的一档不出现 `LUM == 1.00`、角尖和主体之间的对比度没被抹平。

### 3.4 要「有自己的生活 / 下副本」但又不许占内存？用文字叙事

需求原话可能是「不需要真的做，只要有动画 + 文字 HUD 模拟，怎么节约内存怎么来」。
这时**不要**去实例化房间/迷宫/寻路/背包对象，只生成**字符串 + 几个数字**：

```js
// 一次出征的全部数据（实测最大 ~2KB）
run = { dungeon, floors, clear, lines: [{icon, kind, text}], loot: [{type, n, rare}], exp, gold, kills }
```

状态机只要三态，动画就是"走过去 → 淡出 → 淡入"：

```
goout（走向传送门 → 蓄力 → alpha→0） → away（人不在，逐行 push 文案） → back（alpha→1 → 结算）
```

几个必做的细节：
- **传送门要开在宠物另一侧**（`x > W/2 ? W*0.18 : W*0.82`）。开在 `W*0.5`（出生点）会变成"原地淡出"，看不出走过去。
- 门的亮度变量**初值别给 0**，否则"走路那段门根本不画"（`if (k <= 0.02) return`），到蓄力时才突然冒出来。给 0.18。
  淡出用 `alpha = clamp(1 - k*1.5, 0, 1)`，这样门亮到 2/3 时人就没了。
- 文案上限：`while (logs.length > 3) logs.shift()`，DOM 节点不会越攒越多。
- 掉落别自己发明经济系统：调原项目的 `addRareEquip / learnSkill / addItem / addExp / addGold`，
  这样桌面打到的东西在主项目背包里也在。稀有度直接用原项目的 `rollRare(floor, boss)`。
- **守关者保底**：`if (boss && rare === 'common') rare = 'fine'`。辛苦打到 BOSS 开出白板非常打击人。
- **叙事里说的数字必须等于实际入账的数字**。踩过：句子说"捡到 105 金币"，代码里失败又乘了 0.4 → 实际 63。
  要么别扣，要么把扣完的数写进句子。写个批量测试跑 200~300 次比对。

## 详细内容（references，按需读取）

- `references/split-part-01.md`：4. 必踩的坑 / 5. 验证：三层都要做 / 6. Windows 环境限制（会影响交付什么） / 7. 交付前清单
