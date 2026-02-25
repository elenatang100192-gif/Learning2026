#!/bin/bash

# 获取连接的 iOS 设备 UDID

echo "=== 获取 iOS 设备 UDID ==="
echo ""

echo "正在查找连接的设备..."
echo ""

# 使用 xcrun xctrace 列出设备
DEVICES=$(xcrun xctrace list devices 2>&1)

if [[ $DEVICES == *"iPhone"* ]] || [[ $DEVICES == *"iPad"* ]]; then
    echo "找到以下设备："
    echo ""
    echo "$DEVICES" | grep -E "(iPhone|iPad)" | grep -v "Simulator"
    echo ""
    echo "UDID 格式：XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
    echo ""
    echo "使用方法："
    echo "1. 复制上面的 UDID"
    echo "2. 访问：https://developer.apple.com/account/resources/devices/list"
    echo "3. 点击 '+' 添加设备"
    echo "4. 粘贴 UDID 并注册"
else
    echo "⚠️  未找到连接的 iOS 设备"
    echo ""
    echo "请确保："
    echo "1. 设备已用 USB 线连接到 Mac"
    echo "2. 设备已解锁"
    echo "3. 设备上已点击 '信任此电脑'"
    echo ""
    echo "其他获取 UDID 的方法："
    echo "1. Finder：连接设备后，点击序列号查看 UDID"
    echo "2. 设备设置：设置 > 通用 > 关于本机 > 标识符"
fi

echo ""
echo "=== 完成 ==="

