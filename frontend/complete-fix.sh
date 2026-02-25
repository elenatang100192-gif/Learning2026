#!/bin/bash

echo "=== 完整修复：钥匙串访问权限 + 配置文件 ==="
echo ""

# 1. 修复钥匙串访问权限
echo "步骤 1/2: 修复钥匙串访问权限..."
echo ""
read -sp "请输入钥匙串密码: " KEYCHAIN_PASSWORD
echo ""

security unlock-keychain -p "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null || {
    echo "❌ 解锁钥匙串失败"
    exit 1
}

security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db 2>/dev/null
security set-keychain-settings -t 3600 -u ~/Library/Keychains/login.keychain-db 2>/dev/null

echo "✅ 钥匙串访问权限已修复"
echo ""

# 2. 安装配置文件
echo "步骤 2/2: 安装配置文件..."
./install-provisioning-profile.sh

echo ""
echo "=== 修复完成 ==="
echo ""
echo "现在可以尝试重新构建项目"
