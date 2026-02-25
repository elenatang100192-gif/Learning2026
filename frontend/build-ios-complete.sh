#!/bin/bash

# iOS 应用完整打包脚本
# 使用方法: ./build-ios-complete.sh

set -e

echo "🚀 开始 iOS 应用打包流程..."
echo ""

# 1. 构建前端应用
echo "📦 步骤 1/4: 构建前端应用..."
CAPACITOR=true npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi

echo "✅ 前端应用构建完成"
echo ""

# 2. 同步到 iOS 平台
echo "🔄 步骤 2/4: 同步到 iOS 平台..."
npx cap sync ios

if [ $? -ne 0 ]; then
    echo "❌ 同步失败，请检查错误信息"
    exit 1
fi

echo "✅ iOS 平台同步完成"
echo ""

# 3. 检查 Xcode
echo "🔍 步骤 3/4: 检查 Xcode 环境..."

if ! command -v xcodebuild &> /dev/null; then
    echo "⚠️  未找到 xcodebuild"
    echo "💡 请确保已安装 Xcode（从 Mac App Store 安装）"
    echo ""
    echo "📱 安装 Xcode 后，请运行以下命令打开项目："
    echo "   cd ios/App"
    echo "   open App.xcodeproj"
    echo ""
    echo "然后在 Xcode 中："
    echo "   1. 选择目标设备（真机或模拟器）"
    echo "   2. 点击 Product > Archive"
    echo "   3. 等待归档完成"
    echo "   4. 在 Organizer 中导出应用"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
echo "✅ 找到 Xcode: $XCODE_VERSION"
echo ""

# 4. 打开 Xcode
echo "📱 步骤 4/4: 打开 Xcode 项目..."
cd ios/App

if [ -d "App.xcodeproj" ]; then
    echo "✅ 找到 Xcode 项目文件"
    echo ""
    echo "📋 接下来请在 Xcode 中完成以下步骤："
    echo ""
    echo "1️⃣  配置签名："
    echo "   - 点击项目文件（左侧导航栏）"
    echo "   - 选择 Target 'App'"
    echo "   - 进入 'Signing & Capabilities' 标签"
    echo "   - 勾选 'Automatically manage signing'"
    echo "   - 选择您的 Apple Developer Team"
    echo ""
    echo "2️⃣  选择目标设备："
    echo "   - 在 Xcode 顶部选择设备（真机或模拟器）"
    echo ""
    echo "3️⃣  归档应用："
    echo "   - 菜单栏：Product > Archive"
    echo "   - 等待归档完成（可能需要几分钟）"
    echo ""
    echo "4️⃣  导出应用："
    echo "   - 归档完成后，会弹出 Organizer 窗口"
    echo "   - 选择刚创建的归档文件"
    echo "   - 点击 'Distribute App'"
    echo "   - 选择分发方式："
    echo "     • App Store Connect - 发布到 App Store"
    echo "     • Ad Hoc - 测试分发（最多 100 台设备）"
    echo "     • Enterprise - 企业分发"
    echo "     • Development - 开发测试"
    echo "   - 按照向导完成导出"
    echo ""
    
    # 尝试打开 Xcode
    if open App.xcodeproj 2>/dev/null; then
        echo "✅ Xcode 项目已打开"
    else
        echo "⚠️  无法自动打开 Xcode，请手动打开："
        echo "   open $(pwd)/App.xcodeproj"
    fi
else
    echo "❌ 未找到 Xcode 项目文件"
    exit 1
fi

echo ""
echo "✨ 打包准备完成！请在 Xcode 中继续操作。"

