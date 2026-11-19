---
name: a-share-data-access
description: A股行情取数：用稳定akshare接口替代网页抓取，提供盘前盘中尾盘所需行情、板块、涨停池、资金流。当要换数据源、取涨停池或板块资金流时使用。
agent_created: true
---

# A股数据接入（akshare）

## 概述
用 `akshare` 把 A股取数从「网页抓取 + 解析」升级为「稳定 API 调用」，降低 token 消耗与网页结构变动风险。
数据模块：`astock_data.py`（位于本技能同目录，需隔离 venv 安装 akshare）。

## 依赖
```
python -m venv <venv> && <venv>/Scripts/python -m pip install akshare
```

## 调用方式（供自动化脚本引用）
- `premarket_hotspots(top=15)`：板块资金流 + 涨停池，盘前初筛。
- `hot_rank(top=20)`：个股热度榜。
- `stock_quote(codes)`：批量实时行情。
- `fund_flow(codes)`：个股资金流向（近 5 日）。

CLI 直接跑：
```
python astock_data.py premarket_hotspots
python astock_data.py hot_rank
python astock_data.py quote 688008 600519
python astock_data.py fund_flow 688008
```

## 与现有自动化衔接
- 08:30 盘前：调用 `premarket_hotspots()` 生成初筛候选，再交 TradingAgents-CN / DeepSeek 分析。
- 14:30 尾盘：调用 `stock_quote()` + `fund_flow()` 复核持仓，应用止盈止损。
- 全程只传结构化 JSON 给模型，不 dump 原始网页，省 token。

## 进阶（可选）
- `TradingAgents-CN`（github.com/Seanvp2024/TradingAgents-CN）：多智能体中文 A股分析，需配置 LLM API Key，作为盘前/尾盘决策的"重度分析"层，与轻量 akshare 取数互补。
- 回测：`vectorbt` 对 T+1 策略做参数扫描。

## 零依赖兜底：东财挂掉时的两条备胎（2026-11 实测有效）

东方财富 `push2.eastmoney.com` / `push2his...fflow` 会按 IP 限流，症状是**连续多次后突然全部 `RemoteDisconnected`**（个股、指数、资金流一起挂，加 `ut` 参数也没用）。此时不必装 akshare，用下面两个裸 HTTP 接口即可完整替代，git-bash + 内置 python 就能跑：

**① 行情 —— 腾讯（GBK 文本，一次可批量）**
```
https://qt.gtimg.cn/q=sh600938,sh600036,sz000858,sh000001,sz399001,sz399006
```
返回 `v_sh600938="1~中国海油~600938~35.53~35.97~34.92~...";`，按下标取：
`f[1]`名称 `f[2]`代码 `f[3]`现价 `f[4]`昨收 `f[5]`今开 `f[32]`涨跌幅% `f[33]`最高 `f[34]`最低 `f[36]`成交量(手) `f[37]`成交额(**万元**) `f[38]`换手率%。
⚠️ `f[37]` 单位是万元，别当亿元用（除以 1e4 才是亿）。解码用 `.decode("gbk","ignore")`。

**② 四级资金流 —— 新浪（JSON，单只查询）**
```
https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/MoneyFlow.ssi_ssfx_flzjtj?daima=sh600938
```
返回 `r0_in/r0_out`（**超大单**）`r1_*`（**大单**）`r2_*`（中单）`r3_*`（小单）`netamount`（全部净额）+ `trade/volume`。
净额 = `rX_in − rX_out`；校验：`r0+r1+r2+r3` 四者净额之和 ≈ `netamount`。
直接给出四条件里的三项：①`r0净额>0` ②`r0/(r0+r1)` ≥70% ③`r0净额/成交额` ≥3%（成交额取自腾讯 f[37]）。

**已废弃**：腾讯 `qt.gtimg.cn/q=ff_sh600938`（资金流）现在固定返回 `v_pv_none_match="1"`，别再试。

## 注意
- akshare 为第三方数据源，接口名随版本变动；函数已做单点 try/except，单接口失败不影响其余。
- 遵守 T+1：尾盘卖出仅对已持有且满 T+1 的持仓操作。
