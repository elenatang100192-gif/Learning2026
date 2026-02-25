#!/bin/bash

# 修复 Swift Package Manager 问题
# 解决 "Missing package product 'CapApp-SPM'" 错误

set -e

echo "🔧 修复 Swift Package Manager 配置..."

# 进入项目目录
cd "$(dirname "$0")/App"

# 1. 清理 Xcode 派生数据（可选，但推荐）
echo "📦 清理 Xcode 派生数据..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true

# 2. 清理 Swift Package 缓存
echo "📦 清理 Swift Package 缓存..."
rm -rf ~/Library/Caches/org.swift.swiftpm 2>/dev/null || true
rm -rf ~/Library/org.swift.swiftpm 2>/dev/null || true

# 3. 清理项目中的 Swift Package 解析文件
echo "📦 清理项目中的 Swift Package 解析文件..."
rm -rf App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm 2>/dev/null || true

# 4. 验证 Package.swift 文件存在
if [ ! -f "CapApp-SPM/Package.swift" ]; then
    echo "❌ 错误: CapApp-SPM/Package.swift 文件不存在"
    exit 1
fi

# 5. 验证依赖路径
echo "📦 验证依赖路径..."
cd CapApp-SPM
if [ ! -d "../../../node_modules/@capacitor/app" ]; then
    echo "❌ 错误: 找不到 node_modules/@capacitor/app"
    echo "请确保在 frontend 目录下运行了 npm install"
    exit 1
fi
cd ..

echo "✅ 清理完成！"
echo ""
echo "📝 下一步操作："
echo "1. 在 Xcode 中打开项目"
echo "2. 选择 File → Packages → Reset Package Caches"
echo "3. 选择 File → Packages → Resolve Package Versions"
echo "4. 清理构建文件夹: Product → Clean Build Folder (Cmd+Shift+K)"
echo "5. 重新构建项目: Product → Build (Cmd+B)"
echo ""
echo "或者运行以下命令自动解析包："
echo "  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App"

