# 查找 JavaScript 日志的正确方法

## 🔍 问题

您看到的日志主要是系统日志（WebKit、CoreFoundation），但没有看到我们添加的 JavaScript `console.log` 输出。

## 💡 原因

**JavaScript 的 `console.log` 不会直接输出到系统日志中**。它们输出到 WebView 的控制台，需要通过特殊方式查看。

## ✅ 正确的查看方法

### 方法 1: 使用 Xcode 控制台（最推荐）

这是查看 JavaScript 日志的最佳方法：

1. **连接设备到 Mac**（USB）

2. **打开 Xcode**
   ```bash
   cd /Users/et/Desktop/Learning/frontend/ios/App
   open App.xcodeproj
   ```

3. **查看设备控制台**
   - 菜单栏：`Window` > `Devices and Simulators`
   - 选择您的设备
   - 点击 `Open Console` 按钮
   - 在搜索框中输入：`API`、`Error`、`🌐`、`🔧`

4. **或者在 Xcode 中运行应用**
   - 连接设备
   - 选择设备作为运行目标
   - 按 `Cmd+R` 运行应用
   - **查看底部控制台**（这里会显示 JavaScript console.log）

### 方法 2: 使用 Safari Web Inspector（如果支持）

1. **在 iOS 设备上**：
   - 设置 > Safari > 高级 > Web Inspector（开启）

2. **在 Mac 上**：
   - Safari > 偏好设置 > 高级 > 勾选"在菜单栏中显示'开发'菜单"

3. **连接设备并查看**：
   - 连接设备到 Mac
   - 在设备上打开应用
   - 在 Mac 的 Safari 中：`开发` > `[设备名]` > `[应用名]`
   - 打开 Web Inspector，查看 Console 标签页

**注意**：Capacitor 应用可能不完全支持 Web Inspector。

### 方法 3: 在应用中显示错误（已实现）

我们已经更新了代码，错误会显示在：
- **错误消息框**（输入框下方的红色文本）
- **Toast 通知**（底部弹出的通知）

这些不需要查看日志就能看到！

## 🔍 查找的关键信息

在 Xcode 控制台中，查找：

- `🔧 API_BASE_URL 配置:` - API URL 配置值
- `🌐 API Request:` - API 请求详情
- `📥 API Response:` - API 响应
- `❌ API Error:` - API 错误
- `🚀 Starting OTP request` - 开始登录请求
- `nexusmind-api-test` - API 服务器地址

## 📋 当前日志的含义

您提供的日志显示：
- ✅ 应用正在运行（`com.ashleyfurniture.nexusmind`）
- ✅ 应用已启动
- ⚠️ WebKit 调试信息（可以忽略，这是正常的）
- ❌ 没有 JavaScript 日志（需要使用 Xcode 查看）

## 🎯 推荐操作

1. **使用 Xcode 查看控制台**（最可靠）
2. **或者查看应用中的错误提示**（Toast 和错误消息框）
3. **告诉我具体的错误消息**，我可以帮您诊断

## 💡 快速测试

如果您想快速看到错误信息：

1. 打开应用
2. 尝试登录
3. 查看：
   - 输入框下方的红色错误文本
   - 底部弹出的 Toast 通知
4. 这些会显示详细的错误信息，不需要查看日志

## 🔧 如果仍然需要查看日志

运行以下命令查看所有应用日志（包括可能的 JavaScript 输出）：

```bash
log stream --predicate 'processImagePath contains "App"' --level debug | grep -v "WebKitDebugDragLiftDelay" | grep -v "User Defaults"
```

这会过滤掉系统调试信息，只显示应用相关的日志。


