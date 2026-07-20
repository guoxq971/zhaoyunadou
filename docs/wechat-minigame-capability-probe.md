# V2.0 微信小游戏能力探针记录

核对日期：2026-07-20。证据范围只包含微信开放文档、仓库隔离探针的静态/语法检查和本机工具搜索。

## 真实结果

- 官方文档核对：完成。
- 隔离探针源码与语法检查：完成。
- 微信开发者工具：本机未发现。
- 开发者账号、扫码预览、iOS/Android 微信真机：未验证。
- 音频可听、锁屏/Home/聊天顶部进入后台及恢复：未验证。

因此 V2.0 的微信结论是 **官方能力可设计，静态探针已就绪，真实运行待验证**，不是“微信适配成功”。

## 能力矩阵

| 能力 | 官方接口与当前事实 | V2.1 Host 约束 | 本机证据 |
| --- | --- | --- | --- |
| 主 Canvas | [`wx.createCanvas()`](https://developers.weixin.qq.com/minigame/dev/api/render/canvas/wx.createCanvas.html) 首次调用为上屏画布 | `Surface` 独占首次调用顺序 | 静态覆盖，未运行 |
| 离屏 Canvas | 小游戏文档规定后续 `wx.createCanvas()` 为离屏；当前无有效的小游戏 `wx.createOffscreenCanvas` 文档页 | 正式 Adapter 不猜造专用 API | 探针优先检测，默认第二次 `createCanvas` |
| 图片 | [`wx.createImage()`](https://developers.weixin.qq.com/minigame/dev/api/render/image/wx.createImage.html)，`onload/onerror` | 统一缓存与失败状态 | 静态覆盖，未运行 |
| 触控 | [`wx.onTouchStart`](https://developers.weixin.qq.com/minigame/dev/api/device/touch-event/wx.onTouchStart.html) 及 Move/End/Cancel，注销要使用同一函数引用 | 归一为 pointer 事件，保留 identifier/坐标 | 静态覆盖，未运行 |
| 音频 | [`wx.createInnerAudioContext()`](https://developers.weixin.qq.com/minigame/dev/api/media/audio/wx.createInnerAudioContext.html)；必须 `destroy()` | 允许无声降级，前后台/音频中断统一暂停恢复 | 创建/播放路径已写，未确认可听 |
| 存储 | [`set/get/removeStorageSync`](https://developers.weixin.qq.com/minigame/dev/api/storage/wx.setStorageSync.html)；单键 1MB、总计 10MB，可被清理 | 所有调用 try/catch，保留会话内存影子 | 往返步骤已写，未运行 |
| 视口/DPR/安全区 | [`wx.getWindowInfo()`](https://developers.weixin.qq.com/minigame/dev/api/base/system/wx.getWindowInfo.html) 自 2.25.3；`safeArea` 可缺失 | 安全区缺失时降级为完整窗口 | 静态覆盖，未运行 |
| 设备/语言/性能 | `getDeviceInfo/getAppBaseInfo/getDeviceBenchmarkInfo`；旧 `getSystemInfoSync` 已停止维护 | 新 API 优先，低版本按能力降级 | 未运行 |
| 前后台 | [`wx.onShow/onHide`](https://developers.weixin.qq.com/minigame/dev/guide/runtime/operating-mechanism.html)；后台过久可直接被销毁 | 后台停循环，恢复重置时钟，不依赖销毁回调 | 订阅已写，未运行 |
| 计时/渲染帧 | 全局 `requestAnimationFrame/cancelAnimationFrame`；[`Performance.now()`](https://developers.weixin.qq.com/minigame/dev/api/base/performance/Performance.now.html) 为微秒 | Host 统一换算为毫秒，恢复后重置基准 | 静态覆盖，未运行 |
| 键盘 | `onKeyboardInput` 是拉起输入框后的文本回调，不等于 Web keydown | 微信 `keyboard` 能力默认 unsupported/degraded，不复制玩法 | 未实现，符合本轮非目标 |

## 工具搜索证据

已检查 `/Applications`、`~/Applications`、Spotlight、常见 CLI 命令和全局 npm 工具；只发现普通 `WeChat.app`，没有微信开发者工具或可用 CLI。这是本轮未执行模拟器/真机探针的真实阻塞，不使用 mock 冒充成功。

## V2.2 Adapter 设计约束

1. `Surface` 必须管理 `createCanvas` 首次/后续调用顺序。
2. 能力由 Adapter 根据 API 存在与 SDK 语义版本判断，不做字符串大小比较。
3. Touch/resize/show/hide/audio-interruption 订阅都保留同一 listener 引用并可注销。
4. Scheduler 将微秒转为毫秒，后台停止，恢复重置逻辑时钟。
5. Storage 失败、安全区缺失、无键盘、无音频和无性能分档均是明确降级，不在玩法文件写平台分支。
6. 开发者工具仅供调试；进入 V2.2 后必须加 iOS/Android 微信真机证据。
