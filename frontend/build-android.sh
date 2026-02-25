#!/bin/bash

# Android 应用打包脚本
# 使用方法: ./build-android.sh

set -e

echo "🚀 开始构建 Android 应用..."

# 1. 构建前端应用
echo "📦 构建前端应用..."
CAPACITOR=true npm run build

# 2. 同步到 Android 平台
echo "🔄 同步到 Android 平台..."
npx cap sync android

# 3. 构建 APK
echo "📱 构建 Android APK..."
cd android

# 检查是否有签名配置
if [ ! -f "app/keystore.jks" ]; then
    echo "⚠️  未找到签名密钥文件，将构建未签名的 APK"
    echo "💡 要发布到 Google Play，需要配置签名密钥："
    echo "   1. 生成密钥: keytool -genkey -v -keystore app/keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias app"
    echo "   2. 配置 android/app/build.gradle 中的 signingConfigs"
    echo ""
    ./gradlew assembleRelease
else
    echo "✅ 找到签名密钥，构建签名 APK..."
    ./gradlew assembleRelease
fi

echo ""
echo "✅ 构建完成！"
echo "📦 APK 文件位置: android/app/build/outputs/apk/release/app-release.apk"
echo ""

