#!/bin/bash

echo "=== 修复系统钥匙串访问权限 ==="
echo ""

# 证书在系统钥匙串中
KEYCHAIN="/Library/Keychains/System.keychain"
CERT_NAME="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."

echo "证书位置: $KEYCHAIN"
echo "证书名称: $CERT_NAME"
echo ""

# 检查证书
if security find-certificate -c "$CERT_NAME" -a &>/dev/null; then
    echo "✅ 找到证书"
else
    echo "❌ 未找到证书"
    exit 1
fi

echo ""
echo "⚠️  系统钥匙串需要管理员权限"
echo ""
echo "请使用图形界面设置（推荐）："
echo "1. 打开钥匙串访问"
echo "2. 选择左侧的 '系统'（System）"
echo "3. 菜单：显示 > 显示私钥（⌘ + K）"
echo "4. 搜索 'Wanvog'"
echo "5. 找到私钥（钥匙图标）"
echo "6. 右键 > 获取信息 > 访问控制"
echo "7. 勾选 '允许所有应用程序访问此项目'"
echo ""
echo "或者使用命令行（需要管理员权限）："
echo "  sudo security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k '系统密码' /Library/Keychains/System.keychain"
