#!/bin/bash

# 更新 Bundle ID 并同步 Capacitor

set -e

echo "=== 更新 Bundle ID 配置 ==="
echo ""

FRONTEND_DIR="/Users/et/Desktop/Learning/frontend"
cd "$FRONTEND_DIR"

NEW_BUNDLE_ID="com.ashleyfurniture.nexusmind"

echo "新的 Bundle ID: $NEW_BUNDLE_ID"
echo ""

# 检查 capacitor.config.json
if grep -q "\"appId\": \"$NEW_BUNDLE_ID\"" capacitor.config.json; then
    echo "✅ capacitor.config.json 已更新"
else
    echo "⚠️  capacitor.config.json 中的 appId 不匹配"
fi

echo ""
echo "正在重新同步 Capacitor..."
echo ""

# 构建前端应用
echo "1. 构建前端应用..."
CAPACITOR=true npm run build

# 同步 Capacitor
echo ""
echo "2. 同步 Capacitor..."
npx cap sync ios

echo ""
echo "=== ✅ 同步完成 ==="
echo ""
echo "下一步："
echo "1. 在 Xcode 中打开项目："
echo "   cd ios/App && open App.xcodeproj"
echo ""
echo "2. 在 Xcode 中验证 Bundle Identifier："
echo "   - 项目设置 > General > Bundle Identifier"
echo "   - 应该显示: $NEW_BUNDLE_ID"
echo ""
echo "3. 配置签名："
echo "   - 项目设置 > Signing & Capabilities"
echo "   - 确保 Bundle ID 与企业 App ID 匹配"
echo "   - 选择企业分发证书和配置文件"

