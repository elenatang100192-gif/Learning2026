#!/bin/bash

# 修复 iOS Package.swift 路径问题

set -e

echo "=== 修复 iOS Package 路径问题 ==="
echo ""

FRONTEND_DIR="/Users/et/Desktop/Learning/frontend"
cd "$FRONTEND_DIR"

echo "1. 检查 node_modules..."
if [ ! -d "node_modules/@capacitor/app" ]; then
    echo "   安装依赖..."
    npm install
fi

echo ""
echo "2. 清理 Xcode 缓存..."
cd ios/App
if [ -d "App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm" ]; then
    rm -rf App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
    echo "   已清理 Swift Package Manager 缓存"
fi

echo ""
echo "3. 重新同步 Capacitor..."
cd "$FRONTEND_DIR"
CAPACITOR=true npm run build
npx cap sync ios

echo ""
echo "4. 验证 Package.swift 路径..."
PACKAGE_FILE="ios/App/CapApp-SPM/Package.swift"
if [ -f "$PACKAGE_FILE" ]; then
    echo "   Package.swift 存在"
    echo "   检查相对路径..."
    cd ios/App/CapApp-SPM
    if [ -d "../../../node_modules/@capacitor/app" ]; then
        echo "   ✅ 路径正确"
    else
        echo "   ❌ 路径错误，需要检查"
    fi
else
    echo "   ❌ Package.swift 不存在"
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "下一步："
echo "1. 在 Xcode 中：File > Packages > Reset Package Caches"
echo "2. 在 Xcode 中：File > Packages > Resolve Package Versions"
echo "3. 如果还有问题，关闭 Xcode，然后重新打开项目"



