#!/bin/bash

# 打开 Xcode 项目的脚本

cd "$(dirname "$0")/ios/App"

echo "📱 正在打开 Xcode 项目..."
echo ""

# 检查项目文件
if [ -d "App.xcodeproj" ]; then
    echo "✅ 找到 Xcode 项目文件"
    
    # 尝试打开 Xcode
    if open -a Xcode App.xcodeproj 2>/dev/null; then
        echo "✅ Xcode 已打开"
        echo ""
        echo "📋 接下来请在 Xcode 中："
        echo "   1. 等待项目加载完成"
        echo "   2. 选择 Target 'App'"
        echo "   3. 进入 'Signing & Capabilities' 配置签名"
        echo "   4. 选择设备后点击 Product > Archive"
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
    exit 1
fi

