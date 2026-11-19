# Agent Skills · 实战沉淀的 AI 技能库

> 15 个用真实项目喂出来的 agent skills：省 token、桌面宠物、Excel 自动化、A股纪律、像素素材……全部带踩坑记录，Claude Code / Codex / Cursor / DSH / WorkBuddy 通用。

这不是一堆"AI 写的提示词模板"。每一条技能都是从真实项目里踩出来的：有具体命令、有失败过的做法、有验收标准。

## 这些技能能给谁用

同一套 `SKILL.md` 结构，五套 Agent 都能吃：

| Agent | 放哪 |
|---|---|
| Claude Code | `~/.claude/skills/<name>/SKILL.md` |
| Codex | `$CODEX_HOME/skills/<name>/SKILL.md` |
| Cursor | `.cursor/rules` 或 skills 目录 |
| DeepSeek Harness (DSH) | 技能库根目录 + `INDEX.md` |
| WorkBuddy | 技能库根目录（与 DSH 共用一个母本） |

最快验证方式：把任意一个 `skills/<name>/SKILL.md` 全文丢给你的 Agent，让它按里面的步骤做一遍。

## 技能目录（15 条）

| # | 技能 | ID | 一句话 |
|---|---|---|---|
| 1 | [上下文压缩治理](skills/agent-context-compression) | `agent-context-compression` | 长会话撞上限之前，先把 token 花在该花的地方 |
| 2 | [Electron 桌面宠物](skills/electron-desktop-pet) | `electron-desktop-pet` | 把网页 canvas 项目包成透明置顶桌宠，会溜达、会吃掉你拖给它的文件 |
| 3 | [Excel 原生自动化](skills/excel-native-automation) | `excel-native-automation` | 刷新 Power Query、跑 VBA 宏、保住透视表结构，而不是把表重建一遍 |
| 4 | [自我成长 Agent](skills/self-growth-agent) | `self-growth-agent` | 每天 23:00 自己抓料、蒸馏、过 CRITIC 门禁、入库、出日报 |
| 5 | [DSH 进阶用法](skills/dsh-power-user) | `dsh-power-user` | 运行模式、Agent 团队、插件选型、token 成本：榨干 DeepSeek Harness |
| 6 | [定时任务不弹黑窗](skills/silent-scheduled-tasks) | `silent-scheduled-tasks` | pythonw 能不能真的静默，取决于触发器怎么配 |
| 7 | [Canvas 像素精灵](skills/canvas-pixel-sprite) | `canvas-pixel-sprite` | 程序化画像素角色：部件化、自动 1px 描边、参数化体型视角表情 |
| 8 | [Meowa 像素素材](skills/meowa-pixel-assets) | `meowa-pixel-assets` | 生成 sprite sheet、tileset、动画，并接进本地项目 |
| 9 | [没有 ffmpeg 也能录屏](skills/electron-screen-recording) | `electron-screen-recording` | 用 Electron / Chromium 录实机演示，屏幕合成字幕层 |
| 10 | [MOCHI 桌宠迭代](skills/electron-desktop-pet-sprint) | `electron-desktop-pet-sprint` | 给已上线的桌宠加功能改 UI：文件地图、截图桩、四套验证 |
| 11 | [本地页截图验证](skills/local-web-screenshot-verify) | `local-web-screenshot-verify` | 改完 UI 不用盯着看，无头 Edge 出图自己比对 |
| 12 | [A股 10:00 盘中买入窗口](skills/a-share-intraday-buy-window) | `a-share-intraday-buy-window` | 实时行情确认、逐票 buy/watch/放弃、T+1 标注、报告落地 |
| 13 | [A股 14:30 尾盘卖出决策](skills/a-share-close-decision) | `a-share-close-decision` | 止盈止损、T+1 校验、HTML 报告 + 邮件通知 |
| 14 | [A股数据接入](skills/a-share-data-access) | `a-share-data-access` | 用稳定 akshare 接口替掉网页抓取，涨停池和板块资金流一次拿全 |
| 15 | [A股游资短线纪律](skills/a-share-youzi-trading) | `a-share-youzi-trading` | 情绪周期读数、弱市空仓、只做主线龙头、回撤线分仓 |

## 目录约定

```
skills/<ascii-name>/
  SKILL.md              # frontmatter(name + description) + 正文；description 决定 Agent 何时自动加载
  references/*.md       # 渐进披露的细节，只在需要时展开
```

`name` 必须 kebab-case、全库唯一、与目录名一致 —— CI 会校验。

## 视频系列

每条技能都在做成一期横屏短视频，投在 B站「小瑜宝的研究日记」。BV 号会回填到这里。

<!-- BV-LIST-START -->
<!-- BV-LIST-END -->

## 贡献

Issue / PR 都欢迎。改技能请保持：`SKILL.md` 里写清楚"何时用 / 何时不用 / 验收怎么判"。

## License

MIT © 2026 rockiceli — 见 [LICENSE](LICENSE)。第三方来源见 [CREDITS.md](CREDITS.md)。
