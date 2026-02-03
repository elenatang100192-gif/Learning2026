# CORS 错误修复说明

## 问题描述
生产环境上传书籍时出现CORS错误：
```
Access to XMLHttpRequest at 'https://video-app-backend-215072-7-1319956699.sh.run.tcloudbase.com/api/books/upload' 
from origin 'https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com' 
has been blocked by CORS policy
```

## 原因分析
后端API的CORS配置中缺少生产环境的前端域名。

## 解决方案

### 方法1：在CloudBase后端设置环境变量（推荐）

1. 登录腾讯云CloudBase控制台
2. 进入您的后端服务（`video-app-backend-215072-7`）
3. 找到"环境变量"或"配置"选项
4. 添加以下环境变量：

```bash
ADMIN_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-admin
FRONTEND_URL=https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com/Video-frontend
NODE_ENV=production
```

5. 重启后端服务使配置生效

### 方法2：本地测试使用 .env 文件

创建 `adminapi/.env` 文件（已提供 `.env.production` 模板）：

```bash
cd "adminapi"
cp .env.production .env
```

然后根据需要修改域名。

### 方法3：代码已自动支持（无需修改）

后端代码已经支持所有 `.tcloudbaseapp.com` 域名：

```javascript
// 在 server.js 第58-63行
if (origin && origin.includes('.tcloudbaseapp.com')) {
  console.log(`✅ CORS: Allowing CloudBase origin: ${origin}`);
  callback(null, true);
  return;
}
```

**如果还是出现CORS错误，说明生产环境的后端代码可能不是最新版本。**

## 验证步骤

### 1. 检查后端日志
在CloudBase控制台查看后端服务日志，搜索：
```
CORS: Checking origin
```

应该看到类似：
```
🌐 CORS: Checking origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
✅ CORS: Allowing CloudBase origin: https://...
```

### 2. 如果日志显示被阻止
```
⚠️ CORS blocked origin: https://...
```

说明需要：
1. 部署最新代码到生产环境
2. 或者添加环境变量配置

## 重新部署到生产环境

### 方法A：通过Git部署
```bash
# 1. 确保代码已推送到Git
cd /Users/et/Desktop/Learning
git push origin main

# 2. 在CloudBase控制台触发重新部署
# 或者使用CloudBase CLI
tcb fn deploy
```

### 方法B：直接上传代码
1. 打包后端代码
```bash
cd "adminapi"
zip -r backend.zip . -x "node_modules/*" -x ".git/*" -x "*.log"
```

2. 在CloudBase控制台上传 `backend.zip`
3. 重启服务

## 当前代码状态
✅ Git提交: `74ca358` (最新)  
✅ CORS配置已优化，支持所有CloudBase域名  
⚠️ 需要部署到生产环境

## 紧急临时方案
如果无法立即重新部署，可以在CloudBase控制台的"API网关"或"云函数配置"中手动添加CORS头：

```
Access-Control-Allow-Origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

## 测试CORS
使用curl测试：
```bash
curl -X OPTIONS \
  https://video-app-backend-215072-7-1319956699.sh.run.tcloudbase.com/api/books/upload \
  -H "Origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

应该返回：
```
< Access-Control-Allow-Origin: https://video-app-env-8gpoewzu84d85ace-1319956699.tcloudbaseapp.com
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
```

