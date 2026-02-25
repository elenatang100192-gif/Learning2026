#!/bin/bash

# 查看应用日志脚本

echo "=== 📱 应用日志查看工具 ==="
echo ""
echo "请选择查看方式："
echo "1. 实时查看应用日志（推荐）"
echo "2. 查看最近的错误日志"
echo "3. 查看网络请求日志"
echo "4. 查看所有应用相关日志"
echo ""
read -p "请选择 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "=== 实时查看应用日志 ==="
        echo "提示：按 Ctrl+C 停止查看"
        echo "请在设备上操作应用，这里会显示实时日志"
        echo ""
        log stream --predicate 'processImagePath contains "App" OR subsystem contains "com.ashleyfurniture.nexusmind" OR eventMessage contains "App"' --level debug --style compact
        ;;
    2)
        echo ""
        echo "=== 查看最近的错误日志 ==="
        log show --predicate 'eventMessage contains "App" AND (eventMessage contains "Error" OR eventMessage contains "Failed" OR eventMessage contains "error" OR eventMessage contains "fail")' --last 10m --style compact | tail -100
        ;;
    3)
        echo ""
        echo "=== 查看网络请求日志 ==="
        log show --predicate 'eventMessage contains "API" OR eventMessage contains "HTTP" OR eventMessage contains "network" OR eventMessage contains "nexusmind" OR eventMessage contains "fetch" OR eventMessage contains "request"' --last 10m --style compact | tail -100
        ;;
    4)
        echo ""
        echo "=== 查看所有应用相关日志 ==="
        log show --predicate 'processImagePath contains "App" OR subsystem contains "com.ashleyfurniture.nexusmind" OR eventMessage contains "App"' --last 10m --style compact | tail -200
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac
