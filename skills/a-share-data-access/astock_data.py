#!/usr/bin/env python3
# astock_data.py —— A股数据接入（akshare）。供 08:30 盘前 / 14:30 尾盘自动化调用，
# 把"取数"从网页抓取中剥离出来，降低 token 消耗与不稳定网页解析。
# 所有函数返回 JSON 友好的 dict / list；单函数失败不影响其余。
import json, datetime

def _ak():
    import akshare as ak
    return ak

def premarket_hotspots(top=15):
    """板块热点：行业资金流 + 涨停池，供盘前选股初筛。"""
    ak = _ak()
    out = {"industry_fund_flow": [], "limit_up_pool": []}
    try:
        df = ak.stock_fund_flow_industry_em(symbol="即时")
        out["industry_fund_flow"] = df.head(top).to_dict("records")
    except Exception as e:
        out["industry_fund_flow_error"] = str(e)
    try:
        today = datetime.date.today().strftime("%Y%m%d")
        df = ak.stock_zt_pool_em(date=today)
        out["limit_up_pool"] = df.head(top).to_dict("records")
    except Exception as e:
        out["limit_up_pool_error"] = str(e)
    return out

def stock_quote(codes):
    """批量实时行情（代码列表，如 ['688008','600519']）。"""
    ak = _ak()
    df = ak.stock_zh_a_spot_em()
    return df[df["代码"].isin(codes)].to_dict("records")

def fund_flow(codes):
    """个股资金流向。"""
    ak = _ak()
    out = {}
    for c in codes:
        try:
            df = ak.stock_fund_flow_individual_em(symbol=c)
            out[c] = df.tail(5).to_dict("records")
        except Exception as e:
            out[c] = {"error": str(e)}
    return out

def hot_rank(top=20):
    """个股热度榜。"""
    ak = _ak()
    df = ak.stock_hot_rank_em()
    return df.head(top).to_dict("records")

def dump(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))

if __name__ == "__main__":
    import sys
    which = sys.argv[1] if len(sys.argv) > 1 else "premarket_hotspots"
    if which == "premarket_hotspots":
        dump(premarket_hotspots())
    elif which == "hot_rank":
        dump(hot_rank())
    elif which == "quote":
        dump(stock_quote(sys.argv[2:]))
    elif which == "fund_flow":
        dump(fund_flow(sys.argv[2:]))
    else:
        print("usage: astock_data.py [premarket_hotspots|hot_rank|quote CODE...|fund_flow CODE...]")
