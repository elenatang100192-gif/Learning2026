#!/bin/bash

echo "=== 检查邮件服务配置 ==="
echo ""

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
    echo "❌ .env 文件不存在"
    exit 1
fi

echo "📋 检查环境变量配置..."
echo ""

# 检查 EMAIL_USER
EMAIL_USER=$(grep -E '^EMAIL_USER=' .env | cut -d '=' -f2)
if [ -z "$EMAIL_USER" ]; then
    EMAIL_USER=$(grep -E '^SMTP_USER=' .env | cut -d '=' -f2)
fi

if [ -z "$EMAIL_USER" ]; then
    echo "❌ EMAIL_USER 或 SMTP_USER 未设置"
else
    echo "✅ EMAIL_USER: $EMAIL_USER"
fi

# 检查 EMAIL_PASS
EMAIL_PASS=$(grep -E '^EMAIL_PASS=' .env | cut -d '=' -f2)
if [ -z "$EMAIL_PASS" ]; then
    EMAIL_PASS=$(grep -E '^SMTP_PASS=' .env | cut -d '=' -f2)
fi
if [ -z "$EMAIL_PASS" ]; then
    EMAIL_PASS=$(grep -E '^EMAIL_PASSWORD=' .env | cut -d '=' -f2)
fi

if [ -z "$EMAIL_PASS" ]; then
    echo "❌ EMAIL_PASS、SMTP_PASS 或 EMAIL_PASSWORD 未设置"
else
    echo "✅ EMAIL_PASS: ***已设置***"
fi

# 检查 EMAIL_HOST
EMAIL_HOST=$(grep -E '^EMAIL_HOST=' .env | cut -d '=' -f2)
if [ -z "$EMAIL_HOST" ]; then
    EMAIL_HOST=$(grep -E '^SMTP_HOST=' .env | cut -d '=' -f2)
fi

if [ -z "$EMAIL_HOST" ]; then
    echo "⚠️ EMAIL_HOST 未设置（将自动识别）"
else
    echo "✅ EMAIL_HOST: $EMAIL_HOST"
fi

# 检查 EMAIL_PORT
EMAIL_PORT=$(grep -E '^EMAIL_PORT=' .env | cut -d '=' -f2)
if [ -z "$EMAIL_PORT" ]; then
    EMAIL_PORT=$(grep -E '^SMTP_PORT=' .env | cut -d '=' -f2)
fi

if [ -z "$EMAIL_PORT" ]; then
    echo "⚠️ EMAIL_PORT 未设置（将使用默认值）"
else
    echo "✅ EMAIL_PORT: $EMAIL_PORT"
fi

# 检查 EMAIL_SECURE
EMAIL_SECURE=$(grep -E '^EMAIL_SECURE=' .env | cut -d '=' -f2)
if [ -z "$EMAIL_SECURE" ]; then
    echo "⚠️ EMAIL_SECURE 未设置（将自动判断）"
else
    echo "✅ EMAIL_SECURE: $EMAIL_SECURE"
fi

# 检查 NODE_ENV
NODE_ENV=$(grep -E '^NODE_ENV=' .env | cut -d '=' -f2)

echo ""
echo "📋 环境模式："
if [ "$NODE_ENV" = "production" ]; then
    echo "⚠️ NODE_ENV=production（生产模式）"
    echo "   需要配置邮件服务才能发送OTP"
    
    if [ -z "$EMAIL_USER" ] || [ -z "$EMAIL_PASS" ]; then
        echo ""
        echo "❌ 邮件服务未配置，无法发送OTP"
        echo ""
        echo "请配置以下环境变量："
        echo "  EMAIL_USER=your-email@example.com"
        echo "  EMAIL_PASS=your-password-or-app-password"
        echo "  EMAIL_HOST=smtp.example.com（可选，会自动识别）"
        echo "  EMAIL_PORT=587（可选，默认587）"
        echo "  EMAIL_SECURE=false（可选，自动判断）"
        exit 1
    fi
else
    echo "✅ NODE_ENV=$NODE_ENV（开发模式）"
    echo "   开发模式下，OTP会直接返回给前端显示，不需要配置邮件服务"
fi

echo ""
echo "📋 测试邮件服务配置..."
echo ""

node -e "
require('dotenv').config();
const { initEmailService } = require('./utils/email');
const transporter = initEmailService();
if (transporter) {
    console.log('✅ 邮件服务配置正确');
    process.exit(0);
} else {
    console.log('❌ 邮件服务配置错误');
    process.exit(1);
}
" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 邮件服务配置检查通过"
else
    echo ""
    echo "❌ 邮件服务配置检查失败"
    echo ""
    echo "请检查："
    echo "  1. EMAIL_USER 和 EMAIL_PASS 是否正确"
    echo "  2. 邮箱是否启用了SMTP服务"
    echo "  3. 是否使用了正确的授权码（不是登录密码）"
fi


