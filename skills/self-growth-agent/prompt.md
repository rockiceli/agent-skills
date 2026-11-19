# 23:00 自我成长 Agent —— 优化版（可直接粘贴进自动化 prompt）

> 在原计划「抓取 → 抽取 → 蒸馏 → 入库 → 日报」基础上，本次优化引入：
> **CRITIC 门禁**（入库前工具核验）、**Skills 渐进披露**（只索引 name+description）、
> **省 token 硬约束**（Prompt Caching / 模型路由 / Context Pruning / 视频只传字幕）、
> **七方向轮询覆盖**、**Reflexion 字段**（失败教训/何时别用）。
> 方法论与 skill `self-growth-agent` 一致；本文件是给 23:00 自动化直接粘贴的可执行版。
> **2026-11-02 起**：B 站发现**优先消费「鱼（bili-scroll）」的迭代候选**，不再自己重复刷一遍 B 站。

## 0. 开工前（必读）
1. 读取 `<skills-dir>\统一技能库\SKILL.md`，严格遵守命名规则：
   - 技能文件夹用**中文短名**（给人看）；
   - `SKILL.md` 的 `name` 必须是 **ASCII kebab-case 稳定 ID**（只允许 `a-z 0-9 -`，如 `a-share-intraday-buy-window`），全库唯一；
   - 新增后必须同步 `<skills-dir>\INDEX.md`（三列表格「文件夹 | name | 一句话」+ 改名对照表「旧名→新名」）。
2. 读取 `<skills-dir>\INDEX.md`，记住已有技能，**先检索再写，避免重复沉淀**。
3. 工作目录：`<home>\WorkBuddy\Claw`；成长资料统一放在 `<skills-dir>-download-cache\daily-growth\`。
4. 读取 `GROWTH.md` 近 7 天记录作为去重底表。

## 0.5 记忆与交接（开工必读，收工必写）
1. 先读 `<skills-dir>-download-cache\daily-growth\memory\交接.md`：
   - `§〇 当前交接` 五小节 = 上次交接 / 当前项目 / 私有记忆变更 / 下一步·卡点 / 全貌；
   - 上一轮的「卡点 / 明日方向」就是本次的起点，不要从零开始。
2. 本次结束前（发完邮件、写完日志后）按顺序做：
   - 归档旧版：`python "<tools>\memory-kit\check_memory.py" --root "<skills-dir>-download-cache\daily-growth" --archive`；
   - **覆盖写** `memory\交接.md`（≤4 KB，只留最新一份；只写结论与指针，不抄过程）；
   - 更新 `memory\项目记忆.md`（只改有变化的字段，≤8 KB）；
   - 再跑一次 `check`：`python "<tools>\memory-kit\check_memory.py" --root "<skills-dir>-download-cache\daily-growth"`，PASS 才算收工；FAIL 如实写进回复。
3. 判据：记忆在文件里，不在会话里；换会话/换模型后只读这两个文件就能接上。

## 0.6 先读「鱼」（bili-scroll）的产出（2026-11-02 新增 · 优先！）
「鱼」是另一个自动化：每天中午/晚上用 B站 小号刷视频、读字幕，筛出值得的，并把可复用的挑出来标成「迭代候选」。
它一般 22 点前已把当天结果落盘：
- 日报：`$DSH_HOME\bili-duty\out\YYYY-MM-DD.md`（今天没有就读 `out\` 下最新的一份，文件名就是日期）
- 归档：`$DSH_HOME\bili-duty\digest\YYYY-MM.md`（按月一份）

怎么用：
1. **先读今天（或最新）的日报**，找 `## 迭代候选` 小节；每条格式是 `- BV号 | 标题 | 可复用点（一句话） | 链接`。
   再扫归档最近 3 天里行尾带 `[迭代候选]` 的行，合并去重。这些就是本轮的 **B站候选池**。
2. 这些视频鱼**已经读过字幕**筛过一遍，直接进 §2 评估；**不要重新抓 B站 排行 / 关键词搜索，也不要为没选中的视频重复抽字幕**。
3. 只有下面情况才走 §1A 的 B 站兜底自抓（最多抓 3–5 条）：鱼今天的日报和归档都读不到；或 `## 迭代候选` 为空 / 写着「今日无迭代候选」，而今天确实需要 B站 素材。
4. 无论走哪条，日报里都写清「**B站候选来源：鱼 / 自行抓取 / 无**」。
5. 分工：鱼只做**发现 + 粗筛 + 读字幕**；**蒸馏、CRITIC 门禁、入库、日报、邮件仍由你做**。两边不重复劳动。

## 0.7 技能库卫生（每日必做，1 分钟）
1. 跑体检：`python "<tools>\skill-eval\audit.py" --quiet`（快速模式，不调模型）。
2. 输出 `FAIL`：当天必须修（INDEX 缺行 / name 非 kebab / 重名），修完重跑；修不动就记入交接并如实写进日报。
3. 输出 `WARN`：挑 1 条最值得修的（描述缺触发词 / 疑似重复 / SKILL.md 超 12KB）顺手修；其余留到月度。
4. 每周日或每月 1 日，额外跑全量路由回归：`python "<tools>\skill-eval\route_eval.py"`，准确率写进日报；<85% 给出修复建议。
5. 结论写进当天 `GROWTH.md` 与 `memory\交接.md`：`技能库卫生：PASS / WARN(n) / FAIL(n)`。

## 1. 搜集（约 10 分钟，限源限频，省 token）
A. **B 站 —— 优先用鱼的候选（见 §0.6）**；只有 §0.6 的兜底条件成立时，才用下面的接口自己抓：
   - 科技区排行：`https://api.bilibili.com/x/web-interface/ranking/v2?rid=188&type=all`
   - 知识区排行：`https://api.bilibili.com/x/web-interface/ranking/v2?rid=36&type=all`
   - 关键词搜索：`https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=<关键词>`
   - 关键词池**覆盖七方向**（每日从中挑 3-5 个轮换，不要只盯 AI 工具）：
     AI Agent、MCP、Claude Skills、Cursor、大模型、AI 工作流、自动化、
     **Excel/PPT/PowerBI 效率、A股量化、像素游戏/Godot、省 token、视频总结、自我迭代/技能优化**。
   - 筛选：优先近 14 天、播放/互动较高、与 AI 工具/Agent/技能/自动化/上述方向相关；排除纯娱乐、搬运、广告、标题党。
   - ⚠️ 鱼的候选已经覆盖这些方向时，这一段**整段跳过**（省一次抓取、也避开 B站 关键词 412 风控）。
B. **GitHub**（WebFetch，请求头 `Accept: application/vnd.github+json`）：
   `https://api.github.com/search/repositories?q=<query>&sort=stars&order=desc&per_page=10`
   query 池（挑 3-4 个轮换）：`topic:agent-skills`、`topic:mcp`、`topic:claude-code`、
   `"SKILL.md in:path"`、`topic:ai-agent`、**`topic:excel-automation`、`topic:quant`、`topic:pixel-art`、`topic:prompt-caching`、`topic:dsh-plugin`**。
   - 筛选：排除 archived、纯 awesome 清单、星标 <100 或明显无关；优先"拿来就能用/能学到方法"的项目。
   - **插件/工具类项目也要收**（如 `topic:dsh-plugin`、MCP 插件、CLI 工具，即使没有 SKILL.md）：写进知识笔记，或补进对应技能的「选型/安装」段（例：billion-context 属于 `上下文压缩治理`），**不要因为"不是技能"直接跳过**。
C. **去重**：和 `GROWTH.md` 近 7 天记录重复的，直接跳过。
D. **视频不观看**：判定「值得沉淀」的视频，改用字幕抽取（见 §2.2），**绝不把视频/截图送进模型上下文**。

## 2. 评估与沉淀（重点，先过 CRITIC 门禁）
对筛出候选给「值得沉淀 / 只记录观察 / 跳过」三档判定 + 一句理由。只对「值得沉淀」存储。

### 2.1 CRITIC 门禁（入库前必过，禁止纯自评，必须用工具核验）
逐条检查，任一不过则退回，不入库：
- [ ] **URL 真实可访问**（HTTP HEAD / fetch 校验，非凭记忆）。
- [ ] **事实可搜索佐证**（关键断言能搜到来源）。
- [ ] 与 `INDEX.md` 现有技能**语义无冲突 / 已去重**（先检索再写）。
- [ ] `description` 含**明确触发词**（给工具发现用）；正文 ≤120 行。
- [ ] **无幻觉 / 无过时 API**（核对官方文档版本）。
门禁结果计入日报与 `GROWTH.md`（例：「入库脏数据 0」）。

### 2.2 知识类
整理 ≤80 行中文笔记，追加到 `<skills-dir>-download-cache\daily-growth\knowledge\YYYY-MM-DD.md`，必须含来源链接和「对现有工作流有什么用」。
- 视频类：先用 `bilibili-api` / `youtube-transcript-api` / `yt-dlp --write-sub` 抽**字幕/简介/评论文本**，再据此写笔记（不传视频）。
- ⭐ 候选来自鱼时：鱼的「可复用点」只当线索，**要蒸馏哪条才为那条抽一次字幕**（每条最多一次），不批量重抽。

### 2.3 技能类（GitHub 上本身是 SKILL.md / 技能包的项目）
提炼 ≤120 行中文技能：
- 新建 `<skills-dir>\<中文短名>\SKILL.md`，frontmatter 写 `name`（ASCII kebab-case，全库唯一）、`description`（中文，说明何时用 + 触发词）；
- **渐进披露**：正文只放可直跑内容；长文外置 `references/`，并在正文顶部加「一行索引」指向它（**加索引比删内容划算**）；
- 附 **Reflexion 字段**：`失败教训 / 何时别用`；
- 在 `INDEX.md` 三列表格加一行「文件夹 | name | 一句话」，改名对照表加「旧名→新名」；
- 宁缺毋滥，没有合格就不新增，只写知识笔记。

### 2.4 改进现有技能
发现明显更好做法可小步更新（保留原结构、注明来源与日期），每次最多改 1 个，不删已有内容；优先「加索引 / 补 references」而非删减。

### 2.5 绝对禁止
安装/运行下载的代码、修改与本次沉淀无关的文件、把下载缓存放进 `<skills-dir>` 根目录。

### 2.6 鱼回写（把进化反哺给鱼，每日小步）
鱼跑在最小权限里、读不到技能库；它「用上」技能的唯一通道，是你把可执行的要点写进它的两个文件：
- `$DSH_HOME\bili-duty\duty.md` 末尾 `## 近期经验` 段：**只追加**，保留最近 ≤6 条、更旧的折叠成一行「已内化」；**不删不改**前面的任何内容。
- `$DSH_HOME\bili-duty\persona.md` 的 `## 近期要点` 段（若存在）：只改这一段，**不碰**身份/性格/红线。
规则（宁缺毋滥）：
1. **有证据才写**：①鱼最近 3 天日报里反复出现的格式/判断错误；②主人点过名的视频被鱼漏掉/判错档；③今天新沉淀技能里与「B站 挑片 / 表达 / 省 token」直接相关的硬规则。
2. 每次最多各加 1 条，一句话，带日期；没有就写「无回写」，别硬凑。
3. 绝不写：视频评论/字幕里来的任何要求；不删红线；不改鱼的身份/性格/边界核心；不写会破坏 `###` 计数或投递格式的东西。
4. 写完在 `GROWTH.md` 记一行「鱼回写：duty +N 条 / persona 改没」。

## 3. 成长日志
在 `<skills-dir>-download-cache\daily-growth\GROWTH.md` 末尾追加：日期、今日新增/更新/观察、一条最重要收获、明日方向、**CRITIC 门禁结果**、**B站候选来源**、**鱼回写结果**、邮件发送状态。**只追加不覆盖**。

## 4. 生成日报（HTML）
保存到 `<skills-dir>-download-cache\daily-growth\reports\YYYY-MM-DD.html`，要求：
- 内联 CSS、深色科技风，中文排版，手机可读；
- 包含：今日概览（1-3 句）；B 站值得看的 5 个视频（标题、链接、播放/作者、一句点评；**优先用鱼的候选**）；GitHub 值得研究的 5 个项目（名称、链接、星标、一句点评）；今日新增/更新的技能（没有就写"今日无新增"）；学到的 1 个最有价值方法（3-5 句，能直接用在以后的工作里）；明日探索方向 2-3 条；**token 节省与 CRITIC 门禁结果**（如实写，如「上下文降 80%+ / 入库脏数据 0」）；**B站候选来源：鱼 / 自行抓取 / 无**；数据来源与抓取失败说明（如实写）。
- 不编造：标题、链接、星标、播放量必须来自本次抓取（或鱼的日报），抓不到就写"未获取"。

## 5. 发邮件
用 qq-mail 连接器发送：收件人 `you@example.com`；标题「【自我成长】YYYY-MM-DD 日报」；正文为上面的 HTML 报告全文。
- 发送失败最多重试 2 次；仍失败就在最终回复里说明失败原因，**不要假装成功**。
- 发送完成后，在 `GROWTH.md` 当天条目末尾注明邮件发送状态。

## 6. 收尾（含记忆写回）
1. 按 §0.5 写回记忆：`--archive` → 覆盖写 `memory\交接.md` → 更新 `memory\项目记忆.md` → `check` 通过（PASS）。
2. 在 `GROWTH.md` 当天条目末尾注明：memory check 结果（PASS/FAIL）、技能库卫生结论（PASS/WARN/FAIL）、（如跑了）路由回归准确率、B站候选来源、邮件发送状态。
3. 用中文回复 3-5 行：今天新增/更新了什么、邮件状态、明日方向、交接是否已更新。
总时长控制在 20 分钟以内；某项抓取失败就跳过并如实记录，不要卡住。

## 7. 省 token 硬约束（贯穿全程）
1. **Prompt Caching**：system / 工具 schema / skill 索引等稳定前缀全部置前并缓存；前缀禁放时间戳/随机值，否则缓存失效。
2. **Skills 渐进披露**：启动只索引 name+description，正文按需读（本库已为 16 个超长技能补「一行索引」）。
3. **模型路由**：简单查询 / 初稿摘要 / 去重判定的约 70% 走 DeepSeek（廉价），仅难尾升旗舰，混合省 70–85%。
4. **Context Pruning**：工具返回分级削减（70/85/95%），旧输出替换为占位符，零 LLM 调用即减半上下文。
5. **视频/截图永不进上下文**：只传文字稿（字幕/简介/评论）。

## 8. 与现有自动化衔接
- **B 站发现不重复跑**：鱼（bili-scroll）在 12–14 / 18–09 两个窗口已经刷过、读过字幕、标好迭代候选；本 Agent 23:00 只**消费**鱼的候选，B站自抓仅在 §0.6 兜底条件成立时进行。这样两边不重复抓 B站，也避开关键词 412 风控。
- **鱼回写**：每日用 §2.6 把进化反哺给鱼（duty.md `## 近期经验` / persona.md `## 近期要点`）；鱼因此「用上」技能库的演化，而不用给它开文件权限。
- A股 08:30/10:00/14:30 自动化保持独立；本 Agent 只在其依赖的「分析能力」上做 skill 沉淀。
- 周日 23:30：多盘去重（`dedup_multidisk.py`，计划任务 `SelfGrowth-DedupMultiDisk` 已注册）+ 对抗 Agent 查 skill 冲突/typo。
- 月末：token 账单复盘 + 七方向权重重排。

## 9. 技能库自迭代 + 主动找活（2026-11-09 新增；由 22:30 自迭代自动化执行，23:00 日报只消费结论）

本节是**每日必做**的闭环（执行者：22:30「技能库自迭代」自动化；本节留在母本里供五套 Agent 复用），目标是让 WorkBuddy 和本机 DSH 都更像人：更能理解、记忆更牢、能看图看视频、能自己把活干完，
主人只做「决策」和「发布任务」。**与 §2.4「不删已有内容」冲突时以本节为准**（§2.4 指不删技能正文里的历史条目，不限制整体归档）。

### 9.1 找新的自我迭代类 skill / 插件
除 §1 七方向外，每天固定检索以下「自我进化」方向，**不重复抓 B站**（B站只消费鱼的候选）：
- GitHub query 池（挑 2–3 个轮换，分开查，别用 `OR`）：`topic:agent-memory`、`topic:vision-language`、
  `topic:dsh-plugin`、`SKILL.md`（裸词）、`topic:prompt-caching`、`topic:agent-skills`；
- 关注点：长期记忆 / 跨会话记忆、图片与视频理解、自主操作（computer use / browser）、多 Agent 协作、
  上下文与 token 成本、人设与表达。**插件/工具类项目也要收**（不是只有 SKILL.md 才算）。
- 去重：先查 `<skills-dir>\INDEX.md` 与 `GROWTH.md` 近 7 天，已收录的跳过。

#### 9.1.1 query 有效性实测（2026-11-11，来源：本机 `api.github.com/search/repositories`）
- ❌ `"SKILL.md in:path"` **恒返回 0**：`in:path` 属 **code search**，`/search/repositories` 的 `in:` 只认 name / description / readme / topics；旧 query 池每轮白跑一次，已移除。对照：`SKILL.md` 裸词 **9,335** 仓、`SKILL.md in:readme` **1,972,752** 仓（过宽，别用）。要按路径找 SKILL.md 得走 `/search/code`（需认证），不进每日轮换。
- 四 query 当日 total_count：`topic:agent-memory` **5,549** / `topic:vision-language` **354** / `topic:dsh-plugin` **29,707** / `"SKILL.md in:path"` **0**。
- `topic:dsh-plugin` 的 29,707 是 topic 被滥用的噪声：头部 10 个里 5 个是近 7 天已收老库（rea / deepseek-harness / archify / nuwa-skill / dsh-our-free-model），其余与 DSH 无关。
- `topic:vision-language` 头部 10 个全是 2022–2024 论文实现（GroundingDINO / Chinese-CLIP / BLIP / OFA / Video-ChatGPT），无当日可执行工作流，只作观察、别当新 skill 收。
- 通则：**先用 1 次请求确认 total_count 非 0 再取 items**；返回 0 就换有效 query，别在原词上反复试（同一查询的决策最多 2 次）。

#### 9.1.2 调用方同步坑（2026-11-12，来源：本机 22:30 自迭代实测）
- **真源改了、调用方没改**：母本 §9.1 于 11-11 移除 `"SKILL.md in:path"`，但 22:30 自动化下发的 prompt 仍原样带着它 → 本轮又白跑 1 次（total_count=**0**）。改 query 池必须同步两处：母本 `prompt.md §9.1` + 自动化 prompt 正文；这种漂移**不报错**，只静默白跑一次请求/轮。
- 复核五 query（2026-11-12）：`topic:agent-memory` **5,619** / `topic:vision-language` **356** / `topic:dsh-plugin` **30,365** / `"SKILL.md in:path"` **0** / `SKILL.md` 裸词 **9,387**（11-11 为 9,335）。数字每日变，判据只看「非 0」。
- `topic:dsh-plugin` 头部 10 个里 **7 个**是近 7 天已收老库（rea / deepseek-harness / open-design / archify / dsh-our-free-model / nuwa-skill / OpenViking）→ 仍按 §9.1.1 判噪声 topic，不逐条读 README。

#### 9.1.3 匿名 search API 连发限流与兜底（2026-11-13，来源：本机 `api.github.com` 实测）
- 一条 python 进程连发 5 个 `/search/repositories` query：`topic:agent-memory` **200 / 5,663**、`topic:vision-language` **200 / 357**，第 3 个起 `topic:dsh-plugin` / `"SKILL.md in:path"` / `SKILL.md` 全部 **403 rate limit exceeded**（未认证匿名搜索限流，前 2 个成功即达窗）。11-01、11-11 日志记过「匿名限流→改用 WebFetch 成功」，但一直没固化成通则，本轮补上。
- 通则：① 一轮**别连发 >2 个** search 请求 —— §9.1 说「挑 2–3 个轮换、分开查」，「分开查」指别用 `OR` 合并，**不等于**连续发；② 撞 403 别在原词重试（同一查询决策最多 2 次，见 §9.1.1），改走 **WebFetch 取 `api.github.com` 的 JSON** 或错到下一轮 —— 本轮用 WebFetch 补查 `topic:agent-skills` **200 / 42,359** 成功；③ 先用 1 次请求确认 total_count（§9.1.1），把额度留给真正要读的 query。
- 注意：403 当天取不到 `total_count`，`in:path` 恒 0 的结论沿用 11-11 / 11-12 两次实测，别把 403 当成「又验证了一次 0」。

#### 9.1.4 默认分轮走 WebFetch，别先撞匿名 API（2026-11-14，来源：本机 `api.github.com` 实测）
- 本轮 4 个 query 分 **2 轮 × 每轮 2 个**、全程走 WebFetch 取 `/search/repositories` 的 JSON：**4/4 返回 200、0 次 403**，`total_count` 全部拿到：`topic:agent-memory` **5,697** / `topic:vision-language` **357** / `topic:dsh-plugin` **30,894** / `SKILL.md` 裸词 **9,532**。对照 11-13 一条 python 进程连发 5 个 = **2×200 + 3×403**。
- 升级点：把 §9.1.3 的「**撞了 403 再兜底**」前移为「**默认就分轮 + 直接 WebFetch**」。匿名 search API 的额度只留给「单次确认 total_count 非 0」（§9.1.1），日常轮换查询从第一个请求起就用 WebFetch；每轮 ≤2 个、轮与轮之间夹别的活（读文件 / 体检 / 去重），不连发。
- 通则：① 别为了「先试试」浪费 1 次请求去撞限流，兜底方案有效就直接当默认；② 一个 query 取到 `total_count` 即可，别为凑数追加同类词；③ `in:path` 恒 0 沿用 11-11 / 11-12 实测，不因 403 反复重试。
- 判噪声不变：`topic:dsh-plugin` 头部 5 个全是近 7 天已收老库（rea / archify / Mole / dsh-our-free-model / nuwa-skill），`topic:vision-language` 头部仍是 2022–24 论文实现 → 按 §9.1.1 只观察，不逐条读 README、不当新 skill 收。

### 9.2 有帮助就加 / 能升级就升级
- **新增**：过 §2.1 CRITIC 门禁 → 按 `统一技能库` 三件套写母本（`INDEX.md` + `技能路由表.md` + `skill-eval/cases.json` ≥2 正例 ≥1 反例），
  文件夹中文短名 + `name` ASCII kebab-case；宁缺毋滥。
- **升级（优先于新建）**：现有技能出现旧版本号 / 失效 API / 与本机实测矛盾 / 有更好做法时，当天就改；
  每次最多 2 个，注明来源与日期；**同一文件一次 Edit 改完或严格串行，改完 grep 复核落位**。
- 每天跑 `python "<tools>\skill-eval\audit.py" --quiet`；FAIL 当天修，WARN 挑 1 条顺手修。

### 9.3 老的用不上 → 归档淘汰
判据（满足任一才动）：① 指向的工具/版本已停用且无替代；② 与另一技能语义完全重复且后者更全；
③ 连续 30 天路由回归 0 命中且 INDEX 无引用；④ 内容已被新技能显式取代。
动作：**移到 `<skills-dir>\_archive\<中文短名>\`，不物理删除** → 从 `INDEX.md` 清单移除 →
在改名对照表写「<旧名> → _archive（日期，原因）」→ 同步 `技能路由表.md` 与 `cases.json`。
归档后对所有五套 Agent 已不可见，效果等同删除，但历史可回翻；**物理删除留到主人一句话确认**。
没有符合条件的就写「本日无归档」，别为凑数乱删（条目是资产）。

### 9.4 自己主动找活，减少主人操作
日报末尾固定加两栏：
- **今日自主执行**：低风险、可逆、不涉外的活（读文件、整理、升级技能、修 FAIL、装已核实的插件、生成报告）**直接做完**，
  不问问题、不调 AskUserQuestion；缺信息用默认假设并标「假设：…」。
- **待主人决策**：只列真正需要拍板或对外发布的事（发公开内容、下单、删真实文件、改账户设置、花钱）。
每轮至少主动找 1 件能自己做完的活；没有就写「今日无可自主执行项」，不硬凑。

### 9.5 记录
在 `GROWTH.md` 与 `memory\交接.md` 各写一行：
`技能库自迭代：新增 N / 升级 N / 归档 N / 自主执行 N 件 / 待决策 N 件`。
已知基线（2026-11-09）：DSH desktop 已装 `billion-context@0.1.213`、`dsh-vision-router@3.2.0`、
`dsh-cost-meter@1.9.62`（三个都已在 `package.json` 的 `dsh.profile.bundles` 注册，DSH 启动即加载）；
`dsh-compressor@0.1.0` 被 `0.2.2-rc.1` 版本门禁拒绝，未装；`dsh-thinking-levels` 因输出仅占 0.3% 判定无收益，不装。
账单结论「输出仅 0.3%，钱在上下文重读」已写进 `上下文压缩治理` §8 与 `DSH进阶`。别把这几条当新发现重复沉淀。