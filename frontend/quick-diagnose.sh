#!/bin/bash

echo "=== 快速诊断 'Load failed' 错误 ==="
echo ""

# 1. 检查 .env 文件
echo "1. 检查 .env 文件..."
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    echo "   内容:"
    cat .env | grep VITE_API_BASE_URL
else
    echo "❌ .env 文件不存在"
fi

echo ""

# 2. 检查 API 服务器连接
echo "2. 检查 API 服务器连接..."
API_URL=$(grep VITE_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2)
if [ -n "$API_URL" ]; then
    echo "   测试连接: $API_URL"
    curl -I -s -o /dev/null -w "   HTTP状态码: %{http_code}\n" "$API_URL/auth/send-otp" --max-time 5 || echo "   ❌ 无法连接"
else
    echo "   ⚠️ 未找到 API URL"
fi

echo ""

# 3. 检查构建文件
echo "3. 检查构建文件..."
if [ -d "dist" ]; then
    echo "✅ dist 目录存在"
    echo "   文件数量: $(find dist -type f | wc -l)"
    if [ -f "dist/index.html" ]; then
        echo "✅ index.html 存在"
    else
        echo "❌ index.html 不存在"
    fi
else
    echo "❌ dist 目录不存在，需要重新构建"
fi

echo ""

# 4. 建议
echo "=== 建议 ==="
echo "1. 如果 .env 文件存在但应用仍显示 'Load failed'，请："
echo "   - 重新构建: CAPACITOR=true npm run build"
echo "   - 重新打包 IPA"
echo "   - 重新安装应用"
echo ""
echo "2. 查看详细日志："
echo "   - 在 Xcode 中运行应用并查看控制台"
echo "   - 或运行: ./check-device-logs.sh"
echo ""
echo "3. 检查网络连接："
echo "   - 确保 iPhone 连接到网络"
echo "   - 在 Safari 中访问: $API_URL"
