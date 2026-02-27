# 中文字幕乱码问题修复指南

## 问题描述

在自建服务器上生成的中文视频字幕出现乱码，而英文视频字幕正常。本地服务器生成的中文字幕正常。

## 根本原因

服务器环境的 **locale（区域设置）**配置不正确，导致 FFmpeg 在处理 UTF-8 编码的字幕文件时无法正确解析中文字符。

虽然代码中已经：
1. ✅ 使用 UTF-8 BOM 编码写入字幕文件
2. ✅ 在 FFmpeg 命令中指定 `charenc=UTF-8`
3. ✅ 在 Dockerfile 中设置了环境变量

但是 **系统没有生成对应的 locale**，环境变量设置无效。

## 解决方案

### 方案 1：修改 Dockerfile（推荐）✅

已更新 `Dockerfile`，添加以下内容：

```dockerfile
# 安装 locales 包和中文字体
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    locales \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    && rm -rf /var/lib/apt/lists/*

# 生成 UTF-8 locale
RUN sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen && \
    sed -i 's/^# *\(zh_CN.UTF-8\)/\1/' /etc/locale.gen && \
    sed -i 's/^# *\(C.UTF-8\)/\1/' /etc/locale.gen && \
    locale-gen

# 设置环境变量为 C.UTF-8（更通用）
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV LC_CTYPE=C.UTF-8
```

#### 重新构建和部署

```bash
# 1. 重新构建 Docker 镜像
cd adminapi
docker build -t your-registry/adminapi:latest .

# 2. 推送到镜像仓库
docker push your-registry/adminapi:latest

# 3. 在服务器上重新部署（拉取新镜像）
# 如果使用腾讯云 CloudBase Run：
# 在控制台上触发重新部署，或使用 CLI
tcb run deploy --name adminapi --image your-registry/adminapi:latest
```

### 方案 2：在运行中的容器内临时修复（用于测试）

如果无法立即重新部署，可以在运行中的容器内临时修复：

```bash
# 1. 进入容器
docker exec -it <container-id> /bin/bash

# 2. 安装 locales 和字体
apt-get update
apt-get install -y locales fonts-noto-cjk fonts-wqy-zenhei

# 3. 生成 locale
sed -i 's/^# *\(C.UTF-8\)/\1/' /etc/locale.gen
locale-gen

# 4. 设置环境变量
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# 5. 重启 Node.js 应用
pm2 restart all
# 或者
killall node && node server.js &

# 6. 退出容器
exit
```

**注意**：此方法仅为临时解决，容器重启后失效。

### 方案 3：在代码中设置环境变量（不推荐）

虽然不推荐，但可以在 `server.js` 启动时强制设置：

```javascript
// 在 server.js 最开头添加
process.env.LANG = 'C.UTF-8';
process.env.LC_ALL = 'C.UTF-8';
process.env.LC_CTYPE = 'C.UTF-8';
```

这种方法的缺点是只对 Node.js 进程有效，对 FFmpeg 子进程可能无效。

## 验证修复

### 1. 运行诊断脚本

```bash
# 在服务器上运行
node diagnose-subtitle-encoding.js
```

检查输出中的关键信息：
- ✅ `LANG`、`LC_ALL` 应显示为 `C.UTF-8` 或 `en_US.UTF-8`
- ✅ `locale` 命令应显示 UTF-8 编码
- ✅ FFmpeg 应支持 `charenc` 参数
- ✅ 应该有中文字体（Noto CJK、WenQuanYi 等）

### 2. 测试生成中文视频

在管理后台生成一个中文视频，检查字幕是否正常显示。

### 3. 检查 FFmpeg 日志

查看生成视频时的 FFmpeg 日志，确认没有编码相关的警告。

## 技术细节

### 为什么需要 locale？

Linux 系统的 **locale** 决定了程序如何处理字符编码、日期格式、货币格式等。

- 当 locale 未正确设置时，程序可能无法识别 UTF-8 编码
- FFmpeg 的 `subtitles` 滤镜依赖系统 locale 来解析字幕文件
- 即使指定了 `charenc=UTF-8`，如果系统 locale 不支持 UTF-8，仍会失败

### C.UTF-8 vs en_US.UTF-8 vs zh_CN.UTF-8

| Locale        | 说明                            | 推荐度 |
|---------------|-------------------------------|--------|
| `C.UTF-8`     | 通用 UTF-8，所有系统都支持      | ⭐⭐⭐⭐⭐ |
| `en_US.UTF-8` | 英文 UTF-8，需要生成            | ⭐⭐⭐⭐   |
| `zh_CN.UTF-8` | 中文 UTF-8，需要生成            | ⭐⭐⭐    |

**推荐使用 `C.UTF-8`**，因为：
1. 所有现代 Linux 发行版都内置支持
2. 不需要安装额外的语言包
3. 完全支持 UTF-8 字符集（包括中文）
4. 更轻量，容器镜像更小

### 为什么需要中文字体？

FFmpeg 的 `subtitles` 滤镜使用 libass 库来渲染字幕。libass 需要：

1. **正确的字符编码**（通过 locale 和 `charenc` 参数）
2. **合适的字体**（能够显示中文字符）

如果没有中文字体，即使编码正确，字幕也可能显示为方框或问号。

推荐的中文字体包：
- `fonts-noto-cjk`：Google Noto CJK 字体（高质量，支持中日韩）
- `fonts-wqy-zenhei`：文泉驿正黑（开源，常用）
- `fonts-wqy-microhei`：文泉驿微米黑（轻量级）

## 常见问题

### Q1: 为什么本地正常，服务器乱码？

**A**: 本地 macOS/Windows 系统默认配置了 UTF-8 locale 和中文字体，而 Docker 容器默认是最小化配置，需要手动安装。

### Q2: 修改 Dockerfile 后是否需要重新部署？

**A**: 是的，必须重新构建镜像并部署。环境变量和系统配置只能在容器创建时生效。

### Q3: 为什么英文字幕正常，中文乱码？

**A**: 英文字符（ASCII）在任何编码下都能正确显示，而中文字符（UTF-8）需要正确的 locale 配置。

### Q4: 临时修复后容器重启失效怎么办？

**A**: 必须修改 Dockerfile 并重新部署，容器内的临时修改在重启后会丢失。

### Q5: 字幕文件本身是否有问题？

**A**: 字幕文件生成正确（UTF-8 BOM 编码），问题在于服务器环境无法正确解析。可以下载字幕文件到本地查看，应该是正常的。

## 检查清单

部署前检查：
- [ ] Dockerfile 已添加 `locales` 包
- [ ] Dockerfile 已添加中文字体包
- [ ] Dockerfile 已执行 `locale-gen`
- [ ] Dockerfile 环境变量设置为 `C.UTF-8`
- [ ] 已重新构建 Docker 镜像
- [ ] 已推送新镜像到仓库

部署后验证：
- [ ] 运行 `diagnose-subtitle-encoding.js` 确认环境正确
- [ ] 生成测试中文视频，确认字幕正常
- [ ] 检查 FFmpeg 日志无编码警告
- [ ] 检查生成的视频文件，字幕清晰可读

## 参考资料

- [FFmpeg subtitles filter documentation](https://ffmpeg.org/ffmpeg-filters.html#subtitles-1)
- [libass (subtitle rendering library)](https://github.com/libass/libass)
- [Docker locale configuration](https://docs.docker.com/samples/library/debian/#locales)
- [Linux locale tutorial](https://wiki.archlinux.org/title/Locale)

## 联系支持

如果问题仍未解决，请提供以下信息：
1. `diagnose-subtitle-encoding.js` 的完整输出
2. FFmpeg 生成视频时的完整日志
3. 问题视频的 URL
4. 服务器环境信息（系统版本、Docker 版本）
