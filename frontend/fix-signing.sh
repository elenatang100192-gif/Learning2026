#!/bin/bash

# 修复 Xcode 签名配置问题

set -e

echo "=== 修复 Xcode 签名配置 ==="
echo ""

FRONTEND_DIR="/Users/et/Desktop/Learning/frontend"
cd "$FRONTEND_DIR"

echo "1. 检查 Capacitor 配置..."
if [ -f "capacitor.config.json" ]; then
    APP_ID=$(grep -o '"appId": "[^"]*"' capacitor.config.json | cut -d'"' -f4)
    echo "   当前 App ID: $APP_ID"
else
    echo "   ❌ 未找到 capacitor.config.json"
    exit 1
fi

echo ""
echo "2. 检查 iOS 项目..."
if [ -d "ios/App" ]; then
    echo "   ✅ iOS 项目存在"
else
    echo "   ❌ iOS 项目不存在"
    exit 1
fi

echo ""
echo "3. 提示修改 Bundle ID（如果需要）..."
echo ""
echo "   如果 'com.nexusmind.shortvideo' 已被占用，"
echo "   建议修改为更唯一的标识符，例如："
echo "   - com.yourname.nexusmind"
echo "   - com.yourname.shortvideo"
echo "   - com.yourname.nexusmindshortvideo"
echo ""
read -p "   是否要修改 App ID？(y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "   请输入新的 App ID (如: com.yourname.nexusmind): " NEW_APP_ID
    
    if [ -n "$NEW_APP_ID" ]; then
        echo ""
        echo "   正在更新配置..."
        
        # 更新 capacitor.config.json
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/\"appId\": \"[^\"]*\"/\"appId\": \"$NEW_APP_ID\"/" capacitor.config.json
        else
            # Linux
            sed -i "s/\"appId\": \"[^\"]*\"/\"appId\": \"$NEW_APP_ID\"/" capacitor.config.json
        fi
        
        echo "   ✅ 已更新 capacitor.config.json"
        
        echo ""
        echo "4. 重新同步 Capacitor..."
        CAPACITOR=true npm run build
        npx cap sync ios
        
        echo ""
        echo "   ✅ 同步完成"
        echo ""
        echo "   新的 App ID: $NEW_APP_ID"
    else
        echo "   ⚠️  未输入 App ID，跳过修改"
    fi
else
    echo "   跳过修改，使用当前 App ID: $APP_ID"
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "下一步："
echo "1. 打开 Xcode 项目："
echo "   cd ios/App && open App.xcodeproj"
echo ""
echo "2. 在 Xcode 中："
echo "   - Xcode > Settings > Accounts：添加 Apple ID"
echo "   - 项目设置 > Signing & Capabilities："
echo "     - 勾选 'Automatically manage signing'"
echo "     - 选择您的 Team (Apple ID)"
echo ""
echo "3. 如果仍然报错，尝试修改 Bundle Identifier 为唯一值"
echo ""
echo "详细说明请查看：XCODE_SIGNING_FIX.md"

