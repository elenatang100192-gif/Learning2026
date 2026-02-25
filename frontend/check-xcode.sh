#!/bin/bash

# 检查 Xcode 安装状态

echo "=== 检查 Xcode 安装状态 ==="
echo ""

# 检查 Xcode.app 是否存在
echo "1. 检查 Xcode.app 位置："
if [ -d "/Applications/Xcode.app" ]; then
    echo "   ✅ 找到：/Applications/Xcode.app"
    XCODE_PATH="/Applications/Xcode.app"
elif [ -d "/Applications/Xcode-beta.app" ]; then
    echo "   ✅ 找到：/Applications/Xcode-beta.app"
    XCODE_PATH="/Applications/Xcode-beta.app"
else
    echo "   ❌ 未找到 Xcode.app 在 /Applications/"
    echo ""
    echo "   查找其他位置的 Xcode..."
    OTHER_XCODE=$(find /Applications -name "Xcode*.app" -type d 2>/dev/null | head -1)
    if [ -n "$OTHER_XCODE" ]; then
        echo "   ✅ 找到：$OTHER_XCODE"
        XCODE_PATH="$OTHER_XCODE"
    else
        echo "   ❌ 未找到任何 Xcode 安装"
        echo ""
        echo "   请安装 Xcode："
        echo "   1. 从 Mac App Store 安装"
        echo "   2. 或使用 Xcodes.app 安装"
        echo "   3. 参考 XCODE_INSTALL_GUIDE.md"
        exit 1
    fi
fi

echo ""
echo "2. 检查当前开发者目录："
CURRENT_DIR=$(xcode-select -p)
echo "   当前：$CURRENT_DIR"

EXPECTED_DIR="$XCODE_PATH/Contents/Developer"
if [ "$CURRENT_DIR" = "$EXPECTED_DIR" ]; then
    echo "   ✅ 配置正确"
else
    echo "   ⚠️  配置不正确"
    echo "   应该指向：$EXPECTED_DIR"
    echo ""
    echo "   修复方法："
    echo "   sudo xcode-select --switch $EXPECTED_DIR"
fi

echo ""
echo "3. 检查 Xcode 版本："
if command -v xcodebuild &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
    if [[ $XCODE_VERSION == *"Xcode"* ]]; then
        echo "   ✅ $XCODE_VERSION"
    else
        echo "   ⚠️  无法获取版本信息"
    fi
else
    echo "   ❌ xcodebuild 命令不可用"
fi

echo ""
echo "4. 检查 Xcodes.app（版本管理工具）："
if [ -d "/Applications/Xcodes.app" ]; then
    echo "   ✅ 已安装 Xcodes.app"
    echo "   可以使用它来安装或管理 Xcode 版本"
else
    echo "   ℹ️  未安装 Xcodes.app（可选）"
fi

echo ""
echo "=== 检查完成 ==="
echo ""
echo "如果 Xcode 未安装，请参考 XCODE_INSTALL_GUIDE.md"

