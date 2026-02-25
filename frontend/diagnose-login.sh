#!/bin/bash

echo "=== 诊断登录问题 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
cd "$PROJECT_DIR"

echo "📋 步骤 1: 检查环境变量配置"
echo ""

# 检查 .env 文件
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    echo ""
    echo "📄 .env 文件内容："
    cat .env | grep -v "^#" | grep -v "^$"
    echo ""
    
    # 检查 VITE_API_BASE_URL
    API_URL=$(grep VITE_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2)
    if [ -z "$API_URL" ]; then
        echo "❌ 未找到 VITE_API_BASE_URL 配置"
        echo ""
        echo "修复方法："
        echo "  echo 'VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/' > .env"
    else
        echo "✅ VITE_API_BASE_URL: $API_URL"
        
        # 检查 URL 格式
        if [[ ! "$API_URL" =~ ^https?:// ]]; then
            echo "⚠️ 警告：API URL 格式可能不正确（应该以 http:// 或 https:// 开头）"
        fi
        
        if [[ "$API_URL" != */api/ ]] && [[ "$API_URL" != */api ]]; then
            echo "⚠️ 警告：API URL 应该以 /api/ 或 /api 结尾"
        fi
    fi
else
    echo "❌ .env 文件不存在"
    echo ""
    echo "创建 .env 文件..."
    echo "VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/" > .env
    echo "✅ 已创建 .env 文件"
fi

echo ""
echo "📋 步骤 2: 检查构建配置"
echo ""

# 检查 vite.config.ts
if [ -f "vite.config.ts" ]; then
    echo "✅ vite.config.ts 存在"
    
    # 检查 base 配置
    if grep -q "base:" vite.config.ts; then
        echo "✅ vite.config.ts 包含 base 配置"
    else
        echo "⚠️ vite.config.ts 可能缺少 base 配置"
    fi
else
    echo "❌ vite.config.ts 不存在"
fi

echo ""
echo "📋 步骤 3: 检查 iOS 配置"
echo ""

IOS_DIR="ios/App/App"
if [ -f "$IOS_DIR/Info.plist" ]; then
    echo "✅ Info.plist 存在"
    
    # 检查 ATS 配置
    if grep -q "NSAppTransportSecurity" "$IOS_DIR/Info.plist"; then
        echo "✅ Info.plist 包含 App Transport Security 配置"
    else
        echo "⚠️ Info.plist 可能缺少 App Transport Security 配置"
    fi
else
    echo "❌ Info.plist 不存在"
fi

echo ""
echo "📋 步骤 4: 检查 API 服务器连接"
echo ""

API_URL=$(grep VITE_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'")
if [ -n "$API_URL" ]; then
    # 提取域名
    DOMAIN=$(echo "$API_URL" | sed -E 's|https?://([^/]+).*|\1|')
    
    echo "测试连接到: $DOMAIN"
    
    # 测试连接
    if curl -s --head --max-time 5 "https://$DOMAIN" > /dev/null 2>&1; then
        echo "✅ API 服务器可访问"
    else
        echo "❌ 无法连接到 API 服务器"
        echo "   请检查："
        echo "   1. 网络连接"
        echo "   2. API 服务器是否运行"
        echo "   3. 防火墙设置"
    fi
else
    echo "⚠️ 无法测试连接（API URL 未配置）"
fi

echo ""
echo "📋 步骤 5: 检查最近的构建"
echo ""

DIST_DIR="dist"
if [ -d "$DIST_DIR" ]; then
    echo "✅ dist 目录存在"
    
    # 检查 index.html
    if [ -f "$DIST_DIR/index.html" ]; then
        echo "✅ index.html 存在"
        
        # 检查资源路径
        if grep -q "/Video-frontend/assets/" "$DIST_DIR/index.html"; then
            echo "⚠️ 警告：index.html 包含错误的资源路径 (/Video-frontend/assets/)"
            echo "   应该使用 /assets/ 而不是 /Video-frontend/assets/"
        else
            echo "✅ index.html 资源路径正确"
        fi
    else
        echo "❌ index.html 不存在"
    fi
else
    echo "⚠️ dist 目录不存在（可能需要重新构建）"
fi

echo ""
echo "=== 诊断完成 ==="
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 如果环境变量配置不正确，请修复："
echo "   echo 'VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/' > .env"
echo ""
echo "2. 重新构建 IPA："
echo "   cd /Users/et/Desktop/Learning"
echo "   ./build-enterprise-ipa.sh"
echo ""
echo "3. 查看应用运行日志："
echo "   open -a Console"
echo "   然后选择设备，搜索：App API Error 🔧 🌐"
echo ""
echo "4. 或使用命令行查看日志："
echo "   ./view-logs-no-xcode.sh"
echo ""

