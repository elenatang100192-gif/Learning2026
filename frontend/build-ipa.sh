#!/bin/bash

# 完整的 IPA 构建脚本
# 自动完成：构建 -> 同步 -> Archive -> 导出 IPA

set -e

cd "$(dirname "$0")"

echo "🚀 开始构建 IPA 文件..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤 1: 构建前端应用
echo "📦 步骤 1/5: 构建前端应用..."
if npm run build:mobile; then
    echo -e "${GREEN}✅ 前端应用构建完成${NC}"
else
    echo -e "${RED}❌ 前端应用构建失败${NC}"
    exit 1
fi
echo ""

# 步骤 2: 同步到 iOS
echo "🔄 步骤 2/5: 同步到 iOS 平台..."
if npx cap sync ios; then
    echo -e "${GREEN}✅ iOS 平台同步完成${NC}"
else
    echo -e "${RED}❌ iOS 平台同步失败${NC}"
    exit 1
fi
echo ""

# 步骤 3: 修复 iOS 路径
echo "🔧 步骤 3/5: 修复 iOS 路径..."
if [ -f "./fix-ios-paths.sh" ]; then
    bash ./fix-ios-paths.sh
    echo -e "${GREEN}✅ 路径修复完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 fix-ios-paths.sh，跳过路径修复${NC}"
fi
echo ""

# 步骤 4: 检查 Xcode 环境
echo "🔍 步骤 4/5: 检查构建环境..."
cd ios/App

if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ 未找到 xcodebuild${NC}"
    echo "💡 请确保已安装 Xcode（从 Mac App Store 安装）"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
echo -e "${GREEN}✅ 找到 Xcode: $XCODE_VERSION${NC}"

# 检查项目文件
if [ ! -d "App.xcodeproj" ]; then
    echo -e "${RED}❌ 未找到 Xcode 项目文件${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 项目文件检查完成${NC}"
echo ""

# 步骤 5: 构建 Archive 和导出 IPA
echo "📦 步骤 5/5: 构建 Archive 并导出 IPA..."

# 设置路径
OUTPUT_DIR="./build/ipa"
ARCHIVE_PATH="./build/App.xcarchive"
EXPORT_OPTIONS="./exportOptions.plist"

# 清理之前的构建
echo "🧹 清理之前的构建..."
xcodebuild clean \
    -project App.xcodeproj \
    -scheme App \
    -configuration Release \
    > /dev/null 2>&1 || true

# 创建输出目录
mkdir -p "$OUTPUT_DIR"
mkdir -p "./build"

# 检查导出选项文件
if [ ! -f "$EXPORT_OPTIONS" ]; then
    echo -e "${RED}❌ 未找到 exportOptions.plist${NC}"
    echo "💡 请确保 ios/App/exportOptions.plist 文件存在"
    exit 1
fi

# 构建 Archive
echo "📦 创建 Archive（这可能需要几分钟）..."
if xcodebuild archive \
    -project App.xcodeproj \
    -scheme App \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -destination "generic/platform=iOS" \
    CODE_SIGN_IDENTITY="iPhone Distribution" \
    CODE_SIGN_STYLE="Manual" \
    DEVELOPMENT_TEAM="5X988MNY96" \
    PROVISIONING_PROFILE_SPECIFIER="nexusmind 2026" \
    > ./build/archive.log 2>&1; then
    
    echo -e "${GREEN}✅ Archive 创建成功${NC}"
else
    echo -e "${RED}❌ Archive 创建失败${NC}"
    echo "📋 查看详细日志:"
    tail -20 ./build/archive.log
    exit 1
fi

# 检查 Archive 是否存在
if [ ! -d "$ARCHIVE_PATH" ]; then
    echo -e "${RED}❌ Archive 文件不存在${NC}"
    exit 1
fi

# 导出 IPA
echo "📦 导出 IPA 文件..."
if xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$OUTPUT_DIR" \
    -exportOptionsPlist "$EXPORT_OPTIONS" \
    > ./build/export.log 2>&1; then
    
    echo -e "${GREEN}✅ IPA 导出成功${NC}"
else
    echo -e "${RED}❌ IPA 导出失败${NC}"
    echo "📋 查看详细日志:"
    tail -20 ./build/export.log
    exit 1
fi

# 查找 IPA 文件
IPA_FILE=$(find "$OUTPUT_DIR" -name "*.ipa" -maxdepth 1 2>/dev/null | head -1)

if [ -z "$IPA_FILE" ]; then
    echo -e "${RED}❌ 未找到 IPA 文件${NC}"
    exit 1
fi

# 获取文件大小
IPA_SIZE=$(du -h "$IPA_FILE" | cut -f1)

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✨ IPA 文件构建完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📁 IPA 文件位置:"
echo "   $IPA_FILE"
echo ""
echo "📊 文件大小: $IPA_SIZE"
echo ""
echo "📋 输出目录:"
echo "   $(pwd)/$OUTPUT_DIR"
echo ""
echo "💡 提示："
echo "   - 可以将 IPA 文件安装到测试设备"
echo "   - 企业分发可以通过 OTA 方式安装"
echo "   - 确保设备已信任企业证书"
echo ""

