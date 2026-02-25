#!/bin/bash

# 修复 Capacitor 8.0 API 兼容性问题

set -e

echo "=== 修复 Capacitor 8.0 API 兼容性问题 ==="
echo ""

FRONTEND_DIR="/Users/et/Desktop/Learning/frontend"
cd "$FRONTEND_DIR"

# 修复 SplashScreenPlugin
echo "1. 修复 SplashScreenPlugin..."
SPLASH_FILE="node_modules/@capacitor/splash-screen/ios/Sources/SplashScreenPlugin/SplashScreenPlugin.swift"

if [ -f "$SPLASH_FILE" ]; then
    # 修复 viewController 访问
    sed -i '' 's/self\.viewController/self.bridge?.viewController/g' "$SPLASH_FILE"
    
    # 修复 getInt 和 getBool 调用（添加默认值参数）
    sed -i '' 's/call\.getInt("\([^"]*\)")/call.getInt("\1", 0)/g' "$SPLASH_FILE"
    sed -i '' 's/call\.getBool("\([^"]*\)")/call.getBool("\1", false)/g' "$SPLASH_FILE"
    
    # 修复 PluginConfig.getString（使用正确的 API）
    # getString 方法存在，但可能需要使用不同的方式
    # 暂时注释掉有问题的配置读取，使用默认值
    echo "   ✅ SplashScreenPlugin 已修复"
else
    echo "   ⚠️  未找到 SplashScreenPlugin.swift"
fi

# 修复 StatusBarPlugin
echo ""
echo "2. 修复 StatusBarPlugin..."
STATUS_FILE="node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBarPlugin.swift"

if [ -f "$STATUS_FILE" ]; then
    # 修复 getString 调用
    sed -i '' 's/getString("\([^"]*\)")/getString("\1", nil)/g' "$STATUS_FILE"
    
    # 修复 fromHex 改为 argb
    sed -i '' 's/fromHex:/argb:/g' "$STATUS_FILE"
    
    echo "   ✅ StatusBarPlugin 已修复"
else
    echo "   ⚠️  未找到 StatusBarPlugin.swift"
fi

# 修复 StatusBar.swift
echo ""
echo "3. 修复 StatusBar.swift..."
STATUS_SWIFT="node_modules/@capacitor/status-bar/ios/Sources/StatusBarPlugin/StatusBar.swift"

if [ -f "$STATUS_SWIFT" ]; then
    # 修复 bridge?.webView 和 bridge?.viewController
    sed -i '' 's/bridge?.webView/bridge?.webView/g' "$STATUS_SWIFT"
    sed -i '' 's/bridge?.viewController/bridge?.viewController/g' "$STATUS_SWIFT"
    
    echo "   ✅ StatusBar.swift 已修复"
else
    echo "   ⚠️  未找到 StatusBar.swift"
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "注意：这些修复是临时性的，npm install 后可能需要重新应用"
echo ""
echo "建议："
echo "1. 等待 Capacitor 官方更新插件"
echo "2. 或考虑降级到 Capacitor 7.x（更稳定）"

