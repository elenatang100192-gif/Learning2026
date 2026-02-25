#!/bin/bash

echo "=== 修复 'bogus resource handle' 警告 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
cd "$PROJECT_DIR"

echo "📋 这个警告通常是系统级别的，不影响应用功能。"
echo ""

echo "🔍 步骤 1: 检查应用功能是否正常"
echo ""
read -p "应用的主要功能（登录、浏览等）是否正常工作？(y/n): " app_works

if [ "$app_works" = "y" ] || [ "$app_works" = "Y" ]; then
    echo ""
    echo "✅ 应用功能正常，这个警告可以安全忽略。"
    echo ""
    echo "💡 建议："
    echo "   1. 忽略此警告，专注于查找登录相关的日志"
    echo "   2. 在查看日志时过滤掉这些警告"
    echo ""
    echo "查看登录日志："
    echo "   open -a Console"
    echo "   搜索：App API Error 🔧 🌐 ❌"
    exit 0
fi

echo ""
echo "📋 步骤 2: 清理构建缓存"
echo ""

read -p "是否清理构建缓存？(y/n): " clean_cache

if [ "$clean_cache" = "y" ] || [ "$clean_cache" = "Y" ]; then
    echo ""
    echo "清理前端构建缓存..."
    rm -rf dist
    rm -rf node_modules/.vite
    echo "✅ 前端缓存已清理"
    
    echo ""
    echo "清理 iOS 构建缓存..."
    if [ -d "ios/App/build" ]; then
        rm -rf ios/App/build
        echo "✅ iOS 构建缓存已清理"
    fi
    
    echo ""
    echo "清理 Xcode DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null
    echo "✅ Xcode DerivedData 已清理"
    
    echo ""
    echo "清理 Capacitor 缓存..."
    rm -rf .capacitor
    echo "✅ Capacitor 缓存已清理"
    
    echo ""
    echo "重新同步 Capacitor..."
    npx cap sync ios
    echo "✅ Capacitor 已重新同步"
fi

echo ""
echo "📋 步骤 3: 检查配置"
echo ""

# 检查 Info.plist
if [ -f "ios/App/App/Info.plist" ]; then
    echo "✅ Info.plist 存在"
    
    if grep -q "NSAppTransportSecurity" "ios/App/App/Info.plist"; then
        echo "✅ App Transport Security 已配置"
    else
        echo "⚠️ App Transport Security 未配置"
    fi
else
    echo "❌ Info.plist 不存在"
fi

echo ""
echo "📋 步骤 4: 检查 Capacitor 版本"
echo ""

if command -v npm &> /dev/null; then
    CAPACITOR_VERSION=$(npm list @capacitor/core 2>/dev/null | grep @capacitor/core | head -1)
    if [ -n "$CAPACITOR_VERSION" ]; then
        echo "✅ Capacitor 版本: $CAPACITOR_VERSION"
    else
        echo "⚠️ 无法获取 Capacitor 版本"
    fi
else
    echo "⚠️ npm 未安装"
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 重新构建 IPA："
echo "   cd /Users/et/Desktop/Learning"
echo "   ./build-enterprise-ipa.sh"
echo ""
echo "2. 重新安装应用并测试"
echo ""
echo "3. 如果警告仍然出现但应用功能正常，可以忽略此警告"
echo ""
echo "4. 查看登录相关的日志（忽略资源句柄警告）："
echo "   open -a Console"
echo "   搜索：App API Error 🔧 🌐 ❌"
echo ""

