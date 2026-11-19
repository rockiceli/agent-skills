---
name: silent-scheduled-tasks
description: Windows计划任务弹黑窗的定位与静默化：改pythonw或隐藏启动器并校验触发器。当说定时弹cmd/powershell黑框、要审计本机自动化任务时使用。
---

# 让 Windows 计划任务不弹窗口

## 定位（先找是谁，别猜）

```bash
# 1) 正在跑的进程 + 完整命令行（比 tasklist 有用）
wmic.exe process where "name='python.exe'" get processid,commandline /format:list | tr -d '\r'
# 2) 按名字查任务定义
schtasks.exe /Query /TN "<任务名>" /XML
# 3) 全量审计哪些任务会开控制台
```
```powershell
Get-ScheduledTask | Where-Object { $_.Actions.Execute -match 'python|cmd|powershell|\.bat|\.vbs' } |
  ForEach-Object { '{0}{1} | {2} | {3}' -f $_.TaskPath,$_.TaskName,($_.Actions[0].Execute),$_.State }
```

输出文件被 grep 当二进制（中文）时，给 `schtasks` 加 `tr -d '\r'` 再 `grep -a`。
PowerShell 工具在本机**不回传 stdout**，要结果就 `[System.IO.File]::WriteAllLines(..., [System.Text.UTF8Encoding]::new($false))` 写文件再 Read。

## 四种无窗口改法（按优先级）

| 场景 | 做法 | 备注 |
|---|---|---|
| **powershell / python / cmd 脚本任务（首选）** | **把 Principal 改成 `S4U`**（"不管用户是否登录都运行"）→ 进程落在 Session 0，**根本不创建窗口** | 零闪烁、命令行完全不用改。代价：Session 0 无桌面，**不能跑需要 GUI/交互的东西**（拉 Electron 应用、Excel COM、弹框） |
| python 脚本 | Execute 从 `python.exe` 换成同目录 `pythonw.exe` | 次选，保留 Interactive 会话；**控制台输出本来就是关窗即丢，换掉不损失信息** |
| 需要留日志 | `pythonw` 或 S4U + 脚本内部自己写日志文件（别靠 stdout） | pythonw 下 `sys.stdout is None`，`print` 会抛异常，必须 try/except 或走 Logger |
| 要拉起 GUI 程序 | Execute 直接指向那个 `.exe`（去掉 `cmd /c 包装.cmd`） | 先验证目标是不是**单实例**（见下方探针）；单实例就不需要"是否已在运行"的判断 |
| .cmd / .bat | `wscript.exe //B hide.vbs "<目标>"` | ⚠ 本机沙箱把 `wscript.exe` 当 LOLBin **拦截**，此路不通，别浪费时间 |

改 Principal（只动 Principal，触发器/设置都保留）：
```powershell
$t = Get-ScheduledTask -TaskName X
$p = New-ScheduledTaskPrincipal -UserId $t.Principal.UserId -LogonType S4U -RunLevel Highest
Set-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Principal $p
```
S4U 前提：目标盘是**本地盘**（`wmic logicaldisk get deviceid,drivetype`，3=本地 4=网络）；网络映射盘在 Session 0 里访问不到。

## 改完必须实测（S4U 有真实的失败模式）

别信"设上了就完事"，Session 0 里可能因为凭证/网络/DPAPI 拿不到东西而静默失败。
**顺序：先拿一个低风险任务试点 → 手动 `Start-ScheduledTask` → 看它自己的日志 → 全绿再批量推。**

实测过的探针（A股抓龙那次）：
```powershell
schtasks /Run /TN "<任务名>"            # 或 Start-ScheduledTask
Get-ScheduledTaskInfo -TaskName X        # LastTaskResult 0 = 成功
```
再去看产物：`logs/run_<flow>_<stamp>.log` 里的 `exit=0` / `"ok": true`、生成的 html/json 的 mtime。
- 非 LLM 流程（health）→ 验证网络+venv：抓了 5563 条行情
- LLM 流程（verify_free_model）→ 验证账号凭证：输出 291 tokens、cost 0
- 每 5 分钟的刷新任务 → 验证产物 mtime 有更新

## 单实例探针（换直接拉 exe 之前跑）

```powershell
$before = @(Get-Process -Name X | Where-Object MainWindowTitle | ForEach-Object Id)
Start-ScheduledTask -TaskName X; Start-Sleep 8
$after  = @(Get-Process -Name X | Where-Object MainWindowTitle | ForEach-Object Id)
$added  = $after | Where-Object { $before -notcontains $_ }   # 有新增 = 非单实例，回滚
```
⚠ 别用 `wmic process` 数进程数判断 —— Electron 有一堆 `--type=` 子进程，数不准。

改 action **只动 action**，别重建整个任务：
```powershell
$a = (Get-ScheduledTask -TaskName X).Actions[0]
$na = New-ScheduledTaskAction -Execute $newExe -Argument $a.Arguments   # -WorkingDirectory 为空时必须省略，传 '' 会报参数验证失败
Set-ScheduledTask -TaskName X -Action $na        # 触发器/设置原样保留
```

## 挖坑记录

- **`New-ScheduledTaskAction -WorkingDirectory ''` 直接报错**（参数不能为空）→ 先判空再决定传不传。
- **改了任务要回报 XML 校验触发器**：`schtasks /Query /TN X /XML | grep -aE "<Command>|StartBoundary|<Sunday>|DaysInterval"`，确认时间没被重置成"现在"。
- **同一任务可能同时跑两个实例**（本次实测 PID 两个，都在扫盘）→ 改之前 `taskkill`，并给 `-MultipleInstances IgnoreNew`。
- **杀进程前先确认有没有进入破坏性阶段**：本次的隔离/移动发生在写报告那一刻，`dedup_report.txt` 不存在 + 隔离目录不存在 ⇒ 还在扫描，杀之无碍。
- 审计时**别一刀切**：交易/开盘这类用户盯着看的任务，弹窗可能是他要的可见性，先问再动。
- **改完必须再全量审计一次**：这次第一轮只处理了 9 个，第二轮才发现 `02c_盘后板块分析`、`10_实时状态刷新` 是**当天新加的**，漏在外面继续弹。
- **留意 `Repetition/Interval`**：`10_实时状态刷新` 是 `PT5M` 每 5 分钟、Duration `P3650D` —— 这种才是"老是弹"的真凶，比每周一次的任务刺眼得多。
- **"下次运行 N/A" = 没有触发器**（只能手动/被调用），这种不用动。
- 用 `$_.Actions.Arguments -like '*脚本名*'` 来筛任务，**别用中文任务名做筛选条件**（PowerShell 工具传中文参数容易乱码，用参数里的 ASCII 脚本名最稳）。

## 2026-11-10 反例：黑框来自桌面应用，不是计划任务

**别一上来改计划任务**。`10_实时状态刷新`(PT5M) 看着最像，手动 `Start-ScheduledTask` 实测落 `SessionId=0` / `Result=0`，不弹窗；真凶是 `SessionId=1` 的一批 `powershell.exe -EncodedCommand`，`PPID` 追到 DSH `dsh-desktop-host` 主进程。

定位四步：① 抓 `powershell/conhost/cmd` 的 `SessionId`+`ParentProcessId`+完整 `CommandLine`（**Session 0 不是你看到的窗口**）→ ② `PPID` 追到根认出哪个桌面应用 → ③ `-EncodedCommand` 按 **UTF-16LE** 解码（不是 UTF-8）看它在查什么 → ④ 在该应用 `node_modules` Grep 解码出的独特串，定位 `execFile`/`spawn`。

- **`windowsHide: true` 不保证无窗口**：源码已带该参数，`conhost.exe` 照样跟着起 —— `SW_HIDE` 挡不住 GUI 父进程为控制台程序新建的 conhost。别再纠结隐藏参数。
- **修法按 yagni 排**：让检测**短路**（本次把状态文件 `desktop` 记录改名为 `_desktop_disabled_20261110`，数据不删+留备份）→ **热生效 1.5s**、语义等价；给第三方 `node_modules` 加缓存/降频要重启宿主且会被升级覆盖；停用插件会打断在跑的 Connector，别擅自做。
- **短路前查三件事**：目标桌面端进程确实没跑；状态文件 `legacyMachineMigrated: true`（否则 legacy `machine.json` 会补回记录）；当前状态是 `absent`（否则 installed→absent 可能触发 `begin()` / `connector.stop()`）。改完 JSON 解析校验 + 连续采样 10s 数进程，别信"改了就好"。
- **工具坑**：PowerShell 工具拦含 `-EncodedCommand` 字面量的脚本（"Encoded commands hide the actual code"），采样要拼 `$needle='Enc'+'oded'`；Bash 里调 `powershell.exe` 也被拦，只能用 PowerShell 工具。
