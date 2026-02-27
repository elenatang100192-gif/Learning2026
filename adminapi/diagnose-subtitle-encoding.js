#!/usr/bin/env node
/**
 * 字幕编码诊断脚本
 * 用于检查服务器环境的字符编码配置
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 开始诊断字幕编码环境...\n');

// 1. 检查系统环境变量
console.log('📋 1. 系统环境变量:');
console.log('   LANG:', process.env.LANG || '未设置');
console.log('   LC_ALL:', process.env.LC_ALL || '未设置');
console.log('   LC_CTYPE:', process.env.LC_CTYPE || '未设置');
console.log('   NODE_ENV:', process.env.NODE_ENV || '未设置');
console.log('');

// 2. 检查 locale 设置
console.log('📋 2. 系统 Locale 设置:');
try {
  const localeOutput = execSync('locale', { encoding: 'utf8', timeout: 5000 });
  console.log(localeOutput);
} catch (e) {
  console.error('   ❌ 无法获取 locale 信息:', e.message);
}
console.log('');

// 3. 检查可用的 locale
console.log('📋 3. 可用的 UTF-8 Locale:');
try {
  const localesOutput = execSync('locale -a | grep -i utf', { encoding: 'utf8', timeout: 5000 });
  console.log(localesOutput);
} catch (e) {
  console.error('   ❌ 无法获取可用 locale 列表:', e.message);
}
console.log('');

// 4. 检查 FFmpeg 版本和字幕支持
console.log('📋 4. FFmpeg 字幕支持:');
try {
  const ffmpegVersion = execSync('ffmpeg -version | head -1', { encoding: 'utf8', timeout: 5000 });
  console.log('   版本:', ffmpegVersion.trim());
  
  const filtersOutput = execSync('ffmpeg -filters 2>&1 | grep subtitles', { encoding: 'utf8', timeout: 5000 });
  console.log('   字幕滤镜:', filtersOutput.trim());
  
  const filterHelp = execSync('ffmpeg -h filter=subtitles 2>&1 | grep -A 2 charenc', { encoding: 'utf8', timeout: 5000 });
  console.log('   charenc 参数支持:');
  console.log(filterHelp);
} catch (e) {
  console.error('   ❌ 无法获取 FFmpeg 信息:', e.message);
}
console.log('');

// 5. 检查字体配置
console.log('📋 5. 系统字体配置:');
try {
  const fontDirs = [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    '~/.fonts',
    '/System/Library/Fonts'
  ];
  
  fontDirs.forEach(dir => {
    try {
      const expanded = dir.replace('~', process.env.HOME || '');
      if (fs.existsSync(expanded)) {
        const fonts = execSync(`find ${expanded} -name "*.ttf" -o -name "*.otf" 2>/dev/null | head -5`, { encoding: 'utf8', timeout: 5000 });
        if (fonts.trim()) {
          console.log(`   ${dir}:`);
          console.log(fonts.trim().split('\n').map(f => `     - ${f}`).join('\n'));
        }
      }
    } catch (e) {
      // 忽略错误
    }
  });
} catch (e) {
  console.error('   ❌ 无法获取字体信息:', e.message);
}
console.log('');

// 6. 创建测试字幕文件
console.log('📋 6. 创建测试字幕文件:');
const testDir = path.join(__dirname, 'temp', 'encoding-test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const testSubtitlePath = path.join(testDir, 'test-zh.srt');
const testContent = `1
00:00:00,000 --> 00:00:03,000
这是一个中文字幕测试

2
00:00:03,000 --> 00:00:06,000
测试UTF-8编码是否正常

3
00:00:06,000 --> 00:00:09,000
English subtitle test
`;

// 使用 UTF-8 BOM 写入
const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF]);
const contentBuffer = Buffer.from(testContent, 'utf8');
const fullBuffer = Buffer.concat([bomBuffer, contentBuffer]);
fs.writeFileSync(testSubtitlePath, fullBuffer);

console.log('   ✅ 测试字幕文件已创建:', testSubtitlePath);
console.log('   文件大小:', fs.statSync(testSubtitlePath).size, '字节');

// 验证 BOM
const verifyBuffer = fs.readFileSync(testSubtitlePath);
const hasBOM = verifyBuffer[0] === 0xEF && verifyBuffer[1] === 0xBB && verifyBuffer[2] === 0xBF;
console.log('   UTF-8 BOM:', hasBOM ? '✅ 存在' : '❌ 不存在');

// 使用 file 命令检查文件编码（如果可用）
try {
  const fileOutput = execSync(`file -b --mime-encoding "${testSubtitlePath}"`, { encoding: 'utf8', timeout: 5000 });
  console.log('   文件编码（file命令）:', fileOutput.trim());
} catch (e) {
  console.log('   ⚠️ file 命令不可用');
}

// 读取并显示内容（验证编码）
const readContent = fs.readFileSync(testSubtitlePath, 'utf8');
console.log('   内容预览（前100字符）:', readContent.substring(0, 100).replace(/\n/g, '\\n'));
console.log('');

// 7. 测试 FFmpeg 字幕渲染（如果有测试视频）
console.log('📋 7. FFmpeg 字幕渲染建议:');
console.log('   如果在服务器上遇到中文字幕乱码，请尝试以下方法：');
console.log('');
console.log('   方法1: 显式设置 locale 环境变量（推荐）');
console.log('   export LANG=C.UTF-8');
console.log('   export LC_ALL=C.UTF-8');
console.log('');
console.log('   方法2: FFmpeg 命令中明确指定字符编码');
console.log(`   ffmpeg -i input.mp4 -vf "subtitles='${testSubtitlePath}':charenc=UTF-8" output.mp4`);
console.log('');
console.log('   方法3: 安装中文字体（如果字体缺失）');
console.log('   apt-get install -y fonts-noto-cjk fonts-wqy-zenhei fonts-wqy-microhei');
console.log('');
console.log('   方法4: 在 Dockerfile 中生成 locale');
console.log('   RUN apt-get install -y locales && \\');
console.log('       sed -i "s/^# *\\(en_US.UTF-8\\)/\\1/" /etc/locale.gen && \\');
console.log('       sed -i "s/^# *\\(zh_CN.UTF-8\\)/\\1/" /etc/locale.gen && \\');
console.log('       locale-gen');
console.log('');

console.log('✅ 诊断完成！');
console.log('');
console.log('📝 测试字幕文件位置:', testSubtitlePath);
console.log('📝 您可以使用此文件在服务器上测试字幕渲染');

