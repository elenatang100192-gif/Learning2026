# admin API

基于Express.js的后端API服务，为frontend和admin提供数据接口。

## 🏗️ 架构概览

```
前端应用 (React) ←───── HTTP API ─────→ 后端API (Express.js)
    ↓                                           ↓
    ↓                                           ↓
浏览器                                     Express API
                                              ↓
                                         MySQL数据库
                                              ↓
                                         MySQL + OSS文件存储
```

## 🚀 快速开始

### 安装依赖
```bash
cd admin\ API
npm install
```

### 配置环境变量

1. **复制环境变量模板文件**：
```bash
cp .env.example .env
```

2. **编辑 `.env` 文件，填入你的API密钥**：

```bash
# 阿里云百炼（DashScope）API配置
# 获取方式：https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2803795
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# Deepseek API配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 腾讯云TTS API配置
TENCENT_SECRET_ID=your_tencent_secret_id_here
TENCENT_SECRET_KEY=your_tencent_secret_key_here

# MySQL数据库配置
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

**重要提示**：
- `.env` 文件已添加到 `.gitignore`，不会被提交到Git仓库
- 请妥善保管你的API密钥，不要泄露给他人
- 阿里云百炼API Key获取方式：访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2803795)

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3001` 启动。

## 📋 API接口

### 基础信息
- **Base URL**: `http://localhost:3001/api`
- **认证**: Session-based (存储在localStorage中)
- **数据格式**: JSON

### 主要接口

#### 🔐 认证相关
- `POST /auth/send-otp` - 发送OTP验证码
- `POST /auth/login` - 邮箱登录
- `GET /auth/me` - 获取当前用户信息
- `POST /auth/logout` - 登出

#### 🎬 视频相关
- `GET /videos` - 获取视频列表（支持分页、筛选、排序）
- `GET /videos/:id` - 获取单个视频详情
- `POST /videos/publish` - 发布新视频
- `POST /videos/:id/view` - 增加观看次数
- `POST /videos/:id/watch` - 记录观看历史

#### 📂 分类相关
- `GET /categories` - 获取所有分类

#### ❤️ 点赞相关
- `GET /likes/:videoId/status` - 检查点赞状态
- `POST /likes/:videoId/toggle` - 点赞/取消点赞

#### ⭐ 收藏相关
- `GET /favorites/:videoId/status` - 检查收藏状态
- `POST /favorites/:videoId/toggle` - 收藏/取消收藏
- `GET /favorites` - 获取用户收藏列表

#### 👤 用户相关
- `GET /users/publications` - 获取用户发布记录
- `GET /users/watch-history` - 获取观看历史

#### 📤 文件上传
- `POST /upload/video` - 上传视频文件
- `POST /upload/cover` - 上传封面图片

#### 🏥 系统
- `GET /health` - 健康检查

## 🔧 配置

### 环境变量
```bash
# 服务器配置
PORT=3001
NODE_ENV=development

# MySQL数据库配置
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# CORS配置
FRONTEND_URL=http://localhost:5174
ADMIN_URL=http://localhost:5173
```

## 🗄️ 数据模型

### 核心数据表
- **Category**: 视频分类
- **Video**: 视频内容
- **_User**: 用户信息
- **Like**: 点赞记录
- **Favorite**: 收藏记录
- **WatchHistory**: 观看历史
- **Comment**: 评论（预留）

### 数据关系
```
User ──┬── Like ─── Video
       │
       ├── Favorite ── Video
       │
       ├── WatchHistory ── Video
       │
       └── Video (as author)
```

## 🔒 安全特性

- **CORS**: 配置允许的前端域名
- **速率限制**: API请求频率限制
- **Helmet**: HTTP安全头
- **输入验证**: 使用express-validator
- **数据压缩**: Gzip压缩响应

## 🧪 测试API

### 健康检查
```bash
curl http://localhost:3001/api/health
```

### 获取分类
```bash
curl http://localhost:3001/api/categories
```

### 获取视频
```bash
curl "http://localhost:3001/api/videos?page=1&limit=10"
```

## 📁 项目结构

```
admin API/
├── routes/                 # API路由
│   ├── auth.js            # 认证路由
│   ├── videos.js          # 视频路由
│   ├── categories.js      # 分类路由
│   ├── likes.js           # 点赞路由
│   ├── favorites.js       # 收藏路由
│   ├── users.js           # 用户路由
│   └── upload.js          # 文件上传路由
├── server.js              # 服务器主文件
├── package.json           # 项目配置
└── README.md             # 说明文档
```

## 🚦 部署

### 生产环境部署
1. 设置环境变量
2. 运行 `npm start`
3. 配置反向代理（Nginx）
4. 设置SSL证书

### Docker部署（可选）
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🔍 监控和日志

- **Morgan**: HTTP请求日志
- **错误处理**: 统一的错误响应格式
- **健康检查**: `/api/health` 端点

## 🤝 贡献

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📝 许可证

本项目采用MIT许可证。
