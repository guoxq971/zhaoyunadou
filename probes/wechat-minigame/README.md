# 微信小游戏 Host 能力探针

该目录是 V2.0 隔离技术探针，不导入 `src/`，不是正式微信 Adapter，也不会把 `wechat` 写入 Game Pack 的 `targetPlatforms`。

探针顺序：主 Canvas → 离屏 Canvas → 图片 → 触摸 → 音频 → 存储往返 → 渲染帧/单调时钟 → 后台 → 恢复。屏幕和控制台同时记录 `pass/fail/pending` JSON。

当前小游戏官方语义是第一次 `wx.createCanvas()` 创建上屏画布，之后调用创建离屏画布。探针仅在宿主确实提供 `wx.createOffscreenCanvas` 时记录为专用 API，否则使用第二次 `wx.createCanvas()`。

真实验收必须同时满足：

1. 微信开发者工具载入该目录并完整走到后台/恢复。
2. 至少一台 iOS 和一台 Android 微信真机复验。
3. 人工确认短音可听；`onPlay` 回调不代表人耳验证。
4. 保存平台、基础库版本、设备、系统、时间和控制台 JSON。

本仓库当前未发现微信开发者工具或 CLI，因此该探针仅完成静态和语法验证，运行状态必须保持 `pending`。
