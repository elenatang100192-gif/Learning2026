#!/bin/bash
# 修复 iOS 构建后的资源路径

cd "$(dirname "$0")"

# 修复 dist/index.html
if [ -f "dist/index.html" ]; then
  sed -i '' 's|/Video-frontend/assets/|/assets/|g' dist/index.html
  echo "✅ Fixed dist/index.html"
fi

# 修复 ios/App/App/public/index.html
if [ -f "ios/App/App/public/index.html" ]; then
  sed -i '' 's|/Video-frontend/assets/|/assets/|g' ios/App/App/public/index.html
  echo "✅ Fixed ios/App/App/public/index.html"
fi

echo "✅ Asset paths fixed!"

