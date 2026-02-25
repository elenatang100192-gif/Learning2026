#!/bin/bash

echo "=== 不通过 Xcode 查看应用日志 ==="
echo ""
echo "请选择查看方式："
echo ""
echo "1. 打开 Console.app（图形界面，推荐）"
echo "2. 命令行查看 Mac 日志（log stream）"
echo "3. 命令行查看真机日志（idevicesyslog，需要设备连接）"
echo "4. 命令行查看模拟器日志（需要模拟器运行）"
echo ""
read -p "请选择 (1-4): " choice

case $choice in
  1)
    echo ""
    echo "打开 Console.app..."
    open -a Console
    echo ""
    echo "✅ Console.app 已打开"
    echo ""
    echo "📋 操作步骤："
    echo "  1. 左侧选择您的设备（Mac、iPhone 或模拟器）"
    echo "  2. 顶部搜索框输入关键词：App API Error 🌐 🔧"
    echo "  3. 查看实时日志"
    echo ""
    echo "💡 提示：可以组合多个关键词搜索，例如：App API"
    ;;
  2)
    echo ""
    echo "查看 Mac 应用日志..."
    echo "按 Ctrl+C 停止查看"
    echo ""
    echo "过滤关键词：API, Error, 🌐, 🔧, ❌, 🚀"
    echo ""
    log stream --predicate 'processImagePath contains "App"' --level debug 2>&1 | \
      grep -v "WebKitDebugDragLiftDelay" | \
      grep -v "User Defaults" | \
      grep -v "CFPrefsPlistSource" | \
      grep -E "API|Error|Failed|🌐|📥|❌|🔧|🚀|nexusmind|auth" --line-buffered -i
    ;;
  3)
    echo ""
    echo "检查设备连接..."
    DEVICE=$(xcrun xctrace list devices 2>&1 | grep -i "iphone" | grep -v "Simulator" | head -1)
    
    if [ -z "$DEVICE" ]; then
      echo "❌ 未找到 iPhone 设备"
      echo ""
      echo "请确保："
      echo "  1. iPhone 已通过 USB 连接到 Mac"
      echo "  2. iPhone 已信任此电脑"
      echo ""
      echo "或者使用 Console.app（方法 1）"
    else
      echo "✅ 找到设备: $DEVICE"
      echo ""
      echo "查看真机日志..."
      echo "按 Ctrl+C 停止查看"
      echo ""
      
      # 检查 idevicesyslog 是否可用
      if command -v idevicesyslog &> /dev/null; then
        idevicesyslog -u | grep -E "App:|API|Error|🌐|🔧|❌|🚀|nexusmind|auth" --line-buffered -i
      else
        echo "⚠️ idevicesyslog 未安装"
        echo ""
        echo "安装方法："
        echo "  brew install libimobiledevice"
        echo ""
        echo "或者使用 Console.app（方法 1）"
      fi
    fi
    ;;
  4)
    echo ""
    echo "检查模拟器..."
    BOOTED=$(xcrun simctl list devices | grep "Booted" | head -1)
    
    if [ -z "$BOOTED" ]; then
      echo "❌ 未找到运行的模拟器"
      echo ""
      echo "请先启动模拟器："
      echo "  1. 打开 Xcode"
      echo "  2. Xcode > Window > Devices and Simulators"
      echo "  3. 启动一个模拟器"
      echo ""
      echo "或者使用 Console.app（方法 1）"
    else
      echo "✅ 找到运行的模拟器"
      echo ""
      echo "查看模拟器日志..."
      echo "按 Ctrl+C 停止查看"
      echo ""
      xcrun simctl spawn booted log stream --level debug 2>&1 | \
        grep -v "WebKitDebugDragLiftDelay" | \
        grep -v "User Defaults" | \
        grep -E "App:|API|Error|🌐|🔧|❌|🚀|nexusmind|auth" --line-buffered -i
    fi
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac
