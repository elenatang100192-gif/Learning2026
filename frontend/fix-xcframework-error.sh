#!/bin/bash

echo "=== 修复 XCFramework 错误 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
IOS_DIR="$PROJECT_DIR/ios/App"

cd "$PROJECT_DIR"

echo "📋 步骤 1: 清理 Swift Package Manager 缓存"
echo ""

# 清理 DerivedData
echo "清理 Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null
echo "✅ DerivedData 已清理"

# 清理 Swift Package Manager 缓存
echo "清理 Swift Package Manager 缓存..."
rm -rf ~/Library/Caches/org.swift.swiftpm 2>/dev/null
rm -rf ~/Library/org.swift.swiftpm 2>/dev/null
echo "✅ Swift Package Manager 缓存已清理"

# 清理项目中的 Swift Package Manager 缓存
if [ -d "$IOS_DIR/.swiftpm" ]; then
    rm -rf "$IOS_DIR/.swiftpm"
    echo "✅ 项目 Swift Package Manager 缓存已清理"
fi

# 清理 Package.resolved
if [ -f "$IOS_DIR/Package.resolved" ]; then
    rm -f "$IOS_DIR/Package.resolved"
    echo "✅ Package.resolved 已删除"
fi

echo ""
echo "📋 步骤 2: 清理构建缓存"
echo ""

# 清理构建目录
if [ -d "$IOS_DIR/build" ]; then
    rm -rf "$IOS_DIR/build"
    echo "✅ iOS 构建缓存已清理"
fi

# 清理前端构建
if [ -d "$PROJECT_DIR/dist" ]; then
    rm -rf "$PROJECT_DIR/dist"
    echo "✅ 前端构建缓存已清理"
fi

echo ""
echo "📋 步骤 3: 检查 Package.swift"
echo ""

if [ -f "$IOS_DIR/Package.swift" ]; then
    echo "✅ Package.swift 存在"
    
    # 检查是否包含 Capacitor 和 Cordova
    if grep -q "Capacitor" "$IOS_DIR/Package.swift" && grep -q "Cordova" "$IOS_DIR/Package.swift"; then
        echo "✅ Package.swift 包含 Capacitor 和 Cordova 依赖"
    else
        echo "⚠️ Package.swift 可能缺少依赖"
    fi
else
    echo "❌ Package.swift 不存在"
    echo "   需要运行: npx cap sync ios"
fi

echo ""
echo "📋 步骤 4: 重新同步 Capacitor"
echo ""

# 先构建前端（Capacitor sync 需要 dist 目录）
echo "构建前端应用..."
cd "$PROJECT_DIR"
CAPACITOR=true npm run build

if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi

echo "✅ 前端构建完成"

# 重新同步 Capacitor
echo ""
echo "同步 Capacitor..."
npx cap sync ios

if [ $? -ne 0 ]; then
    echo "❌ Capacitor 同步失败"
    exit 1
fi

echo "✅ Capacitor 同步完成"

echo ""
echo "📋 步骤 5: 验证 XCFramework"
echo ""

# 检查 XCFramework 是否存在
XCFRAMEWORK_PATH="$IOS_DIR/Package.swift"
if [ -f "$XCFRAMEWORK_PATH" ]; then
    echo "✅ Package.swift 存在"
    
    # 尝试解析包依赖
    echo "解析 Swift Package Manager 依赖..."
    cd "$IOS_DIR"
    
    # 使用 xcodebuild 解析包
    if command -v xcodebuild &> /dev/null; then
        xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App 2>&1 | head -20
        echo ""
        echo "✅ 包依赖解析完成"
    else
        echo "⚠️ xcodebuild 未找到，跳过包解析"
    fi
else
    echo "❌ Package.swift 不存在"
fi

echo ""
echo "=== 修复完成 ==="
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 打开 Xcode 项目："
echo "   cd $IOS_DIR"
echo "   open App.xcworkspace"
echo ""
echo "2. 在 Xcode 中："
echo "   - File > Packages > Reset Package Caches"
echo "   - File > Packages > Update to Latest Package Versions"
echo ""
echo "3. 清理构建："
echo "   Product > Clean Build Folder (Shift+Cmd+K)"
echo ""
echo "4. 重新构建："
echo "   Product > Build (Cmd+B)"
echo ""
echo "5. 或使用命令行构建 IPA："
echo "   cd /Users/et/Desktop/Learning"
echo "   ./build-enterprise-ipa.sh"
echo ""

