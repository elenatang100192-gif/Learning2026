#!/bin/bash

echo "=== iPhone 连接检查工具 ==="
echo ""

# 检查设备连接
echo "1. 检查设备连接..."
DEVICES=$(xcrun xctrace list devices 2>&1 | grep -i "iphone\|ipad" | grep -v "Simulator")

if [ -z "$DEVICES" ]; then
    echo "❌ 未找到 iPhone 设备"
    echo ""
    echo "请检查："
    echo "  1. iPhone 是否通过 USB 连接到 Mac"
    echo "  2. iPhone 是否已信任此电脑（在 iPhone 上确认）"
    echo "  3. USB 数据线是否正常工作"
else
    echo "✅ 找到以下设备："
    echo "$DEVICES" | while IFS= read -r line; do
        echo "  - $line"
    done
fi

echo ""
echo "2. 打开 Xcode 设备窗口..."
echo ""
echo "操作步骤："
echo "  1. 打开 Xcode"
echo "  2. Window > Devices and Simulators"
echo "  3. 或按 Shift+Cmd+2"
echo ""
echo "3. 在 Xcode 中选择设备："
echo "  - 在顶部设备选择器中选择您的 iPhone"
echo "  - 然后按 Cmd+R 运行应用"
echo ""

# 询问是否打开 Xcode
read -p "是否打开 Xcode 项目？(y/n): " open_xcode
if [ "$open_xcode" = "y" ] || [ "$open_xcode" = "Y" ]; then
    cd /Users/et/Desktop/Learning/frontend/ios/App
    open App.xcodeproj
    echo ""
    echo "✅ Xcode 已打开"
    echo "📋 下一步："
    echo "  1. 在顶部设备选择器中选择您的 iPhone"
    echo "  2. 按 Cmd+R 运行应用"
fi
