# 中文字幕乱码修复 - 快速指南

## 问题
自建服务器生成的中文视频字幕乱码，英文正常。本地正常。

## 原因
服务器 Docker 容器缺少 UTF-8 locale 配置和中文字体。

## 已修复的文件
✅ **Dockerfile** - 已更新，添加：
- `locales` 包
- 中文字体（Noto CJK、WenQuanYi）
- locale 生成命令
- C.UTF-8 环境变量

## 立即修复步骤

### 方式 1：自动化脚本（推荐）
```bash
cd adminapi
./fix-subtitle-encoding.sh
```

### 方式 2：手动执行
```bash
cd adminapi

# 1. 构建镜像
docker build -t your-registry/adminapi:latest .

# 2. 推送镜像
docker push your-registry/adminapi:latest

# 3. 重新部署
tcb run deploy --name adminapi --image your-registry/adminapi:latest
```

## 验证修复
部署后运行诊断：
```bash
docker exec <container-id> node diagnose-subtitle-encoding.js
```

然后生成一个中文测试视频，检查字幕是否正常。

## 详细文档
- 🔍 **诊断脚本**: `diagnose-subtitle-encoding.js`
- 📖 **完整指南**: `SUBTITLE_ENCODING_FIX.md`
- 🚀 **部署脚本**: `fix-subtitle-encoding.sh`

## 技术要点
1. 问题根源：系统 locale 未配置，FFmpeg 无法解析 UTF-8
2. 解决方法：安装 locales + 生成 locale + 安装中文字体
3. 环境变量：使用 `C.UTF-8`（通用，所有系统支持）

## 预期效果
✅ 中文字幕正常显示，无乱码
✅ 英文字幕继续正常
✅ 本地和服务器行为一致

