#!/bin/bash
# 快速查看 iOS 应用日志

echo "=== iOS 应用日志查看工具 ==="
echo ""
echo "选择查看方式："
echo "1. 使用 Xcode 控制台（推荐）"
echo "2. 使用命令行查看系统日志"
echo "3. 打开 Xcode 项目"
echo ""
read -p "请选择 (1-3): " choice

case $choice in
  1)
    echo ""
    echo "请按照以下步骤操作："
    echo "1. 连接 iOS 设备到 Mac"
    echo "2. 打开 Xcode"
    echo "3. Window > Devices and Simulators"
    echo "4. 选择您的设备"
    echo "5. 点击 'Open Console' 按钮"
    echo ""
    echo "在控制台中搜索："
    echo "  - 🌐 API Request"
    echo "  - ❌ API Error"
    echo "  - Failed"
    ;;
  2)
    echo ""
    echo "开始查看系统日志..."
    echo "按 Ctrl+C 停止"
    echo ""
    log stream --predicate 'processImagePath contains "App"' --level debug
    ;;
  3)
    echo ""
    echo "打开 Xcode 项目..."
    cd /Users/et/Desktop/Learning/frontend/ios/App
    open App.xcodeproj
    echo "✅ Xcode 已打开"
    echo ""
    echo "提示："
    echo "1. 连接设备"
    echo "2. 选择设备作为运行目标"
    echo "3. 按 Cmd+R 运行应用"
    echo "4. 查看底部控制台"
    ;;
  *)
    echo "无效选择"
    ;;
esac
