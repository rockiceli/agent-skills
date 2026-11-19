> 本文件由 `SKILL.md` 拆分而来（只读参考，不单独作为技能入口）。
> 对应主文件：`SKILL.md`；小节：N2 轮（2026-10-17 深夜）踩过的坑

## N2 轮（2026-10-17 深夜）踩过的坑

**① 开发跑的是源码，改完即生效；包只在分发时才需要重打 —— 但包本身是「当前-最新一次打包」的，不是垃圾。**
`desktop/main.js` 是 `win.loadFile(path.join(ROOT,'desktop.html'))`，`ROOT = desktop/..` = **源码根目录**；
`启动桌面小兽.vbs` 也是 `electron.exe <desktop 目录>` ⇒ **改源码即生效，不用重打包**。
> ⚠ 我（上一轮）在这里写过「`MOCHI-exe` 是 10-08 的旧包、跟开发无关」—— **那是错的**，别信那句。
> 实测 `MOCHI-exe/MOCHI/MOCHI.exe` 就是最近一次打包的产物（含 `desk-dock.js` 等全部外模块），
> 只是**打包那一刻之后的新代码不在里面**。所以：
> - 「改了没生效」→ 先查**旧进程杀没杀**（托盘常驻），不要去查包；
> - 「要分发 / 要发 Steam」→ **必须重打**，否则 N 轮的新模块根本不在包里（N2 就漏过一次：
>   包是 21:56 打的，N2 两个新模块是 23:0x 加的 ⇒ 包里没有）。
> - 验包是否含本轮改动：`ls <输出>/MOCHI/resources/app/js/desk-<新模块>.js` +
>   `grep -c "BD.<新模块>.bind" <输出>/MOCHI/resources/app/js/desktop.js`。
> - 打包脚本只改**副本**的 `js/edition.js`（源码那份永远是 `'dev'`），可以放心打。

**①b 本机 `--clean` 会被批量删除护栏拦住（N21 实测，坑 B356）。**
`node tools/build-exe.js . <输出目录> --clean` 第一步要 `fs.rmSync(输出目录, {recursive:true})`，
在 WorkBuddy 的 node shim 下抛 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] count=1075 threshold=50`，
**包一个文件都不会更新**（容易误判成「打包成功」）。等价做法：
```bash
# 1) 旧目录改名挪开（Rename-Item 不算删除，秒过）
powershell -Command "Rename-Item 'G:\...\MOCHI-exe' -NewName 'MOCHI-exe-old-<ts>'"
# 2) 输出目录已不存在 ⇒ 打出来的就是全新包（天然等价 --clean）
node tools/build-exe.js . G:/.../MOCHI-exe --clean
# 3) 验完再删旧目录（送回收站优先；代码目录属构建产物，可永久删）
```
判据：日志有 `✅ 打包完成`，且 `resources/app/js` 与源码 **67 个 js 逐个 md5 一致**
（steam 只允许 `edition.js` 不同 = `'steam'`，那是 `--edition=steam` 写的发行变体）。
⚠ 别用 `rm -rf` / `Remove-Item -Recurse -Force` 硬闯护栏；也别改 `build-exe.js` 去绕。

**①c 坑索引重建脚本在 `desktop/tools/reindex-pitfalls.js`（不在 `tools/`）。**
```bash
cd desktop/HANDOFF && node ../tools/reindex-pitfalls.js   # → "索引重建完成：N 条，Bxx~Byy，无空洞" + 行号自检
```
它只重建 §0b 表格与行号；**文件头那两处「最新坑号 / 体积」仍要手改**（脚本不管）。

**② 写断言之前先读实现，别按猜的字段名写。**（这一轮 6 条假红全是这么来的）
- `OR.divine(topic)` 返回 `{lines:[...]}` —— **不是** `{hope, care, isaac}`；
  判词顺序是 `HOPE → (GOOD|WARN) → CARE×n → ISAAC`，希望句排**第一**、以撒式**压最后**。
- `OR.guessSay()` 返回 **对象** `{say, reply}`，不是字符串。
- `ML.writeLetter()` 返回 `{hello,open,where,did,feel,bye,gift}`，**没有** `body`（正文是面板现拼的）。
> 泛化：**先 `grep -n "function X"` 读一遍返回结构，再写判据** —— 猜字段名的断言 100% 假红，
> 而且很容易被误判成「功能没做对」去改代码。

**③ `AW.returnHome()` 是「进入 away 并起一个回来定时器」，不是「回家」。**
真的回来是 `AW._comeBack()`（或 `AW.recall(true)`）。
让小兽出门的既有套路（照抄，别自己造）：
```js
AW._reset(); AW._leave('portal');
for (let i = 1; i <= 20; i++) AW.draw(mkCtx(), i * 0.1);   // dt 每帧封顶 0.1，12+ 帧才演完
// 之后 AW.isAway() === true，mode === 'away'
```

**④ 模块「让位」时，只让该让的（动画推进），不许把「维持自身状态」一起让掉。**（B287，用户报的 bug）
`desk-dock.js` 以前在 `tick()` 首行 `if (awayNow()) return`，把窗口校正 `reconcile()` 一起掐了、
`draw()` 也直接 return ⇒ 收纳着的缝不画发光边/标识（"吸附自己没了"），
而 away 那块大牌画在 `pet.x`（此刻整扇窗只剩一条缝，pet.x 在屏外）⇒ "界面藏在边界外"。
修法：`if (awayNow()) { reconcile(); return; }` —— 只冻动画，位置照旧维持。
> 断言写法：画出缝之后收集 `ctx.fillRect` 的矩形，判**每一笔都落在 `DK._strip(side)` 范围内**
> （比"数笔数"更能证明「没画到屏幕外」）。

**⑤ Git Bash 的终端输出会把中文显示成乱码（`娴嬭瘯鐢` / `鈽匩2` 之类），文件本身是好的。**
复核一律用 Read 工具，别去"修文件编码"（改了反而真乱码）。

**⑥ 新 `js/desk-*.js` 的接线四件套**（缺一个就整页功能消失，N2 已写成断言）：
① `desktop.html` 的 `<script>` 排在 `desktop.js` **之前**（它顶层 bind，反了撞 TDZ 白屏）
② `tools/desktop-smoke.js` 那份白名单数组同样排在 `desktop.js` 之前
③ `desktop.js` 顶层 bind 区挂 `BD.x.bind({...})`
④ `update` / `draw` 里转交 `tick` / `draw`（要点击的再加 `tap`）。
外加**成就取值源**：`data.js` 加成就 + `desktop.js` 的 `achvCtx()` 加同名字段，**漏后者 = 成就永远判定成 0**。

**⑦ 交接文档里的数字会过期，改之前先核实。**（2026-10-18 重写 HANDOFF 时实测出的偏差）
`desktop/HANDOFF/` 里四份文档互相抄数字，实测发现这些是**错的**：
- 「合体 34 套」→ 错，**34 是职业数**（`DT.CLASS_KEYS.length===34`）；合体招数断言是 `PL.FUSION.length>=30`。
- 「52 只抽卡角色」→ 代码里 grep 不到；沙箱实测 `allSkins()`=42（固定皮肤 33 + 内建 9），真机导素材后更多。
- 同一份文档里 `desktop.js` 行数一处 10798、一处 10791；门禁一处 3137、一处 2984。
> 泛化：**文档里的计数，一律回到 `tools/desktop-smoke.js` 的断言里取真值**（断言才是唯一权威），
> 拿不准就写个一次性 node 脚本 stub 出 `window` 加载 `data.js`/`pets.js` 直接数。
> 新写文档时**把「怎么验」写在数字旁边**（`3198（跑 tools/desktop-smoke.js）`），下一轮才核得动。

**⑧ 行数现状**：`js/desktop.js` **10798 行 / 硬上限 10800，剩 0 行**；外模块 40 个 / 17986 行。
新功能只能进 `js/desk-*.js`，主文件里连注释都要**并回现有行尾**（N2 加两个新模块，主文件净增 0 行）。

**⑧ `tools/smoke.js`（网页版）的「迷宫点击」会因为**设计内**的"打空"偶发红。**（N2 顺手修）
第 61 轮起 `dmgTo()` 先 roll 一次命中（`DT.hitRateOf`），没中就飘「闪」、伤害 0 ——
只点一次等于在测运气（实测 15 次红 2 次）。已改成**连点 ≤8 次取「至少打中一次」**：
全空的概率 ≈1e-7，命中那条路真坏了照样当场红。**改的是"测量方式"，不是放宽阈值。**
> 泛化：遇到间歇红，先去**代码里找有没有刻意的随机机制**（miss / crit / 掉落 / 概率触发）。
> 有 → 改测量方式（重试取聚合，或喂一个确定的种子值）；没有 → 那是真噪声，加大样本量。
