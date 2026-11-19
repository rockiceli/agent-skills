---
name: dsh-power-user
summary: DeepSeek Harness 桌面端进阶操作 —— 模式选择、Agent 团队、插件安装与选型、上下文/费用管理、提示词避坑
description: DSH进阶用法：运行模式、Agent团队协作、插件安装评估、上下文与token成本、AGENTS.md与提示词避坑。当要榨干DSH、装插件、用agent teams时使用。
---

# DSH 进阶（桌面端）

> 来源：B站 `BV19dJQ6sE9F`《【插件推荐】榨干 DeepSeek Harness！！！》（UP：萌芽）
> ＋ 本机 DSH `0.2.1-rc.3` 实测。**版本相关的 UI/模式名标注了「按当前版本核对」**。

## 一分钟速览

- DSH 是「一切皆插件」的 agent，底层是 Cordis 插件组合；一个 **profile** = 一串插件包补丁层。
  本机 profile：`desktop`（桌面端主用）、`headless`、`auto-task`、`auto-task-light`、`bili-duty`。
- 日常改代码用**标准模式**；一轮里要连续几十次工具调用（梳理陌生项目、查文档、版本迁移、多篇对比）→
  **PTC 模式**：把多次工具调用合并成一段脚本执行，少几次「调用→思考→再调用」的往返，省时也省 token。
- **极简模式**主要给模型基准测试用，日常可以忽略；**创造模式**用于开发插件。
- 装插件：设置 → 插件 → 添加插件（填包名 / GitHub 仓库地址），或者直接让 DSH 帮你装；
  命令行等价：`dsh plugin --profile desktop add <包名|tgz直链|github:仓库>`（装完重启一次）。
- 插件装进哪个 profile，就只对那个 profile 生效；`desktop` 是桌面端本体会用的那个。

## 四种模式怎么选（视频口径，按当前版本核对 UI）

| 模式 | 适合什么 | 备注 |
|---|---|---|
| 标准 | 日常写代码、改项目 | 默认就够用 |
| PTC | 连续多次工具调用、可脚本化的批量操作 | 合并成一段程序执行，减少往返；官方示意是省时间省 token |
| 极简 | 模型基准测试 | 工具与上下文压到最少，不适合日常 |
| 创造 | 开发插件 | 插件管理工具默认只在这个模式下开 |

> 本机提示：`plugin_manager` 之类的管理工具默认只在 **Creator 模式**启用；其他模式要用得先确认。

## 提示词与 AGENTS.md（这部分最省事）

- **把「不要用什么」写出来**：DSH 有时会调无关工具（比如为了改个名字去开浏览器）。
  需求里直接写「不要用浏览器 / 不要操作电脑，直接改文件」。
- 需求要足够清楚再发出去，否则目标/计划模式很容易跑偏。
- `@` 引用：输入框里 `@` 可以带文件、工作区进上下文。
- `AGENTS.md` 分两级，和 Codex 一个套路：
  - **全局**（用户级）：通用做事规则（先查已有资料别重复干活；删除/发布类操作先给方案再执行）。
  - **项目级**（项目目录里）：技术栈、文件组织、测试方式；冲突时项目级优先。
  - DSH 没有专门的 AGENTS.md 设置入口时，直接让 AI 帮你创建/修改这份文件。

## Agent Teams（智能体团队）

- 本机 `desktop` profile 已装：`dsh-experimental-agent-team-profile`、`dsh-experimental-auto-review`。
- 用法：提示词里**明确说**「调用智能体团队 / agent teams，并指定需要用哪些 agent、什么团队」——
  DSH 没有斜杠命令或 @ 直接添加插件，必须靠提示词点名。
- 协作形态：主 agent（lead）拆任务 → research 子 agent 开新会话查资料 → 结果交给 review agent 审 →
  回来改；适合做选题、方案评审、代码审查这类有「起草→挑错→修正」的活。
- 权限：`auto-review` 能自动放行低风险操作、高风险仍问你；不装它就得每步手动确认。

## 插件选型清单（视频提到的社区插件，装前核对来源/权限/兼容性）

| 插件（视频口径） | 干什么 | 值不值 |
|---|---|---|
| `eagle-browser` 类浏览器插件 | AI 操作浏览器，你能看着并在必要时接手 | 需要网页操作时值；注意别让它碰账号密码 |
| `DSHIM` | 微信/飞书远程给电脑下任务、收结果 | 电脑端 DSH 必须常驻；适合手机遥控 |
| drawio / artifact 编辑器 | 画流程图、架构图；artifact 做可交互 HTML 图 | 做汇报/方案时值 |
| `dsh-context` | 看上下文里装了什么、占多少 | 长会话排障用 |
| `billion-context` 类 | 把旧对话分段摘要、维护交接文档 | 上下文爆炸时值 |
| `costmeter` / 余额插件 | 每会话用量/估算费用、余额、峰谷时段提醒 | 省钱刚需 |
| `rewind` | 会话回退到前面某轮重新提问 | 值；**代码回退用 git，别靠它** |
| `dsh-web-ui` 全家桶 | 归档管理（搜索/按项目筛/恢复）、任务看板（拖状态、定时） | 任务多时值；19 个插件按需挑 |

> ⚠️ 社区插件是第三方代码，会以宿主权限运行。装之前看 README 的权限/网络说明，
> 别把「整台电脑读写 + 联网」的插件放进无人值守的 profile（参考 `bili-duty` 的最小权限做法）。

## 上下文与费用

- 上下文太长：先 `compact` 压缩；再不行用上下文观察插件看占用；长期方案是开新会话 + 交接文档。
- **峰谷定价（2026-09-10 官方口径）**：工作日 9:00–12:00、14:00–18:00 是高峰，其余时间和整个周末是谷时。
  不着急的批量活放谷时跑；`costmeter` 一类插件会提醒当前时段。
- 官方 API 按 token 计价，agent 一轮的真实成本 ≈ 输入（含上下文/工具结果）+ 输出；压缩和少调无关工具都是实打实省钱。
- **先拆账单再装省 token 插件**：本机账单在 `~/.dsh/composite/main-usage.jsonl`，归因脚本与判读见 `上下文压缩治理` §8。

## 省 token 4 插件：按账单筛，别无脑装（2026-11-09 实测）

> 来源：B站 `BV1pexF6gEB7`《DSH省token必下的4个插件》（UP 天才依山尽，2026-10-29）
> ＋ 文字版 控场AI（2026-11-06）＋ 本机真实账单。**视频自己也强调「先统计支出结构、装前装后看数字」**。

| 视频插件 | 治哪块 | 本机账单 | 动作 |
|---|---|---|---|
| DSH Shops（工具输出紧凑化） | 少读·每轮重读 | 输入占 **99.7%**、平均单步 **220,685** token、峰值 368,296 | ❌ **未装**：`dsh-compressor@0.1.0` 被 DSH `0.2.2-rc.1` 判不兼容（要求 `@deepseek-ai/dsh-tools@0.1.0-rc.6`，强行装可能崩/丢数据）；不豁免风险，改用「少读」提示词纪律，官方 `@deepseek-ai/dsh-compaction-tool-result-pruner` 作备选 |
| Billion Context（旧历史折摘要） | 少重读 | 22 个 turn、单 turn 最多 137 步 | ✅ 已装 `billion-context@0.1.213`（npm 最新，无需升级） |
| DSH Vision Router（图先转文字） | 少重读 + 看图 | 图片不是当前账单大头 | ✅ 装 `dsh-vision-router@3.2.0`，为「图片视频观看」能力；**必须关云回退 / 配本地 Ollama** |
| DSH Thinking Levels（思考自动挡） | 少想·输出 | **输出只占 0.3%**（431,464 / 136,594,353） | ❌ **不装**：省不了钱，还会自动降思考深度 |

**本机账单（2026-11-08~09，617 次调用，全 deepseek-flash，$32.386）**：输入 136,162,889 / 输出 431,464，
缓存命中率 **97.3%**（cacheRead 116,266,496，未命中新输入仅 3,199,092）；11-08 $23.44、11-09 $8.95。
**结论：钱全花在「每轮重读上下文」，不在模型输出** → 优先压工具输出与历史，别碰输出侧。
**额外补装**：`dsh-cost-meter@1.9.62`（费用账本，把账单持续可视化，闭环「装前装后看数字」）。

**流程纪律（照做）**：
1. 装前备份 profile 的 5 个配置文件（11-09 `desktop.bak-20261109-2243/`、11-10 `desktop.bak-20261110-0010/`）；
2. 先拆账单再选插件；装前装后各看一次 `costUsd`，数字没动就回滚；
3. ⚠ `dsh-vision-router` 默认免 K 云回退会把图片发到 OVHcloud，**不是离线**；涉密图走本地 Ollama / LM Studio 后端；
4. `desktop` 是 pnpm workspace root（`packages: ['.']`），`dsh plugin add` 要带 **`-w`**，否则可能被拒；
5. ⚠ **装完必须复核 `dsh.profile.bundles`**：本机两次实测不一致 —— 11-09 装 `cost-meter`/`vision-router` 时 CLI 只写 `dependencies`（21→23 靠手补），11-10 装 `cc-safety-net`/`dsh-plug-store`/`dsh-whale-balance` 时 CLI 自动注册（23→26）。**包有没有 `dsh.bundle.patch` 不是判据**（五个包全都有）。别猜，装完读一次 `package.json` 并用 `plugin list --depth 0` 复核，缺了就手补；`cordis.patch.yml` 不用动。
6. 社区插件以宿主权限运行，`bili-duty` 等无人值守 profile 不装。

## 八个必装插件：按本机已有清单筛（2026-11-10）

来源 B站 `BV1GJnZ6MEFw`（天才依山尽，2026-10-26）。**八个里本机已有 5 个**，只补装 3 个：
`cc-safety-net@2.7.8`（拦破坏性命令）、`dsh-whale-balance@1.0.2`（余额）、`dsh-plug-store@0.1.26`（DSH 内自助管插件）；
跳过 `context-doctor@0.45.0`（独立 CLI/MCP，非 DSH 插件）。
完整对照表、包名核实、bundles 23→26 与 peer 警告 → `references/八个插件清单.md`。

## 从视频里提取的「稳定性经验」

- DSH 偶尔会多做无关操作；把「不要 X」写进提示词，比事后纠正便宜。
- 插件装完没反应：先查版本/是否需要重启，再看日志，不要连续重装。
- 未来的方向（官方口述）：插件市场、兼容性、Agent 团队、长期记忆、远程协作；
  Cordis 论文两件事——插件卸掉要收干净（时间可组合性）、插件之间要能配合（空间可组合性）。
- 同一 profile 只留一个「改写历史」的后端；若日后装了工具输出压缩插件，它与 `billion-context`（折会话历史）层次不同可共存，但装后必须验证，且别同时上两个改写工具输出的 hook。

## 本机可直接用的命令

```powershell
# 版本 / 帮助
& '<home>\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe' `
  --expose-internals '<home>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js' --version

# 看 / 改 profile 里加载的插件包
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
```

装插件（本机验证过，desktop 是 workspace root 故带 `-w`）：

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
$exe='<home>\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe'
$cli='<home>\AppData\Local\Programs\DeepSeek Harness\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js'
& $exe --expose-internals $cli plugin --profile desktop add <包名或tgz直链> -w
& $exe --expose-internals $cli plugin --profile desktop list --depth 0
```

Git Bash 等价（PowerShell 抓不到 stdout 时用）：

```bash
ELECTRON_RUN_AS_NODE=1 "/f/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/DeepSeek Harness.exe" \
  --expose-internals "<home>/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js" \
  plugin --profile desktop list --depth 0
```

## 待核对项

- 四种模式在**当前桌面版**的位置/名称（视频是 2026-11 的版本口述）。
- 社区插件的最新版本与兼容性（按 README 与 Releases 页为准，别用 npm 上的旧版）。
- 2026-11-09 已核对：`billion-context@0.1.213` / `dsh-vision-router@3.2.0` / `dsh-cost-meter@1.9.62` 均为 npm 最新版，已装入 desktop 并注册进 `dsh.profile.bundles`；`dsh-compressor@0.1.0` 虽是最新版但被版本门禁拒绝，未装。
- 2026-11-10：3 个新插件装入 desktop，bundles 26 条、CLI 复核在位；`context-doctor` 非 DSH 插件不装；`dsh-plug-store` peer 与 GUI 加载待验证。
