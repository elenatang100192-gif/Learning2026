#!/bin/bash

# 安装证书和配置文件的辅助脚本

set -e

echo "=== 安装证书和配置文件 ==="
echo ""

# 检查文件是否存在
CERT_FILE="证书.p12"
PROVISION_FILE="nexusmind_2026.mobileprovision"

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ 错误：找不到证书文件：$CERT_FILE"
    echo ""
    echo "请确保证书文件在当前目录，或修改脚本中的文件路径"
    exit 1
fi

if [ ! -f "$PROVISION_FILE" ]; then
    echo "❌ 错误：找不到配置文件：$PROVISION_FILE"
    echo ""
    echo "请确保配置文件在当前目录，或修改脚本中的文件路径"
    exit 1
fi

echo "找到文件："
echo "  ✅ $CERT_FILE"
echo "  ✅ $PROVISION_FILE"
echo ""

# 步骤 1：安装证书
echo "步骤 1/2: 安装证书..."
echo ""
echo "⚠️  注意：如果证书有密码，系统会提示您输入密码"
echo ""

# 尝试安装到登录钥匙串
security import "$CERT_FILE" -k ~/Library/Keychains/login.keychain-db -P "" 2>&1 || {
    echo ""
    echo "请手动安装证书："
    echo "1. 双击文件：$CERT_FILE"
    echo "2. 输入证书密码（如果有）"
    echo "3. 选择钥匙串：登录"
    echo ""
}

echo "✅ 证书安装完成（或需要手动安装）"
echo ""

# 步骤 2：安装配置文件
echo "步骤 2/2: 安装配置文件..."
echo ""

# 创建目录
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles/

# 配置文件 UUID（从 mobileprovision 文件中提取）
PROFILE_UUID="70b8c860-57a6-4069-a5d9-e02353c570e9"

# 复制配置文件
cp "$PROVISION_FILE" ~/Library/MobileDevice/Provisioning\ Profiles/"$PROFILE_UUID.mobileprovision"

if [ $? -eq 0 ]; then
    echo "✅ 配置文件已安装到："
    echo "   ~/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
else
    echo "❌ 配置文件安装失败"
    exit 1
fi

echo ""
echo "=== ✅ 安装完成 ==="
echo ""
echo "下一步："
echo "1. 验证证书安装：打开'钥匙串访问'，搜索 'Wanvog' 或 'Distribution'"
echo "2. 在 Xcode 中配置项目签名"
echo "3. 运行打包脚本：./build-enterprise-ipa.sh"
echo ""
echo "详细步骤请查看：STEP_BY_STEP_IPA_GUIDE.md"

