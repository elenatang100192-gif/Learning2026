#!/bin/bash

echo "=== 检查证书和配置文件 ==="
echo ""

# 检查证书
echo "1. 检查安装的证书："
security find-identity -v -p codesigning | grep -i "wanvog\|distribution" || echo "   ⚠️  未找到企业分发证书"

echo ""
echo "2. 检查配置文件："
ls -la ~/Library/MobileDevice/Provisioning\ Profiles/ | grep -i nexusmind || echo "   ⚠️  未找到配置文件"

echo ""
echo "3. 检查证书详细信息："
CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
security find-certificate -c "$CERT_NAME" -a -p 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "   ⚠️  无法读取证书信息"

echo ""
echo "4. 检查钥匙串状态："
security show-keychain-info ~/Library/Keychains/login.keychain-db 2>/dev/null || echo "   ⚠️  无法读取钥匙串信息"
