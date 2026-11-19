---
name: self-growth-agent
description: 每日自我成长流水线：抓取、蒸馏、CRITIC门禁、入库、日报，含prompt caching、渐进披露、模型路由。当配置或优化23:00成长Agent、22:30技能库自迭代、技能改动过验证门禁、路由回归准确率骤降判测量故障、GitHub query 白跑/调用方同步漂移/匿名API连发403限流兜底/默认分轮WebFetch时使用。
agent_created: true
---

# 自我成长自动 Agent（升级版）

> 完整可粘贴进 23:00 自动化的 prompt 见同目录 `prompt.md`（与七方向成长计划对齐：CRITIC 门禁、七方向轮询、视频只抽字幕、模型路由、渐进披露）。

## 概述

本技能把"自我成长"从「被动收藏」升级为「主动进化闭环」：
**抓取 → 抽取 → 蒸馏 → CRITIC 门禁 → 入库 → 日报**。
覆盖 7 个方向：文件处理自动化 / 办公效率(Excel·PPT·PowerBI) / 股票分析 / 像素游戏开发 / 省 token 方案 / 视频极简总结 / 自我迭代与 skill 优化。

适用：23:00 每日定时 Agent；或多 Agent（WorkBuddy·DeepSeek·Codex·Claude Code·Cursor）共用 `<skills-dir>` 母本的场景。

## 触发条件

- 用户说"自我成长"、"每日成长 Agent"、"优化成长计划"、"23:00 自动化"
- 自动化任务（建议 automation id 挂本技能）在每日 23:00 执行
- 任何需要"把优质内容沉淀成可复用 skill 并发日报"的场景

## 执行流程

### 1. 抓取（7 方向）
优先从 GitHub、B站、arXiv、官方文档检索；每方向限源、限频，避免浪费 token。
记录每条候选的：来源 URL、方向标签、原始要点。

### 2. 抽取（视频一律走字幕流水线，不传视频）
- B站：`bilibili-api` 取字幕/简介/评论（纯文本）。
- YouTube：`youtube-transcript-api` 或 `yt-dlp --write-sub`。
- 无字幕：本地 `whisper` small 转写（仅传文本给 LLM）。
- 文档：`markitdown` 转 Markdown 后再处理。
- **原则：永远把文字稿而非视频/截图喂给模型。**

### 3. 蒸馏
- 用**廉价模型（DeepSeek）**做初稿摘要与去重判断；仅难尾升旗舰。
- 蒸馏产物：一条 skill 候选（name/description+触发词 + 正文 ≤500 行，长文外置 `references/`）+ 一行索引。

### 4. CRITIC 门禁（入库前必过）
用工具客观核验，禁止纯自评：
- URL 真实可访问（HTTP HEAD / fetch 校验）；
- 事实可搜索佐证；
- 与 `<skills-dir>` 现有 skill **语义无冲突 / 已去重**（Voyager 式检索）；
- `description` 含明确触发词。
任何一项不过 → 退回，不入库。

**§4.1 蒸馏他人的"思维"时补三道门（2026-11-07 来自女娲.skill）**
人物/方法论类 skill 最容易写成"角色扮演"，加这三条才算可入库：
1. **三重验证**：一个观点要收成"心智模型"，必须 ① 跨 2+ 个领域出现过；② 能推断他对**新问题**的立场（有预测力）；③ **不是所有聪明人都会这么想**（有排他性）。三条全过才收。
2. **诚实边界**（写进正文，不写在附录）：蒸馏不了直觉、只是调研时间点的快照、公开表达 ≠ 真实想法。
3. **反向测题**：拿 1 个他**没公开讨论过**的问题去问，合格表现是"适度不确定 + 说清为什么不猜"，不是斩钉截铁。
判据一句话：**一个不告诉你局限在哪的 skill，不值得信。**

### 5. 入库（渐进披露 + 只追加）
- 新 SKILL.md 顶部强制 `name/description`（~100 token），正文按需读；
- 长文加「一行索引」指向 `references/`（加索引比删内容划算）；
- 附 **Reflexion 字段**：`失败教训 / 何时别用`；
- 日志与审计**只追加不覆盖**；新 skill **先试跑验证再提交**。

### 6. 日报
产出当日：新增/修订 skill 清单、各方向 token 节省估算、待办。数字优先（如"上下文降 80%+""视频总结 token 降 ~95%"），不给形容词。

### 7. 记忆与交接（v2，强制 —— 来自淋雨家工作台方法）
记忆**不放在会话里**，放在 `<skills-dir>-download-cache\daily-growth\memory\`：

| 文件 | 作用 | 红线 |
|---|---|---|
| `交接.md` | §〇 当前交接（上次交接 / 当前项目 / 私有记忆变更 / 下一步·卡点 / 全貌），**覆盖写** | ≤ 4 KB |
| `项目记忆.md` | 一个项目一份：状态 / 一句话 / 成果证据 / 下一步 / 坑 / 已有档案 | ≤ 8 KB |
| `archive/` | 历史交接，**只进不改** | — |

每次运行必须：
1. 开工先读 `交接.md`（上一轮的卡点/明日方向 = 本次起点）；
2. 收工前：`python "<tools>\memory-kit\check_memory.py" --root "<skills-dir>-download-cache\daily-growth" --archive` → 覆盖写新交接 → 更新项目记忆 → `check` PASS 才算收工；
3. 只记结论与指针（≤10 行），过程留在当轮对话；细节留在 `GROWTH.md` / `knowledge/` / `reports/`。

本技能同目录 `prompt.md` 是给 23:00 自动化直接粘贴的可执行版；**改完必须同步**（否则自动化仍跑旧版）：

```powershell
python "<tools>\workbuddy-sync\sync_growth_prompt.py"
```

同步器会更新 WorkBuddy 自动化 DB prompt、备份 JSON、daily-growth 副本，并回读校验（`--check` 只检查漂移）。

### 8. 技能库卫生（每日，1 分钟）
- `python "<tools>\skill-eval\audit.py" --quiet`：FAIL 必须当天修（INDEX 缺行/name 非 kebab/重名），WARN 挑一条顺手的修；结论写 `GROWTH.md` 与交接。
- 每周日/每月 1 日：`python "<tools>\skill-eval\route_eval.py"`（全量路由回归，WorkBuddy 免费模型），<85% 要修描述/加反例。
- 新增技能三件套：`INDEX.md` + `技能路由表.md` + `<tools>\skill-eval\cases.json`（≥2 正例、≥1 反例）。
- GitHub 检索先验证 query：`"SKILL.md in:path"` 在 `/search/repositories` 恒 0（`in:path` 属 code search），2026-11-11 实测已移除 → 见 `prompt.md` §9.1.1。
- 改 query 池必须同步两处（母本 §9.1 + 自动化 prompt 正文）；否则真源改了、调用方没改，静默白跑一次/轮（2026-11-12 实测）→ 见 `prompt.md` §9.1.2。
- 连发 >2 个 query 撞匿名 403：改 WebFetch / 错轮（§9.1.3）；默认分 2 轮×2 走 WebFetch、4/4 200 零 403（§9.1.4）。

### 8.1 准确率骤降先判测量故障，别改 description（2026-11-10 复核）

来源：`microsoft/SkillOpt`（18,972★/MIT，2026-11-07 推送，README 原文 "trains reusable natural-language skills ... validation-gated updates"，产物 `best_skill.md`）+ 本机 `<tools>\skill-eval\` 实测。
**正面**：改一条 description / 加一个技能，先跑 `cases.json` + `route_eval.py` 回归再决定留不留 —— CRITIC 管「事实真不真」，验证门禁管「改完有没有变笨」，两者互补。
**反面**：11.8% 不是路由退化。11-09 06:43 那份 `route-eval-latest.json` 里 **76/76 用例 `error='timeout'`、`got` 全空**，只是旧版脚本把 negative 的 `expect=[]` 碰巧判通过（9/9），才凑出 9/76=0.1184。新版已修：`passed` 加 `and not error`、全部调用失败时 ABORT 且不写 latest；`audit.py` 也已标注「结果无效，勿据此改 description」。
**三步判据**：① `by_kind.positive` 是否 0/N；② results 里 `error` 是否全非空、`got` 全空；③ 引擎连通性（workbuddy headless CLI 会 60s timeout；需先 `ollama serve` 才有 `--engine ollama`）。满足任一 → **先修引擎再重跑，禁止动 description 或加反例**（拿脏数据改库）。
**何时别用**：引擎明确可用、用例与技能清单同步时，别拿这条当借口跳过回归。

## 省 token 硬约束（贯穿全程）

1. **Prompt Caching**：system / 工具 schema / skill 索引等稳定前缀全部置前并缓存；前缀禁放时间戳/随机值。
2. **Skills 渐进披露**：启动只索引 name+description，正文按需读。
3. **模型路由**：简单查询 70% 走 DeepSeek，仅难尾升旗舰，混合省 70–85%。
4. **Context Pruning**：工具返回分级削减（70/85/95%），旧输出替换为占位符。
5. **视频/截图永不进上下文**：只传文字稿。
6. **少写代码**：见 §9 七级阶梯——省输出 token 的同时少踩坑面，但校验/安全/可访问性绝不砍。

### 9. 产出侧的"最小完整改动"：少写代码反而更省（2026-11-08 收录）

前面五条都在省**读**，这条省**写**——省代码同时也省输出 token、少踩坑面。
来源：`DietrichGebert/ponytail`（186717★，MIT，2026-10 推送），一句话人设"最懒的资深开发"。

**七级阶梯（按顺序，第一个成立的就用）**：① 这东西需不需要存在（没人要的功能直接不做，一句话说明）；
② 本仓已有（helper / 组件 / 现成模式）就照周边写法用；③ 标准库或平台特性（浏览器自带日期选择器 > 自己画日历）；
④ 已装依赖；⑤ 能不能一行看懂；⑥ 再退到"最小可用"；⑦ 有分支/循环/解析/钱/安全的逻辑，**留一个小测试**。

**必守边界（绝不砍）**：信任边界的校验、防丢数据的错误处理、安全、可访问性、真实硬件校准、用户明确要的东西。
**收尾一行**：每次回复末尾写"我跳过了什么 / 没检查什么 / 有什么风险"。
**短注释约定**：已知限制写成 `shortcut: <限制>, <什么时候该升级>`。

官方自陈数字（同一 agent 加/不加该 skill，39 个任务 × 5 次，Opus 5.5）：代码行 -53%、耗时 -41%、成本 -26%、输出 token -45%；
而且**风险逻辑带测试的比例 98%（不加 68%）**——少写不等于少测。作者自己点明：**"不是最少 token 才叫好，是只写任务需要的那点"**。

**何时别用**：探索期/一次性脚本（求快不求省）；需要抽象留给后续扩展的框架代码；会掉安全/可访问性的地方（那不属于"省"）。
本机用法：写自动化脚本、日报生成器、检查器时先问第 ① ② 条——很多"新脚本"其实是仓库里已有的那几十行。


## 与现有自动化衔接

- **B站 不重复刷（2026-11-02 起）**：B站 发现交给「鱼」（`dsh-bili-scroll`，每天 12–14 / 18–09 用小号刷、读字幕、标 `[迭代候选]`），
  本 Agent 23:00 先读鱼当天的日报/归档（`~/.dsh/bili-duty/out/<日期>.md`、`digest/<月>.md`），只消费候选；
  鱼没跑成功/没候选时才兜底自己抓 B站（并避开 412 关键词风控）。两边**不重复抓、不重复读字幕**。
- **鱼回写（2026-11-04 起）**：鱼的进化回流也由本 Agent 做 —— 每日用「§2.6 鱼回写」把有证据的可执行要点追加进
  `~/.dsh/bili-duty/duty.md` 的 `## 近期经验` 段（只追加、有上限），需要时改 `persona.md` 的 `## 近期要点`；
  鱼因此**用上技能库的演化**，但不用给它开文件/skill 权限（保持最小权限）。
- A股 08:30/10:00/14:30 自动化保持独立；本 Agent 仅在其决策所依赖的"分析能力"上做 skill 沉淀（如接入 AKShare + TradingAgents-CN 的笔记）。
- 周日 23:30：czkawka 多盘去重 + 对抗 Agent 查 skill 冲突/typo。
- 月末：token 账单复盘 + 7 方向权重重排。

## 参考资源（已核验）

- Prompt Caching: docs.anthropic.com/en/docs/build-with-claude/prompt-caching · platform.openai.com/docs/guides/prompt-caching · ai.google.dev/gemini-api/docs/caching
- Skills 渐进披露: skill.md · designforai.dev/agent-skills · agentskills.io/specification
- 视频: github.com/nemo2011/bilibili-api · github.com/jdepoix/youtube-transcript-api · github.com/yt-dlp/yt-dlp · github.com/openai/whisper
- 自迭代: arxiv.org/abs/2303.11366(Reflexion) · arxiv.org/abs/2305.16291(Voyager) · arxiv.org/abs/2305.11738(CRITIC) · arxiv.org/abs/2311.11482(meta-prompting)
- 文件/办公: github.com/tfeldmann/organize · github.com/qarmin/czkawka · github.com/n8n-io/n8n · github.com/scanny/python-pptx · github.com/microsoft/markitdown
