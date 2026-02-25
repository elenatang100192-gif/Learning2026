#!/bin/bash

# iOS 应用打包脚本
# 使用方法: ./build-ios.sh

set -e

echo "🚀 开始构建 iOS 应用..."

# 1. 构建前端应用
echo "📦 构建前端应用..."
CAPACITOR=true npm run build

# 2. 同步到 iOS 平台
echo "🔄 同步到 iOS 平台..."
npx cap sync ios

# 3. 打开 Xcode
echo "📱 打开 Xcode..."
echo "💡 在 Xcode 中："
echo "   1. 选择目标设备或模拟器"
echo "   2. 点击 Product > Archive 进行归档"
echo "   3. 在 Organizer 中导出 .ipa 文件"
echo ""

npx cap open ios

