---
name: excel-native-automation
description: 让Excel跑起来：刷新Power Query、DAX、VBA宏、保留透视表图表结构、Goal Seek。当要Excel自动化、宏跑不了、表被重建时使用。
agent_created: true
---

# Excel 原生自动化（驱动真 Excel，而非解析 xlsx）

一行索引：
- §1 什么时候用 / 什么时候别用（先看这个，别用错）
- §2 工具选型：CLI vs MCP Server（**省 token 关键**）
- §3 Excel MCP 能力清单（437 操作）
- §4 安全作业流程（生产表绝对不许直连）
- §5 常见坑
- §6 Reflexion

---

## 1. 什么时候用 / 什么时候别用

**用**（必须"真 Excel"才能做的事）
- 刷新 **Power Query** / 加载到 Data Model
- 计算 **DAX** 度量值、Power Pivot
- **运行或写入 VBA 宏**（含 WEBADI / EBS 宏处理）
- 保留**透视表、图表、条件格式、切片器**的结构与格式
- **Goal Seek / 方案管理器 / 数据表**假设分析
- Python in Excel（`=PY()`）

**别用**（用 openpyxl / sheetagent 更快更轻）
- 只是读写单元格、改格式、做简单计算
- 无人值守的**定时任务/后台服务**——Excel MCP 要求**交互式桌面**，后台必失败
- 不希望把 64 个工具 schema 塞进上下文的场景（改用 CLI）

## 2. 工具选型：CLI 优先，MCP 兜底

来源：https://github.com/sbroenne/mcp-server-excel （MIT / C# .NET 10 / Windows）

| 接口 | 适用 | token 成本 |
|---|---|---|
| **CLI `excelcli`** | 能跑终端命令的 Agent | **低**——自带 help，不加载 MCP 工具定义 |
| **MCP Server** | 任意 MCP 客户端、需工具发现 + 持久会话 | **高**——64 个工具 / 437 操作 schema 全进上下文 |

> ⭐ **本机默认走 CLI**。64 个工具的 schema 是巨大固定前缀，用 MCP 会把上下文预算吃掉一大块——这属于"省 token 先看 schema 占比"的直接应用。

CLI 会常驻后台服务，工作簿会话跨命令保持；MCP 与 CLI 都在独立 worker 进程跑 Excel 命令，单个卡住的 Excel 操作不会阻塞基础控制。

安装路径（择一，**装之前先确认版本与 .NET 10 运行时**）：
- VS Code 扩展：`sbroenne.excel-mcp`（Marketplace）
- GitHub Copilot CLI 插件：`copilot plugin install excel-mcp@awesome-copilot`（MCP 版）或 `excel-cli@awesome-copilot`（CLI 版）
- 独立安装：见 https://excelmcpserver.dev/installation/

## 3. 能力清单（33 功能区 / 437 操作，按用途分组）

- **数据与分析**：Power Query、DAX、Power Pivot、Excel 表格、透视表、数据连接
- **单元格与工作簿**：区域、公式、格式、工作表、文件、重算、命名区域
- **图表与视觉**：图表、切片器、条件格式、**截图**、绘图、迷你图
- **自动化与进阶**：**VBA**、Python in Excel、Goal Seek、方案、数据表、窗口、XML Maps

⚠️ **截图功能会把图片送进上下文**——按"视频/截图永不进上下文"的纪律，除非必须目视核对，否则别用。

## 4. 安全作业流程（硬规矩）

1. **绝不直连生产表**：先 `复制 → 副本`，在副本上验证。
2. **先只读后写入**：第一轮只做"读 + 刷新 + 读结果"，验证稳定后再考虑写。
3. **宏操作前必备份**：`xlsm` 拷贝一份带时间戳的原件（宏一旦跑错无法回滚）。
4. **改完立刻复核**：用 openpyxl / sheetagent 独立读取关键单元格，不复用被驱动进程的返回值（两者互校）。
5. **不在无人值守自动化里调用**：23:00 / 08:30 这类后台任务只用文件级工具。

## 5. 常见坑

- **交互式桌面是硬门槛**：Session 0 / 服务 / 远程无桌面会话都会失败。
- **Excel 决定打开文件是只读还是可写**：文件被别的进程占用时会静默变只读，写入无效——先检查文件锁。
- **工作簿已打开时要"发现并附着"**，不要在它开着的时候另开新实例（会导致内存里两份状态）。
- **.NET 10 运行时**缺失是最常见的启动失败原因。
- **版本要求 Excel 2016+**，WPS 不支持。

## 6. Reflexion

**失败教训**
- 2026-11-03 体检数字从 `61 技能 / 41 WARN` 突变为 `59 / 0 WARN`，第一反应怀疑技能被误删；实际是路由表与目录同步更新、WARN 已修完。**教训：数字突变先核对目录实际数量与 INDEX 一致性，别先假设故障。**
- 该 MCP 只有 844★，不算热门项目；选它是因为**唯一性**（真 COM 驱动 Excel 的开源方案），而非星标背书。选型理由要写清是"唯一"还是"最好"。

**何时别用**
- 纯 xlsx 读写（openpyxl 快 10 倍且零依赖）
- 定时/无人值守任务（后台无桌面，必失败）
- 上下文预算紧张时用 MCP 版（应换 CLI）
- 用 WPS 而非 MS Excel 的环境（不兼容）
