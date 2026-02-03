# 🚨 CORS 问题快速修复指南

## 当前问题
生产环境后端代码未更新，缺少对前端域名的CORS支持。

**前端域名**: `https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-frontend`  
**后台管理**: `https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-admin`  
**后端API**: `https://video-app-backend-215072-7-1319956699.sh.run.tcloudbase.com`

## 🎯 最快解决方案（3种方法，任选其一）

---

### 方法1：腾讯云控制台手动添加环境变量 ⭐ 推荐

#### 步骤：
1. 登录腾讯云控制台：https://console.cloud.tencent.com/tcb
2. 找到您的环境：`video-app-backend-215072-7-1319956699`
3. 点击左侧菜单"云托管" 或 "Cloud Run"
4. 找到您的后端服务（可能叫 `video-app-backend` 或类似名称）
5. 点击"服务配置" 或 "环境变量"
6. 添加以下环境变量：

```bash
ADMIN_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-admin
FRONTEND_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-frontend
NODE_ENV=production
```

7. 点击"保存"并"重启服务"
8. 等待1-2分钟服务重启完成
9. 刷新前端页面，重试上传书籍

**预计时间**: 5分钟

---

### 方法2：使用CloudBase CLI重新部署 ⭐⭐

#### 前提条件：
需要安装CloudBase CLI

```bash
# 安装CLI（如果还没安装）
npm install -g @cloudbase/cli

# 登录
tcb login

# 查看当前环境
tcb env:list
```

#### 部署步骤：

```bash
# 1. 进入后端目录
cd "/Users/et/Desktop/Learning/adminapi"

# 2. 设置环境ID（替换为您的实际环境ID）
export TCB_ENVID="video-app-backend-215072-7-1319956699"

# 3. 部署后端服务
tcb fn deploy --name video-app-backend --path ./ --runtime Nodejs16

# 4. 设置环境变量
tcb fn env:set video-app-backend ADMIN_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
tcb fn env:set video-app-backend FRONTEND_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
tcb fn env:set video-app-backend NODE_ENV=production

# 5. 重启服务
tcb fn invoke video-app-backend --restart
```

**预计时间**: 10分钟

---

### 方法3：临时绕过CORS（仅用于紧急测试）⚠️

在浏览器中安装CORS插件临时解决（**不推荐用于生产环境**）：

#### Chrome浏览器：
1. 安装插件："Allow CORS: Access-Control-Allow-Origin"
2. 启用插件
3. 刷新页面重试

**注意**: 这只是临时方案，其他用户仍会遇到CORS错误。

---

## 🔍 验证CORS是否修复

### 测试1：使用curl命令
```bash
curl -X OPTIONS \
  https://video-app-backend-215072-7-1319956699.sh.run.tcloudbase.com/api/books/upload \
  -H "Origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"
```

**期望结果**：
```
< access-control-allow-origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
```

**注意**: CloudBase的 `.tcloudbaseapp.com` 域名支持会匹配整个域名（包括子路径），所以配置基础域名即可。

### 测试2：查看后端日志
在腾讯云控制台查看后端日志，应该看到：
```
🌐 CORS: Checking origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
✅ CORS: Allowing CloudBase origin: https://...
```

如果看到：
```
⚠️ CORS blocked origin: https://...
```
说明配置未生效，需要检查代码是否更新。

---

## 📝 为什么会出现这个问题？

1. **本地代码已更新** ✅
   - Git提交：`6e579d4`
   - `server.js` 已支持所有 `.tcloudbaseapp.com` 域名

2. **生产环境代码未更新** ❌
   - 需要重新部署或设置环境变量

---

## 🆘 如果以上方法都不行

### 最后的手段：联系腾讯云支持

1. 登录腾讯云控制台
2. 点击右上角"工单"
3. 创建工单，说明：
   - 需要为云托管服务添加CORS支持
   - 前端域名：`https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com`
   - 后端域名：`https://video-app-backend-215072-7-1319956699.sh.run.tcloudbase.com`
   - 请求添加以下响应头：
     ```
     Access-Control-Allow-Origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
     Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
     Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
     Access-Control-Allow-Credentials: true
     ```

---

## ✅ 确认修复成功

修复后，在前端尝试上传书籍，应该不再出现CORS错误。

如果还有问题，请提供：
1. 后端服务日志（腾讯云控制台查看）
2. 浏览器Console的完整错误信息
3. Network标签中OPTIONS请求的响应头

