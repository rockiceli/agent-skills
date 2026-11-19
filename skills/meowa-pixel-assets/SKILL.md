---
name: meowa-pixel-assets
description: 用Meowa生成像素游戏素材：角色、sprite包、道具、图标、tileset、动画，并接进本地项目。当提到meowa、sprite sheet、生成宠物素材时使用。
agent_created: true
---

## 索引（渐进披露，按需展开正文）

- 一、本机命令
- 二、密钥（必须先配好）
- 三、生成一个像素素材
- 四、提示词规范（官方明确要求）
- 四·五、实测过的关键事实（2026-09）
- 四·六、踩过的坑（2026-09-27 实测，务必先看）
- 五、beast-diary 的落地标准
- 四·七、非角色素材（建筑/道具）→ 代码网格管线（2026-10-20 MOCHI 房子实测）
- 六、安全审计记录（安装时做过）

# Meowa 像素素材生成（本机适配版）

> ## ⛔ 先看这一条：禁止陷入「找素材」死循环（2026-09-27 用户明确要求）
>
> 曾经在这个环节**反复搜索、反复比较、反复纠结要不要生成**，耗掉大量时间和上下文，用户明确要求以后不许再犯。
>
> **固定决策顺序，不许回头：**
>
> | 顺序 | 手段 | 什么时候用 |
> |---|---|---|
> | ① | **复用已有的**（项目里已有的图 / 已有数据表 / 换色变体） | 永远先找这个 |
> | ② | **代码手绘**（`fillRect` 逐像素画，0 积分） | ① 没有 → **默认走这条，别再犹豫** |
> | ③ | 联网搜免费像素素材 | 只在用户**点名要某个现成 IP/风格**时才搜，**最多 1 轮、不超过 5 分钟** |
> | ④ | meowa 生成（**要花积分**） | ①②③ 都走不通，**且先问过用户**才生成 |
>
> **硬规则：**
> - 同一个素材的「找 / 搜 / 比」**最多 2 次决策**，第 2 次还没定就直接走 ② 代码手绘。
> - 搜索**只许一轮**，搜不到就手绘，不换关键词再搜。
> - 手绘一只像素角色大约 40~60 行代码，产出确定、0 积分、可参数化换色 —— **它几乎总是比"再找找"划算**。
> - 生成前必须能一句话说清「为什么非生成不可」，说不清就是不必要。

官方 skill（runner + 能力文档）装在 **`<home>/.workbuddy/skills/meowa-game-assets/`**，
本文件只记录**本机怎么跑**和**产物怎么落地**，不改动官方目录（它是版本单元，会整体覆盖升级）。

## 一、本机命令

managed venv 装不上 Pillow/requests，**直接用系统 Python 3.12**（已自带 requests 2.34 + Pillow 11.1）：

```bash
PY="E:/Users/Administrator/AppData/Local/Programs/Python/Python312/python.exe"
SK="<home>/.workbuddy/skills/meowa-game-assets/meowart_api.py"

"$PY" "$SK" --version                  # 2026.09.26.1
"$PY" "$SK" credits-balance            # 验证 key / 查余额
"$PY" "$SK" --help                     # 所有命令
"$PY" "$SK" pixel-gen-template-info    # 像素尺寸预设（生成前必须先看）
"$PY" "$SK" hd-gen-template-info       # 高清预设
```

## 二、密钥（必须先配好）

1. 登录 <https://meowa.ai/#/api-keys> → `Create API Key` → 复制 `ma_live_...`
2. 写进 `<home>/.workbuddy/skills/meowa-game-assets/.env`：

```dotenv
MEOWART_API_KEY="<your-meowa-api-key>"
```

**绝不把 key 粘贴到聊天、命令参数或截图里。** runner 不接受命令行传密钥。
没配 key 时会报 `Meowa authentication is not configured.` —— 这时不要瞎试，直接让用户去拿 key。

## 三、生成一个像素素材

```bash
"$PY" "$SK" pixel-gen-run \
  --template-name <从 template-info 挑的预设名> \
  --requirement "<自然语言描述>" \
  --aspect-ratio 1:1 \
  --output-dir ./outputs/<名字>
```

- 产物落在 `./outputs/<名字>/<slug>/`：只有最终媒体 + `final_outputs.json`，取这两个。
- 任务中断/超时用对应的 `*-poll --job-id <id>` 恢复，**不要重复提交**（会重复扣费）。
- 每次生成都用新的 `--output-dir`。

其它常用能力（详见官方 `SKILL.md` 与 `references/`）：
`character-multi-view-run`（八方向）、`remove-background-run`（去背景）、`pixelate-run`（转像素）、
`sprite-animation-*`（动画）、`image-2.5-run`（通用高清生图）。

## 四、提示词规范（官方明确要求）

- **自然语言，短而具体**。写主体、动作、视角、材质、元素关系。
- **禁止**扩散模型那套：关键词堆砌、正/负分块、重复质量词、token 权重、采样器语法、镜头渲染术语。
- 一次只加一个约束，先看结果再迭代。
- 像素角色动画**控制在 128×128 以内**；>256px 的动画画布非法。

## 四·五、实测过的关键事实（2026-09）

- **一次 `pixel-gen-run` = 8 张 = 20 积分**，约 1 分钟。规划批量任务时按 20/次 算账。
- 猫狗专用预设：`cat` / `cat_3`（极简）/ `cat_4`（简约）/ `dog` / `dog_2`（简约）。
  还有 `animal` `animal_2` `animal5x5` `general_character_64px` `48px characters`。
  **注意 `dog_2` 出来是 32×32，不是 64** —— 用前先看 `output_size`。
- 产物**自带透明通道**（预设默认 `remove-bg-method advanced`），不用再跑去背景。
- 产物目录 = `--output-dir/<提示词slug>/`，含 `sprite_00..NN.png` + `sprite_pack_preview.png`（连图）+ `final_outputs.json`。
- **⚠ `default_count` 不等于实际出图数**：`pixel_char_N` 系（大型奇幻Q版/国风/绘本/治愈…）标 `n=2`，
  实跑就只给 **2 张**（不是 8 张）—— 积分照扣 20/次。想要 8 张候选就选 `general_character_64px`
  这类标 `n=8` 的；嫌 64px 细节不够可以选 `pixel_char_N`（128×128），但要接受只出 2 张。
- **接进 beast-diary 的落地脚本**：`tools/import-cand3.py`（meowa PNG → 裁内容边界 →
  LANCZOS 等比塞进 44×52 → 自适应 ≤16 色 → `oh=26` 锁屏幕占比 → 输出像素网格进 `js/pets.js`）。
  ⚠ 包内零素材文件（build-exe.js 排除 `.png`），meowa 产物**只能落成代码网格**，PNG 本体进不了包；
  `assets/_generated/` 在 RELEASE 下被 build-exe 明确排除，生成的 PNG 不会漏进发布包。
  （配套：`tools/_splice-cand3.py`（龙裔/星轨/九尾）/ `_splice-cand2.py`（影忍/魔女）把网格接进 pets.js；
  `desktop/tools/_dump3.js` + `tools/make-cand3-sheet.py` 出前后对比图。）
- **⚠ 拼接脚本两个必踩的坑（2026-10-18 实测）**：
  ① 网格常量是**两行**（首行 `w/h/pal` + 次行 `px`），只按 `const CAND_` 挑首行会把 `px` 整行漏掉
     ⇒ `node --check` 直接 SyntaxError。挑到 `};` 结尾为止。
  ② 函数体必须 `return gridOf(CAND_X_GRID);` —— **不能直接返回常量**。网格常量是共享对象，
     `spriteOf` / `candSprite` 会往返回对象上写 `sp.n`（名字），直接返回几只**互相抢名字**。
     `gridOf()` 是浅拷贝（和 `petart.js` 的 `A.get` 同口径）。
- **⚠ `px` 是 36 进制字符（`0-9a-f`）**，不是纯数字 —— 自己做 ASCII 验收时用 `parseInt(c,36)`，
  按 `charCodeAt-48` 解会全解错（出来一片 `?`）。
- **验收探针**（改完必跑）：
  `node desktop/tools/_oh-audit.js`（全部角色 `oh` 须 26，现 48 只）+ 一条 vm 沙箱探针跑
  `P.candSprite(key)` 逐个查 `w/h/oh/色数/pxLen===w*h` + 名字不撞。
  ⚠ 另有一条更容易漏的：**改了代码里的网格，老存档看不见**（像素数据冻在存档里）——
  见 beast-diary 的 **B308**，靠 `P.refreshArt()` 兜。

**看不了 PNG 时怎么验收**：用 Pillow 把图按亮度映射成字符矩阵打印，一眼看出轮廓对不对、脚有没有贴底：

```python
from PIL import Image
im = Image.open(f).convert('RGBA'); px = im.load()
for y in range(im.size[1]):
    print(''.join('.' if px[x,y][3]<32 else ('#' if sum(px[x,y][:3])/3<110 else ('o' if sum(px[x,y][:3])/3<190 else '@')) for x in range(im.size[0])))
```

## 四·六、踩过的坑（2026-09-27 实测，务必先看）

1. **别用 `animate-run` 做游戏内动作** —— 一次 100 积分，一个物种 8 动作 = 800。
   静态图 + `D.ACT_MV` 形变（源行重采样挤压 + 逐行偏移倾斜/抖动）就能做出
   待机/走路/吃饭/运动/打怪/睡觉/开心/受伤，脚底钉住不糊，**0 积分**。
2. **换皮形象必须带 `grow`**：`A.toCustom()` 早期是手搓对象字面量，漏了 `grow`，
   于是 `ST.speciesOf().grow.spd` 报错、`ST.statsOf()` 崩、宠物 AI 卡死。
   **正确做法**：`D.blankCustom(id, name, from)` 造骨架，再用 `inheritSpecies(cu, kind)`
   把该物种的 `grow/desc/n` 拷进去 —— 换皮只换长相，数值仍跟物种走。
3. **manifest 不能全量登记**：`A.add()` 上限 80 条，且「素材库」面板一屏塞不下。
   一个物种 8 张候选 → 只登记 1 张默认 + 2 张备选（`skin:true` 只有一条）。
   其余候选留在 `_generated/`，要用再手动加。
4. **尺寸上限是 `assets.js` 的 `MAX_SPRITE`**（现为 **26**）。房间家具 18~24px，
   素材小兽压到 40px 就比床还大、明显出戏。
5. **游戏绘制代码里别用 `ctx.save/clip/rect`**：`tools/smoke.js` 的桩 ctx 没有这些方法，
   一用就整条渲染链报错（`ctx.rect is not a function`）。
   要裁剪就用自己写的逐行裁剪函数（`room.js` 的 `cEllipse(ctx,cx,cy,rw,rh,c,L,T,R,B)`）。
6. **加新物种**要动三处：`data.js` 的 `SPECIES`（色板 + `grow` + `shape`）、
   `draw.js` 的 `SPEC` 形状构造函数（没有就 fallback 到 cat）、`tools/smoke.js` 里硬编码的物种数断言。
7. **无头截图**：`--screenshot` 必须给**绝对路径**（相对路径静默失败）；
   要截 `file://` 之外的 manifest 效果得先起 `python -m http.server`；
   页面里的 canvas 要放大看细节就让注入脚本 `createElement('canvas')` + `image-rendering:pixelated` 贴到 body 上。
8. **免费素材直链**（省积分兜底）：
   - Kenney 官网 zip 藏在页面 HTML 里：`curl -sL https://kenney.nl/assets/<pack> | grep -oE "media/pages/assets/<pack>/[^\"' )]*\.zip"`
   - OpenGameArt：`https://opengameart.org/sites/default/files/<File%20Name.zip>`（页面 HTML 有时 502，直链通常能下）
   - **itch.io 抓不到直链**（过验证），别在这上面浪费时间
   - 本机已存 `beast-diary/assets/_free/`：Kenney Roguelike Indoor / Tiny Dungeon / Tiny Town / Tiny Battle，全 CC0

## 五、beast-diary 的落地标准

生成完的 PNG 放到 `beast-diary/assets/pets|enemies|icons/`，规格见 **`beast-diary/assets/README.md`**：

| 项 | 要求 |
|---|---|
| 格式 | PNG + 透明通道 |
| 尺寸 | 64×64 或 96×96 正方形（游戏会压到 ≤26） |
| 背景 | 透明或纯色（导入时会洪水填充去背景） |
| 构图 | 单只、居中、脚贴底边、占画面 70~85% |
| 色数 | ≤16 |
| 命名 | `物种-序号.png`（`cat-01.png`…`panda-08.png`）—— 同一物种一次出 8 张候选，挑 3 张进 manifest |
| 物种 key | `cat` `dog` `rabbit` `hamster` `dragon` `panda` `ghost` `robot` `fairy`（**9 个**） |

两条接入路径（都已在 `js/assets.js` 实现）：

1. **游戏内批量导入**：档案页 → 素材库 → 多选 PNG（file:// 也能用，最省事）
2. **`assets/manifest.json` 自动装载**：起本地服务器（`python -m http.server 8000`）后自动读取；
   `kind` 写物种 key 会自动给那只小兽换皮

改完记得跑 `node tools/smoke.js`（素材库是第 26 项）。

## 详细内容（references，按需读取）

- `references/split-part-01.md`：四·七、非角色素材（建筑/道具）→ 代码网格管线（2026-10-20 MOCHI 房子实测） / 六、安全审计记录（安装时做过）
