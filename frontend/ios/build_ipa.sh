#!/bin/bash
# 构建 IPA 文件的脚本

set -e

cd "$(dirname "$0")/App"

echo "🔧 开始构建 IPA 文件..."

# 检查 xcpretty（可选，用于美化输出）
if command -v xcpretty &> /dev/null; then
    XCPRETTY="| xcpretty"
else
    XCPRETTY=""
    echo "⚠️  xcpretty 未安装，输出可能不够美观（可选安装：gem install xcpretty）"
fi

# 1. 清理之前的构建
echo "📦 清理之前的构建..."
xcodebuild clean -project App.xcodeproj -scheme App -configuration Release

# 2. 创建输出目录
OUTPUT_DIR="./build/ipa"
ARCHIVE_PATH="./build/App.xcarchive"
mkdir -p "$OUTPUT_DIR"
mkdir -p "./build"

# 3. Archive
echo "📦 创建 Archive..."
if [ -n "$XCPRETTY" ]; then
    xcodebuild archive \
      -project App.xcodeproj \
      -scheme App \
      -configuration Release \
      -archivePath "$ARCHIVE_PATH" \
      -destination "generic/platform=iOS" \
      CODE_SIGN_IDENTITY="iPhone Distribution" \
      CODE_SIGN_STYLE="Manual" \
      DEVELOPMENT_TEAM="5X988MNY96" \
      PROVISIONING_PROFILE_SPECIFIER="nexusmind 2026" \
      | xcpretty
else
    xcodebuild archive \
      -project App.xcodeproj \
      -scheme App \
      -configuration Release \
      -archivePath "$ARCHIVE_PATH" \
      -destination "generic/platform=iOS" \
      CODE_SIGN_IDENTITY="iPhone Distribution" \
      CODE_SIGN_STYLE="Manual" \
      DEVELOPMENT_TEAM="5X988MNY96" \
      PROVISIONING_PROFILE_SPECIFIER="nexusmind 2026"
fi

# 检查 Archive 是否成功
if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive 创建失败！"
    exit 1
fi

echo "✅ Archive 创建成功！"

# 4. Export IPA
echo "📦 导出 IPA..."
if [ -n "$XCPRETTY" ]; then
    xcodebuild -exportArchive \
      -archivePath "$ARCHIVE_PATH" \
      -exportPath "$OUTPUT_DIR" \
      -exportOptionsPlist exportOptions.plist \
      | xcpretty
else
    xcodebuild -exportArchive \
      -archivePath "$ARCHIVE_PATH" \
      -exportPath "$OUTPUT_DIR" \
      -exportOptionsPlist exportOptions.plist
fi

# 检查 IPA 是否成功
IPA_FILE=$(find "$OUTPUT_DIR" -name "*.ipa" 2>/dev/null | head -1)
if [ -z "$IPA_FILE" ]; then
    echo "❌ IPA 导出失败！"
    exit 1
fi

echo "✅ IPA 文件已构建完成！"
echo "📁 IPA 文件位置: $IPA_FILE"
echo "📁 输出目录: $OUTPUT_DIR"
