#!/bin/bash

# 同步 Capacitor 项目并打开 Xcode 的脚本

set -e

cd "$(dirname "$0")"

echo "🚀 开始同步项目到 iOS..."
echo ""

# 步骤 1: 构建移动端版本
echo "📦 步骤 1/3: 构建移动端版本..."
if npm run build:mobile; then
    echo "✅ 构建完成"
else
    echo "❌ 构建失败"
    exit 1
fi

echo ""

# 步骤 2: 同步到 iOS
echo "🔄 步骤 2/3: 同步到 iOS 平台..."
if npx cap sync ios; then
    echo "✅ 同步完成"
else
    echo "❌ 同步失败"
    exit 1
fi

echo ""

# 步骤 3: 修复 iOS 路径
echo "🔧 步骤 3/3: 修复 iOS 路径..."
if [ -f "./fix-ios-paths.sh" ]; then
    bash ./fix-ios-paths.sh
    echo "✅ 路径修复完成"
else
    echo "⚠️  未找到 fix-ios-paths.sh，跳过路径修复"
fi

echo ""

# 步骤 4: 打开 Xcode
echo "📱 正在打开 Xcode 项目..."
cd ios/App

if [ -d "App.xcodeproj" ]; then
    echo "✅ 找到 Xcode 项目文件"
    
    # 尝试打开 Xcode workspace（如果存在）
    if [ -d "App.xcworkspace" ]; then
        echo "📂 打开 Xcode Workspace..."
        open -a Xcode App.xcworkspace 2>/dev/null || open -a Xcode App.xcodeproj
    else
        echo "📂 打开 Xcode Project..."
        open -a Xcode App.xcodeproj
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Xcode 已打开"
        echo ""
        echo "📋 接下来请在 Xcode 中："
        echo "   1. 等待项目加载完成"
        echo "   2. 选择 Target 'App'"
        echo "   3. 进入 'Signing & Capabilities' 配置签名"
        echo "   4. 选择设备（模拟器或真机）"
        echo "   5. 点击运行按钮 (⌘R) 或 Product > Run"
        echo ""
        echo "💡 提示："
        echo "   - 如果遇到签名问题，请在 Signing & Capabilities 中选择您的开发团队"
        echo "   - 真机测试需要连接 iPhone 并信任开发者证书"
        echo "   - 模拟器测试可以直接运行，无需签名"
    else
        echo "⚠️  无法自动打开 Xcode"
        echo ""
        echo "请手动操作："
        echo "   1. 打开 Xcode 应用"
        echo "   2. 菜单栏：File > Open"
        echo "   3. 选择以下路径："
        echo "      $(pwd)/App.xcodeproj"
        echo ""
        echo "或者直接双击 App.xcodeproj 文件"
    fi
else
    echo "❌ 未找到 Xcode 项目文件"
    echo "   请确保已运行 'npx cap add ios'"
    exit 1
fi

