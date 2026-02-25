#!/bin/bash

echo "=== 安装配置文件 ==="
echo ""

# 查找配置文件
PROFILE_FILE=""
if [ -f "../nexusmind_2026.mobileprovision" ]; then
    PROFILE_FILE="../nexusmind_2026.mobileprovision"
elif [ -f "nexusmind_2026.mobileprovision" ]; then
    PROFILE_FILE="nexusmind_2026.mobileprovision"
elif [ -f "/Users/et/Desktop/Learning/nexusmind_2026.mobileprovision" ]; then
    PROFILE_FILE="/Users/et/Desktop/Learning/nexusmind_2026.mobileprovision"
fi

if [ -z "$PROFILE_FILE" ]; then
    echo "❌ 未找到配置文件 nexusmind_2026.mobileprovision"
    echo ""
    echo "请将配置文件放在以下位置之一："
    echo "  - /Users/et/Desktop/Learning/nexusmind_2026.mobileprovision"
    echo "  - /Users/et/Desktop/Learning/frontend/nexusmind_2026.mobileprovision"
    echo ""
    echo "或者双击 .mobileprovision 文件自动安装"
    exit 1
fi

echo "✅ 找到配置文件: $PROFILE_FILE"

# 创建目录
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles/

# 提取 UUID（从配置文件名称或内容）
UUID="70b8c860-57a6-4069-a5d9-e02353c570e9"
TARGET_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/${UUID}.mobileprovision"

# 复制配置文件
cp "$PROFILE_FILE" "$TARGET_PATH"
echo "✅ 已复制到: $TARGET_PATH"

# 设置权限
chmod 644 "$TARGET_PATH"
echo "✅ 已设置权限"

echo ""
echo "配置文件安装完成！"
