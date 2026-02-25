#!/bin/bash

echo "=== 修复钥匙串访问权限 ==="
echo ""

# 1. 检查证书
echo "1. 检查证书..."
CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
if security find-certificate -c "$CERT_NAME" -a &>/dev/null; then
    echo "✅ 找到证书: $CERT_NAME"
else
    echo "❌ 未找到证书: $CERT_NAME"
    echo "请先安装证书文件（.p12）"
    exit 1
fi

# 2. 解锁钥匙串
echo ""
echo "2. 解锁钥匙串..."
read -sp "请输入钥匙串密码（如果需要）: " KEYCHAIN_PASSWORD
echo ""
security unlock-keychain -p "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null || echo "钥匙串可能已解锁"

# 3. 设置证书访问控制
echo ""
echo "3. 设置证书访问控制..."
# 允许 codesign 访问
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null || true

# 4. 设置钥匙串超时（避免频繁输入密码）
echo ""
echo "4. 设置钥匙串超时..."
security set-keychain-settings -t 3600 -u ~/Library/Keychains/login.keychain-db 2>/dev/null || true

echo ""
echo "✅ 钥匙串访问权限已配置"
echo ""
echo "现在可以尝试重新构建项目"
