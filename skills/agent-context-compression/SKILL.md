---
name: agent-context-compression
description: AI Agent上下文与token治理：billion-context压缩、cost-xray账单、前缀缓存、答短、推理分档；KV 缓存命中（前缀须逐字节相同）、缓存命中/未命中与高速档单价差。当要省token、压缩上下文、前缀缓存失效、长会话撞上限时使用。
agent_created: true
---

# Agent 上下文压缩与成本治理

一行索引（按需跳读）：
- §1 选型决策树 ｜ §2 cost-xray（观测）→ §3 sqz（去重）→ §4 headroom（语义）→ §4.5 cache-tax（保前缀）→ §4.6 别重复读 → §4.7 答短 → **§4.8 按难度分档** → §5 book-to-skill
- §6 本机落地顺序与风险 ｜ §7 Reflexion（失败教训 / 何时别用）｜ §8 先测再装的本机账单反例
- 详细参数/安装 → `references/tools-detail.md` ｜ 账单实测数字/归因脚本/坑 → `references/账单归因.md`

---

## 1. 选型决策树（先看这里，别一上来就装）

```
DSH 长会话越跑越满、想跨天/跨周？ → billion-context（§1.5，DSH 原生插件，装完即生效）
token 账单从来没拆开看过？        → 先装 cost-xray（观测优先，不要盲省）
浪费主要是"重复的命令输出/重读文件"？ → sqz（去重 + 13-token 引用，零 LLM、离线）
浪费主要是"一次性超大 JSON / 长日志"？ → headroom（AST + JSON 结构化压缩，可逆）
回答太长/输出是账单大头？ → §4.7 答短纪律（零安装，多轮才省）
难任务用同一个高档位跑、简单任务也在烧钱？ → §4.8 按难度分档（只切档不切模型，切模型会打冷缓存）
要把书/文档变技能？         → book-to-skill
```
各层不互斥，但**同一台机器不要同时上两个"改写工具输出"的 hook**——互相看不到对方格式，压缩率反而下降。

## 1.5 billion-context —— DSH 原生上下文压缩插件（首选，2026-11 收录）

- https://github.com/ranxianglei/billion-context ｜ 3800★ ｜ MIT（附「终端产品需署名」）｜ **官方统一版**：`-pi`/`opencode-acp`/`-dsh` 均已收编，勿装散装移植版。
- 定位：**模型驱动**的上下文管理（ACP）。注入 `compress`/`decompress`/`search_context`/`acp_status`/`acp_cache`；模型决定压哪段，摘要可逆、原文留在 append-only 日志，前缀缓存友好；100k 窗口够用，官方称省约 5× token。
- 数字（官方/第三方）：174,327 次调用零违规；ContextBench F1 第一（省 58.3%）、LongMemEval-S 比最强 RAG +16.6%。明细 → `references/tools-detail.md#billion-context`
- 安装：`dsh plugin --profile <profile> add billion-context`；本机实测热加载免重启、已装 `@0.1.212`；备份/回滚 → `references/tools-detail.md#billion-context`
- 兼容/安全：装前备份 `~/.dsh/profiles/<profile>/`；**同一 profile 只留一个上下文管理器**。
- 何时别用：短会话/纯问答；无法重启 DSH；需逐字引用的合规场景；已装其它压缩后端（先卸）。
- 关系：它管历史、cost-xray 管观测、sqz/headroom 管工具输出；**只留一个改写历史的后端**。

## 2. cost-xray —— 先把账单拆开（观测层）

- https://github.com/tigerless-labs/cost-xray ｜ MIT ｜ Python ｜ tags: prompt-caching / observability
- 作用：看 Claude Code / Codex **实际发往 API 的内容**，system / 工具 schema / 历史 / 本轮输入各花多少钱
- 为什么排第一：不知道"钱花在哪"就永远在瞎省。**schema 占大头** → prompt caching / 渐进披露；**历史输出膨胀** → sqz / Pruning

## 3. sqz —— 去重压缩（会话层，推荐先试这个）

- https://github.com/ojuschugh1/sqz ｜ Apache-2.0/MIT ｜ Rust 单二进制 ｜ **零 LLM / 全离线 / 零遥测**
- 两招：按命令定制的格式化器 + **13-token `§ref:HASH§` 去重引用**。官方 3,003 次平均省 **24.7%**（重跑 `git status` 78%、重读行范围 87%、同测试输出 89%；散文 2%、源码首读与堆栈 **0%**）
- 自检：`sqz gain` / `sqz stats --cost`；后悔信号见 references。**"后悔信号"值得抄**：统计"2 分钟内字节相同的重跑"与"ref 展开次数"，升高=压掉了模型真要的
- 必踩坑与安装细节 → `references/tools-detail.md#sqz`

## 4. headroom —— 语义压缩（数据层，更强但有代价）

- https://github.com/headroomlabs-ai/headroom ｜ Apache-2.0 ｜ Python 3.11+ ｜ 实测省 30–57%
- 流水线 `CacheAligner → ContentRouter → CCR`：SmartCrusher 压 JSON、CodeCompressor（AST）压代码、Kompress-v2 压散文；**CCR 可逆**（`headroom_retrieve`）
- 接入 4 种（库/代理/MCP/包装）。⚠ **默认开匿名遥测** → 设 `HEADROOM_BEACON=off`
- 安装与精度数字 → `references/tools-detail.md#headroom`

## 4.5 cache-tax —— 前缀缓存"冷启动账单"防护（2026-11-04 收录）

- 工具与实测（`/keepwarm` 保活、330k 会话 $6.61 账单）→ `references/tools-detail.md#cache-tax`
- 关键认知：**冷写与缓存读同 token 80 倍价差** → 省 token 一半不在压缩，而在**别让前缀失效**（固定段置前、不带时间戳）
- **命中判据只有一条：前缀必须逐字节相同**（DeepSeek DeepInfer 实测线上 **96% 输入命中 KV 缓存**；命中/未命中价差约 **50 倍**）。→ 改系统提示词开头一个字、插时间戳、换模型 = 整段前缀作废（2026-11-10 收录，来源 BV1DmnB6jEGu）
- **同一模型的三档单价（2026-11-12 收录，来源 BV1Mdnh6ZEZi 转述 Kimi K3.1 Pro 定价）**：缓存命中输入 **1.3 元/百万**，未命中 **13 元/百万**（≈10×），"高速档"再加价至 **≈2×**。⇒ 先保前缀稳，再谈开不开高速；否则等于为一次冷写多付 20 倍
- 何时别用：非 Claude Code 客户端；不能接受 ping 花 token；极短离开

## 4.6 别重复读同一文件 —— reread 阻断（2026-11-05 收录）

- 来源：`rohitg00/pro-workflow`（2943★，`reread-tracker.js` hook）：记已完成的 Read，**同文件未变又被读时提醒**，可设 `block` 拦下。
- 为什么单列：**重复读 = 零信息增益的纯浪费**，同时毁 token 与前缀缓存。本机每天重读纪律/交接/INDEX 正是此形。
- 可搬点：`PreCompact/PostCompact` 双 hook 压缩前后各存一次关键约束；`/mcp-audit` 审计 MCP 开销。
- 核心原则：**已读且本会话未变更的文件不再读；复核只读变更片段**。与 sqz"重读行范围省 87%"同一件事两面。
- 注意：① 该仓 **README 写 MIT 但 API `license` 为 null** → 借思路可以，复制代码前先确认授权；② 本机 hook 不通用 → 落地为"自我约束 + 交接写明本轮已读"。

## 4.7 答短（Say less）—— 最便宜的一档，但只有多轮才省钱（2026-11-06 收录）

- 来源：`JuliusBrussee/caveman`（117930★，Apache-2.0）。
- 五条可照抄的输出纪律：① **先给答案** `[对象][动作][原因].[下一步]`，去掉问候/"让我先看看"/复述；② **一句一个意思**、主动语态、一物一名（源自 ASD-STE100，≤20 词）；③ **语义不能丢**：`不/从不/没有/只有` 与数字单位永远保留；④ **载荷逐字不动**：代码、命令、路径、报错；⑤ **该长就长**：安全警告、不可逆操作、用户明显困惑时用完整句。
- 数字（官方 A/B）：十个开发问题上 opus-5-5 输出 token —— 无指令 6,983 / "Answer concisely." 4,334 / caveman 4,119 / 激进档 2,693 → **"简洁"才是真基线**，caveman 只再省 3%；规则本身花约 1,160 输入 token。
- **省钱前提**：① 只在**按 token 计费**时省（按请求计费不受益）；② **单轮问答不省反亏**（规则成本 > 省下的输出）；③ Adobe 实测：**把用户 prompt 也改成电报体会让答案变差** → **只约束输出格式，永不动 prompt**
- 何时别用：教学/复盘需完整解释；法务逐字留存；脚本依赖固定措辞（4.7/4.8 同）

## 4.8 按难度分配推理档位（effortless，2026-11-09）

- 来源：`HeyCubit/effortless`（331★，MIT，Claude Code 插件）——每条 prompt 自动判难度 → Low/Med/High/xhigh。
- 数字（作者自测）：比"官方建议 medium"省 **21%**、high 省 **29%**、xhigh 省 **42%**，答案仍全对；判档用 ~1s 的小模型。
- **可照抄**：查语法/改字段名走低档，重构/追并发 bug 走高档；**判档成本须远低于省下的钱**。
- **最值钱的坑**：自动切便宜模型默认关闭，因**每个模型各有一份 prompt 缓存**，会话在跑时切模型往往比省的钱更贵 → 与 §4.5 同一条规律：**只切档，不切模型**。
- 何时别用：单轮任务摊不平判档开销；正确性零容忍且无法复核。

## 5. book-to-skill —— 把书/文档变成技能（产物层）

- https://github.com/virgiliojr94/book-to-skill ｜ MIT ｜ Python ｜ 有简体中文 README
- PDF/EPUB/DOCX/MD/HTML/RTF/MOBI → 符合 Agent Skills 开放标准的技能；比把整本书塞进上下文少 **24×–51×** tokens
- 客户端含 Claude Code、Codex、OpenCode、**OpenClaw**
- 用法：转出的技能**必须二次对齐本库命名规范**，多半是 `references/` 分章结构，正合"加索引比删内容划算"

## 6. 本机落地顺序（2026-11-09 按实测账单重排）

1. **先拆账单**（§8）→ 拿到「输入重读 / 工具输出 / 未命中缓存 / 模型输出」占比，**不要盲装**。
2. 本机钱在每轮重读上下文（输入 99.7%）→ 以 `billion-context` + `dsh-cost-meter` 为主；工具输出压缩用"少读"提示纪律（零安装）；`dsh-compressor@0.1.0` 被 DSH `0.2.2-rc.1` 版本门禁拒绝，不豁免；输出侧插件跳过。
3. `cost-xray` 作跨客户端（Claude Code / Codex）观测层保留，DSH 上不重复装。
4. `sqz`/`headroom` 仅在有「重复输出 / 超大 JSON」证据时试，先关遥测；**同一台机器不要同时上两个改写工具输出的 hook**。
5. §4.7 零安装写进 AGENTS.md，单轮别用；§4.8 是同一思路的模型侧——按难度分档，**只切档不切模型**。
6. `book-to-skill` 先转 1 本验证命名；**压缩工具永不改写纪律/持仓 memory**。

## 7. Reflexion

**失败教训**
- **抓 README**（11-02）：`raw.githubusercontent.com/{o}/{r}/main/` 常 404（默认是 `master`）→ 先查 `default_branch`；`search?q=topic:A+OR+topic:B` 返 **422** → 多 topic 分开查；本机 `curl github.com` 返 **000**，只有 API 可达。
- **检索盲区**（11-03）：billion-context 的 topic 只有 `dsh-plugin`、不是 `SKILL.md`，被"只收技能"漏掉 → **"是不是 skill"不能当门槛**。
- **不看账单就装 = 装错**（11-09）：`DSH Thinking Levels` 在本机几乎零收益，因输出只占 0.3% → **选型前必须量化占比**。
- **口播插件名 ≠ npm 包名**（11-09）："DSH Shops" 两轮无对应包 → 别换词反复搜，选已核实的等价方案并写明替代；**选完还要过版本门禁**（`dsh-compressor@0.1.0` 被 `0.2.2-rc.1` 拒绝，别写进"已装"）。

**何时别用**
- 纯短对话/散文为主的流程（压缩率≈2%，白折腾）；需逐字引用的合规场景（AST 会动代码形态）；不允许常驻进程的沙箱
- **不要用压缩工具处理 memory / 纪律文件**：那是唯一不能失真的东西

## 8. 先测再装：本机账单实测反例（2026-11-09）

**硬规则**：装省 token 插件前先拆账单，定位钱落在「输入重读 / 工具输出 / 未命中缓存 / 模型输出」哪一块，别盲装。

- 本机结论：输入 **99.7%** / 输出 **0.3%**、`$32.386`（617 次）；缓存命中 97.3% 却仍每步重读 22 万 token → 钱在**每轮重读上下文**，输出侧插件零收益。
- 完整数字表 / 归因脚本 / 三个坑 / 插件动作 → `references/账单归因.md`（按需读，别整份通读）。
