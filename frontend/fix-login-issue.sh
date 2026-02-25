#!/bin/bash

echo "=== 修复登录问题 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning/frontend"
cd "$PROJECT_DIR"

echo "📋 步骤 1: 检查环境变量配置"
echo ""

# 检查 .env 文件
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    API_URL=$(grep VITE_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    
    if [ -z "$API_URL" ]; then
        echo "❌ VITE_API_BASE_URL 未配置"
        echo ""
        echo "正在修复..."
        echo "VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/" > .env
        echo "✅ 已设置 API URL"
    else
        echo "✅ VITE_API_BASE_URL: $API_URL"
        
        # 检查 URL 格式
        if [[ ! "$API_URL" =~ ^https?:// ]]; then
            echo "⚠️ 警告：API URL 格式不正确，正在修复..."
            echo "VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/" > .env
            echo "✅ 已修复 API URL"
        fi
    fi
else
    echo "❌ .env 文件不存在，正在创建..."
    echo "VITE_API_BASE_URL=https://nexusmind-api-test.ashgso.com/api/" > .env
    echo "✅ 已创建 .env 文件"
fi

echo ""
echo "📋 步骤 2: 清理所有缓存"
echo ""

read -p "是否清理所有缓存？(y/n): " clean_cache

if [ "$clean_cache" = "y" ] || [ "$clean_cache" = "Y" ]; then
    echo ""
    echo "清理前端构建缓存..."
    rm -rf dist
    rm -rf node_modules/.vite
    echo "✅ 前端缓存已清理"
    
    echo ""
    echo "清理 iOS 构建缓存..."
    if [ -d "ios/App/build" ]; then
        rm -rf ios/App/build
        echo "✅ iOS 构建缓存已清理"
    fi
    
    echo ""
    echo "清理 Xcode DerivedData..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/App-* 2>/dev/null
    echo "✅ Xcode DerivedData 已清理"
    
    echo ""
    echo "清理 CoreDevice 缓存..."
    rm -rf ~/Library/Caches/com.apple.CoreDevice.CoreDeviceService 2>/dev/null
    echo "✅ CoreDevice 缓存已清理"
    
    echo ""
    echo "清理 Capacitor 缓存..."
    rm -rf .capacitor
    echo "✅ Capacitor 缓存已清理"
fi

echo ""
echo "📋 步骤 3: 检查构建配置"
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
echo "📋 步骤 4: 检查 iOS 配置"
echo ""

IOS_DIR="ios/App/App"
if [ -f "$IOS_DIR/Info.plist" ]; then
    echo "✅ Info.plist 存在"
    
    # 检查 ATS 配置
    if grep -q "NSAppTransportSecurity" "$IOS_DIR/Info.plist"; then
        echo "✅ App Transport Security 已配置"
    else
        echo "⚠️ App Transport Security 未配置"
    fi
else
    echo "❌ Info.plist 不存在"
fi

echo ""
echo "📋 步骤 5: 检查 API 服务器连接"
echo ""

API_URL=$(grep VITE_API_BASE_URL .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
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
echo "=== 诊断完成 ==="
echo ""
echo "📋 下一步操作："
echo ""
echo "1. 重新构建 IPA："
echo "   cd /Users/et/Desktop/Learning"
echo "   ./build-enterprise-ipa.sh"
echo ""
echo "2. 重新安装应用："
echo "   - 在 iPhone 上卸载旧版本"
echo "   - 安装新构建的 IPA"
echo ""
echo "3. 查看应用日志："
echo "   open -a Console"
echo "   搜索：App API Error 🔧 🌐 ❌"
echo ""
echo "4. 测试登录功能："
echo "   - 输入邮箱：eltang@ashleyfurniture.com"
echo "   - 点击发送验证码"
echo "   - 观察 Console.app 中的日志"
echo ""

