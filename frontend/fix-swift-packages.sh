#!/bin/bash

# 修复 Swift Package Manager 依赖问题

set -e

echo "=== 修复 Swift Package Manager 依赖 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning/frontend/ios/App"
cd "$PROJECT_DIR"

# 步骤 1：删除 Package.resolved
echo "1. 删除 Package.resolved..."
rm -f App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
echo "   ✅ 已删除"
echo ""

# 步骤 2：清理 DerivedData
echo "2. 清理 DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
echo "   ✅ 已清理"
echo ""

# 步骤 3：重新同步 Capacitor
echo "3. 重新同步 Capacitor..."
cd /Users/et/Desktop/Learning/frontend
npx cap sync ios
echo "   ✅ 同步完成"
echo ""

# 步骤 4：重新解析包依赖
echo "4. 重新解析 Swift Package 依赖..."
cd "$PROJECT_DIR"
xcodebuild -resolvePackageDependencies -project App.xcodeproj 2>&1 | tail -10
echo ""

echo "=== 修复完成 ==="
echo ""
echo "如果问题仍然存在，请在 Xcode 中："
echo "1. File > Packages > Reset Package Caches"
echo "2. File > Packages > Resolve Package Versions"
echo "3. 清理项目：Product > Clean Build Folder (⇧⌘K)"

