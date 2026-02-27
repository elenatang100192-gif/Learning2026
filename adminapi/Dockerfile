# 使用 Node.js 18 官方镜像作为基础镜像
FROM node:18

# 设置工作目录
WORKDIR /app

# 安装系统依赖（包括 FFmpeg、locale、中文字体）
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    locales \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    && rm -rf /var/lib/apt/lists/*

# 生成 UTF-8 locale（支持英文和中文）
RUN sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen && \
    sed -i 's/^# *\(zh_CN.UTF-8\)/\1/' /etc/locale.gen && \
    sed -i 's/^# *\(C.UTF-8\)/\1/' /etc/locale.gen && \
    locale-gen

# 设置 UTF-8 编码环境变量，确保正确处理中文字符
# 使用 C.UTF-8 而非 en_US.UTF-8，因为它更通用且在所有系统上都可用
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装 Node.js 依赖
RUN npm install --production

# 复制应用代码
COPY . .

# 暴露端口（CloudBase 会自动映射，这里设置为 3001）
EXPOSE 3001

# 启动应用
CMD ["node", "server.js"]

