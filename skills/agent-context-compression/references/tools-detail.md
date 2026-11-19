# 各工具详细参数与实测（sqz / headroom）

> 从主 `SKILL.md` 外置（2026-11-04，因正文超 12KB）。主文件只留选型与关键结论；要动手装或判读实测时读这里。

## sqz —— 去重压缩详细

- https://github.com/ojuschugh1/sqz ｜ Apache-2.0/MIT 双许可 ｜ Rust 单二进制 ｜ **零 LLM 调用 / 全离线 / 零遥测**
- 两招：①按命令定制的格式化器（只留失败测试、断言、`file:line`）②**13-token `§ref:HASH§` 去重引用**（已见过的内容不重发）
- 安装：Windows `irm https://raw.githubusercontent.com/ojuschugh1/sqz/main/install.ps1 | iex`；或 `npm i -g sqz-cli`
- 初始化：`sqz init --global`（写 `~/.claude/settings.json`）｜`sqz init --only codex` 只配某个客户端

实测（官方 3,003 次压缩，省 178,442 tokens，**平均 24.7%**）：

| 场景 | 省 |
|---|---:|
| 重跑未变的 `git status` | 78% |
| 重读已读文件的行范围 | 87% |
| 完全相同的测试输出 | 89% |
| 重复日志行 | 74% |
| 散文/文档 | 2% |
| 源码首次读 / 堆栈跟踪 / 凭证行 | **0%（安全模式透传，永不缓存）** |

- 自检：`sqz gain`（每日条形图）、`sqz stats --cost`（按 prompt cache 计费估钱）、`sqz doctor --fix`
- **"后悔信号"设计值得抄**：统计"2 分钟内字节相同的快速重跑"与"ref 展开次数"——这两个升高说明压缩掉了模型真正需要的东西

必踩的坑：

1. 部分模型（GLM 5.1 等）解析不了 `§ref:HASH§` → 死循环。救：`export SQZ_NO_DEDUP=1` 或 `sqz compress --no-cache`
2. `sqz init` 用 JSON 解析器往返配置文件，**会删掉 `.jsonc` 里的注释** → 在意就先备份
3. 引用仅在原文仍在上下文时有效（默认 1800s，`SQZ_REF_TTL_SECS` 可调）
4. 净收益 <16 tokens 直接跳过；会改变命令执行集合的改写会被放弃
5. "建议式"客户端（Cursor/Windsurf/Codex CLI/Zed）需 Agent 主动调 MCP 工具才生效，客户端内置 shell 会绕过

## headroom —— 语义压缩详细

- https://github.com/headroomlabs-ai/headroom ｜ Apache-2.0 ｜ 需 Python 3.11+
- 流水线 `CacheAligner → ContentRouter → CCR`：**SmartCrusher** 压 JSON（保留错误项/异常值/首尾）、**CodeCompressor** 基于 AST（Py/JS/TS/Go/Rust/Java/C/C++/C#/PHP）、**Kompress-v2-base** 压散文；**CCR 可逆**，模型可调 `headroom_retrieve` 取全文
- 四种接入：库（`compress(messages)`）/ **代理** `headroom proxy --port 8787` / **MCP** `headroom mcp install` / **包装** `headroom wrap claude|codex|cursor|aider`（17+ 工具，`unwrap` 撤销）
- 实测：代码搜索 21%、SRE 调试 **57%**、代码库探索 42%、GitHub issue 分类 30%；耗时 0.21ms p50 @10K
- 精度：GSM8K 0.870→0.870（无差）；SQuAD v2 97%@19%；BFCL 97%@32%

必须先处理的问题：

1. **默认开匿名遥测**（上报压缩比/计数器/provider ID/OS/架构，声明不发 prompt）→ 用就设 `HEADROOM_BEACON=off`、`HEADROOM_OFFLINE=1`
2. 开源版自述"为展示单机可能性而做，省得比能省的少"，企业版才满血
3. 短对话、纯散文、已密集负载几乎无压缩；禁止本地进程的沙箱跑不了

## billion-context —— 实测与安装细节（主文件 §1.5 的精简来源）

- https://github.com/ranxianglei/billion-context ｜ 3800★ ｜ MIT（附「终端产品需署名」附加条款）
- 关键数字（官方 README，2026-11）：4.5 个月 / 3 宿主 / 174,327 次调用 / 187.6 亿输入 token，204.8k 窗口零违规；第三方 1,500 题盲测：ContextBench 端到端 F1 第一（比 full 省 58.3%）、LongMemEval-S 比最强 RAG +16.6%（省 71.1%）、MemoryAgentBench 1.48M 超长会话 100% 存活且 30x 稳态压缩。
- 本机实测（2026-11-04）：desktop profile 装 billion-context@0.1.212 当场热加载（工具列表直接多出 compress/decompress/search_context/acp_status/acp_cache，无需重启），重启后持久。
- 备份 / 回滚：装前备份 %TEMP%/billion-context-backup-20261104/（package.json、pnpm-lock.yaml、cordis.patch.yml）；回滚用 dsh plugin --profile desktop remove billion-context。
- 坑：dsh --profile desktop --dump-config 在本机运行中实例上 EXIT=1 且无输出，别拿它当安装失败依据，用「工具出现 + acp_status」判断。
- 兼容：本机 DSH 0.2.1-rc.5；同 profile 只留一个上下文管理器（bundle patch 自动禁用 host 的 compaction-basic，与 billion-context-dsh 互斥）。

## cache-tax —— 前缀缓存冷启动账单（主文件 §4.5 的细节来源）

- 仓库：https://github.com/karanb192/cache-tax ｜ 345★ ｜ MIT ｜ Claude Code Mod（≥2.1.287）
- 治的问题：缓存过期后一句"总结下"会把旧上下文整个重写一遍。实测 330k 会话，两行 recap 触发 **$6.61**，重发后实际写入 **$6.28**。
- 用法：`/keepwarm 90m` 定向保活（静默 50 分钟发一次无工具 fork）；遇冷拦一次并报价，由人选择"重发"或"从笔记重开"。
- 价差参考：冷写与缓存读同 token **80 倍**（$20 vs $0.25/MTok）。
- 何时别用：非 Claude Code 客户端；不能接受 ping 花 token；极短离开场景不值得保活。
