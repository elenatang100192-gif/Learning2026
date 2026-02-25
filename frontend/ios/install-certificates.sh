#!/bin/bash

# 安装证书和配置文件的脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
CERT_FILE="$FRONTEND_DIR/证书.p12"
PROVISION_FILE="$FRONTEND_DIR/nexusmind_2026.mobileprovision"

echo "🔐 安装证书和配置文件..."
echo ""

# 1. 安装证书
if [ -f "$CERT_FILE" ]; then
    echo "📦 安装证书: $CERT_FILE"
    echo "⚠️  请输入证书密码（如果有的话，直接回车表示无密码）:"
    security import "$CERT_FILE" -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign -T /usr/bin/security 2>/dev/null || {
        echo "⚠️  如果导入失败，请手动双击证书文件安装"
    }
    echo "✅ 证书安装完成"
else
    echo "❌ 未找到证书文件: $CERT_FILE"
fi

echo ""

# 2. 安装配置文件
if [ -f "$PROVISION_FILE" ]; then
    echo "📦 安装配置文件: $PROVISION_FILE"
    
    # 获取配置文件的 UUID
    UUID=$(/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin <<< "$(security cms -D -i "$PROVISION_FILE" 2>/dev/null)")
    
    if [ -n "$UUID" ]; then
        echo "   配置文件 UUID: $UUID"
        echo "   配置文件名称: nexusmind 2026"
        
        # 复制到 Xcode 配置文件目录
        PROVISION_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
        mkdir -p "$PROVISION_DIR"
        cp "$PROVISION_FILE" "$PROVISION_DIR/$UUID.mobileprovision"
        echo "✅ 配置文件已安装到: $PROVISION_DIR/$UUID.mobileprovision"
    else
        echo "⚠️  无法读取配置文件 UUID，尝试直接复制..."
        PROVISION_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
        mkdir -p "$PROVISION_DIR"
        cp "$PROVISION_FILE" "$PROVISION_DIR/"
        echo "✅ 配置文件已复制到: $PROVISION_DIR/"
    fi
else
    echo "❌ 未找到配置文件: $PROVISION_FILE"
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "📝 下一步："
echo "1. 在 Xcode 中打开项目"
echo "2. 选择项目文件 → App target → Signing & Capabilities"
echo "3. 对于 Release 配置："
echo "   - 选择 'Manual' 签名"
echo "   - Team: 5X988MNY96 (Wanvog Furniture)"
echo "   - Provisioning Profile: nexusmind 2026"
echo "4. 对于 Debug 配置（真机调试）："
echo "   - 如果有 Developer 证书，使用自动签名"
echo "   - 或者使用模拟器（不需要证书）"

