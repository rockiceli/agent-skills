> 本文件由 `SKILL.md` 拆分而来（只读参考，不单独作为技能入口）。
> 对应主文件：`SKILL.md`；小节：四·七、非角色素材（建筑/道具）→ 代码网格管线（2026-10-20 MOCHI 房子实测） / 六、安全审计记录（安装时做过）

## 四·七、非角色素材（建筑/道具）→ 代码网格管线（2026-10-20 MOCHI 房子实测）

角色模板（44×52）不适合建筑 —— 建筑是**宽幅**的，要自己定目标宽度：

```bash
# ① 生成：模板选 16_9（大型横版，16:9，实测一次出 2 张 / 20 积分）
"$PY" "$SK" pixel-gen-run --template-name 16_9 --requirement "<建筑描述，一句话写主体+配色+视角>" \
  --aspect-ratio 16:9 --output-dir <项目>/assets/_generated/<slug>
# ② 转网格：tools/import-house.py（beast-diary）—— SPEC 里配 (目录, 目标宽度, 挑第几张)
PY3 tools/import-house.py villa,big     # 产物 tools/_house.generated.js（两行式常量，px 是 36 进制）
# ③ 插进目标 js：tools/_splice-house.py（按标记幂等插入，保 CRLF）
```

**量化三坑（第一版全踩了，出来一片荧光绿噪点）：**
1. **透明区先填成主色再量化** —— RGBA→RGB 会把透明变成**黑色**参与调色板，16 色名额被黑吃掉好几个，
   真正的墙面色反而挤没了。先统计不透明像素的主色，`Image.new('RGB', size, 主色)` 再 `paste(图, (0,0), alpha掩码)`。
2. **缩放用 NEAREST，不用 LANCZOS** —— 像素画的硬边被 LANCZOS 糊成半透明过渡带，量化后就是满屏噪点。
3. **`convert('P', palette=ADAPTIVE, colors=16, dither=Image.NONE)`** —— 默认带抖动，也要关。

**进游戏渲染的规矩（大图必须烘离屏）：**
- 单张贴图 > 100×100 就**不能逐格 fillRect 每帧画**（8500 格会拖垮 60fps 透明窗）——
  烘一次离屏 canvas（正常 + 夜暗两份调色板），每帧一次 `drawImage` + `imageSmoothingEnabled=false`。
- 夜暗版必须**烘调色板**（每色乘系数），不能拿半透明矩形盖整张 —— 那会把贴图周围的透明区盖出一块方斑。
- 窗户等「要发光」的部位：把坐标 `[x,y,w,h]` 手工量出来存成常量，运行时在贴图上叠 `globalAlpha` 光斑。
- ASCII 验收对大图失真（缩到 96 列全糊），直接用 `Read` 看图，或把最终网格**渲染成 PNG** 再看
  （⚠ 渲染脚本自己的正则要写对：曾因正则错把 palette 匹配歪，误判成「量化坏了」白排查一轮）。

## 六、安全审计记录（安装时做过）

- 只外联 `https://api.meowa.ai`，无第三方域名
- 无 `eval` / `exec` / `os.system` / `subprocess` / `pickle` / `marshal` / base64 解码执行
- 结论：P2（安全），已安装
