---
name: electron-desktop-pet-sprint
description: MOCHI桌宠项目加功能改UI：文件地图、测试harness约定、截图脚本桩、四套验证。当提到MOCHI、beast-diary、跑四套验证要截图证明时使用。
agent_created: true
---

## 索引（渐进披露，按需展开正文）

- 何时使用
- 项目地址
- 改动前
- 改动后验证
- 新增功能的标准做法
- 只验面板 HTML/样式（不想起 Electron 时的更快套路，第 98 轮常用）
- 截图脚本模板
- 测试沙盒常用技巧
- 画装饰 / 特效的硬规矩
- 联网 / 外部接口的硬规矩（第 21 轮血泪）
- 写测试的硬规矩（第 21 轮两次踩坑总结）
- 拆 desktop.js 的套路（第 22 轮开了头，后面每轮照抄）

# Electron 桌面小兽功能迭代

## 何时使用

用户在 `<home>\WorkBuddy\2026-09-26-11-46-46\beast-diary` 的 Electron 桌宠项目里要求新功能时触发：
- 新行为/新面板/新装备/新同伴能力
- 修真机 bug 后需要回归测试
- 需要出图给真机效果验收

## 项目地址

```text
G:\2026-09-26-11-46-46\beast-diary
```

> ⚠ **路径换过盘了**（2026-10-17 实测）：项目在 **G 盘** `G:\2026-09-26-11-46-46\beast-diary`，
> 不是 `<home>\WorkBuddy\...`（那份是旧的 WorkBuddy workspace，早已不用）。
> 开工前 `ls` 确认一下；交接文档在 `desktop/HANDOFF/`，`PROMPT-复制这段.md` 里写的也是 G 盘路径。

主要入口文件：

| 文件 | 作用 |
|---|---|
| `js/desktop.js` | 引擎：状态机、画布、面板、出征、同伴 |
| `js/petlife.js` | 数据/文案层：出征脚本、天赋、融合技、套装 |
| `js/pets.js` | 角色名册、本命招式、素材角色 |
| `js/draw.js` | 像素绘制、动作形变、毛色 |
| `js/state.js` | 存档与购买/装备/强化接口 |
| `js/desk-gacha.js` | 🎰 抽卡（第 23 轮起，**第 25 轮 1184 行**：70 只可抽 / 5 档稀有度 / 8 阵营 / 13 组羁绊 / 动态取名词库 / **手风琴折叠（单个 `openKey`）** / **独立预览小窗格 `#gpeek`** / 悬停简介 / 收集看板 / 上传形象剔除出池） |
| `js/desk-memory.js` + `js/desk-memui.js` | 💌「它记得你」+ 明信片（第 23 轮） |
| `js/desk-{shot,home,bg,guide,capsule}.js` | 从 `desktop.js` 拆出来的外模块（演出/小房子/背景/手册/生日胶囊） |
| `js/desk-fold.js` | 🗂️ 第 26 轮：通用面板折叠（一页一个 `openKey` 的手风琴，六页共用） |
| `js/desk-elder.js` + `js/desk-sword.js` | ♛ 第 31 轮前辈深化（拿装备敲「仙·xxx」新副词条 / 已会技能 +1 级封顶 5 / 联手一趟出征 ×2）· ⚔ 传世宝剑（自取名 / 刻字进 tooltip / 会眨眼的像素剑 / 按「第 N 任」口吻叨一句） |
| `js/desk-mini.js` | 🟢 第 32 轮：迷你条（按完整栏**实测高度** +10 错开 + `ResizeObserver` 跟随） |
| `js/desk-case.js` | 📖 第 26 轮：图鉴 / 展示柜 / 佩戴彩怪 / 表情 / 职业；**第 27 轮再接 🐾角色页**（共 6 个面板，469 行） |
| `js/desk-fortune.js` | 🎴 第 26 轮：每日一签（签种 / 权重 / 状态机 / 台词 / 动画 / 面板） |
| `js/desk-slot.js` | 🎰 第 28 轮：老虎机（符号 / 五档概率 / 面额 1~100 转 / 摇奖派奖 / 台词 / 转轮动画 / 面板 / **三个面板动作也在这里，靠 `bind({hooks})` 回调**）。第 29 轮修转轮起点 + 动画顺序 |
| `js/desk-fusion.js` | 🌀 第 29 轮：世界级被动融合（20 组彩蛋名 / 溢价算法 / 二段融合 / 拆开 / 自动触发）+ 技能经验升级（最高 5 级）+ 被动获得档位。第 30 轮加**门数配色**（1 银白 / 2 青蓝 / 3 紫金 / 4+ 七彩，`fxOf(n)` 光环和面板色条共用） |
| `js/desk-mate.js` | 🎒 第 30 轮：副官独立装备栏（三槽 / 穿戴 / 强化 / 60% 折算加成 / 一键配装 / 面板） |
| `desktop/main.js` | Electron 主进程：窗体、托盘、IPC |
| `desktop/preload.js` | 只暴露 `window.BDshell` |
| `desktop/HANDOFF/00-START-HERE.md` | 最交接文档（必读；文末有「给下一个 agent 的提示词」） |
| `desktop/HANDOFF/01-PITFALLS.md` | 真机坑点（活坑 B56~B62 + 掘墓清单） |
| `desktop/HANDOFF/_archive/PITFALLS-历史全量-B01-B55.md` | 历史坑全量底稿（**按主题索引回翻，别整份读**） |
| `docs/_archive/` | 旧玩法总览 / 旧版本历史（当前状态以上面两份 HANDOFF 为准） |
| `desktop/tools/probe-gacha.js` | 真机探针：把 `mochi-share.json` 灌进 state，打印池子/名字/重名/坏名（**沙箱里素材库是空的，动态命名那条路只有它能测**） |
| `tools/sheet-skins.js` | 角色接触表出图（`--only=art\|roster\|manifest\|cu --scale=N --cols=N`） |

## 改动前

1. 读 `desktop/HANDOFF/00-START-HERE.md` 和 `01-PITFALLS.md`。
2. 确认基线四套测试是绿的：

```bash
cd <home>/WorkBuddy/2026-09-26-11-46-46/beast-diary
node tools/smoke.js
node tools/desktop-smoke.js     # 2026-10-17 实测 3198/0（基线只增不减，跑前先看 HANDOFF 里的当前数）

cd desktop
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/selftest.js
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/menutest.js
```

## 改动后验证

必须跑完下面四样再汇报，顺序不限：

| 命令 | 期望结果 |
|---|---|
| `node tools/smoke.js` | 40 ✔，冒烟测试结束（2026-09-29 实测） |
| `node tools/desktop-smoke.js` | 0 失败（**每轮往上涨**：第 45 轮 1960 → 第 46 轮 1998 → **第 47 轮 2026**。跑之前先看 `desktop/HANDOFF/00-START-HERE.md` 里的当前基线，别照抄老数字） |
| `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/selftest.js` | 结果：全部通过 |
| `env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/menutest.js` | ✔ 菜单项全部生效 |

如果改了 `js/draw.js` / `js/data.js` / `js/state.js`，必须额外跑 `node tools/smoke.js` 防网页版回归。

## 新增功能的标准做法

1. **数据/文案层**：在 `js/petlife.js` 里加表/函数；保持 `makeRun` 参数自描述；不要让它依赖 DOM。
2. **引擎层**：在 `js/desktop.js` 里消费 `petlife.js`；状态变更用 `setState()`；和出征互斥用 `isBusy()`。
3. **UI 层**：`pageXxx()` 函数返回 HTML 并设置 `page`；`renderPage()` 负责渲染；加完页签要在 `TABS` 和 `MENU` 里同时补。
4. **暴露测试接口**：在 `DP` 对象末尾加只读/函数导出，例如 `DP.pals = () => pals;`。
5. **测试**：在 `tools/desktop-smoke.js` 里加一个 `xxxMode()` 场景函数，在 `main()` 里调用；断言用 `is()` / `ok()` / `bad()`。
6. **截图**：新功能一般要出 1~4 张图。复制 `desktop/tools/shot-hero.js` 改，关键 IPC 哑桩必须带：

```js
ipcMain.handle('bd:assets', () => []);
ipcMain.handle('bd:panel', () => true);
require('../sysclean').register(() => null);
```

截图脚本必须在 `child.setOpacity(0)` 的可见窗口里跑，否则 `capturePage` 拿到旧帧。

### 只验面板 HTML/样式（不想起 Electron 时的更快套路，第 98 轮常用）

写个一次性 node 脚本：`makeSandbox()` 引导桌面 → 调模块测试钩子摆好状态（给功法/设阅历/切页签）→
把**真实产出的面板 innerHTML** 连同样式（从 `desktop.html` 里把 `#page` 相关 CSS 整段抠出来）写进
一个 `_rNN-xxx-preview.html` → 本地起 `python -m http.server` → 无头 Edge 截图：

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$TEMP/shot-x" --window-size=700,1100 --virtual-time-budget=5000 \
  --screenshot="<绝对路径>/out.png" "http://127.0.0.1:8798/_rNN-xxx-preview.html"
```

- SVG / 想放大看细节：把 SVG 从预览页抽出来单独包一层 `style="width:840px"` 再截（比找缩放参数快得多）。
- 抠 `#page` CSS 别手抄 —— 正则从 `desktop.html` 截 `#page .sec` 起到 `#page .pb` 那段，一次拿全。
- 截完**读图逐项过**：布局溢出 / 空白 / 对比度 / 图标真画出来没。第 98 轮「无品品」文案 bug
  就是这么发现的（断言抓不到文案拼重）。
- 完事删掉 `_rNN-*` 临时文件，别留在项目里。

## 截图脚本模板

```js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'preview');

app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
ipcMain.handle('bd:assets', () => []);
ipcMain.handle('bd:panel', () => true);
require('../sysclean').register(() => null);

function shoot(w, h, js, outName, wait) {
  return new Promise((resolve) => {
    const child = new BrowserWindow({
      width: w, height: h, show: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false,
        backgroundThrottling: false,
      },
    });
    child.setOpacity(0);
    child.loadFile(path.join(ROOT, 'desktop.html'));
    child.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        await child.webContents.executeJavaScript(js);
        setTimeout(async () => {
          const img = await child.webContents.capturePage();
          fs.mkdirSync(OUT, { recursive: true });
          fs.writeFileSync(path.join(OUT, outName), img.toPNG());
          child.destroy(); resolve();
        }, wait || 1200);
      }, 900);
    });
  });
}

app.whenReady().then(async () => {
  // 在这里 await shoot(...)
  app.quit();
});
```

运行：

```bash
cd desktop
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/shot-xxxx.js
```

## 测试沙盒常用技巧

- 推帧：`S.pump(1200)` 直接把 60 秒动画压成一瞬间。
- 等空闲：循环 `BD.desktop.debug()` 看 `state/foods/busy/errand`。
- 同伴状态不稳：直接给 `pl.state/alpha/gone/wait/t` 赋值再 pump。
- 随机性断言要留余量或多次调用，不要假设某一次随机事件一定发生。
- 沙箱里 `S.BD.pets` 是**对象**，不是函数 —— 别写 `PT()`（`PT` 是 desktop.js 里的 getter，测试里直接 `const PT = S.BD.pets`）。
- 想断言「画出来了」：换掉 `ctx.fillRect` 收集 `fillStyle`，比较**笔数**和**颜色集合**（比断言像素坐标稳得多）。

## 详细内容（references，按需读取）

- `references/split-part-01.md`：画装饰 / 特效的硬规矩 / 联网 / 外部接口的硬规矩（第 21 轮血泪） / 写测试的硬规矩（第 21 轮两次踩坑总结） / 拆 desktop.js 的套路（第 22 轮开了头，后面每轮照抄） / 拆完之后必做的「查 bug」两件事（第 22 轮血泪） / 交付清单 / 第 23 轮踩过的坑（写测试时先看这段） / 第 24 轮踩过的坑（抽卡 / 命名 / 存档边界） / 第 25 轮踩过的坑（换肤改名 / 浮动弹窗 / 手风琴 / 真机上传形状）
- `references/split-part-02.md`：第 26 轮踩过的坑（折叠 / 奖杯 / 抽签）
- `references/split-part-03.md`：N2 轮（2026-10-17 深夜）踩过的坑
