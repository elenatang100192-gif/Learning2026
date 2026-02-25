#!/bin/bash

# 完整修复 Swift Package Manager 问题

set -e

echo "🔧 开始修复 Swift Package Manager 问题..."
echo ""

cd "$(dirname "$0")/App"

# 1. 清理所有缓存
echo "📦 步骤 1: 清理所有缓存..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
rm -rf ~/Library/Caches/org.swift.swiftpm 2>/dev/null || true
rm -rf ~/Library/org.swift.swiftpm 2>/dev/null || true
rm -rf App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm 2>/dev/null || true
echo "✅ 缓存清理完成"
echo ""

# 2. 验证包文件存在
echo "📦 步骤 2: 验证包文件..."
if [ ! -f "CapApp-SPM/Package.swift" ]; then
    echo "❌ 错误: CapApp-SPM/Package.swift 不存在"
    exit 1
fi
echo "✅ 包文件存在"
echo ""

# 3. 验证依赖路径
echo "📦 步骤 3: 验证依赖路径..."
cd CapApp-SPM
if [ ! -d "../../../node_modules/@capacitor/app" ]; then
    echo "❌ 错误: 找不到 node_modules/@capacitor/app"
    echo "请确保在 frontend 目录下运行了 npm install"
    exit 1
fi
cd ..
echo "✅ 依赖路径正确"
echo ""

# 4. 解析 Swift Package 依赖
echo "📦 步骤 4: 解析 Swift Package 依赖..."
xcodebuild -resolvePackageDependencies \
    -project App.xcodeproj \
    -scheme App \
    2>&1 | grep -E "Resolved|error|Error" || true
echo ""

# 5. 验证解析结果
if [ -f "App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved" ]; then
    echo "✅ Package.resolved 文件已创建"
    echo ""
    echo "解析的包："
    cat App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved | grep -A 2 "identity" | grep -E "identity|location" | head -10
else
    echo "⚠️  Package.resolved 文件未创建"
fi

echo ""
echo "✅ 修复完成！"
echo ""
echo "📝 下一步操作："
echo "1. 在 Xcode 中关闭并重新打开项目"
echo "2. 如果问题仍然存在："
echo "   - File → Packages → Reset Package Caches"
echo "   - File → Packages → Resolve Package Versions"
echo "3. 清理构建: Product → Clean Build Folder (Cmd+Shift+K)"
echo "4. 重新构建: Product → Build (Cmd+B)"

