# 字幕换行问题修复说明

## 问题描述
- **本地环境**：中文字幕会自动换行，显示正常
- **服务器环境**：中文字幕不换行，长文本显示在一行，可能超出屏幕

## 根本原因

### 原因1: libass 版本差异
不同版本的 libass（FFmpeg 字幕渲染库）对 `WrapStyle` 参数的处理不同：
- **本地 macOS**：通常使用较新版本的 FFmpeg/libass，换行算法更智能
- **服务器 Docker**：可能使用较旧版本，换行算法不够智能或有 bug

### 原因2: 字体度量差异
不同字体对字符宽度的计算不同，影响换行位置判断：
- **本地**：使用系统默认中文字体（如 PingFang SC、Heiti SC）
- **服务器**：使用 Docker 容器中的字体（Noto Sans CJK、WenQuanYi）

### 原因3: 字幕文本未预处理
之前的代码直接将整句话作为一行字幕，依赖 FFmpeg 的 `WrapStyle=0` 自动换行。但由于上述差异，服务器端可能不会正确换行。

## 解决方案

### ✅ 已实施：在 SRT 文件中预先换行

修改了 `routes/books.js`，添加了 `wrapSubtitleText()` 函数，在生成 SRT 文件时就将长文本智能换行。

#### 换行策略

**中文字幕**（默认每行最多 20 字符）：
- 按字符数计算行宽
- 优先在标点符号后换行
- 避免在词语中间断开
- 示例：
  ```
  这是一段很长的中文字幕
  需要分成两行显示
  ```

**英文字幕**（默认每行最多 36 字符）：
- 保持单词完整性，不在单词中间断开
- 按空格分词
- 示例：
  ```
  This is a long English subtitle
  that needs to be wrapped
  ```

#### 代码修改位置

在 `convertParaformerResultToSRT()` 函数中，所有生成字幕文本的地方都应用了 `wrapSubtitleText()`：

```javascript
// 示例
const wrappedText = wrapSubtitleText(sentence, language);
srtContent += `${index}\n${startTime} --> ${endTime}\n${wrappedText}\n\n`;
```

### 配置参数

可以调整每行最大字符数：

```javascript
// 在 wrapSubtitleText 函数调用时指定
wrapSubtitleText(text, 'zh', 18);  // 中文每行18字
wrapSubtitleText(text, 'en', 40);  // 英文每行40字符
```

推荐值：
- **720x1280 分辨率**：中文 15-20 字/行，英文 30-40 字符/行
- **1080x1920 分辨率**：中文 20-25 字/行，英文 40-50 字符/行

### FFmpeg 参数保持不变

继续使用现有的 `force_style` 参数：
```
force_style='FontSize=8,PrimaryColour=&Hffffff,OutlineColour=&H606060,Outline=1,Shadow=0,Alignment=5,MarginL=50,MarginR=50,MarginV=80,WrapStyle=0'
```

`WrapStyle=0` 仍然保留，作为双重保险：
- 如果 SRT 文件中的换行不够，FFmpeg 仍会尝试自动换行
- 如果 SRT 文件已经换好行，FFmpeg 会尊重原有换行

## 测试验证

### 本地测试
1. 启动本地服务器
2. 生成中文视频
3. 检查字幕是否每行最多 20 字左右

### 服务器测试
1. 部署更新后的代码
2. 生成中文视频
3. 检查字幕是否正确换行，不会超出屏幕

### 对比测试
生成相同内容的视频，对比：
- 本地生成的视频
- 服务器生成的视频

两者字幕应该都正确换行，显示一致。

## 其他相关修复

如果换行仍有问题，可以尝试以下额外方案：

### 方案A: 指定字体（强制统一）
```javascript
force_style='FontName=Noto Sans CJK SC,FontSize=8,...'
```

### 方案B: 调整边距（增加换行空间）
```javascript
force_style='...,MarginL=80,MarginR=80,...'
```

### 方案C: 减小字体（更多空间）
```javascript
force_style='...,FontSize=7,...'
```

### 方案D: 改变换行模式
```javascript
force_style='...,WrapStyle=2,...'  // 不自动换行，完全依赖 SRT
```

## 兼容性说明

- ✅ 向后兼容：已生成的视频不受影响
- ✅ 本地和服务器：统一行为，都使用预换行
- ✅ 中英文支持：分别处理，策略不同
- ✅ 性能影响：几乎无影响，只是字符串处理

## 部署步骤

1. **更新代码**
   ```bash
   cd /Users/et/Desktop/Learning
   git pull origin main
   ```

2. **本地测试**
   ```bash
   cd adminapi
   node server.js
   # 生成测试视频
   ```

3. **提交并推送**
   ```bash
   git add adminapi/routes/books.js adminapi/SUBTITLE_WRAPPING_FIX.md
   git commit -m "修复字幕换行问题：在SRT文件中预先换行"
   git push origin main
   ```

4. **服务器部署**
   - 拉取最新代码
   - 重启服务
   - 生成测试视频验证

## 诊断工具

运行诊断脚本检查环境差异：
```bash
node diagnose-subtitle-wrapping.js
```

## 总结

通过在 SRT 文件生成阶段就进行智能换行，解决了本地和服务器环境差异导致的字幕换行不一致问题。这种方案：

✅ 不依赖 FFmpeg/libass 版本
✅ 不依赖字体配置
✅ 行为可控、可预测
✅ 本地和服务器统一

