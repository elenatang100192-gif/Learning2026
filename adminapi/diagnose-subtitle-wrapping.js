#!/usr/bin/env node
/**
 * 字幕换行问题诊断脚本
 * 检查本地和服务器的 FFmpeg、libass 版本和字体配置差异
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 诊断字幕换行问题...\n');

// 1. FFmpeg 版本
console.log('📋 1. FFmpeg 版本信息:');
try {
  const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 5000 });
  const lines = ffmpegVersion.split('\n');
  console.log('   版本:', lines[0]);
  
  // 查找 libass 版本
  const libassLine = lines.find(line => line.includes('libass'));
  if (libassLine) {
    console.log('   libass:', libassLine.trim());
  } else {
    console.log('   ⚠️ 未找到 libass 信息');
  }
  
  // 查找配置信息
  const configLine = lines.find(line => line.includes('configuration:'));
  if (configLine && configLine.includes('--enable-libass')) {
    console.log('   ✅ libass 支持已启用');
  } else {
    console.log('   ⚠️ libass 支持状态未知');
  }
} catch (e) {
  console.error('   ❌ 无法获取 FFmpeg 版本:', e.message);
}
console.log('');

// 2. libass 版本（如果可用）
console.log('📋 2. libass 版本:');
try {
  const libassVersion = execSync('pkg-config --modversion libass 2>/dev/null || echo "N/A"', { encoding: 'utf8', timeout: 5000 });
  console.log('   版本:', libassVersion.trim());
} catch (e) {
  console.log('   ⚠️ 无法获取 libass 版本');
}
console.log('');

// 3. 字体配置
console.log('📋 3. 字体配置:');
try {
  const fcList = execSync('fc-list :lang=zh 2>/dev/null | head -10 || echo "fontconfig not available"', { encoding: 'utf8', timeout: 5000 });
  const fontLines = fcList.split('\n').filter(l => l.trim());
  if (fontLines.length > 0 && fontLines[0] !== 'fontconfig not available') {
    console.log('   中文字体（前10个）:');
    fontLines.forEach(line => {
      const fontName = line.split(':')[1] || line;
      console.log('     -', fontName.trim().substring(0, 60));
    });
  } else {
    console.log('   ⚠️ fontconfig 不可用或无中文字体');
  }
} catch (e) {
  console.log('   ⚠️ 无法列出字体');
}
console.log('');

// 4. ASS/SSA 样式测试
console.log('📋 4. ASS 字幕样式参数说明:');
console.log('   WrapStyle 参数含义:');
console.log('     0 = 智能换行（自动换行，末尾和顶部换行）');
console.log('     1 = 行尾换行（只在行尾换行）');
console.log('     2 = 不换行（文字可能超出屏幕）');
console.log('     3 = 智能换行（较低行换行，libass 0.10.1+）');
console.log('');
console.log('   Alignment 参数（数字键盘布局）:');
console.log('     7  8  9   (顶部)');
console.log('     4  5  6   (中部)');
console.log('     1  2  3   (底部)');
console.log('');

// 5. 建议的修复方案
console.log('📋 5. 字幕换行问题可能原因:');
console.log('');
console.log('   原因1: libass 版本差异');
console.log('   - 本地可能使用较新的 libass，换行算法更智能');
console.log('   - 服务器 libass 较旧，换行算法不同');
console.log('   - 解决：升级服务器 FFmpeg/libass 或调整 WrapStyle');
console.log('');
console.log('   原因2: 字体度量差异');
console.log('   - 不同字体的字符宽度不同，影响换行判断');
console.log('   - 本地和服务器使用了不同的字体');
console.log('   - 解决：在 force_style 中显式指定 FontName');
console.log('');
console.log('   原因3: 视频分辨率和边距');
console.log('   - MarginL/MarginR 设置可能不适合当前字体大小');
console.log('   - 解决：调整边距或使用 MaxWidth 参数（需 libass 支持）');
console.log('');

console.log('📋 6. 推荐的修复方案:');
console.log('');
console.log('   方案1: 显式指定字体（推荐）');
console.log('   force_style=\'FontName=Noto Sans CJK SC,WrapStyle=0,...\'');
console.log('');
console.log('   方案2: 调整 WrapStyle');
console.log('   - WrapStyle=0 改为 WrapStyle=2 或 WrapStyle=3');
console.log('');
console.log('   方案3: 增加左右边距');
console.log('   - MarginL=50,MarginR=50 改为 MarginL=80,MarginR=80');
console.log('');
console.log('   方案4: 减小字体大小');
console.log('   - FontSize=8 改为 FontSize=7 或 FontSize=6');
console.log('');
console.log('   方案5: 在 SRT 文件中手动换行');
console.log('   - 在生成字幕时，检测文本长度并插入换行符');
console.log('   - 每行最多 N 个字符（中文约 15-20 字）');
console.log('');

console.log('✅ 诊断完成！');
console.log('');
console.log('📝 建议：');
console.log('   1. 在本地和服务器分别运行此脚本，对比差异');
console.log('   2. 尝试在 force_style 中添加 FontName 参数');
console.log('   3. 或者在生成 SRT 文件时预先处理换行');

