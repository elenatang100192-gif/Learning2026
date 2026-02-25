#!/bin/bash

# 修复 iOS 项目中的资源路径
IOS_INDEX_HTML="ios/App/App/public/index.html"

if [ -f "$IOS_INDEX_HTML" ]; then
  echo "🔧 修复 iOS 项目中的资源路径..."
  # 将 /Video-frontend/assets/ 替换为 /assets/
  sed -i '' 's|/Video-frontend/assets/|/assets/|g' "$IOS_INDEX_HTML"
  echo "✅ 路径修复完成"
else
  echo "⚠️  未找到 $IOS_INDEX_HTML"
fi

