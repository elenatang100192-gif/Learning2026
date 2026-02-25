#!/bin/bash

# 修复 CapApp-SPM 包依赖问题

set -e

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
IOS_DIR="$PROJECT_DIR/ios/App"

echo "=== 修复 CapApp-SPM 包依赖 ==="
echo ""

# 步骤 1: 清理缓存
echo "🧹 步骤 1/4: 清理 Xcode 缓存..."
rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null || true
rm -rf ~/Library/Caches/org.swift.swiftpm 2>/dev/null || true
echo "✅ 缓存已清理"

# 步骤 2: 同步 Capacitor
echo ""
echo "🔄 步骤 2/4: 同步 Capacitor..."
cd "$PROJECT_DIR"
npx cap sync ios
echo "✅ Capacitor 同步完成"

# 步骤 3: 验证包文件
echo ""
echo "🔍 步骤 3/4: 验证包文件..."
if [ -f "$IOS_DIR/CapApp-SPM/Package.swift" ]; then
    echo "✅ CapApp-SPM/Package.swift 存在"
else
    echo "❌ CapApp-SPM/Package.swift 不存在"
    exit 1
fi

# 步骤 4: 解析包依赖
echo ""
echo "📦 步骤 4/4: 解析 Swift Package 依赖..."
cd "$IOS_DIR"
xcodebuild -resolvePackageDependencies \
  -project App.xcodeproj \
  -scheme App \
  2>&1 | grep -E "(Resolved|CapApp-SPM|error)" || true

echo ""
echo "=== ✅ 修复完成 ==="
echo ""
echo "📝 如果 Xcode 中仍然显示错误，请在 Xcode 中执行："
echo "   1. File → Packages → Reset Package Caches"
echo "   2. File → Packages → Resolve Package Versions"
echo "   3. 或者关闭并重新打开项目"
echo ""
echo "💡 提示：命令行构建不需要 Xcode IDE，可以直接运行："
echo "   cd $PROJECT_DIR && ./build-enterprise-ipa.sh"

