#!/bin/bash
# 修复 XCFramework 找不到的问题

echo "🔧 开始修复 XCFramework 问题..."

# 1. 完全关闭 Xcode（如果正在运行）
echo "📱 请确保 Xcode 已完全关闭（Cmd+Q）"
read -p "按 Enter 继续..."

# 2. 删除所有 Xcode 缓存
echo "🗑️  删除 Xcode 缓存..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
rm -rf ~/Library/Caches/org.swift.swiftpm
rm -rf ~/Library/org.swift.swiftpm

# 3. 删除项目中的 Swift Package 缓存
echo "🗑️  删除项目 Swift Package 缓存..."
cd /Users/et/Desktop/Learning/frontend/ios/App
rm -rf App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm

# 4. 重新解析包依赖
echo "📦 重新解析包依赖..."
xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App

echo "✅ 修复完成！"
echo ""
echo "下一步："
echo "1. 在 Xcode 中打开项目：open App.xcodeproj"
echo "2. 等待包自动解析（可能需要 5-10 分钟）"
echo "3. Product → Clean Build Folder (Cmd+Shift+K)"
echo "4. Product → Build (Cmd+B)"

