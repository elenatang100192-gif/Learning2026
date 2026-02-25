#!/bin/bash

# 企业账号 iOS 应用打包脚本

set -e

# ============================================
# 配置区域（需要根据实际情况修改）
# ============================================

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
IOS_DIR="$PROJECT_DIR/ios/App"
BUILD_DIR="$IOS_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_PATH="$BUILD_DIR/ipa"
SCHEME="App"
CONFIGURATION="Release"

# 企业证书配置（已根据实际证书和配置文件更新）
CODE_SIGN_IDENTITY="iPhone Distribution: Wanvog Furniture (Kunshan) Co., Ltd."
PROVISIONING_PROFILE="nexusmind 2026"
TEAM_ID="5X988MNY96"
BUNDLE_ID="com.ashleyfurniture.nexusmind"

# ============================================
# 打包流程
# ============================================

echo "=== 企业应用打包脚本 ==="
echo ""
echo "项目目录: $PROJECT_DIR"
echo "构建配置: $CONFIGURATION"
echo "Bundle ID: $BUNDLE_ID"
echo ""

# 检查配置
if [[ "$CODE_SIGN_IDENTITY" == *"Your Company"* ]] || [[ "$PROVISIONING_PROFILE" == *"Your Enterprise"* ]] || [[ "$TEAM_ID" == "YOUR_TEAM_ID" ]]; then
    echo "❌ 错误：请先修改脚本中的企业证书配置！"
    echo ""
    echo "需要修改的配置："
    echo "1. CODE_SIGN_IDENTITY: 企业分发证书名称"
    echo "2. PROVISIONING_PROFILE: 企业分发配置文件名称"
    echo "3. TEAM_ID: 企业团队 ID"
    exit 1
fi

# 步骤 1：构建前端应用
echo "📦 步骤 1/6: 构建前端应用..."
cd "$PROJECT_DIR"
CAPACITOR=true npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi
echo "✅ 前端构建完成"

# 修复 index.html 中的资源路径（确保使用 /assets/ 而不是 /Video-frontend/assets/）
echo "🔧 修复 index.html 资源路径..."
if [ -f "dist/index.html" ]; then
    sed -i '' 's|/Video-frontend/assets/|/assets/|g' dist/index.html
    echo "✅ index.html 路径已修复"
fi

# 步骤 2：同步 Capacitor
echo ""
echo "🔄 步骤 2/6: 同步 Capacitor..."
npx cap sync ios
if [ $? -ne 0 ]; then
    echo "❌ Capacitor 同步失败"
    exit 1
fi
echo "✅ Capacitor 同步完成"

# 步骤 3：清理项目
echo ""
echo "🧹 步骤 3/6: 清理 iOS 项目..."
cd "$IOS_DIR"
# 检查是否存在 workspace
if [ -f "App.xcworkspace/contents.xcworkspacedata" ]; then
    WORKSPACE_OPTION="-workspace App.xcworkspace"
else
    WORKSPACE_OPTION="-project App.xcodeproj"
fi

xcodebuild clean \
  $WORKSPACE_OPTION \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  2>&1 | grep -v "warning" || true
echo "✅ 清理完成"

# 步骤 4：创建归档
echo ""
echo "📦 步骤 4/6: 创建归档..."
mkdir -p "$BUILD_DIR"
xcodebuild archive \
  $WORKSPACE_OPTION \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY" \
  PROVISIONING_PROFILE_SPECIFIER="$PROVISIONING_PROFILE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  2>&1 | tee "$BUILD_DIR/archive.log"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ 归档失败，请查看日志: $BUILD_DIR/archive.log"
    exit 1
fi
echo "✅ 归档完成: $ARCHIVE_PATH"

# 步骤 5：创建 exportOptions.plist
echo ""
echo "📝 步骤 5/6: 创建导出配置..."
mkdir -p "$BUILD_DIR"
cat > "$BUILD_DIR/exportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>enterprise</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>iPhone Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>$BUNDLE_ID</key>
        <string>$PROVISIONING_PROFILE</string>
    </dict>
</dict>
</plist>
EOF
echo "✅ 导出配置已创建: $BUILD_DIR/exportOptions.plist"

# 步骤 6：导出 IPA
echo ""
echo "📤 步骤 6/6: 导出 IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$BUILD_DIR/exportOptions.plist" \
  2>&1 | tee "$BUILD_DIR/export.log"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ 导出失败，请查看日志: $BUILD_DIR/export.log"
    exit 1
fi

# 步骤 7：显示结果
echo ""
echo "=== ✅ 打包完成 ==="
echo ""
IPA_FILE="$EXPORT_PATH/App.ipa"
if [ -f "$IPA_FILE" ]; then
    echo "📱 IPA 文件位置:"
    echo "   $IPA_FILE"
    echo ""
    echo "📊 文件信息:"
    ls -lh "$IPA_FILE" | awk '{print "   大小: " $5}'
    echo ""
    echo "📋 下一步操作:"
    echo "1. 将 IPA 文件上传到 HTTPS 服务器"
    echo "2. 创建 manifest.plist 文件（参考 ENTERPRISE_BUILD_GUIDE.md）"
    echo "3. 创建安装页面 index.html"
    echo "4. 用户通过 Safari 访问安装页面下载"
else
    echo "❌ IPA 文件未找到"
    exit 1
fi

