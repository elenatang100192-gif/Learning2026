#!/usr/bin/env node

/**
 * 修复视频文件的 faststart 标志
 * 下载视频 -> 使用 ffmpeg 添加 faststart -> 重新上传
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execAsync = promisify(exec);

// 导入上传函数
const { uploadFile } = require('../utils/fileUpload');

/**
 * 下载文件
 */
async function downloadFile(url, outputPath) {
  console.log(`📥 下载文件: ${url}`);
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode} ${response.statusMessage}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      response.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(outputPath, buffer);
        console.log(`✅ 下载完成，大小: ${buffer.length} bytes`);
        resolve(buffer.length);
      });
    });
    
    request.on('error', (error) => {
      reject(new Error(`下载失败: ${error.message}`));
    });
  });
}

/**
 * 使用 ffmpeg 添加 faststart 标志
 */
async function addFaststart(inputPath, outputPath) {
  console.log(`🎬 处理视频，添加 faststart 标志...`);
  const command = `ffmpeg -i "${inputPath}" -c copy -movflags +faststart "${outputPath}" -y`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ 视频处理完成`);
    return true;
  } catch (error) {
    console.error(`❌ FFmpeg 处理失败:`, error.message);
    throw error;
  }
}

/**
 * 修复单个视频
 */
async function fixVideo(videoUrl, outputFileName) {
  const tempDir = require('os').tmpdir();
  const timestamp = Date.now();
  const inputPath = path.join(tempDir, `input_${timestamp}.mp4`);
  const outputPath = path.join(tempDir, `output_${timestamp}.mp4`);
  
  try {
    // 1. 下载视频
    await downloadFile(videoUrl, inputPath);
    
    // 2. 添加 faststart 标志
    await addFaststart(inputPath, outputPath);
    
    // 3. 读取处理后的视频
    const videoBuffer = await fs.readFile(outputPath);
    console.log(`📊 处理后视频大小: ${videoBuffer.length} bytes`);
    
    // 4. 上传到七牛云
    console.log(`📤 上传视频到七牛云...`);
    const newUrl = await uploadFile(videoBuffer, outputFileName, 'video/mp4', 'videos');
    console.log(`✅ 上传成功，新URL: ${newUrl}`);
    
    // 5. 清理临时文件
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    
    return newUrl;
  } catch (error) {
    // 清理临时文件
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node fix-video-faststart.js <videoUrl> [outputFileName]');
    console.log('示例: node fix-video-faststart.js "https://trainspace.ashgso.com/videos/video.mp4" "video_fixed.mp4"');
    process.exit(1);
  }
  
  const videoUrl = args[0];
  const outputFileName = args[1] || path.basename(videoUrl);
  
  try {
    console.log('🚀 开始修复视频文件...');
    console.log(`   视频URL: ${videoUrl}`);
    console.log(`   输出文件名: ${outputFileName}`);
    
    const newUrl = await fixVideo(videoUrl, outputFileName);
    
    console.log('\n✅ 修复完成！');
    console.log(`   新视频URL: ${newUrl}`);
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { fixVideo };

