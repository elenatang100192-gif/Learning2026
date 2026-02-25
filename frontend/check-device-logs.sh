#!/bin/bash

# 查看 iPhone 设备日志的脚本

echo "=== iPhone 设备日志查看工具 ==="
echo ""
echo "设备: tang的iPhone (18.6.2)"
echo ""

# 检查设备连接
DEVICE_ID=$(xcrun xctrace list devices 2>&1 | grep "tang的iPhone" | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)

if [ -z "$DEVICE_ID" ]; then
    echo "❌ 未找到设备，请确保 iPhone 已连接"
    exit 1
fi

echo "✅ 设备已连接: $DEVICE_ID"
echo ""
echo "=== 查看应用日志 ==="
echo ""
echo "提示：请在 iPhone 上打开应用并尝试登录"
echo "按 Ctrl+C 停止查看"
echo ""
echo "正在查看日志（过滤关键词：API, Error, Failed, 🌐, 📥, ❌, 🔧, 🚀, nexusmind, auth）..."
echo ""

# 使用 log stream 查看设备日志
log stream --predicate 'processImagePath contains "App" OR subsystem contains "com.ashleyfurniture.nexusmind"' --level debug 2>&1 | \
    grep -v "WebKitDebugDragLiftDelay" | \
    grep -v "User Defaults" | \
    grep -v "CoreFoundation" | \
    grep -E "API|Error|Failed|🌐|📥|❌|🔧|🚀|nexusmind|auth|fetch|http|load|Load|Network|network" --line-buffered -i


# 添加更完善的过滤选项
echo ""
echo "提示：系统警告（CFPrefsPlistSource、WebKit、User Defaults）可以安全忽略"
echo "这些警告不会影响应用运行"
