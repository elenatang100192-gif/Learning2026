#!/bin/bash
# 启动后台管理系统和本地服务器（后端API）

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  启动后台管理系统和本地服务器${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查并创建日志目录
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# 函数：清理函数（当脚本退出时）
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止所有服务...${NC}"
    kill $ADMIN_PID $API_PID 2>/dev/null
    wait $ADMIN_PID $API_PID 2>/dev/null
    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 清理旧进程
echo -e "${YELLOW}清理旧进程...${NC}"
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null
lsof -ti:5176 | xargs kill -9 2>/dev/null
sleep 1

# 1. 启动后端API服务器
echo -e "${GREEN}[1/2] 启动后端API服务器...${NC}"
cd "$SCRIPT_DIR/adminapi"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，请确保已配置环境变量${NC}"
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}后端API: 正在安装依赖...${NC}"
    npm install
fi

# 启动服务器
npm run dev > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo -e "${GREEN}✅ 后端API已启动 (PID: $API_PID, 端口: 3001)${NC}"
echo -e "${BLUE}   日志文件: $LOG_DIR/api.log${NC}"
echo -e "${BLUE}   访问地址: http://localhost:3001${NC}"
sleep 3

# 2. 启动后台管理系统
echo ""
echo -e "${GREEN}[2/2] 启动后台管理系统...${NC}"
cd "$SCRIPT_DIR/admin"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}后台管理: 正在安装依赖...${NC}"
    npm install
fi

# 启动后台管理
npm run dev > "$LOG_DIR/admin.log" 2>&1 &
ADMIN_PID=$!
echo -e "${GREEN}✅ 后台管理已启动 (PID: $ADMIN_PID, 端口: 5175)${NC}"
echo -e "${BLUE}   日志文件: $LOG_DIR/admin.log${NC}"
echo -e "${BLUE}   访问地址: http://localhost:5175${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 所有服务已启动！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}服务地址：${NC}"
echo -e "  ${GREEN}后端API服务器:${NC}    http://localhost:3001"
echo -e "  ${GREEN}后台管理系统:${NC}    http://localhost:5175"
echo ""
echo -e "${YELLOW}日志文件：${NC}"
echo -e "  后端API:  ${BLUE}$LOG_DIR/api.log${NC}"
echo -e "  后台管理: ${BLUE}$LOG_DIR/admin.log${NC}"
echo ""
echo -e "${YELLOW}查看日志：${NC}"
echo -e "  tail -f $LOG_DIR/api.log"
echo -e "  tail -f $LOG_DIR/admin.log"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

# 等待所有进程
wait

