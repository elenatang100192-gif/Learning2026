#!/bin/bash

echo "=== 修复证书信任设置 ==="
echo ""

CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
CERT_HASH="4AEFF002B01487D6C13DFEEB7335B8DEABB3916A"

echo "证书名称: $CERT_NAME"
echo "证书哈希: $CERT_HASH"
echo ""

echo "⚠️  需要管理员权限来修改系统钥匙串"
echo ""
echo "请执行以下命令（需要输入管理员密码）："
echo ""
echo "sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <(security find-certificate -c \"$CERT_NAME\" -a -p)"
echo ""
echo "或者使用图形界面（推荐）："
echo "1. 打开钥匙串访问"
echo "2. 选择 '系统'（System）"
echo "3. 找到证书: $CERT_NAME"
echo "4. 双击打开"
echo "5. 展开 '信任'（Trust）部分"
echo "6. 将 '使用此证书时' 设置为 '使用系统默认值'"
echo "7. 确保 '代码签名' 设置为 '使用系统默认值'"
