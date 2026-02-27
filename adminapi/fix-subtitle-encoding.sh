#!/bin/bash
###############################################################################
# 修复中文字幕乱码 - 重新部署脚本
###############################################################################

set -e  # 遇到错误立即退出

echo "🚀 开始修复中文字幕乱码问题并重新部署..."
echo ""

# 检查是否在正确的目录
if [ ! -f "Dockerfile" ]; then
    echo "❌ 错误：请在 adminapi 目录下运行此脚本"
    exit 1
fi

# 1. 显示 Dockerfile 变更
echo "📋 1. 检查 Dockerfile 修改..."
echo "   已添加："
echo "   - locales 包（生成 UTF-8 locale）"
echo "   - fonts-noto-cjk, fonts-wqy-zenhei（中文字体）"
echo "   - locale-gen 命令（生成 locale）"
echo "   - C.UTF-8 环境变量"
echo ""

# 2. 提示用户确认镜像仓库信息
echo "📦 2. 准备构建 Docker 镜像..."
echo ""
read -p "   请输入镜像仓库地址（例如：ccr.ccs.tencentyun.com/your-namespace/adminapi）: " IMAGE_REGISTRY
if [ -z "$IMAGE_REGISTRY" ]; then
    echo "   ❌ 镜像仓库地址不能为空"
    exit 1
fi

# 生成镜像标签（使用时间戳）
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
IMAGE_TAG="${IMAGE_REGISTRY}:${TIMESTAMP}"
IMAGE_TAG_LATEST="${IMAGE_REGISTRY}:latest"

echo "   镜像标签: ${IMAGE_TAG}"
echo "   最新标签: ${IMAGE_TAG_LATEST}"
echo ""

# 3. 构建 Docker 镜像
echo "🔨 3. 构建 Docker 镜像..."
docker build -t "${IMAGE_TAG}" -t "${IMAGE_TAG_LATEST}" .
if [ $? -eq 0 ]; then
    echo "   ✅ 镜像构建成功"
else
    echo "   ❌ 镜像构建失败"
    exit 1
fi
echo ""

# 4. 推送镜像到仓库
echo "📤 4. 推送镜像到仓库..."
read -p "   是否立即推送镜像？(y/n): " PUSH_CONFIRM
if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
    docker push "${IMAGE_TAG}"
    docker push "${IMAGE_TAG_LATEST}"
    if [ $? -eq 0 ]; then
        echo "   ✅ 镜像推送成功"
    else
        echo "   ❌ 镜像推送失败"
        exit 1
    fi
else
    echo "   ⏭️  跳过推送，稍后手动推送："
    echo "      docker push ${IMAGE_TAG}"
    echo "      docker push ${IMAGE_TAG_LATEST}"
fi
echo ""

# 5. 部署说明
echo "🎉 构建完成！"
echo ""
echo "📝 接下来的步骤："
echo ""
echo "   方式1: 使用腾讯云 CloudBase CLI 部署"
echo "   ----------------------------------------"
echo "   tcb run deploy --name adminapi --image ${IMAGE_TAG_LATEST}"
echo ""
echo "   方式2: 在腾讯云控制台手动部署"
echo "   ----------------------------------------"
echo "   1. 登录腾讯云控制台"
echo "   2. 进入 CloudBase 服务"
echo "   3. 找到 adminapi 服务"
echo "   4. 点击「新建版本」或「更新版本」"
echo "   5. 选择镜像: ${IMAGE_TAG_LATEST}"
echo "   6. 点击「部署」"
echo ""
echo "   方式3: 使用 Docker Compose（本地测试）"
echo "   ----------------------------------------"
echo "   docker-compose up -d"
echo ""
echo "🧪 部署后验证："
echo "   1. 运行诊断脚本检查环境："
echo "      docker exec <container-id> node diagnose-subtitle-encoding.js"
echo ""
echo "   2. 生成测试中文视频，检查字幕是否正常"
echo ""
echo "   3. 查看容器日志："
echo "      docker logs <container-id>"
echo ""
echo "✅ 修复完成！"

