---
name: electron-screen-recording
description: 无ffmpeg时用Electron/Chromium录实机演示视频：屏幕合成字幕层、像素统计构图。当要录桌宠或桌面应用宣发演示片时使用。
agent_created: true
---

# Electron 整屏实机录屏（虚拟演播台）

目标：**画面里每一个像素都是真程序跑出来的**（不用截图、不用特效背景），还能叠字幕。
机器上没有 ffmpeg 也能做 —— Electron 自带 Chromium 的 `getDisplayMedia` + `MediaRecorder` 直接吐 mp4。

## 什么时候用

- 要给桌面宠物 / 桌面小工具 / Electron 应用录宣发片或演示片
- 机器上没有 ffmpeg CLI，装不了剪片工具
- 需要"真鼠标操作"进画面（悬停、点击、拖拽 —— 光靠截图做不出来）

## 三步搭起来

目录：`tools/rec/stage/`（`main.js` 主进程、`caption.html` 字幕层、`timeline.js` 分镜表、`bg.html` 壁纸）。

### ① 放行整屏 + 起录

```js
// 必须在 app.whenReady() 之后
session.defaultSession.setDisplayMediaRequestHandler((req, cb) => {
  desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
    .then((srcs) => cb({ video: srcs[0], audio: 'loopback' }))   // audio:'loopback' 抓系统声
    .catch(() => cb(null));
});
// 字幕层页面里
navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'screen' }, audio: { systemAudio: 'include' } });
new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', videoBitsPerSecond: 6_000_000 });
```

⚠ MediaRecorder 的 video 源**必须是 DesktopCapturerSource**，给 `null` 会报
"must be a WebFrameMain or DesktopCapturerSource"。

### ② 三层合成

| 层 | 怎么建 | 关键 |
|---|---|---|
| 壁纸 | 全屏、**无边框**、alwaysOnTop `'screen-saver'`、不透明 | `frame:false` 必需；但实测它**可能仍被其他应用压住**（见坑 ①） |
| 真应用窗口 | 放在画面一侧，alwaysOnTop `'screen-saver'`，**在壁纸之后提顶** | 谁后提顶谁在上 |
| 字幕 | 全屏置顶、`setIgnoreMouseEvents(true)` | **把壁纸画在这一层自己身上**（见坑 ①），别指望独立背景层 |

### ③ 时间轴

把分镜写成独立文件（`timeline.js`），改字幕不动录制逻辑：

```js
module.exports = {
  total: 70,
  segs: [[0, 3.2, '大标题', '副标题'], /* ... */],
  acts: [
    [11.4, 'mouse', { hover: 'cv' }],        // CDP 真鼠标
    [16.0, 'mouse', { drag: 'setBtn', dx: -120, dy: 70 }],
    [19.8, 'js',    { code: '真实接口()' }],  // 没有按钮的动作走真接口
  ],
};
```

- **真鼠标**：`webContents.debugger.attach('1.3')` + `Input.dispatchMouseEvent`（mouseMoved/mousePressed/mouseReleased）。只有真鼠标才能穿过"鼠标穿透"窗口、才拍得出手感。
- **真接口**：`executeJavaScript` 调程序自己的 API，画面照样是它自己跑出来的。

## 五条硬规矩（踩过的）

1. **在沙箱外跑**。沙箱里进程拿的是受限令牌，全屏置顶窗口压不住前台 IDE，成片是一屏编辑器 —— `setAlwaysOnTop('screen-saver')` 也没用。（Bash 工具：开 `dangerouslyDisableSandbox`）
2. **壁纸画进字幕层**。独立背景层实测压不住其他应用，但**字幕层压得住**。所以让字幕层不透明、自己画壁纸，层级 = 别的应用 → 字幕层（壁纸+字）→ 应用窗口。
3. **别抢焦点**。`focusable:false` 的窗口 `focus()` 是空操作；另开一个能聚焦的小窗口去抢，反而会让 DWM 重新分层、把置顶层按下去。
4. **构图靠数字判定，别靠肉眼**。写个 `pixstat.js`：用 `nativeImage.createFromPath().toBitmap()` 算平均亮度。壁纸压住了 → <80；没压住（满屏别的程序）→ >150。再比"主体所在区"和"空白对照区"的亮度，主体区明显 ≠ 对照区才说明主体真的画上去了。
5. **录完再退出，且要比 mtime**。字幕层是 stop() → blob → arraybuffer → IPC → 写盘，要好几秒。等文件出现再 `app.quit()`；只判"文件在不在"会被**上一轮的旧成片**骗过去。另外 Electron 主进程不会自己退，不退就会留一个置顶窗口污染下一场。

## 其他

- 应用的 `main.js` 若在顶层调 `app.disableHardwareAcceleration()`，必须在 `app.whenReady()` **之前** require。
- 要模拟"拖文件给它吃"：没有系统文件图标可用，用 `DataTransfer` + `new File()` 合成 `DragEvent` 派给程序自己的 drop 监听；**如果程序会弹确认框，后面要补一次点击**，否则那框会一直盖着别的按钮、把后续镜头全毁掉。
- 所有 Electron 命令加 `env -u ELECTRON_RUN_AS_NODE`（沙箱会注入这个变量，让 Electron 退化成纯 Node，ipcMain 全没了）。
