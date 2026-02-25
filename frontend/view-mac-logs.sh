#!/bin/bash

echo "=== Mac 应用日志查看工具 ==="
echo ""
echo "请选择查看方式："
echo ""
echo "1. 打开 Xcode 控制台（需要 Xcode 运行应用）"
echo "2. 打开 Console.app（系统日志查看器）"
echo "3. 使用命令行查看日志（log stream）"
echo "4. 打开设备控制台（真机日志）"
echo "5. 查看模拟器日志"
echo ""
read -p "请选择 (1-5): " choice

case $choice in
  1)
    echo ""
    echo "打开 Xcode 项目..."
    cd /Users/et/Desktop/Learning/frontend/ios/App
    open App.xcodeproj
    echo ""
    echo "✅ Xcode 已打开"
    echo "📋 操作步骤："
    echo "  1. 选择设备（模拟器或真机）"
    echo "  2. 按 Cmd+R 运行应用"
    echo "  3. 查看底部控制台日志"
    ;;
  2)
    echo ""
    echo "打开 Console.app..."
    open -a Console
    echo ""
    echo "✅ Console.app 已打开"
    echo "📋 操作步骤："
    echo "  1. 左侧选择您的设备或 Mac"
    echo "  2. 在搜索框中输入关键词过滤"
    echo "  3. 查看实时日志"
    ;;
  3)
    echo ""
    echo "使用命令行查看日志..."
    echo "按 Ctrl+C 停止查看"
    echo ""
    log stream --predicate 'processImagePath contains "App"' --level debug 2>&1 | \
      grep -v "WebKitDebugDragLiftDelay" | \
      grep -v "User Defaults" | \
      grep -v "CFPrefsPlistSource" | \
      grep -E "API|Error|Failed|🌐|📥|❌|🔧|🚀|nexusmind|auth" --line-buffered -i
    ;;
  4)
    echo ""
    echo "打开设备控制台..."
    echo ""
    echo "📋 操作步骤："
    echo "  1. 打开 Xcode"
    echo "  2. Window > Devices and Simulators"
    echo "  3. 选择您的 iPhone"
    echo "  4. 点击 'Open Console' 按钮"
    echo ""
    echo "或者运行："
    echo "  open -a Xcode"
    ;;
  5)
    echo ""
    echo "查看模拟器日志..."
    echo "按 Ctrl+C 停止查看"
    echo ""
    xcrun simctl spawn booted log stream --level debug 2>&1 | \
      grep -v "WebKitDebugDragLiftDelay" | \
      grep -v "User Defaults" | \
      grep -E "API|Error|Failed|🌐|📥|❌|🔧|🚀|nexusmind|auth" --line-buffered -i || \
      echo "⚠️ 未找到运行的模拟器，请先启动模拟器"
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac
