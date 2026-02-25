#!/bin/bash

echo "=== 应用配置验证脚本 ==="
echo ""

PROJECT_DIR="/Users/et/Desktop/Learning"
ADMINAPI_DIR="$PROJECT_DIR/adminapi"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

echo "📋 步骤 1: 检查后端环境变量配置"
echo ""

cd "$ADMINAPI_DIR"

if [ ! -f ".env" ]; then
    check_fail ".env 文件不存在"
    exit 1
fi

check_pass ".env 文件存在"

# 检查数据库配置
echo ""
echo "检查数据库配置..."
DB_VARS=("DB_HOSTNAME" "DB_PORT" "DB_USERNAME" "DB_PASSWORD" "DB_DATABASE")
DB_MISSING=0

for var in "${DB_VARS[@]}"; do
    if grep -q "^${var}=" .env; then
        value=$(grep "^${var}=" .env | cut -d '=' -f2)
        if [ -z "$value" ]; then
            check_fail "${var} 未设置值"
            DB_MISSING=1
        else
            if [ "$var" = "DB_PASSWORD" ]; then
                check_pass "${var} 已配置（已隐藏）"
            else
                check_pass "${var} = ${value}"
            fi
        fi
    else
        check_fail "${var} 未配置"
        DB_MISSING=1
    fi
done

# 检查七牛云配置
echo ""
echo "检查七牛云配置..."
QINIU_VARS=("QINIU_URL" "QINIU_BUCKET" "QINIU_ACCESS_KEY" "QINIU_SECRET_KEY")
QINIU_MISSING=0

for var in "${QINIU_VARS[@]}"; do
    if grep -q "^${var}=" .env; then
        value=$(grep "^${var}=" .env | cut -d '=' -f2)
        if [ -z "$value" ]; then
            check_fail "${var} 未设置值"
            QINIU_MISSING=1
        else
            if [[ "$var" == *"KEY"* ]]; then
                check_pass "${var} 已配置（已隐藏）"
            else
                check_pass "${var} = ${value}"
            fi
        fi
    else
        check_fail "${var} 未配置"
        QINIU_MISSING=1
    fi
done

echo ""
echo "📋 步骤 2: 测试数据库连接"
echo ""

if [ $DB_MISSING -eq 0 ]; then
    echo "正在测试数据库连接..."
    node -e "
    require('dotenv').config();
    const db = require('./utils/db');
    db.testConnection().then(success => {
        if (success) {
            console.log('✅ 数据库连接成功');
            process.exit(0);
        } else {
            console.log('❌ 数据库连接失败');
            process.exit(1);
        }
    }).catch(err => {
        console.log('❌ 数据库连接错误:', err.message);
        process.exit(1);
    });
    " 2>&1
    
    if [ $? -eq 0 ]; then
        check_pass "数据库连接测试通过"
    else
        check_fail "数据库连接测试失败"
    fi
else
    check_warn "跳过数据库连接测试（配置不完整）"
fi

echo ""
echo "📋 步骤 3: 检查七牛云配置"
echo ""

if [ $QINIU_MISSING -eq 0 ]; then
    echo "正在检查七牛云配置..."
    node -e "
    require('dotenv').config();
    try {
        const { uploadFile } = require('./utils/fileUpload');
        console.log('✅ 七牛云配置加载成功');
        process.exit(0);
    } catch(e) {
        console.log('❌ 七牛云配置错误:', e.message);
        process.exit(1);
    }
    " 2>&1
    
    if [ $? -eq 0 ]; then
        check_pass "七牛云配置检查通过"
    else
        check_fail "七牛云配置检查失败"
    fi
else
    check_warn "跳过七牛云配置检查（配置不完整）"
fi

echo ""
echo "📋 步骤 4: 检查前端配置"
echo ""

cd "$FRONTEND_DIR"

if [ ! -f ".env" ]; then
    check_fail ".env 文件不存在"
else
    check_pass ".env 文件存在"
    
    if grep -q "^VITE_API_BASE_URL=" .env; then
        API_URL=$(grep "^VITE_API_BASE_URL=" .env | cut -d '=' -f2)
        if [ -z "$API_URL" ]; then
            check_fail "VITE_API_BASE_URL 未设置值"
        else
            check_pass "VITE_API_BASE_URL = ${API_URL}"
            
            # 检查API URL格式
            if [[ "$API_URL" =~ ^https?:// ]]; then
                check_pass "API URL 格式正确"
            else
                check_fail "API URL 格式错误（应该以 http:// 或 https:// 开头）"
            fi
        fi
    else
        check_fail "VITE_API_BASE_URL 未配置"
    fi
fi

echo ""
echo "📋 步骤 5: 检查代码中的配置"
echo ""

# 检查后端代码中的数据库配置
echo "检查后端数据库配置..."
if grep -q "requireEnv('DB_" "$ADMINAPI_DIR/utils/db.js"; then
    check_pass "后端数据库配置使用环境变量"
else
    check_warn "后端数据库配置可能硬编码"
fi

# 检查后端代码中的七牛云配置
echo "检查后端七牛云配置..."
if grep -q "requireEnv('QINIU_" "$ADMINAPI_DIR/utils/fileUpload.js"; then
    check_pass "后端七牛云配置使用环境变量"
else
    check_warn "后端七牛云配置可能硬编码"
fi

# 检查前端代码中的API配置
echo "检查前端API配置..."
if grep -q "import.meta.env.VITE_API_BASE_URL" "$FRONTEND_DIR/src/app/services/leancloud.ts"; then
    check_pass "前端API配置使用环境变量"
else
    check_warn "前端API配置可能硬编码"
fi

echo ""
echo "=== 配置验证完成 ==="
echo ""
echo "📋 配置总结："
echo ""
echo "数据库: MySQL"
echo "  - 服务器: $(grep "^DB_HOSTNAME=" "$ADMINAPI_DIR/.env" | cut -d '=' -f2):$(grep "^DB_PORT=" "$ADMINAPI_DIR/.env" | cut -d '=' -f2)"
echo "  - 数据库名: $(grep "^DB_DATABASE=" "$ADMINAPI_DIR/.env" | cut -d '=' -f2)"
echo ""
echo "文件存储: 七牛云"
echo "  - URL: $(grep "^QINIU_URL=" "$ADMINAPI_DIR/.env" | cut -d '=' -f2)"
echo "  - Bucket: $(grep "^QINIU_BUCKET=" "$ADMINAPI_DIR/.env" | cut -d '=' -f2)"
echo ""
echo "前端API: $(grep "^VITE_API_BASE_URL=" "$FRONTEND_DIR/.env" | cut -d '=' -f2)"
echo ""
echo "✅ 所有配置检查完成"


