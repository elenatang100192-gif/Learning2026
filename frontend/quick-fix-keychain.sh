#!/bin/bash

echo "=== 快速修复钥匙串访问权限 ==="
echo ""

# 检查证书
CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
if security find-certificate -c "$CERT_NAME" -a &>/dev/null; then
    echo "✅ 找到证书: $CERT_NAME"
else
    echo "❌ 未找到证书，请先安装证书"
    exit 1
fi

# 提示用户输入密码
echo ""
echo "请输入钥匙串密码（用于设置访问权限）："
read -sp "密码: " KEYCHAIN_PASSWORD
echo ""

# 解锁钥匙串
echo "1. 解锁钥匙串..."
security unlock-keychain -p "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null || {
    echo "⚠️  解锁失败，请检查密码"
    exit 1
}

# 设置访问控制
echo "2. 设置证书访问控制..."
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null || {
    echo "⚠️  设置访问控制失败"
}

# 设置超时
echo "3. 设置钥匙串超时（1小时）..."
security set-keychain-settings -t 3600 -u ~/Library/Keychains/login.keychain-db 2>/dev/null || {
    echo "⚠️  设置超时失败"
}

echo ""
echo "✅ 钥匙串访问权限已修复！"
echo ""
echo "现在可以尝试重新构建项目："
echo "  cd ios/App"
echo "  xcodebuild archive -project App.xcodeproj -scheme App -configuration Release ..."
