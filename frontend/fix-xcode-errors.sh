#!/bin/bash

echo "=== Xcode 错误快速修复工具 ==="
echo ""
echo "检测到两个常见错误："
echo "1. attach by pid failed - 调试器附加失败"
echo "2. Logging Error - 日志系统初始化失败"
echo ""
echo "请选择修复方式："
echo ""
echo "1. 修复日志错误（设置环境变量）"
echo "2. 查看设备控制台（无需修复，直接查看日志）"
echo "3. 打开 Xcode 项目（手动修复）"
echo ""
read -p "请选择 (1-3): " choice

case $choice in
  1)
    echo ""
    echo "📋 修复日志错误的步骤："
    echo ""
    echo "1. 打开 Xcode 项目..."
    cd /Users/et/Desktop/Learning/frontend/ios/App
    open App.xcodeproj
    echo ""
    echo "✅ Xcode 已打开"
    echo ""
    echo "2. 设置环境变量："
    echo "   - 点击顶部 Scheme 选择器（App 旁边）"
    echo "   - 选择 'Edit Scheme...'"
    echo "   - 左侧选择 'Run'"
    echo "   - 点击 'Arguments' 标签页"
    echo "   - 在 'Environment Variables' 部分，点击 '+' 按钮"
    echo "   - 添加："
    echo "     Name: IDEPreferLogStreaming"
    echo "     Value: YES"
    echo "   - 点击 'Close' 保存"
    echo ""
    echo "3. 重新运行应用（Cmd+R）"
    ;;
  2)
    echo ""
    echo "📋 使用设备控制台查看日志（无需修复）："
    echo ""
    echo "操作步骤："
    echo "1. 打开 Xcode"
    echo "2. Window > Devices and Simulators"
    echo "3. 选择您的 iPhone"
    echo "4. 点击 'Open Console' 按钮"
    echo ""
    echo "或者运行命令行查看日志："
    echo ""
    cd /Users/et/Desktop/Learning/frontend
    ./check-device-logs.sh
    ;;
  3)
    echo ""
    echo "打开 Xcode 项目..."
    cd /Users/et/Desktop/Learning/frontend/ios/App
    open App.xcodeproj
    echo ""
    echo "✅ Xcode 已打开"
    echo ""
    echo "📋 手动修复步骤："
    echo ""
    echo "修复 attach 错误："
    echo "1. 在 iPhone 上卸载应用"
    echo "2. 在 Xcode 中按 Cmd+R 重新安装"
    echo ""
    echo "修复日志错误："
    echo "1. Edit Scheme > Run > Arguments > Environment Variables"
    echo "2. 添加: IDEPreferLogStreaming = YES"
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac
