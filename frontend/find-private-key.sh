#!/bin/bash

echo "=== 查找私钥信息 ==="
echo ""

# 查找证书和私钥
CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
CERT_HASH=$(security find-identity -v -p codesigning | grep "$CERT_NAME" | head -1 | awk '{print $2}')

if [ -z "$CERT_HASH" ]; then
    echo "❌ 未找到证书"
    exit 1
fi

echo "✅ 找到证书哈希: $CERT_HASH"
echo ""

# 查找私钥
echo "查找私钥..."
security find-key -a "$CERT_HASH" 2>&1 | grep -E "keychain|class|alis" | head -5

echo ""
echo "在钥匙串访问中查找私钥："
echo "1. 打开钥匙串访问"
echo "2. 菜单：显示 > 显示私钥（⌘ + K）"
echo "3. 搜索 'Wanvog'"
echo "4. 找到钥匙图标（不是证书图标）"
echo "5. 右键 > 获取信息 > 访问控制"
