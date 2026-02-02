// 确保环境变量已加载（如果server.js已经加载了dotenv，这里不会重复加载）
if (!process.env.DASHSCOPE_API_KEY && !process.env.ALIYUN_API_KEY) {
  require('dotenv').config();
}

const express = require('express');
const multer = require('multer');
const router = express.Router();
const db = require('../utils/db');
const { uploadFile } = require('../utils/fileUpload');
// const tencentcloud = require('tencentcloud-sdk-nodejs'); // 已禁用：腾讯云TTS服务已禁用
const qiniu = require('qiniu');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const pdfParse = require('pdf-parse');
const { EPub } = require('epub2');
// OCR功能暂时禁用，等待修复pdfjs-dist导入问题
// const { createWorker } = require('tesseract.js');
const { createCanvas, loadImage } = require('canvas');

// 配置multer用于文件上传
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB限制
});

// API配置（从环境变量读取）
// 注意：Deepseek配置已不再使用，所有功能已迁移到阿里云DashScope qwen-long-latest
// const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-0abbe78f54d84a7f8a91c1e36bce0a97';
// const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 阿里云DashScope文件上传和模型API配置
const DASHSCOPE_FILES_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/files';
const DASHSCOPE_CHAT_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

// 阿里云百炼（DashScope）API配置
// 环境变量名：DASHSCOPE_API_KEY（符合阿里云官方文档规范）
// 文档：https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2803795
const ALIYUN_API_KEY = process.env.DASHSCOPE_API_KEY || process.env.ALIYUN_API_KEY || 'sk-abe50fde91f242a682c8c6c189310db5';

// 验证API Key是否已加载
if (!ALIYUN_API_KEY || ALIYUN_API_KEY.length < 20) {
  console.error('❌ 警告：阿里云API Key未正确加载，当前值:', ALIYUN_API_KEY ? `长度${ALIYUN_API_KEY.length}` : 'undefined');
  console.error('❌ 请确保已设置DASHSCOPE_API_KEY环境变量');
} else {
  console.log('✅ 阿里云API Key已加载，长度:', ALIYUN_API_KEY.length, '前4位:', ALIYUN_API_KEY.substring(0, 4));
}

const ALIYUN_IMAGE_GEN_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const ALIYUN_FACE_DETECT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect';
const ALIYUN_VIDEO_GEN_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/generation';
// Qwen TTS使用HTTP SSE API
// 参考文档：根据用户提供的示例
const ALIYUN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
// Doubao-Seedance-1.5-pro API配置（视频生成）- 已禁用
// 注意：豆包视频生成服务已禁用
// 根据README.md配置：
// DOUBAO_MODEL_ID：doubao-seedance-1-5-pro-251215
// API Key：866a3f1e-a011-4f07-a5a8-01cd771f8552
// 文档: https://www.volcengine.com/docs/82379/1520758?lang=zh
// const DOUBAO_API_KEY = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || '866a3f1e-a011-4f07-a5a8-01cd771f8552';
// 模型ID：doubao-seedance-1-5-pro-251215
// const DOUBAO_MODEL_ID = process.env.DOUBAO_MODEL_ID || 'doubao-seedance-1-5-pro-251215';
// volcengine API端点（视频生成）
// const DOUBAO_TEXT_TO_VIDEO_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
// const DOUBAO_TASK_STATUS_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

// Doubao-Seedream-4-0 API配置（图片生成）- 已替换为阿里云 DashScope
// 模型ID：doubao-seedream-4-0-250828
// API端点：https://ark.cn-beijing.volces.com/api/v3/images/generations
// 注意：图片生成功能已迁移到阿里云 DashScope (qwen-image-max)
const DOUBAO_IMAGE_GEN_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DOUBAO_IMAGE_MODEL_ID = process.env.DOUBAO_IMAGE_MODEL_ID || 'doubao-seedream-4-0-250828';

// OpenAI 图像生成 API配置 - Azure AI Foundry
// 支持 DALL-E 3 和 GPT-image-1 系列模型
// API Key: cfbf57ca067949419e00faba7441f21f
// 文档: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/dall-e?view=foundry-classic
// 端点格式: https://[your-resource-name].openai.azure.com/openai/deployments/[deployment-name]/images/generations?api-version=[api-version]
// API 版本：
//   - DALL-E 3: 2024-02-01
//   - GPT-image-1 系列: 2025-04-01-preview
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'cfbf57ca067949419e00faba7441f21f';
const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_DEPLOYMENT_NAME = process.env.OPENAI_DEPLOYMENT_NAME || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-image-1.5';
// API 版本：GPT-image-1.5 使用 2025-04-01-preview，DALL-E 3 使用 2024-02-01
const OPENAI_API_VERSION = process.env.OPENAI_API_VERSION || '2025-04-01-preview';

// 构建 OpenAI 图像生成 API URL
// 支持两种模式：
// 1. Azure AI Foundry: https://[endpoint]/openai/deployments/[deployment]/images/generations?api-version=[version]
// 2. 标准 OpenAI API: https://api.openai.com/v1/images/generations
let OPENAI_IMAGE_GEN_URL;
let OPENAI_USE_AZURE = false;
let OPENAI_AUTH_HEADER = '';

// 检查是否是 Azure AI Foundry 端点
if (OPENAI_ENDPOINT && OPENAI_DEPLOYMENT_NAME && !OPENAI_ENDPOINT.includes('your-resource')) {
  // Azure AI Foundry 模式
  OPENAI_IMAGE_GEN_URL = `${OPENAI_ENDPOINT}/openai/deployments/${OPENAI_DEPLOYMENT_NAME}/images/generations?api-version=${OPENAI_API_VERSION}`;
  OPENAI_USE_AZURE = true;
  OPENAI_AUTH_HEADER = 'api-key'; // Azure 使用 api-key header
  console.log('✅ OpenAI DALL-E API 配置已加载 (Azure AI Foundry)，端点:', OPENAI_IMAGE_GEN_URL);
} else if (OPENAI_ENDPOINT && OPENAI_ENDPOINT.includes('your-resource')) {
  // 占位符端点，提示用户配置
  console.error('❌ OpenAI 端点未正确配置！');
  console.error('   请在 .env 文件中设置正确的 OPENAI_ENDPOINT');
  console.error('   格式: OPENAI_ENDPOINT=https://your-resource.openai.azure.com');
  console.error('   如何查找端点：登录 Azure 门户 -> Azure AI Foundry -> 您的资源 -> 概览 -> 端点');
  OPENAI_IMAGE_GEN_URL = null;
} else {
  // 尝试使用标准 OpenAI API（如果 API key 是标准的 OpenAI key）
  OPENAI_IMAGE_GEN_URL = 'https://api.openai.com/v1/images/generations';
  OPENAI_USE_AZURE = false;
  OPENAI_AUTH_HEADER = 'Authorization'; // 标准 OpenAI 使用 Authorization header
  console.warn('⚠️ 未配置 Azure AI Foundry 端点，尝试使用标准 OpenAI API');
  console.warn('   如果您的 API key 是 Azure AI Foundry 的，请在 .env 文件中设置 OPENAI_ENDPOINT');
}

// 注意：已完全移除豆包TTS相关代码，只使用腾讯云TTS
// 以下变量定义保留仅用于兼容性，但不会被使用
// Doubao语音合成大模型API配置（已禁用，不再使用）
// const DOUBAO_TTS_APP_ID = process.env.DOUBAO_TTS_APP_ID || '7616870473';
// const DOUBAO_TTS_ACCESS_KEY = process.env.DOUBAO_TTS_ACCESS_KEY || process.env.DOUBAO_TTS_ACCESS_TOKEN || 'q8Fx7NRJOVxrl6486XjBKaTL4gqVwqXm';
// const DOUBAO_TTS_SECRET_KEY = process.env.DOUBAO_TTS_SECRET_KEY || 'd9ryy2RnuxT5wGmmA4EteU24fVRjcYSb';
// const DOUBAO_TTS_API_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
// const DOUBAO_TTS_RESOURCE_ID = process.env.DOUBAO_TTS_RESOURCE_ID || 'seed-tts-1.0';

// 七牛云存储配置
const QINIU_URL = process.env.QINIU_URL || 'https://trainspace.ashgso.com';
const QINIU_BUCKET = process.env.QINIU_BUCKET || 'trainspace';
const QINIU_ACCESS_KEY = process.env.QINIU_ACCESS_KEY || 'LovYLFiZZuPFtvGLTjlCXe3l7YcJq3yEmsCOBpSU';
const QINIU_SECRET_KEY = process.env.QINIU_SECRET_KEY || 'ISfANLfFxsgWn0cFlZD2jLlmEbBV4QSnjW5Y_55u';

if (!QINIU_ACCESS_KEY || !QINIU_SECRET_KEY) {
  console.error('❌ 警告：七牛云AccessKey未配置，请设置QINIU_ACCESS_KEY和QINIU_SECRET_KEY环境变量');
}

// 初始化七牛云配置
const qiniuConfig = new qiniu.conf.Config();
qiniuConfig.zone = qiniu.zone.Zone_z0; // 华东区域
const mac = new qiniu.auth.digest.Mac(QINIU_ACCESS_KEY, QINIU_SECRET_KEY);

console.log('✅ 七牛云存储客户端已初始化，Bucket:', QINIU_BUCKET, 'URL:', QINIU_URL);

// 辅助函数：将文件从URL下载并上传到七牛云存储
async function uploadToOSS(fileUrl, fileName, contentType) {
  try {
    console.log('📥 开始下载文件:', fileUrl);
    
    // 下载文件
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`下载文件失败: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('✅ 文件下载完成，大小:', buffer.length, 'bytes');
    
    // 上传到七牛云
    const qiniuPath = `video-generation/${Date.now()}_${fileName}`;
    console.log('📤 上传文件到七牛云:', qiniuPath);
    
    // 生成上传凭证
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${QINIU_BUCKET}:${qiniuPath}`,
    });
    const uploadToken = putPolicy.uploadToken(mac);
    
    // 配置上传参数
    const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
    const putExtra = new qiniu.form_up.PutExtra();
    
    // 上传文件
    return new Promise((resolve, reject) => {
      formUploader.put(uploadToken, qiniuPath, buffer, putExtra, (respErr, respBody, respInfo) => {
        if (respErr) {
          console.error('❌ 七牛云上传失败:', respErr);
          reject(new Error(`七牛云上传失败: ${respErr.message || respErr}`));
          return;
        }
        
        if (respInfo.statusCode === 200) {
          // 构建文件URL
          // 从QINIU_URL中提取域名（移除协议前缀）
          const qiniuDomain = QINIU_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);
          const publicDownloadUrl = bucketManager.publicDownloadUrl(qiniuDomain, qiniuPath);
          
          console.log('✅ 文件上传到七牛云成功，URL:', publicDownloadUrl);
          
          // 验证URL是否可以访问（等待文件同步）
          console.log('⏳ 等待文件同步...');
          setTimeout(async () => {
            try {
              const checkResponse = await fetch(publicDownloadUrl, { method: 'HEAD' });
              if (!checkResponse.ok) {
                console.warn('⚠️ 七牛云URL可能无法访问:', publicDownloadUrl, '状态码:', checkResponse.status);
                // 如果HEAD失败，尝试GET请求
                const getResponse = await fetch(publicDownloadUrl, { method: 'GET', headers: { 'Range': 'bytes=0-0' } });
                if (!getResponse.ok) {
                  console.warn('⚠️ 七牛云URL验证失败，但继续返回URL:', publicDownloadUrl);
                } else {
                  console.log('✅ 七牛云URL可访问（通过GET请求验证）:', publicDownloadUrl);
                }
              } else {
                console.log('✅ 七牛云URL可访问:', publicDownloadUrl);
              }
              resolve(publicDownloadUrl);
            } catch (checkError) {
              console.warn('⚠️ 无法验证七牛云URL可访问性:', checkError.message, '但继续返回URL');
              resolve(publicDownloadUrl);
            }
          }, 1000); // 等待1秒
        } else {
          console.error('❌ 七牛云上传失败，状态码:', respInfo.statusCode, '响应:', respBody);
          reject(new Error(`七牛云上传失败: ${respInfo.statusCode} - ${JSON.stringify(respBody)}`));
        }
      });
    });
  } catch (error) {
    console.error('❌ 上传文件到七牛云失败:', error);
    throw error;
  }
}

// 腾讯云长语音合成API配置（已禁用）
// 注意：腾讯云TTS服务已禁用，现在使用阿里云DashScope TTS
// const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID;
// const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY;
// 
// if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
//   console.error('❌ 警告：腾讯云TTS Secret未配置，请设置TENCENT_SECRET_ID和TENCENT_SECRET_KEY环境变量');
// }
// const TENCENT_TTS_ENDPOINT = 'tts.tencentcloudapi.com';
// const TENCENT_TTS_REGION = 'ap-guangzhou';
// const TENCENT_TTS_SERVICE = 'tts';
// const TENCENT_TTS_VERSION = '2019-08-23';

// 注意：阿里云API可能需要使用不同的认证方式
// Authorization header格式应该是: Bearer {API_KEY} 或 X-DashScope-API-Key: {API_KEY}

// 辅助函数：使用OCR识别PDF页面（暂时禁用）
async function extractTextFromPDFWithOCR(buffer) {
  throw new Error('OCR功能暂时不可用，正在修复中。请上传包含可提取文本的PDF文件。');
}

// 辅助函数：从文件URL提取文本内容
async function extractTextFromFile(fileUrl) {
  try {
    console.log('📥 开始下载文件:', fileUrl);
    
    // 下载文件
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`下载文件失败: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // 从URL提取文件扩展名（处理可能包含查询参数的情况）
    const urlPath = fileUrl.split('?')[0]; // 移除查询参数
    const fileExtension = urlPath.split('.').pop().toLowerCase();
    
    console.log('📄 文件URL:', fileUrl);
    console.log('📄 文件类型:', fileExtension, '文件大小:', buffer.length, 'bytes');
    
    // 验证文件大小
    if (buffer.length === 0) {
      throw new Error('下载的文件为空');
    }
    
    // 验证文件类型（通过文件头验证）
    const fileHeader = buffer.slice(0, 4).toString('hex');
    console.log('📄 文件头:', fileHeader);
    
    if (fileExtension === 'pdf') {
      // PDF文件头应该是 %PDF
      if (!buffer.toString('utf8', 0, 4).startsWith('%PDF')) {
        console.warn('⚠️ 文件头不是PDF格式，但扩展名是.pdf');
      }
    } else if (fileExtension === 'epub') {
      // EPUB文件实际上是ZIP文件，ZIP文件头是 PK
      if (!buffer.toString('utf8', 0, 2).startsWith('PK')) {
        console.warn('⚠️ 文件头不是ZIP格式，但扩展名是.epub');
      }
    }
    
    let textContent = '';
    
    if (fileExtension === 'pdf') {
      // 提取PDF文本
      console.log('📄 开始解析PDF文件，大小:', buffer.length, 'bytes');
      try {
        const pdfData = await pdfParse(buffer);
        console.log('📊 PDF解析结果:', {
          hasText: !!pdfData.text,
          textLength: pdfData.text ? pdfData.text.length : 0,
          numPages: pdfData.numpages || 'unknown',
          info: pdfData.info || 'no info'
        });
        
        textContent = pdfData.text || '';
        
        // 如果text为空，尝试从其他字段获取
        if (!textContent || textContent.trim().length === 0) {
          console.warn('⚠️ PDF文本为空，尝试其他方法...');
          // 检查是否有其他文本字段
          if (pdfData.textContent) {
            textContent = pdfData.textContent;
          }
        }
        
        console.log('✅ PDF文本提取完成，长度:', textContent.length);
      } catch (pdfError) {
        console.error('❌ PDF解析失败:', pdfError);
        console.error('❌ 错误详情:', pdfError.message, pdfError.stack);
        // 如果PDF解析失败，尝试使用OCR
        console.log('⚠️ PDF解析失败，尝试使用OCR识别...');
        try {
          const ocrText = await extractTextFromPDFWithOCR(buffer);
          if (ocrText && ocrText.trim().length > 0) {
            textContent = ocrText;
            console.log('✅ OCR识别成功，使用OCR文本');
          } else {
            throw new Error('OCR识别结果为空');
          }
        } catch (ocrError) {
          console.error('❌ OCR识别也失败:', ocrError.message);
          throw new Error(`PDF解析失败: ${pdfError.message}。OCR识别也失败: ${ocrError.message}`);
        }
      }
    } else if (fileExtension === 'epub') {
      // 提取EPUB文本
      // 创建临时文件
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-'));
      const tempFilePath = path.join(tempDir, 'book.epub');
      await fs.writeFile(tempFilePath, buffer);
      
      try {
        const epub = new EPub(tempFilePath);
        await epub.parse();
        
        const chapters = epub.flow || [];
        for (const chapter of chapters) {
          try {
            const chapterText = await epub.getChapter(chapter.id);
            if (chapterText) {
              // 移除HTML标签，提取纯文本
              const plainText = chapterText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              textContent += plainText + '\n\n';
            }
          } catch (chapterError) {
            console.warn(`⚠️ 跳过章节 ${chapter.id}:`, chapterError.message);
          }
        }
        console.log('✅ EPUB文本提取完成，长度:', textContent.length);
      } finally {
        // 清理临时文件
        try {
          await fs.unlink(tempFilePath);
          await fs.rmdir(tempDir);
        } catch (cleanupError) {
          console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
        }
      }
    } else if (fileExtension === 'mobi') {
      // MOBI格式比较复杂，暂时返回错误提示
      throw new Error('MOBI格式暂不支持，请上传PDF或EPUB格式');
    } else {
      throw new Error(`不支持的文件格式: ${fileExtension}`);
    }
    
    // 检查文本内容（检查是否包含实际的中文或英文字符）
    let cleanText = textContent.replace(/\s+/g, ' ').trim();
    
    // 检查是否包含中文字符或英文字母
    let hasChinese = /[\u4e00-\u9fa5]/.test(textContent);
    let hasEnglish = /[a-zA-Z]/.test(textContent);
    let meaningfulLength = textContent.replace(/[\s\n\r\t]/g, '').length;
    
    console.log('📊 文本内容检查:');
    console.log('   原始长度:', textContent.length);
    console.log('   清理后长度:', cleanText.length);
    console.log('   有意义字符数:', meaningfulLength);
    console.log('   包含中文:', hasChinese);
    console.log('   包含英文:', hasEnglish);
    console.log('   前200字符:', textContent.substring(0, 200));
    
    // 如果PDF文件很大但文本很少，尝试使用OCR
    if (fileExtension === 'pdf' && buffer.length > 1000000 && meaningfulLength < 100) {
      console.log('⚠️ PDF文本很少，可能是扫描版，尝试使用OCR识别...');
      try {
        const ocrText = await extractTextFromPDFWithOCR(buffer);
        if (ocrText && ocrText.trim().length > 0) {
          const ocrMeaningfulLength = ocrText.replace(/[\s\n\r\t]/g, '').length;
          if (ocrMeaningfulLength >= 10) {
            console.log('✅ OCR识别成功，使用OCR文本');
            textContent = ocrText;
            // 重新计算有意义字符数和检查标志
            meaningfulLength = ocrMeaningfulLength;
            cleanText = textContent.replace(/\s+/g, ' ').trim();
            hasChinese = /[\u4e00-\u9fa5]/.test(textContent);
            hasEnglish = /[a-zA-Z]/.test(textContent);
            console.log('📊 OCR文本内容检查:');
            console.log('   原始长度:', textContent.length);
            console.log('   清理后长度:', cleanText.length);
            console.log('   有意义字符数:', meaningfulLength);
            console.log('   包含中文:', hasChinese);
            console.log('   包含英文:', hasEnglish);
          } else {
            throw new Error('OCR识别结果仍然为空或文本太少');
          }
        } else {
          throw new Error('OCR识别结果为空');
        }
      } catch (ocrError) {
        console.error('❌ OCR识别失败:', ocrError.message);
        throw new Error(`PDF文件可能是扫描版（图片），OCR识别失败: ${ocrError.message}。请确保PDF文件清晰可读，或上传包含可提取文本的PDF文件。`);
      }
    }
    
    // 如果文本长度大于0但只包含空白字符，或者有意义字符少于10个
    if (!textContent || cleanText.length === 0 || meaningfulLength < 10) {
      console.error('❌ 提取的文本内容为空或只包含空白字符');
      console.error('❌ 文件URL:', fileUrl);
      console.error('❌ 文件类型:', fileExtension);
      console.error('❌ 文件大小:', buffer.length, 'bytes');
      console.error('❌ 原始文本长度:', textContent.length);
      console.error('❌ 清理后文本长度:', cleanText.length);
      console.error('❌ 有意义字符数:', meaningfulLength);
      
      throw new Error(`无法从文件中提取文本内容，文件可能为空或格式不正确。文件类型: ${fileExtension}, 文件大小: ${buffer.length} bytes, 提取的文本长度: ${textContent.length} 字符, 有意义字符数: ${meaningfulLength}`);
    }
    
    // 使用原始文本（不清理，保留格式）
    // textContent保持原样，只在检查时清理
    
    // 限制文本长度（避免超过API限制）
    const maxLength = 50000; // 限制为50000字符
    if (textContent.length > maxLength) {
      console.log(`⚠️ 文本内容过长(${textContent.length}字符)，截取前${maxLength}字符`);
      textContent = textContent.substring(0, maxLength);
    }
    
    return textContent;
  } catch (error) {
    console.error('❌ 提取文件文本失败:', error);
    throw error;
  }
}

// MySQL数据库，使用标准SQL操作

// 初始化腾讯云TTS客户端（已禁用）
// 注意：腾讯云TTS服务已禁用，现在使用阿里云DashScope TTS
// const TtsClient = tencentcloud.tts.v20190823.Client;
// const tencentTtsClient = new TtsClient({
//   credential: {
//     secretId: TENCENT_SECRET_ID,
//     secretKey: TENCENT_SECRET_KEY,
//   },
//   region: TENCENT_TTS_REGION,
//   profile: {
//     httpProfile: {
//       endpoint: TENCENT_TTS_ENDPOINT,
//     },
//   },
// });

// 初始化腾讯云ASR（语音识别）客户端（已禁用）
// const AsrClient = tencentcloud.asr.v20190614.Client;
// const tencentAsrClient = new AsrClient({
//   credential: {
//     secretId: TENCENT_SECRET_ID,
//     secretKey: TENCENT_SECRET_KEY,
//   },
//   region: 'ap-shanghai', // ASR服务区域
//   profile: {
//     httpProfile: {
//       endpoint: 'asr.tencentcloudapi.com',
//     },
//   },
// });

// 获取书籍列表
router.get('/', async (req, res) => {
  try {
    const { title, author, category, status, page = 1, limit = 20 } = req.query;
    
    let sql = `
      SELECT b.*, 
             c.id as category_id, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder
      FROM Book b
      LEFT JOIN Category c ON b.categoryId = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (title) {
      sql += ` AND b.title LIKE ?`;
      params.push(`%${title}%`);
    }
    if (author) {
      sql += ` AND b.author LIKE ?`;
      params.push(`%${author}%`);
    }
    if (category) {
      const categories = await db.findAll('SELECT id FROM Category WHERE nameCn = ? OR name = ?', [category, category]);
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        sql += ` AND b.categoryId IN (${categoryIds.map(() => '?').join(',')})`;
        params.push(...categoryIds);
      }
    }
    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY b.createdAt DESC`;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const books = await db.query(sql, params);
    
    const booksData = books.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category_id ? {
        id: book.category_id,
        name: book.category_name,
        nameCn: book.category_nameCn,
        sortOrder: book.category_sortOrder
      } : undefined,
      coverUrl: book.coverUrl,
      blogCoverUrl: book.blogCoverUrl,
      fileUrl: book.fileUrl,
      uploadDate: book.uploadDate,
      status: book.status,
      createdAt: book.createdAt
    }));
    
    res.json({
      success: true,
      data: booksData
    });
  } catch (error) {
    console.error('获取书籍列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取书籍列表失败',
      error: error.message
    });
  }
});

// 上传电子书文件
router.post('/upload', upload.single('bookFile'), async (req, res) => {
  // 设置上传请求超时时间为5分钟
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  
  try {
    const { title, author, isbn, categoryId } = req.body;
    const file = req.file;

    if (!title || !author || !isbn || !categoryId) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: '请上传电子书文件'
      });
    }

    // 验证文件类型
    const allowedTypes = ['application/pdf', 'application/epub+zip', 'application/x-mobipocket-ebook'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: '不支持的文件格式，请上传PDF、EPUB或MOBI格式'
      });
    }

    // 获取分类对象
    const category = await db.findOne('SELECT * FROM Category WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: '无效的分类'
      });
    }

    // 上传文件到七牛云
    console.log(`📤 开始上传文件到七牛云，文件名: ${file.originalname}，大小: ${(file.buffer.length / 1024 / 1024).toFixed(2)}MB`);
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `books/${Date.now()}_${title.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
    
    // 设置超时时间（5分钟）
    const uploadStartTime = Date.now();
    let fileUrl;
    try {
      fileUrl = await Promise.race([
        uploadFile(Buffer.from(file.buffer), fileName, file.mimetype),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('文件上传超时，请检查网络连接或文件大小')), 5 * 60 * 1000)
        )
      ]);
      const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`✅ 文件上传完成，耗时: ${uploadTime}秒，URL: ${fileUrl}`);
    } catch (error) {
      console.error('❌ 文件上传失败:', error);
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
      throw new Error(`文件上传失败: ${error.message}`);
    }

    // 创建书籍记录
    console.log('📝 创建书籍记录...');
    const bookId = await db.insert('Book', {
      title: title,
      author: author,
      isbn: isbn,
      categoryId: categoryId,
      fileUrl: fileUrl,
      uploadDate: new Date().toISOString().split('T')[0],
      status: '待处理'
    });
    console.log('✅ 书籍记录创建成功，ID:', bookId);

    res.json({
      success: true,
      data: {
        id: bookId,
        title: title,
        author: author,
        isbn: isbn,
        category: {
          id: category.id,
          name: category.name,
          nameCn: category.nameCn
        },
        fileUrl: fileUrl,
        uploadDate: new Date().toISOString().split('T')[0],
        status: '待处理'
      }
    });
  } catch (error) {
    console.error('上传电子书失败:', error);
    res.status(500).json({
      success: false,
      message: '上传电子书失败',
      error: error.message
    });
  }
});

// 生成博客封面图（使用阿里云 DashScope qwen-image-max 模型）- 必须在 /:bookId/extract 之前定义
// 生成博客封面图提示词（使用阿里云DashScope qwen3-vl-plus生成3种风格）
router.post('/:bookId/generate-blog-cover-prompts', async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // 获取书籍信息
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }
    
    const title = book.title;
    const author = book.author;
    const titleEn = book.titleEn || '';
    const authorEn = book.authorEn || '';
    
    if (!title || !author) {
      return res.status(400).json({
        success: false,
        message: '书籍标题或作者信息缺失'
      });
    }
    
    // 构建书名和作者文本
    let titleText = title;
    let authorText = author;
    
    if (titleEn && titleEn.trim()) {
      titleText = `${title} / ${titleEn}`;
    }
    if (authorEn && authorEn.trim()) {
      authorText = `${author} / ${authorEn}`;
    }
    
    console.log('🎨 开始生成博客封面图提示词，书名:', titleText, '作者:', authorText);
    
    // 使用阿里云DashScope qwen3-vl-plus生成3种风格的提示词
    const prompt = `请根据以下书籍信息，生成3种不同风格的博客封面图提示词。

书籍信息：
- 书名：${titleText}
- 作者：${authorText}

要求：
1. 必须生成恰好3个提示词，分别对应以下3种风格：
   - 风格1：现代简洁风格 - 注重高级感和专业性，适合多数知识类博客
   - 风格2：创意表达风格 - 更具动感和创意，突出"分享"和"传播"的概念
   - 风格3：知识舞台风格 - 将书籍置于"舞台"中央，营造出庄重、经典的讲座或发布会氛围

2. 每个提示词必须满足以下要求：
   - 结合书籍实物和话筒元素
   - 直接点明"书籍讲解"的主题
   - 图片中只出现书籍名称"${titleText}"和作者名称"${authorText}"的中英文文案
   - 不出现其他任何文字（如"书籍讲解"、"Book Review"等描述性文字）
   - 9:16竖屏比例
   - 高质量、专业设计

3. 提示词应该用英文编写，适合用于AI图片生成

请以JSON格式返回，格式如下：
{
  "style1": "提示词1（现代简洁风格）",
  "style2": "提示词2（创意表达风格）",
  "style3": "提示词3（知识舞台风格）"
}`;

    const qwenResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ALIYUN_API_KEY}`,
        'X-DashScope-SSE': 'enable'
      },
      body: JSON.stringify({
        model: 'qwen3-vl-plus',
        input: {
        messages: [
          {
            role: 'user',
              content: [
                {
                  text: prompt
          }
              ]
            }
          ]
        },
        parameters: {
          incremental_output: true
        }
      })
    });

    if (!qwenResponse.ok) {
      const errorText = await qwenResponse.text();
      console.error('❌ 阿里云DashScope qwen3-vl-plus API返回错误:', qwenResponse.status, errorText);
      throw new Error(`阿里云DashScope qwen3-vl-plus API错误: ${qwenResponse.status} - ${errorText}`);
    }

    // 处理SSE流式响应
    let qwenContent = '';
    const reader = qwenResponse.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data === '[DONE]') continue;
          
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.output?.choices?.[0]?.message?.content) {
              const content = jsonData.output.choices[0].message.content;
              if (Array.isArray(content)) {
                for (const item of content) {
                  if (item.text) {
                    qwenContent += item.text;
                  }
                }
              } else if (typeof content === 'string') {
                qwenContent += content;
              }
            } else if (jsonData.output?.text) {
              qwenContent += jsonData.output.text;
            }
          } catch (e) {
            // 忽略JSON解析错误，继续处理下一行
          }
        }
      }
    }
    
    console.log('📥 阿里云DashScope qwen3-vl-plus API原始响应:', qwenContent);

    // 解析JSON响应
    let prompts = null;
    try {
      const jsonMatch = qwenContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        prompts = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('❌ 解析阿里云DashScope qwen3-vl-plus响应失败:', parseError);
    }

    // 如果解析失败，生成默认提示词
    if (!prompts || !prompts.style1 || !prompts.style2 || !prompts.style3) {
      console.warn('⚠️ 阿里云DashScope qwen3-vl-plus返回的提示词格式不正确，使用默认提示词');
      const basePrompt = `A book cover design, 9:16 vertical ratio, high quality, professional design. The cover combines a physical book and a microphone element, directly indicating the theme of "book explanation". The cover must ONLY display the book title "${titleText}" and author name "${authorText}". Absolutely no other Chinese or English text, no descriptions, no subtitles, no additional information should appear on the cover.`;
      
      prompts = {
        style1: `${basePrompt} Modern minimalist style, elegant design, clean layout, professional and sophisticated, suitable for knowledge blogs.`,
        style2: `${basePrompt} Creative expression style, dynamic and creative, highlighting the concept of "sharing" and "spreading", vibrant colors, engaging composition.`,
        style3: `${basePrompt} Knowledge stage style, the book is placed in the center of a "stage", creating a solemn and classic lecture or press conference atmosphere, dramatic lighting, formal setting.`
      };
    }

    console.log('✅ 成功生成3种风格的提示词');
    console.log('   风格1（现代简洁）:', prompts.style1);
    console.log('   风格2（创意表达）:', prompts.style2);
    console.log('   风格3（知识舞台）:', prompts.style3);

    res.json({
      success: true,
      data: {
        prompts: prompts,
        bookTitle: titleText,
        bookAuthor: authorText
      }
    });

  } catch (error) {
    console.error('生成博客封面图提示词失败:', error);
    res.status(500).json({
      success: false,
      message: '生成博客封面图提示词失败',
      error: error.message || String(error)
    });
  }
});

router.post('/:bookId/generate-blog-cover', async (req, res) => {
  // 设置请求和响应超时时间（5分钟），因为图片生成+下载+上传可能需要较长时间
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  
  try {
    const { bookId } = req.params;
    const { customPrompt } = req.body; // 支持自定义提示词
    
    // 获取书籍信息
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }
    
    const title = book.title;
    const author = book.author;
    const titleEn = book.titleEn || '';
    const authorEn = book.authorEn || '';
    
    if (!title || !author) {
      return res.status(400).json({
        success: false,
        message: '书籍标题或作者信息缺失'
      });
    }
    
    console.log('🎨 开始生成博客封面图，书名:', title, '作者:', author);
    if (titleEn) console.log('   英文书名:', titleEn);
    if (authorEn) console.log('   英文作者:', authorEn);
    
    // 构建提示词：只显示书名和作者名称，不显示其他任何文字
    // 如果有英文版本，同时显示中英文
    let titleText = title;
    let authorText = author;
    
    if (titleEn && titleEn.trim()) {
      titleText = `${title} / ${titleEn}`;
    }
    if (authorEn && authorEn.trim()) {
      authorText = `${author} / ${authorEn}`;
    }
    
    // 如果提供了自定义提示词，使用自定义提示词；否则使用默认提示词
    let prompt;
    if (customPrompt && customPrompt.trim()) {
      prompt = customPrompt;
      console.log('📝 使用自定义提示词:', prompt);
    } else {
      // 使用中英文混合提示词，明确要求只显示书名和作者，不显示其他文字
      // 使用negative prompt明确禁止其他文字
      prompt = `A minimalist book cover design, 9:16 vertical ratio, high quality, professional design. The cover must ONLY display the book title "${titleText}" and author name "${authorText}". Absolutely no other Chinese or English text, no descriptions, no subtitles, no additional information, no quotes, no taglines, no promotional text should appear on the cover. Book style, elegant design, clean layout, minimalist style, only title and author name visible. Negative prompt: no text except title and author, no descriptions, no subtitles, no quotes, no taglines, no promotional text, no additional information`;
      console.log('📝 使用默认提示词:', prompt);
    }
    
    // Call Alibaba Cloud DashScope image generation API (timeout set to 120 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
    
    // 构建negative prompt
    const negativePrompt = "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。";
    
    let imageGenResponse;
    try {
      console.log('🎨 Calling Alibaba Cloud DashScope API to generate image, endpoint:', ALIYUN_IMAGE_GEN_URL);
      imageGenResponse = await fetch(ALIYUN_IMAGE_GEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIYUN_API_KEY}`
        },
        body: JSON.stringify({
          model: "qwen-image-max",
          input: {
            messages: [
              {
                role: "user",
                content: [
                  {
                    text: prompt
                  }
                ]
              }
            ]
          },
          parameters: {
            negative_prompt: negativePrompt,
            prompt_extend: true,
            watermark: false,
            size: "1080*1920" // 9:16 vertical ratio
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ Alibaba Cloud DashScope image generation API request timeout (60 seconds)');
        throw new Error('Image generation request timeout, please try again later');
      }
      if (error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT') {
        console.error('❌ Alibaba Cloud DashScope image generation API connection timeout:', error.message);
        throw new Error('Unable to connect to image generation service, please check network connection or try again later');
      }
      console.error('❌ Alibaba Cloud DashScope image generation API request failed:', error.message);
      throw error;
    }
    
    if (!imageGenResponse.ok) {
      const errorText = await imageGenResponse.text();
      console.error('❌ Alibaba Cloud DashScope image generation API failed:', imageGenResponse.status, errorText);
      throw new Error(`Alibaba Cloud DashScope image generation API failed: ${imageGenResponse.status} ${imageGenResponse.statusText} - ${errorText}`);
    }
    
    const imageGenData = await imageGenResponse.json();
    console.log('✅ Alibaba Cloud DashScope image generation API response:', JSON.stringify(imageGenData, null, 2));
    
    // Check response format (DashScope returns: { output: { choices: [{ message: { content: [{ image: "..." }] } }] } })
    let imageUrl;
    if (imageGenData.output && imageGenData.output.choices && Array.isArray(imageGenData.output.choices) && imageGenData.output.choices.length > 0) {
      const choice = imageGenData.output.choices[0];
      if (choice.message && choice.message.content && Array.isArray(choice.message.content) && choice.message.content.length > 0) {
        const contentItem = choice.message.content[0];
        if (contentItem.image) {
          imageUrl = contentItem.image;
        }
      }
    }
    
    // 兼容其他可能的响应格式
    if (!imageUrl && imageGenData.output && imageGenData.output.results && Array.isArray(imageGenData.output.results) && imageGenData.output.results.length > 0) {
      imageUrl = imageGenData.output.results[0].url;
    }
    
    if (!imageUrl && imageGenData.output && imageGenData.output.url) {
      imageUrl = imageGenData.output.url;
    }
    
    if (!imageUrl) {
      console.error('❌ Alibaba Cloud DashScope image generation response format error:', JSON.stringify(imageGenData, null, 2));
      throw new Error('Alibaba Cloud DashScope image generation response format error, image URL not found');
    }
    
    console.log('✅ Image generated successfully, URL:', imageUrl);
    
    // Download image and upload to OSS (timeout set to 120 seconds)
    const downloadController = new AbortController();
    const downloadTimeoutId = setTimeout(() => downloadController.abort(), 120000); // 120 second timeout
    
    let imageResponse;
    try {
      imageResponse = await fetch(imageUrl, {
        signal: downloadController.signal
      });
      clearTimeout(downloadTimeoutId);
    } catch (error) {
      clearTimeout(downloadTimeoutId);
      if (error.name === 'AbortError') {
        console.error('❌ Download image timeout (60 seconds)');
        throw new Error('Download generated image timeout, please try again later');
      }
      console.error('❌ Download image failed:', error.message);
      throw new Error(`Download generated image failed: ${error.message}`);
    }
    
    if (!imageResponse.ok) {
      throw new Error(`Download generated image failed: ${imageResponse.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const finalImageUrl = await uploadFile(imageBuffer, `blog_cover_${bookId}_${Date.now()}.jpg`, 'image/jpeg', 'covers');
    console.log('✅ Image uploaded to Qiniu successfully, URL:', finalImageUrl);
    
    // 保存到书籍对象
    await db.update('Book', { blogCoverUrl: finalImageUrl }, 'id = ?', [bookId]);
    
    res.json({
      success: true,
      data: {
        blogCoverUrl: finalImageUrl,
        imageUrl: finalImageUrl
      }
    });
    
  } catch (error) {
    console.error('生成博客封面图失败:', error);
    res.status(500).json({
      success: false,
      message: '生成博客封面图失败',
      error: error.message || String(error)
    });
  }
});

// 使用阿里云DashScope qwen-long-latest拆解书籍内容
router.post('/:bookId/extract', async (req, res) => {
  // 立即设置CORS头
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // 检测前端是否支持SSE（通过Accept头或useSSE参数）
  const acceptHeader = req.headers.accept || '';
  const useSSE = req.query.useSSE === 'true' || req.body.useSSE === true || acceptHeader.includes('text/event-stream');
  
  let sendProgress, cleanup, heartbeatInterval;
  
  if (useSSE) {
    // 设置流式响应头（Server-Sent Events），用于保持连接活跃并发送进度更新
    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    
    // 发送进度更新的辅助函数
    sendProgress = (message, progress = null) => {
      try {
        const data = JSON.stringify({ message, progress, timestamp: Date.now() });
        res.write(`data: ${data}\n\n`);
        console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
      } catch (err) {
        console.error('❌ 发送进度更新失败:', err);
      }
    };
    
    // 发送心跳以保持连接活跃（每30秒发送一次）
    heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // 清理函数
    cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  } else {
    // 兼容模式：使用JSON响应，但仍然发送进度更新（通过日志）
    res.header('Content-Type', 'application/json');
    sendProgress = (message, progress = null) => {
      console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
    };
    cleanup = () => {};
    console.log('⚠️ 前端不支持SSE，使用JSON响应模式（兼容模式）');
  }
  
  try {
    const { bookId } = req.params;
    const { segments = 10 } = req.body; // 默认10段

    if (![5, 10, 20, 30].includes(segments)) {
      cleanup();
      if (useSSE) {
        const errorData = JSON.stringify({ success: false, message: '分段数量必须是5、10、20或30', completed: true });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      } else {
        res.status(400).json({ success: false, message: '分段数量必须是5、10、20或30' });
      }
      return;
    }
    
    sendProgress('开始处理书籍提取请求', 0);

    // 获取书籍信息
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }

    // 检查是否有附件文件
    const fileUrl = book.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: '书籍没有上传附件文件，无法拆解内容'
      });
    }

    // 更新书籍状态为提取中
    await db.update('Book', { status: '提取中' }, 'id = ?', [req.params.bookId]);

    // 从附件文件提取文本内容
    console.log('📖 开始从附件文件提取文本内容...');
    sendProgress('正在提取文件文本内容', 10);
    let bookContent;
    try {
      bookContent = await extractTextFromFile(fileUrl);
      console.log('✅ 文本内容提取成功，长度:', bookContent.length);
      sendProgress('文本内容提取完成', 20);
    } catch (error) {
      cleanup();
      console.error('❌ 提取文件内容失败:', error);
      await db.update('Book', { status: '待处理' }, 'id = ?', [req.params.bookId]);
      const errorData = JSON.stringify({ success: false, message: `提取文件内容失败: ${error.message}`, completed: true });
      res.write(`data: ${errorData}\n\n`);
      res.end();
      return;
    }

    // 调用阿里云DashScope qwen-long-latest模型拆解书籍（基于文件内容）
    const prompt = `你是一位拥有十年经验的资深书籍解读人，擅长将复杂的书本思想转化为直击人心的故事。请根据我上传的书籍文件为我深度拆解成${segments}视频脚本，目标是创作一段"让人看完久久不能平静"的视频脚本。

请遵循以下要求：
1. **角色设定**：你不是在做学术报告，而是一位"灵魂摆渡人"式的讲述者——温柔、深刻、有洞察力，能看透人性的脆弱与光辉。
2. **选择书籍**：上传的书籍《${book.title}》。
3. **脚本风格**：
   - 情感真挚，语言富有文学性与哲思；
   - 能引发观众强烈共鸣，甚至落泪；
   - 不仅讲"书说了什么"，更要讲"它如何照见我们的人生"。
4. **结构设计（每段视频2分钟左右）**：
   - 【开场】：用一句极具冲击力的提问或金句抓住注意力，制造悬念；
   - 【中段】：以故事化方式讲述书中核心情节或思想；
   - 【高潮】：情感升华，将书的主题与现代人内心的孤独、挣扎、希望连接起来；
   - 【结尾】：温柔收尾，给出一句治愈人心的结语，并自然引导点赞收藏。
5. **输出格式**：
   - 脚本只需包含旁白；
   - 语言口语化。

书籍内容：
${bookContent}

现在，请为我生成这样${segments}刻骨铭心的书籍讲解视频脚本。每集需要包含：

1. chapterTitle (Chinese) - 本集标题（中文），具有吸引力和概括性
2. chapterTitleEn (English) - Episode Title (English) - REQUIRED
3. summary (Chinese, 约200字) - 本集的核心内容总结，包含开场、中段、高潮、结尾的完整内容。要具体、有价值，避免概括性表述。直接阐述核心思想和洞察，不要使用"本书认为"、"作者指出"等表述。语言要富有情感和文学性。
4. summaryEn (English, 约200-300字) - Summary (English) - 完整翻译中文summary，保持所有细节和情感色彩 - REQUIRED
5. avatarDescription (description of gender, age, profession, style) - 数字人形象描述，应该是一位温柔、深刻、有洞察力的讲述者
6. estimatedDuration (seconds) - 预计视频时长（秒），约120秒（2分钟）

IMPORTANT: 
- You MUST provide English translations (chapterTitleEn, summaryEn) for ALL segments. Do not skip any English fields.
- The summary should reflect the emotional depth and literary quality described above.
- Extract ESSENCE and CORE IDEAS, NOT general summaries or overviews.
- Be SPECIFIC and CONCRETE. Avoid vague statements.
- Focus on EMOTIONAL resonance and HUMAN insights that connect the book's themes to modern life.
- Language should be conversational, literary, and philosophical.

Return in JSON format:
{
  "segments": [
    {
      "chapterTitle": "Episode标题（具有吸引力和概括性）",
      "chapterTitleEn": "Episode Title",
      "summary": "核心内容总结（约200字，包含开场、中段、高潮、结尾的完整内容，富有情感和文学性）",
      "summaryEn": "Summary (complete English translation, maintaining all details and emotional depth from Chinese summary, approximately 200-300 words)",
      "avatarDescription": "形象描述（温柔、深刻、有洞察力的讲述者）",
      "estimatedDuration": 120
    }
  ]
}`;

    console.log('📞 调用阿里云DashScope qwen-long-latest API，书籍:', book.title, '分段数:', segments);
    console.log('📞 使用附件文件内容拆解，文件URL:', fileUrl);
    console.log('📞 文本内容长度:', bookContent.length, '字符');
    console.log('📞 DashScope API URL:', DASHSCOPE_CHAT_API_URL);
    console.log('📞 DashScope API Key前4位:', ALIYUN_API_KEY ? ALIYUN_API_KEY.substring(0, 4) : '未设置');
    
    sendProgress('正在调用阿里云DashScope qwen-long-latest API分析书籍内容', 30);
    let dashscopeResponse;
    try {
      dashscopeResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIYUN_API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen-long-latest',
          input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
            ]
          },
          parameters: {
          temperature: 0.7,
          max_tokens: 8000  // 增加token限制以处理更长的内容
          }
        })
      });
    } catch (fetchError) {
      console.error('❌ 阿里云DashScope API请求失败:', fetchError);
      console.error('❌ 错误详情:', fetchError.message, fetchError.stack);
      throw new Error(`无法连接到阿里云DashScope API: ${fetchError.message}`);
    }

    if (!dashscopeResponse.ok) {
      const errorText = await dashscopeResponse.text().catch(() => '无法读取错误响应');
      console.error('❌ 阿里云DashScope API返回错误:', dashscopeResponse.status, dashscopeResponse.statusText);
      console.error('❌ 错误响应内容:', errorText);
      throw new Error(`阿里云DashScope API错误 (${dashscopeResponse.status}): ${dashscopeResponse.statusText}. ${errorText.substring(0, 200)}`);
    }

    const dashscopeData = await dashscopeResponse.json();
    const content = dashscopeData.output?.choices?.[0]?.message?.content || dashscopeData.output?.text || '';
    
    if (!content) {
      console.error('❌ 阿里云DashScope API响应格式错误:', JSON.stringify(dashscopeData, null, 2));
      throw new Error('阿里云DashScope API未返回有效内容');
    }
    
    console.log('📥 阿里云DashScope API原始响应（前500字符）:', content.substring(0, 500) + '...');
    sendProgress('阿里云DashScope API分析完成，正在解析结果', 50);

    // 解析JSON响应（可能包含markdown代码块）
    let segmentsData;
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        segmentsData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        segmentsData = JSON.parse(content);
      }
      
      console.log('✅ 解析成功，段数:', segmentsData.segments?.length || 0);
      // 检查第一段是否包含英文字段
      if (segmentsData.segments && segmentsData.segments.length > 0) {
        const firstSegment = segmentsData.segments[0];
        console.log('📊 第一段字段检查:');
        console.log(`   chapterTitleEn: ${firstSegment.chapterTitleEn ? '✓ 存在' : '✗ 缺失'}`);
        console.log(`   summaryEn: ${firstSegment.summaryEn ? '✓ 存在' : '✗ 缺失'}`);
        if (firstSegment.chapterTitleEn) {
          console.log(`   英文标题示例: ${firstSegment.chapterTitleEn.substring(0, 50)}`);
        }
        if (firstSegment.summaryEn) {
          console.log(`   英文摘要示例: ${firstSegment.summaryEn.substring(0, 50)}`);
        }
      }
    } catch (parseError) {
      console.error('❌ 解析阿里云DashScope响应失败:', parseError);
      console.error('❌ 响应内容:', content);
      throw new Error('无法解析AI返回的内容');
    }

    // 保存提取的内容到数据库
    sendProgress('正在保存提取的内容到数据库', 60);
    const savedSegments = [];
    const totalSegments = segmentsData.segments?.length || 0;

    for (let i = 0; i < (segmentsData.segments || []).length; i++) {
      const segment = segmentsData.segments[i];
      const segmentProgress = 60 + Math.floor((i / totalSegments) * 30);
      sendProgress(`正在保存第 ${i + 1}/${totalSegments} 段内容`, segmentProgress);
      // 处理summary（中文），确保严格200字，提取核心思想和精华
      let summary = segment.summary || '';
      
      // 如果有单独的关键要点，合并到摘要中（兼容旧数据）
      if (segment.keyPoints && Array.isArray(segment.keyPoints) && segment.keyPoints.length > 0) {
        const keyPointsText = segment.keyPoints.join('；');
        // 将关键要点自然地添加到摘要末尾
        if (summary.trim()) {
          summary = summary.trim() + '。主要要点包括：' + keyPointsText + '。';
        } else {
          summary = '主要要点包括：' + keyPointsText + '。';
        }
      }
      
      // 去掉常见的冗余表述和概括性内容
      summary = summary.replace(/本书提出的核心问题是[：:]\s*/g, '');
      summary = summary.replace(/本书认为[，,。]\s*/g, '');
      summary = summary.replace(/作者指出[，,。]\s*/g, '');
      summary = summary.replace(/作者认为[，,。]\s*/g, '');
      summary = summary.replace(/本书[，,。]\s*/g, '');
      summary = summary.replace(/作者[，,。]\s*/g, '');
      summary = summary.replace(/本书介绍了[，,。]\s*/g, '');
      summary = summary.replace(/本书阐述了[，,。]\s*/g, '');
      summary = summary.replace(/本书讲述了[，,。]\s*/g, '');
      summary = summary.replace(/本书说明了[，,。]\s*/g, '');
      summary = summary.replace(/本书分析了[，,。]\s*/g, '');
      summary = summary.replace(/本书讨论了[，,。]\s*/g, '');
      summary = summary.replace(/^[，,。]\s*/g, ''); // 去掉开头的标点
      
      summary = summary.trim();
      
      // 不再强制限制summary长度，允许显示完整内容
      // 根据新的prompt要求，summary是"约200字"，可以更长以包含完整信息
      
      // 处理summaryEn（英文），将关键要点合并到摘要中
      let summaryEn = segment.summaryEn || '';
      summaryEn = summaryEn.trim();
      
      // 如果有单独的关键要点英文版，合并到摘要中
      if (segment.keyPointsEn && Array.isArray(segment.keyPointsEn) && segment.keyPointsEn.length > 0) {
        const keyPointsEnText = segment.keyPointsEn.join('; ');
        // 将关键要点自然地添加到摘要末尾
        if (summaryEn.trim()) {
          summaryEn = summaryEn.trim() + ' Key points include: ' + keyPointsEnText + '.';
        } else {
          summaryEn = 'Key points include: ' + keyPointsEnText + '.';
        }
      }
      
      // 如果AI没有生成英文版本，使用翻译功能
      let chapterTitleEn = segment.chapterTitleEn;
      let summaryEnFinal = summaryEn;
      
      // 检查是否需要翻译：如果英文字段为空或不存在，则翻译
      const needsTitleTranslation = !chapterTitleEn || chapterTitleEn.trim() === '';
      const needsSummaryTranslation = !summaryEnFinal || summaryEnFinal.trim() === '';
      
      // 如果缺少英文标题，翻译中文标题
      if (needsTitleTranslation && segment.chapterTitle) {
        console.log(`🌐 [翻译] 章节标题: ${segment.chapterTitle}`);
        try {
          const translateTitleResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ALIYUN_API_KEY}`
            },
            body: JSON.stringify({
              model: 'qwen-long-latest',
              input: {
              messages: [
                {
                  role: 'user',
                  content: `请将以下中文章节标题翻译成英文，只返回英文翻译，不要添加任何其他内容：\n${segment.chapterTitle}`
                }
                ]
              },
              parameters: {
              temperature: 0.3,
              max_tokens: 100
              }
            })
          });
          
          if (translateTitleResponse.ok) {
            const translateTitleData = await translateTitleResponse.json();
            chapterTitleEn = translateTitleData.output?.choices?.[0]?.message?.content?.trim() || translateTitleData.output?.text?.trim() || '';
            if (chapterTitleEn) {
              console.log(`✅ [翻译完成] 标题: ${chapterTitleEn}`);
            } else {
              console.warn(`⚠️ [翻译警告] 标题翻译返回为空`);
              chapterTitleEn = segment.chapterTitle || 'Untitled Chapter';
            }
          } else {
            const errorText = await translateTitleResponse.text();
            console.error(`❌ [翻译失败] 标题翻译API返回错误: ${translateTitleResponse.status} - ${errorText}`);
            chapterTitleEn = segment.chapterTitle || 'Untitled Chapter';
          }
        } catch (translateError) {
          console.error('❌ [翻译异常] 标题翻译失败:', translateError.message);
          chapterTitleEn = segment.chapterTitle || 'Untitled Chapter';
        }
      }
      
      // 如果缺少英文摘要，翻译中文摘要
      if (needsSummaryTranslation && summary && summary.trim()) {
        console.log(`🌐 [翻译] 摘要: ${summary.substring(0, 50)}...`);
        try {
          const translateSummaryResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ALIYUN_API_KEY}`
            },
            body: JSON.stringify({
              model: 'qwen-long-latest',
              input: {
              messages: [
                {
                  role: 'user',
                  content: `请将以下中文内容摘要完整翻译成英文，保持所有细节，不要限制字数，只返回英文翻译，不要添加任何其他内容：\n${summary}`
                }
                ]
              },
              parameters: {
              temperature: 0.3,
              max_tokens: 1000
              }
            })
          });
          
          if (translateSummaryResponse.ok) {
            const translateSummaryData = await translateSummaryResponse.json();
            summaryEnFinal = translateSummaryData.output?.choices?.[0]?.message?.content?.trim() || translateSummaryData.output?.text?.trim() || '';
            if (summaryEnFinal) {
              // 保持完整，不限制字数
              console.log(`✅ [翻译完成] 摘要: ${summaryEnFinal.substring(0, 100)}... (总长度: ${summaryEnFinal.length}字符)`);
            } else {
              console.warn(`⚠️ [翻译警告] 摘要翻译返回为空`);
              summaryEnFinal = '';
            }
          } else {
            const errorText = await translateSummaryResponse.text();
            console.error(`❌ [翻译失败] 摘要翻译API返回错误: ${translateSummaryResponse.status} - ${errorText}`);
            summaryEnFinal = '';
          }
        } catch (translateError) {
          console.error('❌ [翻译异常] 摘要翻译失败:', translateError.message);
          summaryEnFinal = '';
        }
      }
      
      // 确保有默认值
      chapterTitleEn = chapterTitleEn || segment.chapterTitle || 'Untitled Chapter';
      summaryEnFinal = summaryEnFinal || summary || '';
      
      console.log(`📝 保存内容段 ${savedSegments.length + 1}:`);
      console.log(`   中文标题: ${segment.chapterTitle || '未命名章节'}`);
      console.log(`   英文标题: ${chapterTitleEn}`);
      console.log(`   中文摘要长度: ${summary.length}`);
      console.log(`   英文摘要长度: ${summaryEnFinal.length}`);
      
      const extractedContentData = {
        bookId: parseInt(bookId),
        chapterTitle: segment.chapterTitle || '未命名章节',
        chapterTitleEn: chapterTitleEn,
        summary: summary,
        summaryEn: summaryEnFinal,
        avatarDescription: segment.avatarDescription || '',
        estimatedDuration: segment.estimatedDuration || 180,
        segmentIndex: savedSegments.length + 1,
        videoStatus: 'pending',
        keyPoints: segment.keyPoints ? JSON.stringify(segment.keyPoints) : null
      };

      const contentId = await db.insert('ExtractedContent', extractedContentData);
      const savedContent = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
      
      savedSegments.push({
        id: savedContent.id,
        chapterTitle: savedContent.chapterTitle,
        chapterTitleEn: savedContent.chapterTitleEn,
        summary: savedContent.summary,
        summaryEn: savedContent.summaryEn,
        avatarDescription: savedContent.avatarDescription,
        estimatedDuration: savedContent.estimatedDuration,
        videoStatus: savedContent.videoStatus
      });
    }

    // 更新书籍状态为已完成
    await db.update('Book', { status: '已完成' }, 'id = ?', [req.params.bookId]);

    // 发送完成消息
    cleanup();
    sendProgress('书籍提取完成', 100);
    const responseData = {
      success: true,
      data: {
        bookId: book.id,
        segments: savedSegments
      }
    };
    
    if (useSSE) {
      // SSE格式响应
      responseData.completed = true;
      const finalData = JSON.stringify(responseData);
      res.write(`data: ${finalData}\n\n`);
      res.end();
    } else {
      // JSON格式响应（兼容模式）
      res.json(responseData);
    }
  } catch (error) {
    cleanup();
    console.error('❌ 拆解书籍失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    console.error('❌ 错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('❌ BookId:', req.params.bookId);
    
    // 更新书籍状态为待处理（失败时）
    try {
      await db.update('Book', { status: '待处理' }, 'id = ?', [req.params.bookId]);
    } catch (updateError) {
      console.error('❌ 更新书籍状态失败:', updateError);
    }

    // 发送错误消息（SSE格式）
    let errorMessage = '拆解书籍失败';
    let errorSuggestion = '';
    
    // 检查是否是网络错误
    if (error.message && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
      errorMessage = '无法连接到阿里云DashScope API，请检查网络连接或API配置';
      errorSuggestion = '请检查DASHSCOPE_API_KEY是否正确配置';
    } else if (error.message && (error.message.includes('DashScope API') || error.message.includes('阿里云'))) {
      errorMessage = '阿里云DashScope API调用失败';
      errorSuggestion = '请检查DASHSCOPE_API_KEY是否正确，或查看阿里云DashScope API服务状态';
    } else if (error.message && (error.message.includes('JSON') || error.message.includes('解析'))) {
      errorMessage = '无法解析AI返回的内容';
      errorSuggestion = 'AI返回的内容格式不正确，请重试';
    }

      const errorResponse = {
        success: false,
        message: errorMessage,
        error: error.message || String(error),
        suggestion: errorSuggestion
      };
      
      // 在开发环境下返回更多调试信息
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        errorResponse.stack = error.stack;
        errorResponse.details = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      
      if (useSSE) {
        // SSE格式响应
        errorResponse.completed = true;
        const errorData = JSON.stringify(errorResponse);
        res.write(`data: ${errorData}\n\n`);
        res.end();
      } else {
        // JSON格式响应（兼容模式）
        res.status(500).json(errorResponse);
      }
  }
});

// 使用阿里云DashScope TTS将文字转换为语音
router.post('/content/:contentId/generate-audio', async (req, res) => {
  // 立即设置CORS头，确保长时间运行的请求也能正确返回CORS响应
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // 设置响应超时时间（15分钟），因为音频生成需要轮询查询任务状态
  req.setTimeout(15 * 60 * 1000);
  res.setTimeout(15 * 60 * 1000);
  
  console.log('🚀 ========== 生成音频API被调用 ==========');
  console.log('🌐 Origin:', origin);
  console.log('📥 请求参数:', JSON.stringify(req.params, null, 2));
  console.log('📥 请求体:', JSON.stringify(req.body, null, 2));
  console.log('📥 Content-Type:', req.headers['content-type']);
  
  try {
    const { contentId } = req.params;
    const { text, language = 'zh', includeOpeningText = true } = req.body; // language: 'zh' 或 'en', includeOpeningText: 是否包含开头语（默认true）
    
    // 根据language参数判断是否是英文
    const isEnglish = language === 'en';
    
    console.log('📋 解析后的参数:');
    console.log('   contentId:', contentId);
    console.log('   text:', text ? `${text.substring(0, 50)}...` : 'undefined');
    console.log('   language:', language, `(type: ${typeof language})`);
    console.log('   isEnglish:', isEnglish);

    // 获取内容对象
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: '内容不存在'
      });
    }

    // 如果没有提供text，尝试从contentObj获取summary
    let finalText = text;
    if (!finalText) {
      console.log('⚠️ 请求中未提供text，尝试从contentObj获取summary');
      if (isEnglish) {
        finalText = contentObj.summaryEn || contentObj.summary || '';
      } else {
        finalText = contentObj.summary || contentObj.summaryEn || '';
      }
      console.log('📝 从contentObj获取的文本:', finalText ? `${finalText.substring(0, 50)}...` : '空');
    }

    if (!finalText) {
      console.log('❌ 缺少文本内容');
      return res.status(400).json({
        success: false,
        message: '缺少文本内容（请提供text参数或确保contentObj中有summary字段）'
      });
    }

    // 获取书籍信息和集数信息，用于生成开场白
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [contentObj.bookId]);
    const bookTitle = book ? book.title : '';
    const segmentIndex = contentObj.segmentIndex || 0;
    
    // 查询同一本书的所有内容段，获取总集数
    let totalSegments = 0;
    if (book) {
      const allSegments = await db.query(
        'SELECT COUNT(*) as count FROM ExtractedContent WHERE bookId = ?',
        [contentObj.bookId]
      );
      totalSegments = allSegments[0]?.count || 0;
    }
    
    // 根据集数生成开场白
    let openingText = '';
    if (isEnglish) {
      // 英文开场白
      if (segmentIndex === 1 || totalSegments === 0) {
        // 第一集
        openingText = bookTitle 
          ? `Hello, welcome to our book blog. Today we're starting with a book called "${bookTitle}". `
          : `Hello, welcome to our book blog. Today we're starting with a new book. `;
      } else if (segmentIndex === totalSegments && totalSegments > 0) {
        // 最后一集
        openingText = bookTitle
          ? `Hello, this is the final episode of the "${bookTitle}" breakdown series. `
          : `Hello, this is the final episode of our book breakdown series. `;
      } else {
        // 中间集 - 随机选择一种开场白
        const middleOpenings = [
          `Welcome back. In the previous episode, we discussed `,
          `Hello, this is the book blog. `,
          `Welcome back to our book blog. `
        ];
        openingText = middleOpenings[segmentIndex % middleOpenings.length];
      }
    } else {
      // 中文开场白
      if (segmentIndex === 1 || totalSegments === 0) {
        // 第一集
        openingText = bookTitle 
          ? `你好，欢迎来到我们的书籍博客。今天我们要开启的，是一本名为《${bookTitle}》的书籍。`
          : `你好，欢迎来到我们的书籍博客。今天我们要开启的，是一本重要的书籍。`;
      } else if (segmentIndex === totalSegments && totalSegments > 0) {
        // 最后一集
        openingText = bookTitle
          ? `你好，这是《${bookTitle}》拆解系列的最后一集。`
          : `你好，这是本书拆解系列的最后一集。`;
      } else {
        // 中间集 - 随机选择一种开场白
        const middleOpenings = [
          `欢迎回来。上一集我们探讨了`,
          `你好，这里是书籍博客。`,
          `欢迎再次收听。`
        ];
        openingText = middleOpenings[segmentIndex % middleOpenings.length];
      }
    }
    
    // 根据用户选择决定是否添加开场白
    finalText = (includeOpeningText && openingText) ? `${openingText}${finalText}` : finalText;
    console.log(`📝 添加开场白选项: ${includeOpeningText ? '是' : '否'}, 集数: ${segmentIndex}/${totalSegments}, 语言: ${language}`);
    if (includeOpeningText && openingText) {
      console.log(`📝 开场白: ${openingText}`);
    }
    console.log(`📝 最终文本长度: ${finalText.length} 字符`);

    // 使用阿里云DashScope CosyVoice-v3-plus进行语音合成
    console.log('🔵 ========== 使用阿里云DashScope CosyVoice-v3-plus ==========');
    console.log('🔵 语言:', language);
    console.log('🎵 调用阿里云DashScope TTS API，文本长度:', finalText.length, '语言:', language);
    
    // CosyVoice-v3-plus 模型没有字符数限制，可以直接处理长文本
    // 根据语言选择音色
    // Qwen TTS音色：中英文都使用Ethan
    const voice = 'Ethan';
    console.log(`🎤 选择音色: ${voice} (${isEnglish ? '英文' : '中文'})`);
    console.log(`📝 生成${isEnglish ? '英文' : '中文'}音频，文本长度: ${finalText.length}，内容预览: ${finalText.substring(0, 100)}...`);
    
    // 调用阿里云DashScope Qwen TTS HTTP SSE API
    // 参考文档：根据用户提供的示例
    let audioBuffer = null;
    
    try {
      const requestBody = {
        model: 'qwen-tts',
        input: {
          text: finalText,
          voice: voice,
          language_type: isEnglish ? 'English' : 'Chinese'
        }
      };
      
      console.log('📋 请求参数:', JSON.stringify(requestBody, null, 2));
      
      // 调用Qwen TTS API（SSE流式响应）
      const ttsResponse = await fetch(ALIYUN_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIYUN_API_KEY}`,
          'X-DashScope-SSE': 'enable' // 启用SSE流式响应
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 响应状态:', ttsResponse.status, ttsResponse.statusText);
      
      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error('❌ 阿里云DashScope TTS API失败:', ttsResponse.status, errorText);
        throw new Error(`阿里云DashScope TTS API失败: ${ttsResponse.status} ${ttsResponse.statusText} - ${errorText}`);
      }
      
      // 检查Content-Type判断响应格式
      const contentType = ttsResponse.headers.get('content-type') || '';
      console.log('📥 Content-Type:', contentType);
      
      let audioUrl = null;
      let audioBase64 = null;
      
      if (contentType.includes('text/event-stream')) {
        // SSE流式响应
        console.log('📥 检测到SSE流式响应');
        const reader = ttsResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ''; // 用于累积不完整的行
        
        // 处理SSE行的辅助函数（必须在循环前定义，以便访问外部变量）
        function processSSELine(line) {
          if (line.trim() === '' || line.startsWith(':')) return;
          
          // 处理event行
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
            console.log('📥 SSE事件类型:', eventType);
            return;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim();
              if (jsonStr === '[DONE]') {
                console.log('✅ 收到流结束标记');
                return;
              }
              
              // 尝试解析JSON，如果失败则尝试修复
              let data = null;
              try {
                data = JSON.parse(jsonStr);
              } catch (parseError) {
                // 如果JSON解析失败，可能是被截断了
                // 尝试查找URL字段（即使JSON不完整）
                if (jsonStr.includes('"url"')) {
                  console.warn('⚠️ JSON解析失败，但检测到url字段，尝试提取:', jsonStr.substring(0, 500));
                  // 尝试提取URL
                  const urlMatch = jsonStr.match(/"url"\s*:\s*"([^"]+)"/);
                  if (urlMatch && urlMatch[1]) {
                    audioUrl = urlMatch[1];
                    console.log('✅ 从不完整的JSON中提取到音频URL:', audioUrl);
                    return; // 成功提取URL，返回
                  }
                }
                // 如果JSON不完整且不以}结尾，可能是最后一个数据块
                if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) {
                  console.warn('⚠️ JSON可能不完整，跳过:', jsonStr.substring(0, 200));
                  return; // 跳过不完整的JSON，等待下一个数据块
                }
                // 如果JSON格式错误，抛出异常
                throw parseError;
              }
              
              // 如果解析成功，继续处理
              if (!data) {
                return;
              }
              console.log('📥 解析SSE数据:', JSON.stringify(data).substring(0, 300));
              
              // 检查是否是错误响应
              if (data.code && data.message) {
                const errorCode = data.code || 'UnknownError';
                const errorMsg = data.message || '未知错误';
                console.error('❌ API返回错误:', errorCode, errorMsg);
                throw new Error(`阿里云DashScope TTS API错误: ${errorCode} - ${errorMsg}`);
        }
        
              // 检查各种可能的音频数据位置
              if (data.output && data.output.audio) {
                const audio = data.output.audio;
                console.log('📥 找到output.audio对象:', JSON.stringify(audio).substring(0, 200));
                
                // 检查 output.audio.url（音频URL，通常在最后一条消息中）
                if (audio.url && audio.url.length > 0) {
                  audioUrl = audio.url;
                  console.log('✅ 从output.audio.url获取到音频URL:', audioUrl);
                }
                
                // 检查 output.audio.data（base64编码的音频数据，可能分多次返回）
                if (audio.data && audio.data.length > 0) {
                  // 累积base64数据（可能分多次返回）
                  if (!audioBase64) {
                    audioBase64 = '';
                  }
                  audioBase64 += audio.data;
                  console.log('✅ 累积output.audio.data，当前总长度:', audioBase64.length);
          }
              }
              
              // 检查 output.choices[].message.content[].audio（备用路径）
              if (data.output && data.output.choices && Array.isArray(data.output.choices)) {
                for (const choice of data.output.choices) {
                  if (choice.message && choice.message.content) {
                    const contents = Array.isArray(choice.message.content) ? choice.message.content : [choice.message.content];
                    for (const content of contents) {
                      if (content.audio) {
                        audioUrl = content.audio;
                        console.log('✅ 从choices.message.content获取到音频URL:', audioUrl.substring(0, 100) + '...');
                      } else if (content.audio_base64) {
                        if (!audioBase64) {
                          audioBase64 = '';
    }
                        audioBase64 += content.audio_base64;
                        console.log('✅ 累积choices.message.content.audio_base64，当前总长度:', audioBase64.length);
                      }
                    }
                  }
                }
              }
              
              // 检查顶层字段（备用路径）
              if (data.audio) {
                audioUrl = data.audio;
                console.log('✅ 从顶层audio获取到音频URL:', audioUrl.substring(0, 100) + '...');
              }
              if (data.audio_base64) {
                if (!audioBase64) {
                  audioBase64 = '';
                }
                audioBase64 += data.audio_base64;
                console.log('✅ 累积顶层audio_base64，当前总长度:', audioBase64.length);
              }
              
            } catch (e) {
              console.warn('⚠️ 解析SSE数据失败:', e.message, '行内容:', line.substring(0, 500));
            }
          }
      }
      
        // 读取和处理SSE流数据
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // 处理最后剩余的数据
            if (buffer.trim()) {
              console.log('📥 处理最后剩余的数据:', buffer.substring(0, 1000));
              // 检查buffer中是否包含URL
              if (buffer.includes('"url"')) {
                console.log('📥 检测到buffer中包含url字段');
                // 尝试从buffer中直接提取URL
                const urlMatch = buffer.match(/"url"\s*:\s*"([^"]+)"/);
                if (urlMatch && urlMatch[1]) {
                  audioUrl = urlMatch[1];
                  console.log('✅ 从buffer中提取到音频URL:', audioUrl);
                }
              }
              const finalLines = buffer.split('\n');
              for (const line of finalLines) {
                if (line.trim() && !line.startsWith(':')) {
                  processSSELine(line.trim());
                }
              }
              // 如果buffer中还有未处理的data行（可能不完整），尝试处理
              if (buffer.includes('data:') && !buffer.includes('\n')) {
                console.log('📥 尝试处理buffer中的data行:', buffer.substring(0, 500));
                processSSELine(buffer.trim());
              }
            }
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          console.log('📥 收到SSE数据块（原始）:', chunk.substring(0, 200));
          
          // 检查chunk中是否包含URL（即使JSON不完整）
          if (chunk.includes('"url"')) {
            console.log('📥 检测到chunk中包含url字段');
            const urlMatch = chunk.match(/"url"\s*:\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
              audioUrl = urlMatch[1];
              console.log('✅ 从chunk中提取到音频URL:', audioUrl);
            }
          }
          
          // 处理完整的行，保留不完整的行到下次处理
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后不完整的行
          
          for (const line of lines) {
            if (line.trim() && !line.startsWith(':')) {
              processSSELine(line.trim());
            }
          }
        }
        
        console.log('📥 SSE流处理完成，audioUrl:', audioUrl ? `已获取: ${audioUrl.substring(0, 100)}...` : '未获取', 'audioBase64长度:', audioBase64 ? audioBase64.length : 0);
      } else {
        // 普通JSON响应
        console.log('📥 检测到JSON响应');
        const responseData = await ttsResponse.json();
        console.log('📥 完整响应数据:', JSON.stringify(responseData, null, 2));
        
        // 检查各种可能的音频数据位置
        if (responseData.output) {
          if (responseData.output.choices && Array.isArray(responseData.output.choices)) {
            for (const choice of responseData.output.choices) {
              if (choice.message && choice.message.content) {
                const contents = Array.isArray(choice.message.content) ? choice.message.content : [choice.message.content];
                for (const content of contents) {
                  if (content.audio) {
                    audioUrl = content.audio;
                    console.log('✅ 从choices.message.content获取到音频URL:', audioUrl);
                  } else if (content.audio_base64) {
                    audioBase64 = content.audio_base64;
                    console.log('✅ 从choices.message.content获取到Base64音频数据');
                  }
                }
              }
            }
          }
          
          if (responseData.output.audio) {
            audioUrl = responseData.output.audio;
            console.log('✅ 从output.audio获取到音频URL:', audioUrl);
          }
          
          if (responseData.output.result && typeof responseData.output.result === 'string') {
            audioBase64 = responseData.output.result;
            console.log('✅ 从output.result获取到音频数据');
          }
        }
        
        if (responseData.audio) {
          audioUrl = responseData.audio;
          console.log('✅ 从顶层audio获取到音频URL:', audioUrl);
        }
        if (responseData.audio_base64) {
          audioBase64 = responseData.audio_base64;
          console.log('✅ 从顶层audio_base64获取到音频数据');
        }
      }
      
      // 处理音频数据
      if (audioUrl) {
        // 如果有音频URL，下载音频
        console.log('📥 下载音频文件，URL:', audioUrl);
        const audioResponse = await fetch(audioUrl);
          if (!audioResponse.ok) {
            throw new Error(`下载音频文件失败: ${audioResponse.statusText}`);
          }
        const audioArrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(audioArrayBuffer);
        console.log('✅ 音频下载完成，Buffer长度:', audioBuffer.length);
      } else if (audioBase64) {
        // 如果有Base64数据，解码
        console.log('📥 解码Base64音频数据，长度:', audioBase64.length);
        audioBuffer = Buffer.from(audioBase64, 'base64');
        console.log('✅ Base64解码完成，Buffer长度:', audioBuffer.length);
      } else {
        // 打印完整响应以便调试
        if (!contentType.includes('text/event-stream')) {
          const responseText = await ttsResponse.clone().text();
          console.error('❌ 完整响应内容:', responseText.substring(0, 2000));
            }
        throw new Error('阿里云DashScope TTS API未返回音频数据（未找到audio或audio_base64字段）');
          }
          
    } catch (error) {
      console.error('❌ 阿里云DashScope TTS API调用失败:', error);
      throw error;
          }
          
    // 处理音频数据
    let buffer = audioBuffer;
    
    if (!buffer || buffer.length === 0) {
      throw new Error('阿里云DashScope TTS API未返回有效的音频数据');
      }
    
    // 将音频文件上传到七牛云（添加重试机制）
    const fileName = `audio_${contentId}_${Date.now()}.mp3`;
    console.log('📤 上传音频文件到七牛云:', fileName, '文件大小:', buffer.length, 'bytes');
    
    // 重试上传，最多3次
    let finalAudioUrl;
    const maxRetries = 3;
    let lastError;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        if (retry > 0) {
          console.log(`🔄 重试上传音频文件 (${retry}/${maxRetries - 1})...`);
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 2000 * retry));
        }
        
        finalAudioUrl = await uploadFile(buffer, fileName, 'audio/mpeg', 'audios');
        console.log('✅ 音频文件上传成功，URL:', finalAudioUrl);
        break; // 成功则跳出循环
      } catch (uploadError) {
        lastError = uploadError;
        console.error(`❌ 上传音频文件失败 (尝试 ${retry + 1}/${maxRetries}):`, uploadError.message);
        
        // 如果是连接重置错误，继续重试
        if (uploadError.code === 'ECONNRESET' || uploadError.message.includes('ECONNRESET')) {
          if (retry < maxRetries - 1) {
            console.log(`⏳ 连接重置，将在 ${2 * (retry + 1)} 秒后重试...`);
            continue;
          }
        }
        
        // 最后一次尝试失败，抛出错误
        if (retry === maxRetries - 1) {
          throw new Error(`上传音频文件到七牛云失败（已重试${maxRetries}次）: ${uploadError.message}`);
        }
      }
    }
    
    if (!finalAudioUrl) {
      throw new Error(`上传音频文件到七牛云失败（已重试${maxRetries}次）: ${lastError?.message || '未知错误'}`);
    }
    
    // 更新ExtractedContent记录，根据language参数保存到对应字段
    if (contentObj) {
      const updateData = {};
      if (language === 'en') {
        updateData.audioUrlEn = finalAudioUrl;
      } else {
        updateData.audioUrl = finalAudioUrl;
      }
      await db.update('ExtractedContent', updateData, 'id = ?', [contentId]);
    }

    res.json({
      success: true,
      data: {
        audioUrl: finalAudioUrl,
        contentId: contentId,
        language: language
      }
    });
  } catch (error) {
    console.error('❌ 生成音频失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    console.error('❌ 错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // 特殊处理阿里云DashScope API错误
    if (error.message && error.message.includes('DashScope')) {
      return res.status(500).json({
        success: false,
        message: '阿里云DashScope TTS API错误',
        error: error.message || '未知错误',
        suggestion: '请检查API Key是否正确，或查看阿里云控制台'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '生成音频失败',
      error: error.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 步骤2: 生成无声视频（根据文本和音频时长调用doubao模型）
router.post('/content/:contentId/generate-silent-video', async (req, res) => {
  // 立即设置CORS头，确保长时间运行的请求也能正确返回CORS响应
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // 豆包视频生成服务已禁用
  return res.status(503).json({
    success: false,
    message: '豆包视频生成服务已禁用',
    error: 'Doubao video generation service is disabled'
  });
  
  // 设置响应超时时间（15分钟）
  req.setTimeout(15 * 60 * 1000);
  res.setTimeout(15 * 60 * 1000);
  
  // 监听请求断开事件
  let requestAborted = false;
  req.on('close', () => {
    requestAborted = true;
    console.warn('⚠️ 客户端断开连接，但后端将继续处理视频生成任务');
  });
  
  console.log('🌐 Origin:', origin);
  
  try {
    const { contentId } = req.params;
    let { styleDescription } = req.body || {}; // 从请求体中获取风格描述
    
    // If no style description provided, use default value
    if (!styleDescription || !styleDescription.trim()) {
      styleDescription = 'Anime style, vibrant colors';
      console.log('⚠️ No style description provided, using default:', styleDescription);
    } else {
      console.log('🎨 Received style description:', styleDescription);
    }
    
    // 获取内容信息
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: '内容不存在'
      });
    }

    // 获取文本内容（优先使用中文，如果没有则使用英文）
    // 只使用summary，不包含标题
    const textContent = contentObj.summary || contentObj.summaryEn || '';
    if (!textContent) {
      return res.status(400).json({
        success: false,
        message: '内容文本为空，无法生成视频'
      });
    }

    // 获取音频时长（优先使用中文音频，如果没有则使用英文音频）
    let audioUrl = contentObj.audioUrl || contentObj.audioUrlEn;
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: '请先生成至少一个音频（中文或英文）'
      });
    }

    // 判断是否是中文视频（如果存在中文音频URL，则为中文视频）
    const isChineseVideo = !!contentObj.audioUrl;

    // 更新状态为生成中
    await db.update('ExtractedContent', { videoStatus: 'generating' }, 'id = ?', [contentId]);

    console.log('📝 开始生成无声视频，文本:', textContent.substring(0, 50) + '...');

    // 验证Doubao API配置
    if (!DOUBAO_API_KEY) {
      throw new Error('Doubao API Key未配置，请设置ARK_API_KEY或DOUBAO_API_KEY环境变量');
    }

    // 获取音频时长
    let finalAudioUrl = audioUrl;
    if (finalAudioUrl.startsWith('http://')) {
      finalAudioUrl = finalAudioUrl.replace('http://', 'https://');
    }
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const tempAudioPath = path.join(tempDir, `audio_${contentId}_${timestamp}.mp3`);
    
    // 下载音频文件
    const audioResponse = await fetch(finalAudioUrl);
    if (!audioResponse.ok) {
      throw new Error(`下载音频失败: ${audioResponse.statusText}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await fs.writeFile(tempAudioPath, audioBuffer);
    console.log('✅ 音频下载完成，大小:', audioBuffer.length, 'bytes');
    
    // 使用ffmpeg获取音频时长
    const audioDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          console.error('❌ 获取音频时长失败:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          console.log('✅ 音频时长:', duration, '秒');
          resolve(duration);
        }
      });
    });
    
    const audioDurationSeconds = Math.ceil(audioDuration);
    console.log('📊 音频总时长:', audioDurationSeconds, '秒');
    
    // 固定生成3段视频（每段5秒）
    const videoSegmentDuration = 5; // 每段视频5秒
    const numSegments = 3; // 固定生成3段视频
    console.log('📊 固定生成', numSegments, '段视频（每段', videoSegmentDuration, '秒）');
    
    // 步骤1: 使用阿里云DashScope qwen-long-latest根据Chinese Summary生成3个视频画面提示词
    console.log('🤖 步骤1: 使用阿里云DashScope qwen-long-latest生成3个视频画面提示词...');
    console.log('📝 Chinese Summary内容:', textContent);
    
    let videoPrompts = [];
    try {
      const qwenPrompt = `请根据以下中文内容，生成3个适合用于视频画面的视觉描述提示词。每个提示词应该简洁、具体、富有画面感，适合用于文生视频API。

内容摘要：
${textContent}

要求：
1. 生成恰好3个提示词
2. 每个提示词应该描述一个具体的视觉场景或画面
3. 提示词应该与内容主题相关
4. 提示词长度适中（20-50字）
5. 避免抽象概念，注重具体可视化的描述

请以JSON格式返回，格式如下：
{
  "prompts": ["提示词1", "提示词2", "提示词3"]
}`;

      const qwenResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIYUN_API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen-long-latest',
          input: {
            messages: [
              {
                role: 'user',
                content: qwenPrompt
              }
            ]
          },
          parameters: {
            temperature: 0.7,
            max_tokens: 2000
          }
        })
      });

      if (!qwenResponse.ok) {
        const errorText = await qwenResponse.text();
        console.error('❌ 阿里云DashScope qwen-long-latest API返回错误:', qwenResponse.status, errorText);
        throw new Error(`阿里云DashScope qwen-long-latest API错误: ${qwenResponse.status} - ${errorText}`);
      }

      const qwenData = await qwenResponse.json();
      const qwenContent = qwenData.output?.choices?.[0]?.message?.content || qwenData.output?.text || '';
      console.log('📥 阿里云DashScope qwen-long-latest API原始响应:', qwenContent);

      // 解析JSON响应
      const jsonMatch = qwenContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        videoPrompts = parsedData.prompts || [];
      }

      // 确保有恰好3个提示词
      if (videoPrompts.length !== 3) {
        console.warn('⚠️ 阿里云DashScope qwen-long-latest返回的提示词数量不是3个，使用备用方案');
        // 备用方案：将文本分段
        const textLength = textContent.length;
        const segmentTextLength = Math.ceil(textLength / numSegments);
        videoPrompts = [];
        for (let i = 0; i < numSegments; i++) {
          const start = i * segmentTextLength;
          const end = Math.min(start + segmentTextLength, textLength);
          videoPrompts.push(textContent.substring(start, end));
        }
      }

      console.log('✅ 成功生成3个视频画面提示词:');
      videoPrompts.forEach((prompt, index) => {
        console.log(`   提示词${index + 1}: ${prompt}`);
      });

    } catch (error) {
      console.error('❌ 使用阿里云DashScope qwen-long-latest生成提示词失败:', error.message);
      console.log('⚠️ 使用备用方案：将文本简单分段');
      
      // 备用方案：将文本分段
      const textLength = textContent.length;
      const segmentTextLength = Math.ceil(textLength / numSegments);
      videoPrompts = [];
      for (let i = 0; i < numSegments; i++) {
        const start = i * segmentTextLength;
        const end = Math.min(start + segmentTextLength, textLength);
        videoPrompts.push(textContent.substring(start, end));
      }
    }
    
    console.log('📊 最终使用的', videoPrompts.length, '个视频提示词');
    
    // 生成多段视频
    console.log('🎬 开始生成多段无声视频');
    const videoSegmentUrls = [];
    const tempVideoSegmentPaths = [];
    
    const videoRequestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DOUBAO_API_KEY}`
    };
    
    // 辅助函数：简化文本以避免敏感内容检测
    const simplifyText = (text, level = 1) => {
      let simplified = text;
      
      // 级别1：移除可能触发敏感检测的词汇和标点
      if (level >= 1) {
        // 移除一些可能触发敏感检测的词汇
        const sensitiveWords = ['问题', '解决', '方法', '策略', '挑战', '困难', '失败', '成功', '竞争', '垄断'];
        sensitiveWords.forEach(word => {
          simplified = simplified.replace(new RegExp(word, 'g'), '');
        });
        
        // 移除多余的标点符号
        simplified = simplified.replace(/[，。！？；：、]/g, ' ');
        simplified = simplified.replace(/\s+/g, ' ').trim();
      }
      
      // 级别2：缩短文本，只保留核心内容
      if (level >= 2) {
        // 如果文本太长，截取前半部分
        if (simplified.length > 50) {
          simplified = simplified.substring(0, 50);
        }
      }
      
      // 级别3：提取关键词
      if (level >= 3) {
        // 提取前30个字符作为核心内容
        if (simplified.length > 30) {
          simplified = simplified.substring(0, 30);
        }
      }
      
      return simplified || text.substring(0, 20); // 如果简化后为空，至少保留前20个字符
    };
    
    // 辅助函数：生成单段视频（带重试机制）
    const generateVideoSegment = async (promptText, segmentIndex, retryCount = 0) => {
      const maxRetries = 3;
      let currentText = promptText;
      
      // 如果已经重试过，简化文本
      if (retryCount > 0) {
        currentText = simplifyText(promptText, retryCount);
        console.log(`🔄 第 ${segmentIndex + 1}/${numSegments} 段视频重试（第${retryCount}次），简化后文本:`, currentText.substring(0, 50) + '...');
      }
      
      // 根据API文档，使用 --ratio 9:16 --dur 参数格式
      // --ratio 9:16 表示9:16竖屏比例（强制限制）
      // --dur 指定视频时长（秒）
      // styleDescription在入口处已经保证有值（默认值或用户提供）
      const finalStyleText = styleDescription.trim();
      const styleText = `，${finalStyleText}`;
      const promptWithParams = `${currentText}${styleText} --ratio 9:16 --dur ${videoSegmentDuration}`;
      console.log(`🎨 第 ${segmentIndex + 1}/${numSegments} 段视频提示词:`, currentText);
      console.log(`🎨 第 ${segmentIndex + 1}/${numSegments} 段视频使用的风格描述:`, finalStyleText);
      
      const textToVideoRequestBody = {
        model: DOUBAO_MODEL_ID,
        content: [
          {
            type: 'text',
            text: promptWithParams
          }
        ],
        generate_audio: false // 明确指定生成无声视频
      };
      
      console.log(`📤 第 ${segmentIndex + 1}/${numSegments} 段视频请求:`, JSON.stringify(textToVideoRequestBody, null, 2));
      console.log(`🔑 使用模型: ${DOUBAO_MODEL_ID}`);
      console.log(`🔗 API端点: ${DOUBAO_TEXT_TO_VIDEO_URL}`);
      
      let textToVideoResponse;
      try {
        // 使用AbortController实现超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        textToVideoResponse = await fetch(DOUBAO_TEXT_TO_VIDEO_URL, {
          method: 'POST',
          headers: videoRequestHeaders,
          body: JSON.stringify(textToVideoRequestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError) {
        console.error(`❌ Doubao API请求失败:`, {
          error: fetchError.message,
          errorName: fetchError.name,
          errorStack: fetchError.stack,
          url: DOUBAO_TEXT_TO_VIDEO_URL,
          headers: videoRequestHeaders,
          requestBody: textToVideoRequestBody
        });
        throw new Error(`Doubao API请求失败: ${fetchError.message || fetchError.name || '网络错误'}`);
      }
      
      if (!textToVideoResponse.ok) {
        const errorText = await textToVideoResponse.text();
        console.error(`❌ Doubao API错误响应:`, {
          status: textToVideoResponse.status,
          statusText: textToVideoResponse.statusText,
          errorText: errorText,
          requestBody: textToVideoRequestBody
        });
        throw new Error(`Doubao文生视频API失败: ${textToVideoResponse.status} ${textToVideoResponse.statusText} - ${errorText}`);
      }
      
      const textToVideoData = await textToVideoResponse.json();
      const taskId = textToVideoData.id;
      
      if (!taskId) {
        throw new Error('Doubao文生视频响应格式错误，未找到任务ID');
      }
      
      console.log(`⏳ 开始轮询第 ${segmentIndex + 1}/${numSegments} 段视频，task_id:`, taskId);
      
      // 轮询获取视频URL（增加超时时间，视频生成可能需要更长时间）
      const maxAttempts = 120; // 增加到120次（10分钟）
      const pollInterval = 5000; // 每5秒查询一次
      let attempts = 0;
      let taskStatus = 'queued';
      let segmentVideoUrl = null;
      
      while (attempts < maxAttempts && taskStatus !== 'succeeded' && taskStatus !== 'failed' && taskStatus !== 'expired' && taskStatus !== 'cancelled') {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        
        const statusUrl = `${DOUBAO_TASK_STATUS_URL}/${taskId}`;
        let statusResponse = null;
        let retryCount = 0;
        const maxRetries = 3;
        const fetchTimeout = 30000;
        
        while (retryCount < maxRetries) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
            
            statusResponse = await fetch(statusUrl, {
              method: 'GET',
              headers: videoRequestHeaders,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            break;
          } catch (fetchError) {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error(`查询任务状态失败: ${fetchError.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (!statusResponse || !statusResponse.ok) {
          const errorText = statusResponse ? await statusResponse.text() : '无响应';
          throw new Error(`查询任务状态失败: ${statusResponse?.statusText || '网络错误'} - ${errorText}`);
        }
        
        const statusData = await statusResponse.json();
        taskStatus = statusData.status;
        
        console.log(`📊 第 ${segmentIndex + 1}/${numSegments} 段视频任务状态（第${attempts}次查询）:`, taskStatus);
        
        if (taskStatus === 'succeeded') {
          segmentVideoUrl = statusData.content?.video_url;
          if (!segmentVideoUrl) {
            throw new Error('任务完成但未找到视频URL');
          }
          console.log(`✅ 第 ${segmentIndex + 1}/${numSegments} 段视频生成完成，URL:`, segmentVideoUrl);
          break;
        } else if (taskStatus === 'failed' || taskStatus === 'expired' || taskStatus === 'cancelled') {
          const errorMsg = statusData.error?.message || statusData.error?.code || '任务失败';
          const errorCode = statusData.error?.code || '';
          
          // 特殊处理敏感内容错误 - 自动重试
          if (errorMsg.includes('sensitive') || errorMsg.includes('敏感') || errorCode.includes('sensitive')) {
            console.error(`❌ 第 ${segmentIndex + 1}/${numSegments} 段视频生成失败（内容安全检测）:`, errorMsg);
            
            // 如果还有重试次数，自动简化文本并重试
            if (retryCount < maxRetries) {
              console.log(`🔄 检测到敏感内容，自动简化文本并重试（${retryCount + 1}/${maxRetries}）...`);
              // 等待2秒后重试
              await new Promise(resolve => setTimeout(resolve, 2000));
              // 递归调用，增加重试次数
              return generateVideoSegment(promptText, segmentIndex, retryCount + 1);
            } else {
              // 重试次数用完，抛出错误
              throw new Error(`视频生成失败：内容可能包含敏感信息，已尝试简化文本${maxRetries}次仍失败。请手动修改文本内容后重试。错误详情: ${errorMsg}`);
            }
          }
          
          console.error(`❌ 第 ${segmentIndex + 1}/${numSegments} 段视频生成失败:`, errorMsg);
          throw new Error(`视频生成任务失败: ${errorMsg}`);
        }
      }
      
      if (!segmentVideoUrl) {
        throw new Error(`视频生成超时或失败，任务状态: ${taskStatus}`);
      }
      
      return segmentVideoUrl;
    };
    
    // 步骤2: 使用豆包根据提示词和风格描述生成3个视频
    console.log('🎬 步骤2: 使用豆包生成3个视频...');
    for (let i = 0; i < numSegments; i++) {
      console.log(`📹 生成第 ${i + 1}/${numSegments} 段视频，使用提示词: ${videoPrompts[i]}`);
      const segmentVideoUrl = await generateVideoSegment(videoPrompts[i], i);
      videoSegmentUrls.push(segmentVideoUrl);
    }
    
    console.log('✅ 所有视频段生成完成，共', videoSegmentUrls.length, '段');
    
    // 下载所有视频段
    console.log('📥 下载所有视频段');
    for (let i = 0; i < videoSegmentUrls.length; i++) {
      const segmentUrl = videoSegmentUrls[i];
      const segmentPath = path.join(tempDir, `video_segment_${contentId}_${timestamp}_${i}.mp4`);
      tempVideoSegmentPaths.push(segmentPath);
      
      console.log(`📥 下载第 ${i + 1}/${videoSegmentUrls.length} 段视频:`, segmentUrl);
      const segmentResponse = await fetch(segmentUrl);
      if (!segmentResponse.ok) {
        throw new Error(`下载视频段失败: ${segmentResponse.statusText}`);
      }
      const segmentBuffer = Buffer.from(await segmentResponse.arrayBuffer());
      await fs.writeFile(segmentPath, segmentBuffer);
      console.log(`✅ 第 ${i + 1}/${videoSegmentUrls.length} 段视频下载完成`);
    }
    
    // 使用ffmpeg拼接所有视频段
    console.log('🎞️ 拼接所有视频段');
    const concatenatedVideoPath = path.join(tempDir, `concatenated_${contentId}_${timestamp}.mp4`);
    const concatFilePath = path.join(tempDir, `concat_${contentId}_${timestamp}.txt`);
    const concatFileContent = tempVideoSegmentPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(concatFilePath, concatFileContent);
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000;
      
      const ffmpegProcess = ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c:v copy', '-c:a copy'])
        .output(concatenatedVideoPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg拼接命令:', commandLine);
          timeoutId = setTimeout(() => {
            console.error('❌ 视频段拼接超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频段拼接超时，请重试'));
          }, timeout);
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频段拼接完成');
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ FFmpeg拼接失败:', err);
          // 如果copy失败，尝试重新编码
          if (err.message && err.message.includes('copy')) {
            console.log('⚠️ 视频流复制失败，尝试重新编码...');
            const fallbackProcess = ffmpeg()
              .input(concatFilePath)
              .inputOptions(['-f', 'concat', '-safe', '0'])
              .outputOptions([
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-s 720x1280'
              ])
              .output(concatenatedVideoPath)
              .on('end', () => {
                console.log('✅ 视频段拼接完成（使用重新编码）');
                resolve(null);
              })
              .on('error', (fallbackErr) => {
                console.error('❌ 重新编码也失败:', fallbackErr);
                reject(fallbackErr);
              })
              .run();
          } else {
            reject(err);
          }
        })
        .run();
    });
    
    // 步骤3: 根据音频时长拼接3个视频并重复拼接
    console.log('🔄 步骤3: 根据音频时长拼接并重复视频...');
    console.log('📏 获取拼接后视频的时长...');
    const concatenatedVideoDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(concatenatedVideoPath, (err, metadata) => {
        if (err) {
          console.error('❌ 获取视频时长失败:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          console.log('✅ 拼接后视频时长:', duration, '秒');
          resolve(duration);
        }
      });
    });
    
    // 根据音频时长，重复播放拼接后的视频直到匹配音频时长
    let finalVideoPath = concatenatedVideoPath;
    if (audioDurationSeconds > concatenatedVideoDuration) {
      console.log(`🔄 音频时长(${audioDurationSeconds}秒) > 视频时长(${concatenatedVideoDuration}秒)，需要重复播放视频`);
      const repeatCount = Math.ceil(audioDurationSeconds / concatenatedVideoDuration);
      console.log(`📊 需要重复播放 ${repeatCount} 次`);
      
      // 创建重复播放的视频列表文件
      const repeatConcatFilePath = path.join(tempDir, `repeat_concat_${contentId}_${timestamp}.txt`);
      const repeatConcatContent = Array(repeatCount).fill(concatenatedVideoPath).map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
      await fs.writeFile(repeatConcatFilePath, repeatConcatContent);
      
      // 重复拼接视频
      finalVideoPath = path.join(tempDir, `final_repeated_${contentId}_${timestamp}.mp4`);
      console.log('🔄 开始重复拼接视频...');
      
      await new Promise((resolve, reject) => {
        let timeoutId = null;
        const timeout = 300000;
        
        const ffmpegProcess = ffmpeg()
          .input(repeatConcatFilePath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions([
            '-c:v libx264',
            '-preset ultrafast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-s 720x1280',
            '-t', audioDurationSeconds.toString() // 限制总时长为音频时长
          ])
          .output(finalVideoPath)
          .on('start', (commandLine) => {
            console.log('🎬 FFmpeg重复拼接命令:', commandLine);
            timeoutId = setTimeout(() => {
              console.error('❌ 视频重复拼接超时（5分钟）');
              ffmpegProcess.kill('SIGKILL');
              reject(new Error('视频重复拼接超时，请重试'));
            }, timeout);
          })
          .on('end', () => {
            if (timeoutId) clearTimeout(timeoutId);
            console.log('✅ 视频重复拼接完成');
            resolve(null);
          })
          .on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            console.error('❌ FFmpeg重复拼接失败:', err);
            reject(err);
          })
          .run();
      });
      
      // 清理重复拼接的临时文件
      try {
        await fs.unlink(repeatConcatFilePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理重复拼接临时文件失败:', cleanupError.message);
      }
    } else {
      console.log(`✅ 视频时长(${concatenatedVideoDuration}秒) >= 音频时长(${audioDurationSeconds}秒)，无需重复播放`);
    }
    
    // 上传最终的无声视频到七牛云
    console.log('📤 开始上传无声视频到七牛云...');
    const silentVideoBuffer = await fs.readFile(finalVideoPath);
    const fileSizeMB = (silentVideoBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`📊 视频文件大小: ${fileSizeMB}MB`);
    
    // 设置上传超时时间（10分钟）
    const uploadStartTime = Date.now();
    let silentVideoUrl;
    try {
      silentVideoUrl = await Promise.race([
        uploadFile(silentVideoBuffer, `silent_video_${contentId}_${timestamp}.mp4`, 'video/mp4', 'videos'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('视频上传超时，请检查网络连接或文件大小')), 10 * 60 * 1000)
        )
      ]);
      const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`✅ 无声视频上传成功，耗时: ${uploadTime}秒，URL:`, silentVideoUrl);
    } catch (error) {
      console.error('❌ 无声视频上传失败:', error);
      console.error('错误详情:', error.message);
      throw new Error(`视频上传失败: ${error.message}`);
    }
    
    // 更新ExtractedContent记录
    await db.update('ExtractedContent', { silentVideoUrl: silentVideoUrl }, 'id = ?', [contentId]);
    
    // 清理临时文件
    const cleanupFiles = [
      tempAudioPath, 
      concatenatedVideoPath, 
      concatFilePath, 
      ...tempVideoSegmentPaths,
      ...(finalVideoPath !== concatenatedVideoPath ? [finalVideoPath] : []) // 如果创建了重复播放的视频，也清理它
    ];
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        silentVideoUrl: silentVideoUrl,
        contentId: contentId
      }
    });
  } catch (error) {
    console.error('❌ 生成无声视频失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    console.error('❌ 错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('❌ ContentId:', req.params.contentId);
    
    // 更新状态为失败
    try {
      await db.update('ExtractedContent', { videoStatus: 'failed' }, 'id = ?', [req.params.contentId]);
    } catch (updateError) {
      console.error('更新内容状态失败:', updateError);
    }
    
    // 检查是否是数据库错误
    if (error.message && error.message.includes('Object not found')) {
      return res.status(404).json({
        success: false,
        message: '内容不存在',
        error: `找不到ID为 ${req.params.contentId} 的内容记录`,
        contentId: req.params.contentId
      });
    }
    
    // 返回详细的错误信息
    const errorResponse = {
      success: false,
      message: '生成无声视频失败',
      error: error.message || String(error),
      contentId: req.params.contentId
    };
    
    // 在开发环境下返回更多调试信息
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      errorResponse.stack = error.stack;
      errorResponse.details = JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    
    res.status(500).json(errorResponse);
  }
});

// 步骤3: 生成视频（将无声视频与音频合并）
// 生成字幕文件的辅助函数（使用腾讯云语音识别）
// 字幕提前量（秒），让字幕提前出现以匹配音频
const SUBTITLE_ADVANCE_TIME = 0.7; // 提前0.7秒，增加提前量以改善同步

// 检查FFmpeg版本和subtitles滤镜支持情况
async function checkFFmpegSubtitlesSupport() {
  return new Promise((resolve) => {
    ffmpeg.ffprobe('', (err) => {
      // 忽略错误，只是检查FFmpeg是否可用
      const { execSync } = require('child_process');
      try {
        // 检查FFmpeg版本
        const versionOutput = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 5000 });
        const versionMatch = versionOutput.match(/ffmpeg version (\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        
        // 检查subtitles滤镜是否支持charenc参数
        try {
          const filterHelp = execSync('ffmpeg -h filter=subtitles', { encoding: 'utf8', timeout: 5000 });
          const supportsCharenc = filterHelp.includes('charenc') || filterHelp.includes('character encoding');
          resolve({ version, supportsCharenc, available: true });
        } catch (e) {
          // 如果无法获取帮助信息，假设支持（较新版本都支持）
          resolve({ version, supportsCharenc: true, available: true });
        }
      } catch (e) {
        console.warn('⚠️ 无法检查FFmpeg版本:', e.message);
        resolve({ version: 'unknown', supportsCharenc: true, available: false });
      }
    });
  });
}

// 转义字幕文件路径，用于FFmpeg subtitles滤镜
// 在Docker容器中，路径需要特殊处理以确保FFmpeg能正确读取
function escapeSubtitlePath(filePath) {
  if (!filePath) return '';
  
  // 统一使用正斜杠（Docker容器中使用正斜杠）
  let escaped = filePath.replace(/\\/g, '/');
  
  // FFmpeg subtitles滤镜路径转义规则：
  // 1. 在单引号字符串中，单引号需要转义为 '\''
  // 2. 冒号、方括号、逗号等特殊字符在路径中不需要转义（除非在filter表达式中）
  // 3. 确保路径是绝对路径或相对于工作目录的路径
  
  // 转义单引号（在单引号字符串中）
  escaped = escaped.replace(/'/g, "'\\''");
  
  console.log(`📝 字幕路径转义: 原始=${filePath}, 转义后=${escaped}`);
  
  return escaped;
}

async function generateSubtitleFile(audioUrl, language, tempDir, contentId, timestamp) {
  try {
    console.log(`📝 开始使用阿里云DashScope Paraformer-v1生成${language === 'zh' ? '中文' : '英文'}字幕，音频URL: ${audioUrl}`);
    
    const ALIYUN_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-abe50fde91f242a682c8c6c189310db5';
    const SUBMIT_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
    
    // 根据语言设置language_hints参数
    // paraformer-v1支持中文、英文，以及中英文混合
    const languageHints = language === 'zh' ? ['zh'] : ['en'];
    
    // 提交语音识别任务
    console.log(`🎤 创建阿里云DashScope Paraformer-v1识别任务，语言: ${languageHints.join(',')}`);
    const submitTaskParams = {
      model: 'paraformer-v1',
      input: {
        file_urls: [audioUrl]
      },
      parameters: {
        channel_id: [0], // 单声道
        language_hints: languageHints
      }
    };
    
    console.log('📋 提交任务请求参数:', JSON.stringify(submitTaskParams, null, 2));
    
    const submitResponse = await fetch(SUBMIT_TASK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ALIYUN_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(submitTaskParams)
    });
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`提交ASR任务失败: ${submitResponse.status} ${submitResponse.statusText} - ${errorText}`);
    }
    
    const submitData = await submitResponse.json();
    console.log('✅ 提交任务响应:', JSON.stringify(submitData, null, 2));
    
    const taskId = submitData.output?.task_id;
    if (!taskId) {
      throw new Error('ASR任务提交成功但未返回task_id');
    }
    
    console.log(`✅ ASR任务已提交，TaskId: ${taskId}`);
    
    // 查询任务状态接口
    const QUERY_TASK_URL = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    
    // 轮询查询任务状态（最多等待10分钟）
    const maxAttempts = 120; // 最多查询120次
    const pollInterval = 5000; // 每5秒查询一次
    let recognitionResult = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      console.log(`📊 查询ASR任务状态 (${attempt + 1}/${maxAttempts})，TaskId: ${taskId}`);
      
      const queryResponse = await fetch(QUERY_TASK_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ALIYUN_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable'
        }
      });
      
      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        throw new Error(`查询ASR任务状态失败: ${queryResponse.status} ${queryResponse.statusText} - ${errorText}`);
      }
      
      const queryData = await queryResponse.json();
      console.log(`📊 查询结果 (${attempt + 1}/${maxAttempts}):`, JSON.stringify(queryData, null, 2));
      
      const status = queryData.output?.task_status;
      if (status === 'SUCCEEDED') {
        recognitionResult = queryData.output;
        console.log('✅ ASR任务完成，获取到识别结果');
        break;
      } else if (status === 'FAILED') {
        const errorMsg = queryData.output?.message || '未知错误';
        throw new Error(`ASR任务失败: ${errorMsg}`);
      }
      // status === 'RUNNING' 或 'PENDING' 表示任务处理中，继续轮询
    }
    
    if (!recognitionResult) {
      throw new Error('ASR任务超时，未能获取识别结果');
    }
    
    // 解析识别结果
    // Paraformer返回格式：results数组，每个元素包含file_url和transcription_url
    const results = recognitionResult.results || [];
    if (results.length === 0) {
      throw new Error('ASR识别结果为空');
    }
    
    // 获取第一个结果的transcription_url（如果存在）
    let transcriptionUrl = null;
    let transcriptionText = null;
    
    for (const result of results) {
      if (result.subtask_status === 'SUCCEEDED' && result.transcription_url) {
        transcriptionUrl = result.transcription_url;
        break;
      } else if (result.subtask_status === 'SUCCEEDED' && result.transcription) {
        transcriptionText = result.transcription;
        break;
    }
    }
    
    // 如果有transcription_url，下载识别结果
    if (transcriptionUrl) {
      console.log('📥 下载识别结果，URL:', transcriptionUrl);
      const transcriptionResponse = await fetch(transcriptionUrl);
      if (!transcriptionResponse.ok) {
        throw new Error(`下载识别结果失败: ${transcriptionResponse.statusText}`);
      }
      transcriptionText = await transcriptionResponse.text();
    }
    
    if (!transcriptionText) {
      // 如果没有transcription_url，尝试从results中提取文本
      transcriptionText = results.map(r => r.transcription || '').filter(t => t).join('\n');
    }
    
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      throw new Error('ASR识别结果为空');
    }
    
    console.log('📝 ASR识别结果文本:', transcriptionText.substring(0, 500));
    console.log('📝 ASR识别结果长度:', transcriptionText.length);
    
    // 将识别结果转换为SRT格式
    const srtPath = path.join(tempDir, `subtitle_${contentId}_${language}_${timestamp}.srt`);
    const srtContent = convertParaformerResultToSRT(transcriptionText, language);
    
    // 确保使用UTF-8 BOM编码，避免中文乱码
    // 使用Buffer确保UTF-8 BOM正确写入
    const BOM = Buffer.from('\uFEFF', 'utf8');
    const srtContentBuffer = Buffer.from(srtContent, 'utf8');
    const srtContentWithBOM = Buffer.concat([BOM, srtContentBuffer]);
    
    await fs.writeFile(srtPath, srtContentWithBOM);
    console.log(`✅ 字幕文件生成成功: ${srtPath}`);
    console.log(`📝 字幕文件编码: UTF-8 with BOM`);
    console.log(`📝 字幕内容预览（前200字符）: ${srtContent.substring(0, 200)}`);
    
    return srtPath;
  } catch (error) {
    console.error('❌ 使用阿里云DashScope Paraformer-v1生成字幕失败:', error);
    console.error('❌ 错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('❌ 错误消息:', error.message);
    console.error('❌ 错误堆栈:', error.stack);
    // 如果生成失败，返回null，视频仍然可以生成，只是没有字幕
    console.warn('⚠️ 字幕生成失败，视频将继续生成但不包含字幕');
    return null;
  }
}

// 将阿里云DashScope Paraformer识别结果转换为SRT格式
function convertParaformerResultToSRT(transcriptionText, language) {
  // Paraformer返回的transcription可能是：
  // 1. JSON格式，包含sentences数组，每个sentence包含text和start_time/end_time
  // 2. JSON格式，包含words数组，每个word包含word和start_time/end_time
  // 3. 纯文本格式
  // 4. 带时间戳的文本格式
  
  let srtContent = '';
  let index = 1;
  
  try {
    // 先尝试解析JSON格式
    let parsedData = null;
    try {
      parsedData = JSON.parse(transcriptionText);
    } catch (e) {
      // 不是JSON格式，继续处理
    }
    
    if (parsedData && parsedData.transcripts && Array.isArray(parsedData.transcripts)) {
      // JSON格式，包含transcripts数组（Paraformer标准格式）
      console.log('📋 Paraformer结果JSON格式，transcripts数量:', parsedData.transcripts.length);
      
      // 检查transcripts数组是否包含时间戳信息
      const firstTranscript = parsedData.transcripts[0];
      const hasTimestamps = firstTranscript && (
        firstTranscript.start_time !== undefined || 
        firstTranscript.end_time !== undefined ||
        firstTranscript.start !== undefined ||
        firstTranscript.end !== undefined ||
        (firstTranscript.words && Array.isArray(firstTranscript.words) && firstTranscript.words.length > 0)
      );
      
      if (hasTimestamps && firstTranscript.words && Array.isArray(firstTranscript.words)) {
        // 如果有words数组，使用单词级别的时间戳（最精确）
        console.log('📋 使用单词级别时间戳');
        let currentSentence = '';
        let sentenceStartTime = null;
        let sentenceEndTime = null;
        
        for (const word of firstTranscript.words) {
          if (!word.word || !word.word.trim()) continue;
          
          const wordStartTime = (word.start_time || word.start || 0) / 1000; // 转换为秒
          const wordEndTime = (word.end_time || word.end || wordStartTime * 1000 + 500) / 1000;
          
          if (sentenceStartTime === null) {
            sentenceStartTime = wordStartTime;
          }
          sentenceEndTime = wordEndTime;
          
          currentSentence += word.word.trim() + ' ';
          
          // 如果遇到标点符号或句子结束，开始新的字幕块
          if (/[。！？.!?]/.test(word.word)) {
            if (currentSentence.trim()) {
              const startTimeStr = formatSRTTime(sentenceStartTime);
              const endTimeStr = formatSRTTime(sentenceEndTime);
              
              srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${currentSentence.trim()}\n\n`;
              index++;
            }
            currentSentence = '';
            sentenceStartTime = null;
            sentenceEndTime = null;
          }
        }
        
        // 处理最后一句
        if (currentSentence.trim() && sentenceStartTime !== null) {
          const startTimeStr = formatSRTTime(sentenceStartTime);
          const endTimeStr = formatSRTTime(sentenceEndTime || sentenceStartTime + 3);
          
          srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${currentSentence.trim()}\n\n`;
        }
      } else {
        // 如果没有精确的时间戳，使用音频总时长按比例分配
        // 获取音频总时长（优先使用content_duration_in_milliseconds，否则使用properties中的时长）
        let totalDurationMs = 0;
        if (parsedData.transcripts.length > 0 && parsedData.transcripts[0].content_duration_in_milliseconds) {
          totalDurationMs = parsedData.transcripts[0].content_duration_in_milliseconds;
        } else if (parsedData.properties && parsedData.properties.original_duration_in_milliseconds) {
          totalDurationMs = parsedData.properties.original_duration_in_milliseconds;
        }
        
        const totalDurationSeconds = totalDurationMs / 1000;
        console.log(`⏱️ 音频总时长: ${totalDurationSeconds}秒 (${totalDurationMs}毫秒)`);
        
        // 不使用提前量，直接使用音频实际时长按比例分配时间戳
        let currentTime = 0;
        for (const transcript of parsedData.transcripts) {
        if (!transcript.text || !transcript.text.trim()) continue;
        
        const text = transcript.text.trim();
        const totalTextLength = text.length;
        
        // 智能分段文本，确保单词完整性
        const validSentences = [];
        
        if (language === 'en') {
          // 英文：按句子分段，确保单词不被分割
          // 先按句号、问号、感叹号分段
          const sentences = text.split(/([.!?]\s+)/);
          
          for (let i = 0; i < sentences.length; i += 2) {
            let sentence = sentences[i]?.trim();
            const punctuation = sentences[i + 1]?.trim() || '';
            
            if (!sentence) continue;
            
            // 如果句子太长（超过80个字符），按逗号、分号、冒号分段
            if (sentence.length > 80) {
              const parts = sentence.split(/([,;:]\s+)/);
              for (let j = 0; j < parts.length; j += 2) {
                let part = parts[j]?.trim();
                const partPunctuation = parts[j + 1]?.trim() || '';
                if (part) {
                  // 确保单词完整性：如果part以空格结尾，保留；否则添加空格
                  const fullPart = part + partPunctuation;
                  validSentences.push({
                    text: fullPart,
                    length: fullPart.length
                  });
                }
              }
            } else {
              // 短句子直接添加
              const fullSentence = sentence + punctuation;
              validSentences.push({
                text: fullSentence,
                length: fullSentence.length
              });
            }
          }
        } else {
          // 中文：按标点符号分段
          const sentences = text.split(/([。！？.!?])/);
          
          for (let i = 0; i < sentences.length; i += 2) {
            const sentence = sentences[i]?.trim();
            const punctuation = sentences[i + 1] || '';
            if (sentence) {
              validSentences.push({
                text: sentence + punctuation,
                length: (sentence + punctuation).length
              });
            }
          }
        }
        
        // 按文本长度比例分配时间戳
        let processedLength = 0;
        for (const sentenceObj of validSentences) {
          const sentence = sentenceObj.text;
          const sentenceLength = sentenceObj.length;
          
          // 计算句子在总文本中的比例
          const textRatio = sentenceLength / totalTextLength;
          const sentenceDuration = totalDurationSeconds * textRatio;
          
          // 确保最小显示时长为0.5秒，最大不超过剩余时长
          const minDuration = 0.5;
          const remainingDuration = totalDurationSeconds - Math.max(0, currentTime);
          const actualDuration = Math.max(minDuration, Math.min(sentenceDuration, remainingDuration));
          
          // 确保开始时间不为负数（第一个字幕从0开始）
          const sentenceStartTime = Math.max(0, currentTime);
          const sentenceEndTime = sentenceStartTime + actualDuration;
          
          const sentenceStartTimeStr = formatSRTTime(sentenceStartTime);
          const sentenceEndTimeStr = formatSRTTime(sentenceEndTime);
          
          srtContent += `${index}\n${sentenceStartTimeStr} --> ${sentenceEndTimeStr}\n${sentence}\n\n`;
          index++;
          
          // 更新currentTime，不使用提前量
          currentTime = sentenceEndTime;
          processedLength += sentenceLength;
          
          // 如果已经处理完所有文本，停止
          if (currentTime >= totalDurationSeconds) {
            break;
          }
        }
        
        // 确保最后一个字幕的结束时间不超过总时长
        if (currentTime > totalDurationSeconds) {
          currentTime = totalDurationSeconds;
        }
        }
      }
    } else if (parsedData && parsedData.sentences && Array.isArray(parsedData.sentences)) {
      // JSON格式，包含sentences数组
      console.log('📋 Paraformer结果JSON格式，sentences数量:', parsedData.sentences.length);
      
      for (const sentence of parsedData.sentences) {
        if (!sentence.text || !sentence.text.trim()) continue;
        
        const startTime = sentence.start_time || sentence.start || 0;
        const endTime = sentence.end_time || sentence.end || startTime + 3;
        
        const startTimeStr = formatSRTTime(startTime);
        const endTimeStr = formatSRTTime(endTime);
        
        srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${sentence.text.trim()}\n\n`;
        index++;
      }
    } else if (parsedData && parsedData.words && Array.isArray(parsedData.words)) {
      // JSON格式，包含words数组（单词级别的时间戳）
      console.log('📋 Paraformer结果JSON格式，words数量:', parsedData.words.length);
      
      // 按句子分组words
      let currentSentence = '';
      let sentenceStartTime = null;
      let sentenceEndTime = null;
      
      for (const word of parsedData.words) {
        if (!word.word || !word.word.trim()) continue;
        
        const wordStartTime = word.start_time || word.start || 0;
        const wordEndTime = word.end_time || word.end || wordStartTime + 0.5;
        
        if (sentenceStartTime === null) {
          sentenceStartTime = wordStartTime;
        }
        sentenceEndTime = wordEndTime;
        
        currentSentence += word.word.trim();
        
        // 如果遇到标点符号或句子结束，开始新的字幕块
        if (/[。！？.!?]/.test(word.word)) {
          if (currentSentence.trim()) {
            const startTimeStr = formatSRTTime(sentenceStartTime);
            const endTimeStr = formatSRTTime(sentenceEndTime);
            
            srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${currentSentence.trim()}\n\n`;
            index++;
          }
          currentSentence = '';
          sentenceStartTime = null;
          sentenceEndTime = null;
        }
      }
      
      // 处理最后一句
      if (currentSentence.trim() && sentenceStartTime !== null) {
        const startTimeStr = formatSRTTime(sentenceStartTime);
        const endTimeStr = formatSRTTime(sentenceEndTime || sentenceStartTime + 3);
        
        srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${currentSentence.trim()}\n\n`;
      }
    } else {
      // 纯文本格式，需要按标点符号分段
      console.log('📋 Paraformer结果纯文本格式');
      
      // 按标点符号分段
      const sentences = transcriptionText.split(/([。！？.!?])/);
      let currentTime = 0;
      const timePerChar = 0.1; // 假设每个字符0.1秒
      
      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i]?.trim();
        const punctuation = sentences[i + 1] || '';
        
        if (!sentence) continue;
        
        const fullSentence = sentence + punctuation;
        const duration = fullSentence.length * timePerChar;
        const startTime = currentTime;
        const endTime = currentTime + duration;
        
        const startTimeStr = formatSRTTime(startTime);
        const endTimeStr = formatSRTTime(endTime);
        
        srtContent += `${index}\n${startTimeStr} --> ${endTimeStr}\n${fullSentence}\n\n`;
        index++;
        
        currentTime = endTime;
      }
    }
    
    if (!srtContent.trim()) {
      throw new Error('无法从Paraformer结果中提取字幕内容');
    }
    
    return srtContent;
  } catch (error) {
    console.error('❌ 解析Paraformer结果失败:', error);
    throw new Error(`解析Paraformer识别结果失败: ${error.message}`);
  }
}

// 格式化SRT时间戳（秒数转换为HH:MM:SS,mmm格式）
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// 将腾讯云ASR识别结果转换为SRT格式（保留作为备用）
function convertAsrResultToSRT(resultText) {
  // ASR返回格式可能是多种：
  // 格式1: "00:00:00,000 --> 00:00:03,000 第一段文字\n00:00:03,000 --> 00:00:06,000 第二段文字"
  // 格式2: JSON格式，包含时间戳和文本数组
  // 格式3: 纯文本，需要根据时间戳分段
  
  let srtContent = '';
  let index = 1;
  
  try {
    // 先尝试解析JSON格式
    let parsedData = null;
    try {
      parsedData = typeof resultText === 'string' ? JSON.parse(resultText) : resultText;
    } catch (e) {
      // 不是JSON格式，继续按文本处理
    }
    
    if (parsedData && typeof parsedData === 'object') {
      // JSON格式：可能包含words、sentences等字段
      console.log('📋 ASR结果JSON格式:', JSON.stringify(parsedData, null, 2));
      
      // 尝试提取words数组（包含时间戳的单词）
      if (parsedData.words && Array.isArray(parsedData.words)) {
        // 按照标点符号分段，同时保证音频和字幕完全同步
        // 使用ASR返回的单词时间戳，完全按照音频时间同步
        const subtitleBlocks = [];
        let currentBlock = { words: [], startTime: null, endTime: null };
        const MAX_TIME_GAP = 2.0; // 如果单词间隔超过2.0秒，也分段（作为备用规则）
        const MAX_CHARS_PER_BLOCK = 84; // 每块最多84字符，严格控制不超过3行（每行28字符，3行约84字符）
        
        // 定义句子结束标点符号（英文和中文）
        const sentenceEndPunctuation = /[.!?。！？]/;
        // 定义其他标点符号（逗号、分号等，也可以作为分段点）
        const otherPunctuation = /[,;，；：:]/;
        
        for (let i = 0; i < parsedData.words.length; i++) {
          const word = parsedData.words[i];
          const wordStartTime = word.start_time !== undefined ? word.start_time / 1000 : null;
          const wordEndTime = word.end_time !== undefined ? word.end_time / 1000 : null;
          const wordText = word.word || word.text || '';
          
          if (wordText.trim().length === 0) {
            continue;
          }
          
          // 检查当前单词是否包含标点符号
          const hasSentenceEndPunct = sentenceEndPunctuation.test(wordText);
          const hasOtherPunct = otherPunctuation.test(wordText);
          
          // 计算添加当前单词后的总字符数（包括空格）
          const currentText = currentBlock.words.join('');
          const newText = currentText + (currentText ? ' ' : '') + wordText;
          const newTextLength = newText.length;
          
          // 检查是否需要开始新的字幕块（在添加当前单词之前）
          // 注意：标点符号分段在添加单词后处理，这里只处理字符数和时间间隔
          let shouldStartNewBlock = false;
          
          // 1. 如果字符数超过限制，分段
          if (newTextLength > MAX_CHARS_PER_BLOCK && currentBlock.words.length > 0) {
            shouldStartNewBlock = true;
          }
          // 2. 如果时间间隔太大，分段（备用规则）
          else if (currentBlock.words.length > 0 && currentBlock.endTime !== null && wordStartTime !== null) {
            const timeGap = wordStartTime - currentBlock.endTime;
            if (timeGap > MAX_TIME_GAP) {
              shouldStartNewBlock = true;
            }
          }
          
          // 如果需要开始新块（字符数或时间间隔），先保存当前块
          if (shouldStartNewBlock && currentBlock.words.length > 0 && currentBlock.startTime !== null) {
            subtitleBlocks.push({
              text: currentBlock.words.join(''),
              startTime: Math.max(0, currentBlock.startTime - SUBTITLE_ADVANCE_TIME),
              endTime: currentBlock.endTime || 0
            });
            currentBlock = { words: [], startTime: null, endTime: null };
          }
          
          // 添加单词到当前块
          if (currentBlock.startTime === null && wordStartTime !== null) {
            currentBlock.startTime = wordStartTime;
          }
          if (wordEndTime !== null) {
            currentBlock.endTime = wordEndTime;
          }
          currentBlock.words.push(wordText);
          
          // 如果当前单词包含句子结束标点符号，立即分段（在添加单词后）
          // 这样可以确保标点符号包含在当前块的末尾
          if (hasSentenceEndPunct && currentBlock.words.length > 0 && currentBlock.startTime !== null) {
            subtitleBlocks.push({
              text: currentBlock.words.join(''),
              startTime: Math.max(0, currentBlock.startTime - SUBTITLE_ADVANCE_TIME),
              endTime: currentBlock.endTime || 0
            });
            currentBlock = { words: [], startTime: null, endTime: null };
          }
        }
        
        // 添加最后一个块
        if (currentBlock.words.length > 0 && currentBlock.startTime !== null) {
          subtitleBlocks.push({
            text: currentBlock.words.join(''),
            startTime: Math.max(0, currentBlock.startTime - SUBTITLE_ADVANCE_TIME),
            endTime: currentBlock.endTime || 0
          });
        }
        
        // 生成SRT（完全按照ASR返回的时间戳，不限制字数）
        // 确保时间戳不重叠：上一句消失后再显示下一句
        for (let i = 0; i < subtitleBlocks.length; i++) {
          const block = subtitleBlocks[i];
          let endTime = block.endTime;
          
          // 如果下一句存在且开始时间早于当前句的结束时间，调整当前句的结束时间
          if (i < subtitleBlocks.length - 1) {
            const nextStartTime = subtitleBlocks[i + 1].startTime;
            if (endTime > nextStartTime) {
              endTime = nextStartTime;
            }
          }
          
          // 确保结束时间大于开始时间
          if (endTime <= block.startTime) {
            endTime = block.startTime + 0.1; // 至少显示0.1秒
          }
          
          srtContent += `${index}\n`;
          srtContent += `${formatSRTTime(block.startTime)} --> ${formatSRTTime(endTime)}\n`;
          srtContent += `${wrapSubtitleText(block.text)}\n\n`;
          index++;
        }
      } else if (parsedData.sentences && Array.isArray(parsedData.sentences)) {
        // 如果有sentences数组
        // 确保时间戳不重叠：上一句消失后再显示下一句
        const sentences = parsedData.sentences;
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          const startTime = Math.max(0, (sentence.start_time || sentence.startTime || 0) / 1000 - SUBTITLE_ADVANCE_TIME);
          let endTime = (sentence.end_time || sentence.endTime || 0) / 1000;
          const text = sentence.text || sentence.word || '';
          
          // 如果下一句存在且开始时间早于当前句的结束时间，调整当前句的结束时间
          if (i < sentences.length - 1) {
            const nextStartTime = Math.max(0, (sentences[i + 1].start_time || sentences[i + 1].startTime || 0) / 1000 - SUBTITLE_ADVANCE_TIME);
            if (endTime > nextStartTime) {
              endTime = nextStartTime;
            }
          }
          
          // 确保结束时间大于开始时间
          if (endTime <= startTime) {
            endTime = startTime + 0.1; // 至少显示0.1秒
          }
          
          srtContent += `${index}\n`;
          srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
          srtContent += `${wrapSubtitleText(text)}\n\n`;
          index++;
        }
      }
    }
    
    // 如果不是JSON格式或JSON解析失败，尝试按行解析文本格式
    if (srtContent.length === 0) {
      const textStr = typeof resultText === 'string' ? resultText : JSON.stringify(resultText);
      const lines = textStr.split('\n').filter(line => line.trim().length > 0);
      
      // 先收集所有字幕条目
      const subtitleEntries = [];
      
      for (const line of lines) {
        // 格式1: [M:SS.mmm,M:SS.mmm]  文本内容（腾讯云ASR标准格式）
        // 例如：[0:0.040,0:22.140]  美国花卉产业的崛起...
        const bracketTimeMatch = line.match(/\[(\d+):(\d+\.\d+),(\d+):(\d+\.\d+)\]\s*(.*)/);
        
        if (bracketTimeMatch) {
          const [, startMin, startSec, endMin, endSec, text] = bracketTimeMatch;
          
          // 转换为秒数，并提前字幕时间
          const startSeconds = parseInt(startMin) * 60 + parseFloat(startSec) - SUBTITLE_ADVANCE_TIME;
          const endSeconds = parseInt(endMin) * 60 + parseFloat(endSec);
          
          // 清理文本：移除多余空格，过滤掉明显不是文本的内容
          const cleanText = cleanSubtitleText(text);
          
          if (cleanText && cleanText.trim().length > 0) {
            subtitleEntries.push({
              startTime: Math.max(0, startSeconds),
              endTime: endSeconds,
              text: cleanText
            });
          }
          continue;
        }
        
        // 格式2: HH:MM:SS,mmm --> HH:MM:SS,mmm 文字（标准SRT格式）
        const timeTextMatch = line.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*[-–—>]+\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*(.*)/);
        
        if (timeTextMatch) {
          let [, startTime, endTime, text] = timeTextMatch;
          // 统一时间格式（将.替换为,）
          startTime = startTime.replace('.', ',');
          endTime = endTime.replace('.', ',');
          
          // 提前字幕开始时间
          const startSeconds = parseSRTTime(startTime) - SUBTITLE_ADVANCE_TIME;
          const endSeconds = parseSRTTime(endTime);
          
          const cleanText = cleanSubtitleText(text);
          if (cleanText && cleanText.trim().length > 0) {
            subtitleEntries.push({
              startTime: Math.max(0, startSeconds),
              endTime: endSeconds,
              text: cleanText
            });
          }
          continue;
        }
        
        // 格式3: 00:00:00.000-00:00:03.000 文字（其他时间格式）
        const altMatch = line.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})[-–—](\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*(.*)/);
        if (altMatch) {
          let [, startTime, endTime, text] = altMatch;
          startTime = startTime.replace('.', ',');
          endTime = endTime.replace('.', ',');
          
          const startSeconds = parseSRTTime(startTime);
          const endSeconds = parseSRTTime(endTime);
          
          const cleanText = cleanSubtitleText(text);
          if (cleanText && cleanText.trim().length > 0) {
            subtitleEntries.push({
              startTime: Math.max(0, startSeconds),
              endTime: endSeconds,
              text: cleanText
            });
          }
        }
      }
      
      // 确保时间戳不重叠：上一句消失后再显示下一句
      for (let i = 0; i < subtitleEntries.length; i++) {
        const entry = subtitleEntries[i];
        let endTime = entry.endTime;
        
        // 如果下一句存在且开始时间早于当前句的结束时间，调整当前句的结束时间
        if (i < subtitleEntries.length - 1) {
          const nextStartTime = subtitleEntries[i + 1].startTime;
          if (endTime > nextStartTime) {
            endTime = nextStartTime;
          }
        }
        
        // 确保结束时间大于开始时间
        if (endTime <= entry.startTime) {
          endTime = entry.startTime + 0.1; // 至少显示0.1秒
        }
        
        srtContent += `${index}\n`;
        srtContent += `${formatSRTTime(entry.startTime)} --> ${formatSRTTime(endTime)}\n`;
        srtContent += `${wrapSubtitleText(entry.text)}\n\n`;
        index++;
      }
    }
    
    // 如果仍然没有解析到内容，使用简单分段方法
    if (srtContent.length === 0) {
      console.warn('⚠️ ASR结果无法解析为标准格式，使用简单分段方法');
      const textStr = typeof resultText === 'string' ? resultText : JSON.stringify(resultText);
      // 先清理文本，移除时间戳等
      const cleanedText = cleanSubtitleText(textStr);
      if (cleanedText && cleanedText.trim().length > 0) {
        // 简单分段方法：不再按标点符号分段，而是根据文本长度动态分配时间
        const sentences = cleanedText.split(/[。！？\n\.!?]+/).filter(s => s.trim().length > 0);
        let currentTime = Math.max(0, 0 - SUBTITLE_ADVANCE_TIME); // 从提前时间开始
        
        // 估算总时长（假设每分钟200字，或每字0.3秒）
        const totalChars = cleanedText.length;
        const estimatedTotalDuration = Math.max(10, totalChars * 0.3); // 至少10秒
        const timePerChar = estimatedTotalDuration / totalChars;
        
        for (const sentence of sentences) {
          const cleanSentence = cleanSubtitleText(sentence);
          if (cleanSentence && cleanSentence.trim().length > 0) {
            // 根据句子长度动态计算时长
            const sentenceDuration = Math.max(2, cleanSentence.length * timePerChar); // 至少2秒
            
            const startTime = formatSRTTime(Math.max(0, currentTime));
            currentTime += sentenceDuration;
            const endTime = formatSRTTime(currentTime);
            
            srtContent += `${index}\n`;
            srtContent += `${startTime} --> ${endTime}\n`;
            srtContent += `${wrapSubtitleText(cleanSentence)}\n\n`;
            index++;
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ 解析ASR结果失败:', error);
    throw new Error(`解析ASR识别结果失败: ${error.message}`);
  }
  
  if (srtContent.length === 0) {
    throw new Error('ASR识别结果无法转换为SRT格式');
  }
  
  // 直接返回ASR生成的字幕，不再进行额外的分段处理
  // 这样可以保持与音频的同步性
  return srtContent;
}

// 按照标点符号分段字幕，压缩每屏字数
function segmentSubtitlesByPunctuation(srtContent) {
  // 解析现有的SRT内容
  const subtitleBlocks = [];
  const lines = srtContent.split('\n');
  
  let currentBlock = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 空行表示一个字幕块结束
    if (line === '') {
      if (currentBlock) {
        subtitleBlocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }
    
    // 数字行，开始新的字幕块
    if (/^\d+$/.test(line)) {
      if (currentBlock) {
        subtitleBlocks.push(currentBlock);
      }
      currentBlock = {
        index: parseInt(line),
        timeRange: '',
        text: ''
      };
      continue;
    }
    
    // 时间范围行
    if (line.includes('-->')) {
      if (currentBlock) {
        currentBlock.timeRange = line;
      }
      continue;
    }
    
    // 文本行
    if (currentBlock && !currentBlock.timeRange) {
      // 如果还没有时间范围，这行应该是时间范围
      if (line.includes('-->')) {
        currentBlock.timeRange = line;
      }
    } else if (currentBlock) {
      // 已经有时间范围，这是文本内容
      if (currentBlock.text) {
        currentBlock.text += ' ' + line;
      } else {
        currentBlock.text = line;
      }
    }
  }
  
  // 添加最后一个块
  if (currentBlock) {
    subtitleBlocks.push(currentBlock);
  }
  
  // 对每个字幕块进行分段
  const segmentedBlocks = [];
  
  for (const block of subtitleBlocks) {
    // 解析时间范围
    const timeMatch = block.timeRange.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) {
      // 如果无法解析时间，直接使用原块
      segmentedBlocks.push(block);
      continue;
    }
    
    const startTimeStr = timeMatch[1];
    const endTimeStr = timeMatch[2];
    
    // 将时间字符串转换为秒数，并提前字幕开始时间
    const startSeconds = Math.max(0, parseSRTTime(startTimeStr) - SUBTITLE_ADVANCE_TIME);
    const endSeconds = parseSRTTime(endTimeStr);
    const duration = endSeconds - startSeconds;
    
    // 按照标点符号分段文本
    // 中英文标点：。！？，、；：. ! ? , ; :
    const segments = splitTextByPunctuation(block.text);
    
    if (segments.length === 0) {
      segmentedBlocks.push({
        ...block,
        timeRange: `${formatSRTTime(startSeconds)} --> ${endTimeStr}`
      });
      continue;
    }
    
    // 如果只有一个段落，直接使用（但调整开始时间）
    if (segments.length === 1) {
      segmentedBlocks.push({
        ...block,
        timeRange: `${formatSRTTime(startSeconds)} --> ${endTimeStr}`
      });
      continue;
    }
    
    // 多个段落，根据字数比例重新分配时间
    // 计算每个段落的字数（中文字符按1个字符计算，英文单词按平均长度计算）
    const segmentLengths = segments.map(seg => {
      const text = seg.trim();
      if (!text) return 0;
      // 中文字符数 + 英文单词数（按平均4个字符一个单词估算）
      const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0).length;
      return chineseChars + englishWords * 2; // 英文单词权重为2
    });
    
    const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);
    
    if (totalLength === 0) {
      // 如果没有有效字数，平均分配时间
      const timePerSegment = duration / segments.length;
      let currentTime = startSeconds;
      for (let i = 0; i < segments.length; i++) {
        const segmentText = segments[i].trim();
        if (segmentText.length === 0) continue;
        const segmentStartTime = currentTime;
        const segmentEndTime = Math.min(currentTime + timePerSegment, endSeconds);
        segmentedBlocks.push({
          index: block.index + (i > 0 ? i * 0.001 : 0),
          timeRange: `${formatSRTTime(segmentStartTime)} --> ${formatSRTTime(segmentEndTime)}`,
          text: segmentText
        });
        currentTime = segmentEndTime;
        if (currentTime >= endSeconds) break;
      }
    } else {
      // 设置最小和最大停留时长（秒）
      const MIN_DURATION = 1.5; // 最短1.5秒
      const MAX_DURATION = 8.0; // 最长8秒
      
      // 先按字数比例计算基础时长
      const baseDurations = segmentLengths.map(len => {
        return (len / totalLength) * duration;
      });
      
      // 应用最小和最大时长限制
      const adjustedDurations = baseDurations.map(dur => {
        return Math.max(MIN_DURATION, Math.min(MAX_DURATION, dur));
      });
      
      // 如果调整后的总时长超过原始时长，按比例缩放
      const totalAdjustedDuration = adjustedDurations.reduce((sum, d) => sum + d, 0);
      const scaleFactor = duration / Math.max(totalAdjustedDuration, duration);
      const finalDurations = adjustedDurations.map(dur => dur * scaleFactor);
      
      let currentTime = startSeconds;
      
      for (let i = 0; i < segments.length; i++) {
        const segmentText = segments[i].trim();
        if (segmentText.length === 0) continue;
        
        let segmentDuration = finalDurations[i];
        
        // 确保不超过剩余时间
        const remainingTime = endSeconds - currentTime;
        segmentDuration = Math.min(segmentDuration, remainingTime);
        
        // 确保至少是最小时长（如果还有足够时间）
        if (remainingTime >= MIN_DURATION && segmentDuration < MIN_DURATION) {
          segmentDuration = Math.min(MIN_DURATION, remainingTime);
        }
        
        const segmentStartTime = currentTime;
        const segmentEndTime = Math.min(currentTime + segmentDuration, endSeconds);
        
        segmentedBlocks.push({
          index: block.index + (i > 0 ? i * 0.001 : 0), // 保持索引顺序
          timeRange: `${formatSRTTime(segmentStartTime)} --> ${formatSRTTime(segmentEndTime)}`,
          text: segmentText
        });
        
        currentTime = segmentEndTime;
        
        // 如果已经到达结束时间，停止分配
        if (currentTime >= endSeconds) break;
      }
    }
  }
  
  // 重新生成SRT内容
  let newSrtContent = '';
  let newIndex = 1;
  
  for (const block of segmentedBlocks) {
    newSrtContent += `${newIndex}\n`;
    newSrtContent += `${block.timeRange}\n`;
    newSrtContent += `${block.text}\n\n`;
    newIndex++;
  }
  
  return newSrtContent;
}

// 按照标点符号分段文本
function splitTextByPunctuation(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // 中英文标点符号：。！？，、；：. ! ? , ; :
  // 使用正则表达式分割，保留标点符号
  const segments = [];
  let currentSegment = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    currentSegment += char;
    
    // 遇到标点符号，结束当前段落
    if (/[。！？，、；：.!,;:?]/.test(char)) {
      const trimmed = currentSegment.trim();
      if (trimmed.length > 0) {
        segments.push(trimmed);
      }
      currentSegment = '';
    }
  }
  
  // 添加最后一段（如果有）
  const trimmed = currentSegment.trim();
  if (trimmed.length > 0) {
    segments.push(trimmed);
  }
  
  // 如果没有任何分段（没有标点），返回原文本
  if (segments.length === 0) {
    return [text.trim()];
  }
  
  return segments;
}

// 解析SRT时间格式为秒数
function parseSRTTime(timeStr) {
  // 格式：HH:MM:SS,mmm
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) {
    return 0;
  }
  
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  const milliseconds = parseInt(match[4]);
  
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

// 简单的字幕分段方法（备用方案）
function generateSimpleSubtitles(text, audioDurationSeconds) {
  const words = text.split(/[，。！？\s,\.!?]+/).filter(w => w.trim().length > 0);
  const segmentCount = Math.max(1, Math.floor(audioDurationSeconds / 3)); // 每3秒一段
  const wordsPerSegment = Math.ceil(words.length / segmentCount);
  
  const subtitles = [];
  let currentTime = Math.max(0, 0 - SUBTITLE_ADVANCE_TIME); // 从提前时间开始
  const timePerSegment = audioDurationSeconds / segmentCount;
  
  for (let i = 0; i < segmentCount; i++) {
    const startWords = i * wordsPerSegment;
    const endWords = Math.min(startWords + wordsPerSegment, words.length);
    const segmentText = words.slice(startWords, endWords).join(' ');
    
    if (segmentText.trim().length === 0) continue;
    
    const startTime = formatSRTTime(Math.max(0, currentTime));
    currentTime += timePerSegment;
    const endTime = formatSRTTime(Math.min(currentTime, audioDurationSeconds));
    
    subtitles.push({
      index: subtitles.length + 1,
      startTime: startTime,
      endTime: endTime,
      text: segmentText.trim()
    });
  }
  
  return { subtitles };
}

// 格式化SRT时间格式 (HH:MM:SS,mmm)
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

// 将分钟和秒转换为SRT时间格式
// 例如：convertToSRTTime(0, 22.140) -> "00:00:22,140"
function convertToSRTTime(minutes, seconds) {
  const totalSeconds = minutes * 60 + seconds;
  return formatSRTTime(totalSeconds);
}

// 清理字幕文本，过滤掉时间戳、数字等非文本内容
function cleanSubtitleText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let cleaned = text.trim();
  
  // 移除时间戳格式：[M:SS.mmm,M:SS.mmm] 或类似格式
  cleaned = cleaned.replace(/\[\d+:\d+\.\d+,\d+:\d+\.\d+\]/g, '');
  
  // 移除单独的时间戳格式，如 "0:31,140" 或 "0:31.140"
  cleaned = cleaned.replace(/\b\d+:\d+[,\.]\d+\b/g, '');
  
  // 移除纯数字（可能是误识别的时间戳）
  // 但保留数字在文本中的情况（如"19世纪"）
  cleaned = cleaned.replace(/\b\d+[,\.]\d+\b/g, ''); // 移除小数
  
  // 移除多余的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // 如果清理后只剩下数字或特殊字符，返回空字符串
  if (/^[\d\s,\.:;，。：；]+$/.test(cleaned)) {
    return '';
  }
  
  return cleaned;
}

// 智能换行字幕文本，确保不超出屏幕宽度
// 对于720宽度的视频，左右各50像素边距，可用宽度620像素
// 字体大小8，中文字符约8-10像素宽，每行最多约30-35个中文字符
// 英文按单词分割，不分开单词
function wrapSubtitleText(text, maxCharsPerLine = 28) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  const trimmed = text.trim();
  if (trimmed.length <= maxCharsPerLine) {
    return trimmed;
  }
  
  // 检测是否包含英文（包含字母和空格）
  const hasEnglish = /[a-zA-Z]/.test(trimmed);
  
  if (hasEnglish) {
    // 英文或中英混合：按单词和标点分割
    const lines = [];
    let currentLine = '';
    
    // 按空格、标点符号分割（保留分隔符）
    const tokens = trimmed.split(/(\s+|[，。！？、；：,.!?;:])/);
    
    for (const token of tokens) {
      if (!token) continue;
      
      // 如果是空格或标点
      if (/^[\s，。！？、；：,.!?;:]+$/.test(token)) {
        // 如果加上这个空格/标点后不超过限制，添加到当前行
        if (currentLine.length + token.length <= maxCharsPerLine) {
          currentLine += token;
        } else {
          // 当前行已满，换行
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = token;
        }
      } else {
        // 如果是单词或中文片段
        const tokenLength = token.length;
        
        // 如果单个token就超过限制（极长的单词），需要强制分割
        if (tokenLength > maxCharsPerLine) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
            currentLine = '';
          }
          // 强制分割长token
          let remaining = token;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.substring(0, maxCharsPerLine));
            remaining = remaining.substring(maxCharsPerLine);
          }
          currentLine = remaining;
        } else if (currentLine.length + tokenLength <= maxCharsPerLine) {
          // 可以添加到当前行
          currentLine += token;
        } else {
          // 当前行已满，换行
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
          currentLine = token;
        }
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
    
    return lines.join('\\N');
  } else {
    // 纯中文：按标点符号优先分割
    const punctuation = /[，。！？、；：]/;
    const lines = [];
    let currentLine = '';
    
    const segments = trimmed.split(/([，。！？、；：])/);
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (!segment) continue;
      
      if (punctuation.test(segment)) {
        currentLine += segment;
        if (currentLine.length > maxCharsPerLine) {
          if (currentLine.length > maxCharsPerLine * 2) {
            const mid = Math.floor(currentLine.length / 2);
            lines.push(currentLine.substring(0, mid));
            currentLine = currentLine.substring(mid);
          } else {
            lines.push(currentLine);
            currentLine = '';
          }
        }
      } else {
        if (currentLine.length + segment.length <= maxCharsPerLine) {
          currentLine += segment;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = '';
          }
          if (segment.length > maxCharsPerLine) {
            let remaining = segment;
            while (remaining.length > maxCharsPerLine) {
              lines.push(remaining.substring(0, maxCharsPerLine));
              remaining = remaining.substring(maxCharsPerLine);
            }
            currentLine = remaining;
          } else {
            currentLine = segment;
          }
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\\N');
  }
}

router.post('/content/:contentId/generate-video', async (req, res) => {
  // 立即设置CORS头，确保长时间运行的请求也能正确返回CORS响应
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // 获取请求参数
  const { audioUrl, language = 'zh', coverImageUrl, summary, summaryEn, chapterTitle, chapterTitleEn, includeOpeningText = true } = req.body;
  
  // 检测前端是否支持SSE（通过Accept头或useSSE参数）
  const acceptHeader = req.headers.accept || '';
  const useSSE = req.query.useSSE === 'true' || req.body.useSSE === true || acceptHeader.includes('text/event-stream');
  
  let sendProgress, cleanup, heartbeatInterval;
  
  if (useSSE) {
    // 设置流式响应头（Server-Sent Events），用于保持连接活跃并发送进度更新
    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    
    // 发送进度更新的辅助函数
    sendProgress = (message, progress = null) => {
      try {
        const data = JSON.stringify({ message, progress, timestamp: Date.now() });
        res.write(`data: ${data}\n\n`);
        console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
      } catch (err) {
        console.error('❌ 发送进度更新失败:', err);
      }
    };
    
    // 发送心跳以保持连接活跃（每30秒发送一次）
    heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // 清理函数
    cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  } else {
    // 兼容模式：使用JSON响应，但仍然发送进度更新（通过日志）
    res.header('Content-Type', 'application/json');
    sendProgress = (message, progress = null) => {
      console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
    };
    cleanup = () => {};
    console.log('⚠️ 前端不支持SSE，使用JSON响应模式（兼容模式）');
  }
  
  let tempVideoPath = null;
  let tempAudioPath = null;
  let tempOutputPath = null;
  let tempSubtitlePath = null;
  
  try {
    console.log('🚀 ========== 生成视频API被调用 ==========');
    console.log('📥 请求参数:', JSON.stringify(req.params, null, 2));
    console.log('📥 请求体:', JSON.stringify(req.body, null, 2));
    console.log('🌐 Origin:', origin);
    
    sendProgress('开始处理视频生成请求', 0);
    
    const { contentId } = req.params;
    const { audioUrl, language = 'zh' } = req.body;

    console.log(`📝 开始处理${language === 'zh' ? '中文' : '英文'}视频生成，ContentId: ${contentId}`);
    sendProgress(`Step 1: Preparing to generate audio and subtitles`, 5);

    // 获取内容信息
    let contentObj;
    try {
      contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    } catch (queryError) {
      console.error('❌ 查询内容失败:', queryError);
      return res.status(404).json({
        success: false,
        message: '内容不存在',
        error: queryError.message,
        contentId: contentId
      });
    }
    
    if (!contentObj) {
      console.error('❌ 内容不存在，ContentId:', contentId);
      return res.status(404).json({
        success: false,
        message: '内容不存在',
        contentId: contentId
      });
    }

    // 根据语言确定使用哪个音频URL
    let finalAudioUrl = audioUrl;
    if (!finalAudioUrl) {
      // 如果前端没有传递audioUrl，从content对象中获取
      if (language === 'en') {
        finalAudioUrl = contentObj.audioUrlEn;
        if (!finalAudioUrl) {
          return res.status(400).json({
            success: false,
            message: '缺少英文音频URL，请先生成英文音频'
          });
        }
      } else {
        finalAudioUrl = contentObj.audioUrl;
        if (!finalAudioUrl) {
          return res.status(400).json({
            success: false,
            message: '缺少中文音频URL，请先生成中文音频'
          });
        }
      }
    }

    console.log(`📻 使用的音频URL (${language === 'zh' ? '中文' : '英文'}):`, finalAudioUrl);
    
    if (!finalAudioUrl) {
      console.error('❌ 缺少音频URL');
      return res.status(400).json({
        success: false,
        message: `缺少${language === 'zh' ? '中文' : '英文'}音频URL`
      });
    }

    // 获取书籍信息以获取博客封面图
    const bookId = contentObj.bookId;
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '内容未关联到书籍'
      });
    }
    
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }
    
    // Use custom cover image if provided, otherwise use book's blog cover image
    const blogCoverUrl = book.blogCoverUrl;
    if (!coverImageUrl && !blogCoverUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please generate blog cover image or upload cover image first'
      });
    }
    
    // If custom summary/title is provided, use it for video generation (optional, not saved to database)
    if (summary) {
      console.log('📝 Using custom Chinese summary:', summary.substring(0, 50) + '...');
      // Note: This is not saved to database, only used for video generation
    }
    if (summaryEn) {
      console.log('📝 Using custom English summary:', summaryEn.substring(0, 50) + '...');
    }
    if (chapterTitle) {
      console.log('📝 Using custom Chinese title:', chapterTitle);
      // Note: This is not saved to database, only used for video generation
    }
    if (chapterTitleEn) {
      console.log('📝 Using custom English title:', chapterTitleEn);
      // Note: This is not saved to database, only used for video generation
    }

    // Update status to generating
    await db.update('ExtractedContent', { videoStatus: 'generating' }, 'id = ?', [contentId]);

    console.log(`📝 Starting ${language === 'zh' ? 'Chinese' : 'English'} video generation (using blog cover image)`);
    sendProgress('Step 1: Downloading audio file', 10);

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    
    // 下载音频（使用之前确定的finalAudioUrl）
    // 只将http替换为https，但保持域名的大小写
    if (finalAudioUrl.startsWith('http://')) {
      finalAudioUrl = finalAudioUrl.replace(/^http:\/\//, 'https://');
    }
    
    // 验证音频URL格式
    if (!finalAudioUrl || !finalAudioUrl.startsWith('http')) {
      console.error('❌ 音频URL格式无效:', finalAudioUrl);
      throw new Error(`音频URL格式无效: ${finalAudioUrl}`);
    }
    
    // 对于腾讯云COS的URL，确保URL编码正确
    // 如果URL包含已编码的字符，不要重复编码
    let audioUrlToFetch = finalAudioUrl;
    try {
      // 尝试解析URL，如果失败则说明URL格式有问题
      const urlObj = new URL(finalAudioUrl);
      // 如果URL解析成功，使用原始URL（保持签名参数不变）
      audioUrlToFetch = urlObj.toString();
    } catch (urlError) {
      console.warn('⚠️ URL解析失败，使用原始URL:', urlError.message);
      // 如果URL解析失败，尝试编码整个URL
      audioUrlToFetch = encodeURI(finalAudioUrl);
    }
    
    tempAudioPath = path.join(tempDir, `audio_${contentId}_${timestamp}.mp3`);
    console.log('📥 开始下载音频');
    console.log('📥 原始URL:', finalAudioUrl);
    console.log('📥 处理后的URL:', audioUrlToFetch);
    sendProgress('Step 1: Downloading audio file', 15);
    
    let audioResponse;
    try {
      console.log('🌐 发起音频fetch请求（超时时间：60秒）...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时
      
      // 对于腾讯云COS，可能需要添加Referer头
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      };
      
      // 如果是腾讯云COS URL，添加Referer
      if (audioUrlToFetch.includes('myqcloud.com')) {
        headers['Referer'] = 'https://console.cloud.tencent.com/';
      }
      
      audioResponse = await fetch(audioUrlToFetch, {
        method: 'GET',
        headers: headers,
        signal: controller.signal,
        redirect: 'follow' // 跟随重定向
      });
      
      clearTimeout(timeoutId);
      console.log('✅ 音频fetch请求完成，状态码:', audioResponse.status);
      console.log('✅ 响应头:', JSON.stringify(Object.fromEntries(audioResponse.headers.entries()), null, 2));
    } catch (fetchError) {
      console.error('❌ 下载音频失败（网络错误）:', fetchError);
      console.error('❌ 尝试的URL:', audioUrlToFetch);
      console.error('❌ 原始URL:', finalAudioUrl);
      
      // 如果是网络错误，尝试使用原始URL
      if (audioUrlToFetch !== finalAudioUrl) {
        console.log('🔄 尝试使用原始URL重新下载...');
        try {
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), 60000);
          audioResponse = await fetch(finalAudioUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: retryController.signal
          });
          clearTimeout(retryTimeoutId);
          console.log('✅ 使用原始URL重试成功，状态码:', audioResponse.status);
        } catch (retryError) {
          throw new Error(`下载音频失败（网络错误）: ${fetchError.message}`);
        }
      } else {
        throw new Error(`下载音频失败（网络错误）: ${fetchError.message}`);
      }
    }
    
    if (!audioResponse.ok) {
      const errorText = await audioResponse.text().catch(() => '无法读取错误响应');
      console.error('❌ 下载音频失败:', audioResponse.status, audioResponse.statusText);
      console.error('❌ 尝试的音频URL:', audioUrlToFetch);
      console.error('❌ 原始URL:', finalAudioUrl);
      console.error('❌ 错误响应:', errorText.substring(0, 500));
      
      // 提供更详细的错误信息
      if (audioResponse.status === 404) {
        // 检查是否是URL编码问题
        if (finalAudioUrl !== audioUrlToFetch) {
          throw new Error(`音频文件不存在 (404): 音频URL可能已过期、无效或存在编码问题。请重新生成${language === 'zh' ? '中文' : '英文'}音频。\n原始URL: ${finalAudioUrl.substring(0, 100)}...`);
        } else {
          throw new Error(`音频文件不存在 (404): 音频URL可能已过期或无效。请重新生成${language === 'zh' ? '中文' : '英文'}音频。\nURL: ${finalAudioUrl.substring(0, 100)}...`);
        }
      } else {
        throw new Error(`下载${language === 'zh' ? '中文' : '英文'}音频失败 (${audioResponse.status}): ${audioResponse.statusText}`);
      }
    }
    
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await fs.writeFile(tempAudioPath, audioBuffer);
    console.log('✅ 音频下载完成，大小:', audioBuffer.length, 'bytes');
    
    // 获取音频时长
    const audioDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          console.error('❌ 获取音频时长失败:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          console.log('✅ 音频时长:', duration, '秒');
          resolve(duration);
        }
      });
    });
    
    const audioDurationSeconds = Math.ceil(audioDuration);
    console.log('📊 音频总时长:', audioDurationSeconds, '秒');
    sendProgress('Step 1: Generating subtitle file', 30);
    
    // 使用腾讯云ASR生成字幕文件（基于音频URL）
    // 确保音频URL是HTTPS格式
    let audioUrlForASR = finalAudioUrl;
    if (audioUrlForASR.startsWith('http://')) {
      audioUrlForASR = audioUrlForASR.replace('http://', 'https://');
    }
    
    console.log('🎤 使用音频URL生成字幕:', audioUrlForASR);
    tempSubtitlePath = await generateSubtitleFile(
      audioUrlForASR,
      language,
      tempDir,
      contentId,
      timestamp
    );
    
    if (tempSubtitlePath) {
      console.log('✅ 字幕文件生成成功，路径:', tempSubtitlePath);
      sendProgress('Step 1: Subtitle generation completed', 40);
    } else {
      console.warn('⚠️ 字幕生成失败，视频将继续生成但不包含字幕');
      console.warn('⚠️ 请检查：1. 腾讯云ASR配置是否正确 2. 音频URL是否可访问 3. 查看上方错误日志');
      sendProgress('Step 1: Subtitle generation failed, continuing without subtitles', 40);
    }
    
    // Use custom cover image if provided, otherwise use book's blog cover image
    const finalCoverImageUrl = coverImageUrl || blogCoverUrl;
    if (!finalCoverImageUrl) {
      throw new Error('Cover image URL does not exist, please provide cover image or generate blog cover image');
    }
    
    // Download blog cover image
    console.log('📥 Starting to download blog cover image:', finalCoverImageUrl);
    let coverImageResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      coverImageResponse = await fetch(finalCoverImageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      throw new Error(`下载博客封面图失败: ${fetchError.message}`);
    }
    
    if (!coverImageResponse.ok) {
      throw new Error(`下载博客封面图失败 (${coverImageResponse.status}): ${coverImageResponse.statusText}`);
    }
    
    const coverImageBuffer = Buffer.from(await coverImageResponse.arrayBuffer());
    const coverImagePath = path.join(tempDir, `cover_${contentId}_${timestamp}.jpg`);
    await fs.writeFile(coverImagePath, coverImageBuffer);
    console.log('✅ Blog cover image saved successfully');
    sendProgress('Step 2: Cover image downloaded', 50);
    
    // 视频参数（9:16比例，720x1280）
    const videoWidth = 720;
    const videoHeight = 1280;
    const fps = 30;
    
    // 使用ffmpeg将博客封面图转换为视频（静态图片，匹配音频时长）
    tempVideoPath = path.join(tempDir, `video_${contentId}_${timestamp}.mp4`);
    console.log('🎞️ 开始生成视频（使用博客封面图）');
    sendProgress('Step 2: Generating video', 55);
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      // 使用ffmpeg将封面图转换为视频（循环播放以匹配音频时长）
      const ffmpegProcess = ffmpeg()
        .input(coverImagePath)
        .inputOptions([
          '-loop', '1',
          '-t', audioDurationSeconds.toString()
        ])
        .complexFilter([
          // 缩放封面图到目标尺寸（保持宽高比，居中）
          `[0:v]scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease,pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2:black[out]`
        ])
        .outputOptions([
          '-map', '[out]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', fps.toString(),
          '-t', audioDurationSeconds.toString()
        ])
        .output(tempVideoPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg视频生成命令:', commandLine);
          timeoutId = setTimeout(() => {
            console.error('❌ 视频生成超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频生成超时，请重试'));
          }, timeout);
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频生成完成');
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ FFmpeg视频生成失败:', err);
          reject(err);
        })
        .on('stderr', (stderrLine) => {
          // 输出ffmpeg的进度信息
          if (stderrLine.includes('time=')) {
            console.log('📊 FFmpeg进度:', stderrLine.trim());
          }
        })
        .run();
    });
    
    // 合并视频和音频（如果有字幕则嵌入字幕）
    tempOutputPath = path.join(tempDir, `output_${contentId}_${language}_${timestamp}.mp4`);
    console.log('🎞️ 开始合并视频和音频' + (tempSubtitlePath ? '（包含字幕）' : ''));
    sendProgress('Step 2: Merging and compositing video', 75);
    
    // 如果有字幕文件，先验证文件是否存在
    if (tempSubtitlePath) {
      try {
        await fs.access(tempSubtitlePath);
        const stats = await fs.stat(tempSubtitlePath);
        console.log('✅ 字幕文件存在，路径:', tempSubtitlePath);
        console.log('✅ 字幕文件大小:', stats.size, '字节');
      } catch (accessError) {
        console.error('❌ 字幕文件不存在或无法访问:', tempSubtitlePath);
        console.error('❌ 错误详情:', accessError.message);
        throw new Error(`字幕文件不存在: ${tempSubtitlePath}`);
      }
    }
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      let ffmpegProcess = ffmpeg()
        .input(tempVideoPath)
        .input(tempAudioPath);
      
      // 如果有字幕文件，添加字幕滤镜
      if (tempSubtitlePath) {
        console.log('📝 添加字幕到视频:', tempSubtitlePath);
        // 验证字幕文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(tempSubtitlePath)) {
          console.error('❌ 字幕文件不存在:', tempSubtitlePath);
          throw new Error(`字幕文件不存在: ${tempSubtitlePath}`);
        }
        const subtitleStats = fs.statSync(tempSubtitlePath);
        console.log('✅ 字幕文件存在，大小:', subtitleStats.size, '字节');
        const escapedSubtitlePath = escapeSubtitlePath(tempSubtitlePath);
        console.log('📝 转义后的字幕路径:', escapedSubtitlePath);
        
        ffmpegProcess = ffmpegProcess
          .complexFilter([
            // 缩放视频
            `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black[v]`,
            // 添加字幕（硬字幕，烧录到视频帧上）
            // 显式指定输入编码为UTF-8，确保中文字幕正确显示
            // 字幕文件已使用UTF-8 BOM编码，但显式指定charenc参数更可靠
            // 字幕样式：白色文字，无阴影，中灰色描边，位置居中（画面正中心偏下），确保在屏幕内
            // PrimaryColour=&Hffffff：白色文字
            // Outline=1：细边框
            // Shadow=0：无阴影效果
            // OutlineColour=&H606060：深灰色描边
            // Alignment=5：画面正中心（锚点在正中心）
            // WrapStyle=0：智能换行，长文本自动换行不超出屏幕（更激进的换行策略）
            // MarginL=50,MarginR=50：左右边距50像素，确保字幕不超出屏幕边界（720宽度，可用620）
            // MarginV=80：垂直边距80像素，让字幕从中心往下移动，位置固定不变
            // 注意：force_style参数值使用单引号包裹，内部不需要转义（FFmpeg会自动处理）
            // FontSize=8：字体大小8
            // OutlineColour=&H606060：深灰色描边
            `[v]subtitles='${escapedSubtitlePath}':charenc=UTF-8:force_style='FontSize=8,PrimaryColour=&Hffffff,OutlineColour=&H606060,Outline=1,Shadow=0,Alignment=5,MarginL=50,MarginR=50,MarginV=80,WrapStyle=0'[outv]`
          ])
          .outputOptions([
            '-map', '[outv]',
            '-map', '1:a',  // 映射音频流（第二个输入文件的音频）
            '-c:v libx264',
            '-preset medium',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-profile:v baseline', // 使用baseline profile确保最大兼容性
            '-level 3.0', // H.264 level 3.0，确保兼容性
            '-c:a aac',
            '-b:a 128k',
            '-shortest',
            '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
          ]);
      } else {
        // 即使没有字幕，也重新编码以确保faststart生效和兼容性
        ffmpegProcess = ffmpegProcess.outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-profile:v baseline', // 使用baseline profile确保最大兼容性
          '-level 3.0', // H.264 level 3.0，确保兼容性
          '-c:a aac',
          '-b:a 128k',
          '-shortest',
          '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
        ]);
      }
      
      ffmpegProcess = ffmpegProcess.output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg合并命令:', commandLine);
          timeoutId = setTimeout(() => {
            console.error('❌ 视频合并超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频合并超时，请重试'));
          }, timeout);
        })
        .on('stderr', (stderrLine) => {
          // 记录所有stderr输出，特别是错误和警告
          const line = stderrLine.trim();
          // 优先记录字幕相关的所有输出
          if (line.includes('Parsed_subtitles') || line.includes('libass') || line.includes('fontselect') || 
              line.includes('Glyph') || line.includes('ASS') || line.includes('subtitles') || 
              line.includes('Subtitle') || line.includes('字幕') || line.includes('font') || 
              line.includes('Font') || line.includes('字体')) {
            console.warn('⚠️ FFmpeg字幕相关:', line);
          } else if (line.includes('time=')) {
            console.log('📊 FFmpeg进度:', line);
          } else if (line.includes('error') || line.includes('Error') || line.includes('ERROR') || 
                     line.includes('warning') || line.includes('Warning') || line.includes('WARNING')) {
            console.warn('⚠️ FFmpeg stderr:', line);
          } else if (line.length > 0 && !line.match(/^frame=\s*\d+/) && 
                     !line.match(/^Stream mapping/) && !line.match(/^Press \[q\]/) &&
                     !line.match(/^\[libx264\]/) && !line.match(/^\[Parsed_scale/) &&
                     !line.match(/^\[Parsed_pad/) && !line.match(/^Output #0/) &&
                     !line.match(/^\[out#/) && !line.match(/^\[libx264 @/) &&
                     !line.match(/^configuration:/) && !line.match(/^Input #/) &&
                     !line.match(/^Duration:/) && !line.match(/^Stream #/)) {
            // 记录其他非进度信息（排除常见的进度和状态行）
            console.log('📝 FFmpeg输出:', line);
          }
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频合并完成');
          sendProgress('Step 2: Video merge completed', 85);
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ FFmpeg合并失败:', err);
          console.error('❌ FFmpeg错误详情:', err.message);
          console.error('❌ FFmpeg错误堆栈:', err.stack);
          // 如果编码失败，尝试使用更快的预设
          console.log('⚠️ 视频编码失败，尝试使用ultrafast预设...');
          sendProgress('视频编码失败，尝试使用ultrafast预设', 80);
          let fallbackProcess = ffmpeg()
            .input(tempVideoPath)
            .input(tempAudioPath);
          
          // 如果有字幕，添加字幕滤镜
          if (tempSubtitlePath) {
            fallbackProcess = fallbackProcess
              .complexFilter([
                `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black[v]`,
                `[v]subtitles='${escapeSubtitlePath(tempSubtitlePath)}':charenc=UTF-8:force_style='FontSize=8,PrimaryColour=&Hffffff,OutlineColour=&H606060,Outline=1,Shadow=0,Alignment=5,MarginV=80,MarginL=50,MarginR=50,WrapStyle=0'[outv]`
              ])
              .outputOptions([
                '-map', '[outv]',
                '-map', '1:a',  // 映射音频流（第二个输入文件的音频）
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-profile:v baseline', // 使用baseline profile确保最大兼容性
                '-level 3.0', // H.264 level 3.0，确保兼容性
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
                '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
              ]);
          } else {
            fallbackProcess = fallbackProcess.outputOptions([
              '-c:v libx264',
              '-preset ultrafast',
              '-crf 23',
              '-pix_fmt yuv420p',
              '-profile:v baseline', // 使用baseline profile确保最大兼容性
              '-level 3.0', // H.264 level 3.0，确保兼容性
              '-s 720x1280', // 强制9:16竖屏分辨率
              '-aspect 9:16', // 设置宽高比
              '-c:a aac',
              '-b:a 128k',
              '-shortest',
              '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
            ]);
          }
          
          fallbackProcess = fallbackProcess.output(tempOutputPath)
            .on('end', () => {
              console.log('✅ 视频合并完成（使用重新编码）');
              sendProgress('Step 2: Video merge completed', 85);
              resolve(null);
            })
            .on('error', (fallbackErr) => {
              console.error('❌ 重新编码也失败:', fallbackErr);
              reject(fallbackErr);
            })
            .run();
        })
        .run();
    });
    
    // 上传合并后的视频到七牛云
    sendProgress('Step 2: Uploading video', 90);
    const outputBuffer = await fs.readFile(tempOutputPath);
    const finalVideoUrl = await uploadFile(outputBuffer, `video_${contentId}_${language}_${timestamp}.mp4`, 'video/mp4', 'videos');
    console.log('✅ 视频上传成功，URL:', finalVideoUrl);
    sendProgress('Step 2: Video upload completed', 95);
    
    // 更新ExtractedContent记录
    const updateData = { videoStatus: 'completed' };
    if (language === 'en') {
      updateData.videoUrlEn = finalVideoUrl;
    } else {
      updateData.videoUrl = finalVideoUrl;
    }
    await db.update('ExtractedContent', updateData, 'id = ?', [contentId]);
    
    // 清理临时文件（包括字幕文件）
    const cleanupFiles = [tempVideoPath, tempAudioPath, tempOutputPath, tempSubtitlePath].filter(Boolean);
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
    }
    
    // 清理视频帧目录
    try {
      const framesFiles = await fs.readdir(framesDir);
      for (const file of framesFiles) {
        await fs.unlink(path.join(framesDir, file));
      }
      await fs.rmdir(framesDir);
    } catch (cleanupError) {
      console.warn('⚠️ 清理视频帧目录失败:', cleanupError.message);
    }
    
    // 根据语言返回相应的字段
    const responseData = {
      contentId: contentId,
      language: language
    };
    
    if (language === 'en') {
      responseData.videoUrlEn = finalVideoUrl;
    } else {
      responseData.videoUrl = finalVideoUrl;
    }
    
    // 发送完成消息
    cleanup();
    sendProgress('视频生成完成', 100);
    
    if (useSSE) {
      // SSE格式响应
      const finalData = JSON.stringify({ success: true, data: responseData, completed: true });
      res.write(`data: ${finalData}\n\n`);
      res.end();
    } else {
      // JSON格式响应（兼容模式）
      res.json({
        success: true,
        data: responseData
      });
    }
  } catch (error) {
    cleanup();
    console.error('❌ 生成视频失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    console.error('❌ 错误详情:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('❌ ContentId:', req.params.contentId);
    console.error('❌ AudioUrl:', req.body.audioUrl);
    console.error('❌ Language:', req.body.language);
    
    // 清理临时文件（包括字幕文件）
    const cleanupFiles = [tempVideoPath, tempAudioPath, tempOutputPath, tempSubtitlePath].filter(Boolean);
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
    }
    
    // 如果响应还没有发送，发送错误响应
    if (!res.headersSent) {
      // 确保错误响应也包含CORS头
      const origin = req.headers.origin;
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      
      // 更新状态为失败
      try {
        await db.update('ExtractedContent', { videoStatus: 'failed' }, 'id = ?', [req.params.contentId]);
      } catch (updateError) {
        console.error('❌ 更新内容状态失败:', updateError);
      }

      // 发送错误消息（SSE格式）
      let errorMessage = '生成视频失败';
      let errorSuggestion = '';
      
      // 检查是否是网络错误
      if (error.message && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') || error.message.includes('下载'))) {
        errorMessage = '下载视频或音频文件失败，请检查网络连接';
        errorSuggestion = '请检查silentVideoUrl和audioUrl是否可访问';
      } else if (error.message && (error.message.includes('FFmpeg') || error.message.includes('合并') || error.message.includes('超时'))) {
        errorMessage = '视频处理失败';
        errorSuggestion = '请检查FFmpeg是否正确安装，或重试';
      }

      // 发送错误消息
      const errorResponse = {
        success: false,
        message: errorMessage,
        error: error.message || String(error),
        suggestion: errorSuggestion,
        contentId: req.params.contentId
      };
      
      // 在开发环境下返回更多调试信息
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        errorResponse.stack = error.stack;
        errorResponse.details = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      
      if (useSSE) {
        // SSE格式响应
        errorResponse.completed = true;
        const errorData = JSON.stringify(errorResponse);
        res.write(`data: ${errorData}\n\n`);
        res.end();
      } else {
        // JSON格式响应（兼容模式）
        res.status(500).json(errorResponse);
      }
    } else {
      console.error('❌ 响应已发送，无法发送错误响应');
    }
  }
});


// 使用文生视频API生成视频（原有逻辑）
async function generateVideoWithTextToVideo(req, res, contentId, audioUrl) {
  let tempVideoPath = null;
  let tempAudioPath = null;
  let tempOutputPath = null;
  
  try {
    // 获取内容信息
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: '内容不存在'
      });
    }

    const textContent = contentObj.summary || contentObj.chapterTitle || '';
    if (!textContent) {
      return res.status(400).json({
        success: false,
        message: '内容文本为空，无法生成视频'
      });
    }

    // 更新状态为生成中
    await db.update('ExtractedContent', { videoStatus: 'generating' }, 'id = ?', [contentId]);

    console.log('📝 开始根据文字生成视频，文本:', textContent.substring(0, 50) + '...');

    // 豆包视频生成服务已禁用
    throw new Error('豆包视频生成服务已禁用，无法生成视频');
    
    // 验证Doubao API配置（已禁用）
    // console.log('🔑 Doubao API Key:', DOUBAO_API_KEY ? `${DOUBAO_API_KEY.substring(0, 20)}...` : '未设置');
    // console.log('🔑 Doubao Model ID:', DOUBAO_MODEL_ID);
    // if (!DOUBAO_API_KEY) {
    //   throw new Error('Doubao API Key未配置，请设置ARK_API_KEY或DOUBAO_API_KEY环境变量');
    // }

    // 步骤1: 先获取音频时长，以便计算需要生成多少段视频
    console.log('📥 步骤1: 获取音频时长');
    let finalAudioUrl = audioUrl;
    if (finalAudioUrl.startsWith('http://')) {
      finalAudioUrl = finalAudioUrl.replace('http://', 'https://');
    }
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempAudioPath = path.join(tempDir, `audio_${contentId}_${timestamp}.mp3`);
    
    // 下载音频文件
    const audioResponse = await fetch(finalAudioUrl);
    if (!audioResponse.ok) {
      throw new Error(`下载音频失败: ${audioResponse.statusText}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await fs.writeFile(tempAudioPath, audioBuffer);
    console.log('✅ 音频下载完成，大小:', audioBuffer.length, 'bytes');
    
    // 使用ffmpeg获取音频时长
    const audioDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          console.error('❌ 获取音频时长失败:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          console.log('✅ 音频时长:', duration, '秒');
          resolve(duration);
        }
      });
    });
    
    const audioDurationSeconds = Math.ceil(audioDuration);
    console.log('📊 音频总时长:', audioDurationSeconds, '秒');
    
    // 计算需要生成多少段视频（每段5秒）
    const videoSegmentDuration = 5; // 每段视频5秒
    const numSegments = Math.ceil(audioDurationSeconds / videoSegmentDuration);
    console.log('📊 需要生成', numSegments, '段视频（每段', videoSegmentDuration, '秒）');
    
    // 将文本分段（简单平均分段）
    const textLength = textContent.length;
    const segmentTextLength = Math.ceil(textLength / numSegments);
    const textSegments = [];
    for (let i = 0; i < numSegments; i++) {
      const start = i * segmentTextLength;
      const end = Math.min(start + segmentTextLength, textLength);
      textSegments.push(textContent.substring(start, end));
    }
    console.log('📊 文本已分为', textSegments.length, '段');
    
    // 步骤2: 生成多段视频
    console.log('🎬 步骤2: 开始生成多段视频');
    const videoSegmentUrls = [];
    const tempVideoSegmentPaths = [];
    
    // Doubao API需要的请求头
    // 根据volcengine API文档，使用API Key鉴权
    // 根据volcengine常见做法，使用 Authorization: Bearer {API_KEY} 格式
    const videoRequestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DOUBAO_API_KEY}`
    };
    
    // 判断是否是中文视频（如果存在中文音频URL，则为中文视频）
    const isChineseVideo = !!contentObj.audioUrl;
    
    // 辅助函数：生成单段视频
    const generateVideoSegment = async (segmentText, segmentIndex) => {
      // 根据Doubao API格式构建请求体
      // 文生视频：使用text类型，在text中包含提示词和参数
      // 参数格式：--ratio 9:16 --dur {duration}
      // --ratio 9:16 表示9:16竖屏比例（强制限制）
      // --dur 指定视频时长（秒）
      // 明确指定动漫风格，色彩鲜艳
      const styleText = '，动漫风格，色彩鲜艳';
      const promptWithParams = `${segmentText}${styleText} --ratio 9:16 --dur ${videoSegmentDuration}`;
      
      const textToVideoRequestBody = {
        model: DOUBAO_MODEL_ID, // Doubao模型ID或Endpoint ID
        content: [
          {
            type: 'text',
            text: promptWithParams
          }
        ],
        generate_audio: false // 明确指定生成无声视频
      };
      
      console.log(`📤 第 ${segmentIndex + 1}/${numSegments} 段视频请求（Doubao API）:`, JSON.stringify(textToVideoRequestBody, null, 2));
      
      const textToVideoResponse = await fetch(DOUBAO_TEXT_TO_VIDEO_URL, {
        method: 'POST',
        headers: videoRequestHeaders,
        body: JSON.stringify(textToVideoRequestBody)
      });
      
      if (!textToVideoResponse.ok) {
        const errorText = await textToVideoResponse.text();
        console.error(`❌ Doubao API失败:`);
        console.error(`   状态码:`, textToVideoResponse.status);
        console.error(`   状态文本:`, textToVideoResponse.statusText);
        console.error(`   错误响应:`, errorText);
        console.error(`   请求URL:`, DOUBAO_TEXT_TO_VIDEO_URL);
        console.error(`   请求头:`, JSON.stringify(videoRequestHeaders, null, 2));
        console.error(`   请求体:`, JSON.stringify(textToVideoRequestBody, null, 2));
        throw new Error(`Doubao文生视频API失败: ${textToVideoResponse.status} ${textToVideoResponse.statusText} - ${errorText}`);
      }
      
      const textToVideoData = await textToVideoResponse.json();
      console.log(`✅ 第 ${segmentIndex + 1}/${numSegments} 段视频API响应（Doubao）:`, JSON.stringify(textToVideoData, null, 2));
      
      // Doubao API返回任务ID（id字段）
      const taskId = textToVideoData.id;
      
      if (!taskId) {
        console.error('❌ Doubao API响应格式不符合预期:', JSON.stringify(textToVideoData, null, 2));
        throw new Error('Doubao文生视频响应格式错误，未找到任务ID');
      }
      
      console.log(`⏳ 开始轮询第 ${segmentIndex + 1}/${numSegments} 段视频，task_id:`, taskId);
      
      // 轮询获取视频URL（增加超时时间，视频生成可能需要更长时间）
      const maxAttempts = 120; // 增加到120次（10分钟）
      const pollInterval = 5000; // 每5秒查询一次
      let attempts = 0;
      let taskStatus = 'queued';
      let segmentVideoUrl = null;
      
      while (attempts < maxAttempts && taskStatus !== 'succeeded' && taskStatus !== 'failed' && taskStatus !== 'expired' && taskStatus !== 'cancelled') {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        
        // 查询任务状态：GET /api/v3/contents/generations/tasks/{id}
        const statusUrl = `${DOUBAO_TASK_STATUS_URL}/${taskId}`;
        
        // 添加重试机制和超时控制
        let statusResponse = null;
        let retryCount = 0;
        const maxRetries = 3;
        const fetchTimeout = 30000; // 30秒超时
        
        while (retryCount < maxRetries) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
            
            statusResponse = await fetch(statusUrl, {
              method: 'GET',
              headers: videoRequestHeaders,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            break; // 成功，退出重试循环
          } catch (fetchError) {
            retryCount++;
            if (retryCount >= maxRetries) {
              console.error(`❌ 查询任务状态失败（已重试${maxRetries}次）:`, fetchError.message);
              throw new Error(`查询任务状态失败: ${fetchError.message}`);
            }
            console.warn(`⚠️ 查询任务状态失败，${retryCount}/${maxRetries}次重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
          }
        }
        
        if (!statusResponse || !statusResponse.ok) {
          const errorText = statusResponse ? await statusResponse.text() : '无响应';
          throw new Error(`查询任务状态失败: ${statusResponse?.statusText || '网络错误'} - ${errorText}`);
        }
        
        const statusData = await statusResponse.json();
        taskStatus = statusData.status;
        
        console.log(`📊 第 ${segmentIndex + 1}/${numSegments} 段视频任务状态（第${attempts}次查询）:`, taskStatus);
        
        if (taskStatus === 'succeeded') {
          // 任务成功，获取视频URL
          segmentVideoUrl = statusData.content?.video_url;
          if (!segmentVideoUrl) {
            throw new Error('任务完成但未找到视频URL');
          }
          console.log(`✅ 第 ${segmentIndex + 1}/${numSegments} 段视频生成完成，URL:`, segmentVideoUrl);
          break;
        } else if (taskStatus === 'failed' || taskStatus === 'expired' || taskStatus === 'cancelled') {
          const errorMsg = statusData.error?.message || statusData.error?.code || '任务失败';
          const errorCode = statusData.error?.code || '';
          
          // 特殊处理敏感内容错误
          if (errorMsg.includes('sensitive') || errorMsg.includes('敏感') || errorCode.includes('sensitive')) {
            console.error(`❌ 第 ${segmentIndex + 1}/${numSegments} 段视频生成失败（内容安全检测）:`, errorMsg);
            throw new Error(`视频生成失败：内容可能包含敏感信息，请尝试修改文本内容后重试。错误详情: ${errorMsg}`);
          }
          
          console.error(`❌ 第 ${segmentIndex + 1}/${numSegments} 段视频生成失败:`, errorMsg);
          throw new Error(`视频生成任务失败: ${errorMsg}`);
        }
        
        // 继续等待：queued 或 running 状态
        console.log(`⏳ 第 ${segmentIndex + 1}/${numSegments} 段视频任务状态: ${taskStatus}，继续等待...`);
      }
      
      if (!segmentVideoUrl) {
        throw new Error(`视频生成超时或失败，任务状态: ${taskStatus}`);
      }
      
      return segmentVideoUrl;
    };
    
    // 生成所有视频段（可以并行，但为了控制API调用频率，这里串行执行）
    for (let i = 0; i < numSegments; i++) {
      console.log(`📹 生成第 ${i + 1}/${numSegments} 段视频...`);
      const segmentVideoUrl = await generateVideoSegment(textSegments[i], i);
      videoSegmentUrls.push(segmentVideoUrl);
    }
    
    console.log('✅ 所有视频段生成完成，共', videoSegmentUrls.length, '段');
    
    // 步骤3: 下载所有视频段
    console.log('📥 步骤3: 下载所有视频段');
    for (let i = 0; i < videoSegmentUrls.length; i++) {
      const segmentUrl = videoSegmentUrls[i];
      const segmentPath = path.join(tempDir, `video_segment_${contentId}_${timestamp}_${i}.mp4`);
      tempVideoSegmentPaths.push(segmentPath);
      
      console.log(`📥 下载第 ${i + 1}/${videoSegmentUrls.length} 段视频:`, segmentUrl);
      const segmentResponse = await fetch(segmentUrl);
      if (!segmentResponse.ok) {
        throw new Error(`下载视频段失败: ${segmentResponse.statusText}`);
      }
      const segmentBuffer = Buffer.from(await segmentResponse.arrayBuffer());
      await fs.writeFile(segmentPath, segmentBuffer);
      console.log(`✅ 第 ${i + 1}/${videoSegmentUrls.length} 段视频下载完成，大小:`, segmentBuffer.length, 'bytes');
    }
    
    // 步骤4: 使用ffmpeg拼接所有视频段
    console.log('🎞️ 步骤4: 拼接所有视频段');
    const concatenatedVideoPath = path.join(tempDir, `concatenated_${contentId}_${timestamp}.mp4`);
    
    // 创建ffmpeg concat文件
    const concatFilePath = path.join(tempDir, `concat_${contentId}_${timestamp}.txt`);
    const concatFileContent = tempVideoSegmentPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(concatFilePath, concatFileContent);
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      const ffmpegProcess = ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v copy', // 复制视频流，不重新编码（大幅加快速度）
          '-c:a copy' // 复制音频流（如果存在）
        ])
        .output(concatenatedVideoPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg拼接命令:', commandLine);
          // 设置超时
          timeoutId = setTimeout(() => {
            console.error('❌ 视频段拼接超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频段拼接超时，请重试'));
          }, timeout);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`📊 拼接进度: ${Math.floor(progress.percent)}%`);
          } else if (progress.timemark) {
            console.log(`📊 拼接进度: ${progress.timemark}`);
          }
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频段拼接完成');
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ 视频段拼接失败:', err);
          // 如果copy失败，尝试重新编码
          if (err.message && err.message.includes('copy')) {
            console.log('⚠️ 视频流复制失败，尝试重新编码...');
            const fallbackProcess = ffmpeg()
              .input(concatFilePath)
              .inputOptions(['-f', 'concat', '-safe', '0'])
              .outputOptions([
                '-c:v libx264',
                '-preset ultrafast', // 使用最快预设
                '-crf 23',
                '-pix_fmt yuv420p',
                '-s 720x1280' // 720P竖屏分辨率（低分辨率）
              ])
              .output(concatenatedVideoPath)
              .on('end', () => {
                console.log('✅ 视频段拼接完成（使用重新编码）');
                resolve(null);
              })
              .on('error', (fallbackErr) => {
                console.error('❌ 重新编码也失败:', fallbackErr);
                reject(fallbackErr);
              })
              .run();
          } else {
            reject(err);
          }
        })
        .run();
    });
    
    // 清理concat文件
    try {
      await fs.unlink(concatFilePath);
    } catch (e) {
      console.warn('⚠️ 清理concat文件失败:', e);
    }
    
    // 更新tempVideoPath为拼接后的视频
    tempVideoPath = concatenatedVideoPath;
    
    // 步骤5: 使用ffmpeg合并音频和视频
    console.log('🎞️ 步骤5: 合并音频和视频');
    tempOutputPath = path.join(tempDir, `output_${contentId}_${timestamp}.mp4`);
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      const ffmpegProcess = ffmpeg(tempVideoPath)
        .input(tempAudioPath)
        .outputOptions([
          '-c:v copy', // 复制视频流，不重新编码（大幅加快速度，输入视频应该已经是9:16）
          '-c:a aac', // 音频编码为AAC
          '-b:a 128k', // 音频比特率
          '-shortest', // 以较短的流为准
          '-movflags +faststart' // 优化web播放
        ])
        .output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg合并命令:', commandLine);
          // 设置超时
          timeoutId = setTimeout(() => {
            console.error('❌ 视频合并超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频合并超时，请重试'));
          }, timeout);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`📊 合并进度: ${Math.floor(progress.percent)}%`);
          } else if (progress.timemark) {
            console.log(`📊 合并进度: ${progress.timemark}`);
          }
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频合并完成');
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ 视频合并失败:', err);
          // 如果copy失败，尝试重新编码
          if (err.message && err.message.includes('copy')) {
            console.log('⚠️ 视频流复制失败，尝试重新编码...');
            // 使用重新编码作为备选方案
            const fallbackProcess = ffmpeg(tempVideoPath)
              .input(tempAudioPath)
              .outputOptions([
                '-c:v libx264',
                '-preset ultrafast', // 使用最快预设
                '-crf 23',
                '-pix_fmt yuv420p',
                '-s 720x1280', // 强制9:16竖屏分辨率
                '-aspect 9:16', // 设置宽高比
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
                '-movflags +faststart'
              ])
              .output(tempOutputPath)
              .on('end', () => {
                console.log('✅ 视频合并完成（使用重新编码）');
                resolve(null);
              })
              .on('error', (fallbackErr) => {
                console.error('❌ 重新编码也失败:', fallbackErr);
                reject(fallbackErr);
              })
              .run();
          } else {
            reject(err);
          }
        })
        .run();
    });
    
    // 清理视频段文件
    for (const segmentPath of tempVideoSegmentPaths) {
      try {
        await fs.unlink(segmentPath);
      } catch (e) {
        console.warn('⚠️ 清理视频段文件失败:', e);
      }
    }
    
    // 清理拼接后的视频文件
    try {
      await fs.unlink(concatenatedVideoPath);
    } catch (e) {
      console.warn('⚠️ 清理拼接视频文件失败:', e);
    }

    // 步骤4: 上传合并后的视频到七牛云
    console.log('📤 步骤4: 上传合并后的视频');
    const outputVideoBuffer = await fs.readFile(tempOutputPath);
    const videoFileName = `video_${contentId}_${timestamp}.mp4`;
    const finalVideoUrl = await uploadFile(outputVideoBuffer, videoFileName, 'video/mp4', 'videos');
    console.log('✅ 视频上传成功，URL:', finalVideoUrl);

    // 更新内容记录
    await db.update('ExtractedContent', { videoStatus: 'completed', videoUrl: finalVideoUrl }, 'id = ?', [contentId]);

    // 清理临时文件
    try {
      await fs.unlink(tempVideoPath);
      await fs.unlink(tempAudioPath);
      await fs.unlink(tempOutputPath);
      console.log('✅ 临时文件已清理');
    } catch (cleanupError) {
      console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
    }

    res.json({
      success: true,
      data: {
        videoUrl: finalVideoUrl,
        contentId: contentId
      }
    });
  } catch (error) {
    console.error('生成视频失败:', error);
    
    // 清理临时文件
    const cleanupFiles = [tempVideoPath, tempAudioPath, tempOutputPath].filter(Boolean);
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('⚠️ 清理临时文件失败:', cleanupError.message);
      }
    }
    
    // 更新状态为失败
    try {
      await db.update('ExtractedContent', { videoStatus: 'failed' }, 'id = ?', [req.params.contentId]);
    } catch (updateError) {
      console.error('更新内容状态失败:', updateError);
    }

    res.status(500).json({
      success: false,
      message: '生成视频失败',
      error: error.message
    });
  }
}

// 生成数字人形象图片（使用阿里通义万相）
router.post('/content/:contentId/generate-avatar', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { avatarDescription } = req.body;

    if (!avatarDescription) {
      return res.status(400).json({
        success: false,
        message: '缺少形象描述'
      });
    }

    // 调用阿里通义万相生成图像
    const prompt = `生成一个专业讲解视频的数字人形象：${avatarDescription}，要求：正面照，清晰的面部特征，专业形象，适合用于视频讲解`;
    
    console.log('🎨 调用阿里通义万相生成图像，prompt:', prompt);
    
    // 注意：wan2.6-image需要图片输入，不支持纯文本生成
    // 这里使用Deepseek生成图片描述，然后使用预定义的数字人形象图片
    // 或者可以集成其他支持文本生成图片的服务（如Stable Diffusion API）
    
    console.log('🎨 生成数字人形象，描述:', avatarDescription);
    
    // 方案1: 使用Deepseek生成更详细的图片描述，然后使用图片生成服务
    // 方案2: 使用预定义的数字人形象图片库（根据描述选择）
    // 方案3: 暂时使用占位符图片，后续可以集成其他图片生成API
    
    // 根据描述选择合适的预定义图片
    // 这里简化处理，使用一个通用的专业形象图片
    // 实际应用中可以：
    // 1. 使用Deepseek生成图片描述
    // 2. 调用支持文本生成图片的API（如Stable Diffusion、Midjourney等）
    // 3. 或使用预定义的数字人形象图片库
    
    const avatarImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face';
    
    console.log('✅ 使用预定义数字人形象图片:', avatarImageUrl);

    // 更新内容记录
    await db.update('ExtractedContent', { avatarImageUrl: avatarImageUrl }, 'id = ?', [contentId]);

    res.json({
      success: true,
      data: {
        avatarImageUrl: avatarImageUrl,
        contentId: contentId
      }
    });
  } catch (error) {
    console.error('生成数字人形象失败:', error);
    res.status(500).json({
      success: false,
      message: '生成数字人形象失败',
      error: error.message
    });
  }
});

// Update content summary and titles (using Master Key to bypass ACL)
router.post('/content/:contentId/update-summary', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { summary, summaryEn, chapterTitle, chapterTitleEn } = req.body;
    
    if (!summary && !chapterTitle) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (summary or chapterTitle) must be provided'
      });
    }
    
    // Get content object
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Update fields
    const updateData = {};
    if (summary !== undefined) {
      updateData.summary = summary;
    }
    if (summaryEn !== undefined) {
      updateData.summaryEn = summaryEn;
    }
    if (chapterTitle !== undefined) {
      updateData.chapterTitle = chapterTitle;
    }
    if (chapterTitleEn !== undefined) {
      updateData.chapterTitleEn = chapterTitleEn;
    }
    await db.update('ExtractedContent', updateData, 'id = ?', [contentId]);
    
    const updatedContent = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    console.log(`✅ Content updated: contentId=${contentId}`);
    
    res.json({
      success: true,
      message: 'Content updated successfully',
      data: {
        summary: updatedContent.summary,
        summaryEn: updatedContent.summaryEn,
        chapterTitle: updatedContent.chapterTitle,
        chapterTitleEn: updatedContent.chapterTitleEn
      }
    });
  } catch (error) {
    console.error('Failed to update content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update content',
      error: error.message
    });
  }
});

// 为已有内容生成英文翻译（使用Master Key绕过ACL）
// 注意：这个路由必须在 /:bookId/contents 之前定义，避免路由冲突
router.post('/content/:contentId/translate', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    // 获取内容对象
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: '内容不存在'
      });
    }
    
    const chapterTitle = contentObj.chapterTitle;
    const summary = contentObj.summary;
    
    let chapterTitleEn = contentObj.chapterTitleEn || '';
    let summaryEn = contentObj.summaryEn || '';
    
    // 翻译标题
    if ((!chapterTitleEn || chapterTitleEn.trim() === '') && chapterTitle) {
      console.log(`🌐 [手动翻译] 章节标题: ${chapterTitle}`);
      try {
        const translateTitleResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ALIYUN_API_KEY}`
          },
          body: JSON.stringify({
            model: 'qwen-long-latest',
            input: {
              messages: [
                {
                  role: 'user',
                  content: `请将以下中文章节标题翻译成英文，只返回英文翻译，不要添加任何其他内容：\n${chapterTitle}`
                }
              ]
            },
            parameters: {
              temperature: 0.3,
              max_tokens: 100
            }
          })
        });
        
        if (translateTitleResponse.ok) {
          const translateTitleData = await translateTitleResponse.json();
          chapterTitleEn = translateTitleData.output?.choices?.[0]?.message?.content?.trim() || translateTitleData.output?.text?.trim() || '';
          if (chapterTitleEn) {
            console.log(`✅ [手动翻译完成] 标题: ${chapterTitleEn}`);
          }
        }
      } catch (error) {
        console.error('❌ [手动翻译失败] 标题:', error.message);
      }
    }
    
    // 翻译摘要
    if ((!summaryEn || summaryEn.trim() === '') && summary) {
      console.log(`🌐 [手动翻译] 摘要: ${summary.substring(0, 50)}...`);
      try {
        const translateSummaryResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ALIYUN_API_KEY}`
          },
          body: JSON.stringify({
            model: 'qwen-long-latest',
            input: {
              messages: [
                {
                  role: 'user',
                  content: `请将以下中文内容摘要完整翻译成英文，保持所有细节，不要限制字数，只返回英文翻译，不要添加任何其他内容：\n${summary}`
                }
              ]
            },
            parameters: {
              temperature: 0.3,
              max_tokens: 2000
            }
          })
        });
        
        if (translateSummaryResponse.ok) {
          const translateSummaryData = await translateSummaryResponse.json();
          summaryEn = translateSummaryData.output?.choices?.[0]?.message?.content?.trim() || translateSummaryData.output?.text?.trim() || '';
          if (summaryEn) {
            // 保持完整，不限制字数
            console.log(`✅ [手动翻译完成] 摘要: ${summaryEn.substring(0, 100)}... (总长度: ${summaryEn.length}字符)`);
          }
        }
      } catch (error) {
        console.error('❌ [手动翻译失败] 摘要:', error.message);
      }
    }
    
    // 保存翻译结果
    const updateData = {};
    if (chapterTitleEn) updateData.chapterTitleEn = chapterTitleEn;
    if (summaryEn) updateData.summaryEn = summaryEn;
    if (Object.keys(updateData).length > 0) {
      await db.update('ExtractedContent', updateData, 'id = ?', [contentId]);
    }
    
    res.json({
      success: true,
      message: '翻译完成',
      data: {
        chapterTitleEn,
        summaryEn
      }
    });
  } catch (error) {
    console.error('翻译内容失败:', error);
    res.status(500).json({
      success: false,
      message: '翻译内容失败',
      error: error.message
    });
  }
});

// 生成英文视频（一键生成：翻译+英文音频+合并视频）
router.post('/content/:contentId/generate-english-video', async (req, res) => {
  // 立即设置CORS头，确保长时间运行的请求也能正确返回CORS响应
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // 检测前端是否支持SSE（通过Accept头或useSSE参数）
  const acceptHeader = req.headers.accept || '';
  const useSSE = req.query.useSSE === 'true' || req.body.useSSE === true || acceptHeader.includes('text/event-stream');
  
  let sendProgress, cleanup, heartbeatInterval;
  
  if (useSSE) {
    // 设置流式响应头（Server-Sent Events），用于保持连接活跃并发送进度更新
    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    
    // 发送进度更新的辅助函数
    sendProgress = (message, progress = null) => {
      try {
        const data = JSON.stringify({ message, progress, timestamp: Date.now() });
        res.write(`data: ${data}\n\n`);
        console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
      } catch (err) {
        console.error('❌ 发送进度更新失败:', err);
      }
    };
    
    // 发送心跳以保持连接活跃（每30秒发送一次）
    heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    
    // 清理函数
    cleanup = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  } else {
    // 兼容模式：使用JSON响应，但仍然发送进度更新（通过日志）
    res.header('Content-Type', 'application/json');
    sendProgress = (message, progress = null) => {
      console.log(`📊 进度更新: ${message}${progress !== null ? ` (${progress}%)` : ''}`);
    };
    cleanup = () => {};
    console.log('⚠️ 前端不支持SSE，使用JSON响应模式（兼容模式）');
  }
  
  let tempVideoPath = null;
  let tempAudioPath = null;
  let tempOutputPath = null;
  let tempSubtitlePath = null;
  
  try {
    const { contentId } = req.params;
    
    console.log('🚀 ========== 生成英文视频API被调用 ==========');
    console.log('🌐 Origin:', origin);
    console.log('📥 contentId:', contentId);
    
    sendProgress('开始处理英文视频生成请求', 0);
    sendProgress('Step 1: Preparing to generate audio and subtitles', 5);
    
    // 获取内容对象
    const contentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
    if (!contentObj) {
      return res.status(404).json({
        success: false,
        message: '内容不存在'
      });
    }
    
    // 获取书籍信息以获取博客封面图
    const bookId = contentObj.bookId;
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '内容未关联到书籍'
      });
    }
    
    const book = await db.findOne('SELECT * FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }
    
    // Get request parameters (cover image, titles, summaries, opening text option)
    const { coverImageUrl, chapterTitle, chapterTitleEn, summary, summaryEn, includeOpeningText = true } = req.body;
    
    // Use custom cover image if provided, otherwise use book's blog cover image
    const blogCoverUrl = book.blogCoverUrl;
    const finalCoverImageUrl = coverImageUrl || blogCoverUrl;
    if (!finalCoverImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please generate blog cover image or upload cover image first'
      });
    }
    
    // Use custom titles/summaries if provided, otherwise get from database
    let finalChapterTitle = chapterTitle !== undefined ? chapterTitle : (contentObj.chapterTitle || '');
    let finalChapterTitleEn = chapterTitleEn !== undefined ? chapterTitleEn : (contentObj.chapterTitleEn || '');
    let finalSummary = summary !== undefined ? summary : (contentObj.summary || '');
    let finalSummaryEn = summaryEn !== undefined ? summaryEn : (contentObj.summaryEn || '');
    
    // 记录从数据库获取的原始值
    console.log('📋 从数据库获取的原始值:');
    console.log(`   summary长度: ${contentObj.summary ? contentObj.summary.length : 0}字符`);
    console.log(`   summaryEn长度: ${contentObj.summaryEn ? contentObj.summaryEn.length : 0}字符`);
    console.log(`   finalSummaryEn长度: ${finalSummaryEn ? finalSummaryEn.length : 0}字符`);
    
    // 如果finalSummaryEn为空或太短，尝试重新查询数据库
    if (!finalSummaryEn || finalSummaryEn.trim().length < 50) {
      console.warn('⚠️ finalSummaryEn为空或太短，尝试重新查询数据库...');
      try {
        const refreshedContentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
        if (refreshedContentObj && refreshedContentObj.summaryEn) {
          const refreshedSummaryEn = refreshedContentObj.summaryEn || '';
          if (refreshedSummaryEn && refreshedSummaryEn.length > (finalSummaryEn?.length || 0)) {
            console.log(`✅ 重新查询后获取到更长的summaryEn: ${refreshedSummaryEn.length}字符`);
            finalSummaryEn = refreshedSummaryEn;
          }
        }
      } catch (fetchError) {
        console.error('❌ 重新查询数据库失败:', fetchError.message);
      }
    }
    
    // Log custom values if provided
    if (coverImageUrl) {
      console.log('📝 Using custom cover image:', coverImageUrl.substring(0, 50) + '...');
    }
    if (chapterTitleEn !== undefined) {
      console.log('📝 Using custom English title:', finalChapterTitleEn);
    }
    if (summaryEn !== undefined) {
      console.log('📝 Using custom English summary:', finalSummaryEn.substring(0, 50) + '...');
    }
    
    // 获取中文内容（如果未提供自定义值）
    const chapterTitleDb = contentObj.chapterTitle || '';
    const summaryDb = contentObj.summary || '';
    
    // 获取或翻译英文内容（如果未提供自定义值）
    let chapterTitleEnDb = contentObj.chapterTitleEn || '';
    let summaryEnDb = contentObj.summaryEn || '';
    
    console.log('📋 检查英文翻译状态...');
    console.log('   标题:', finalChapterTitleEn ? '已有' : '需要翻译');
    console.log('   摘要:', finalSummaryEn ? '已有' : '需要翻译');
    
    // 如果缺少英文翻译，使用阿里云DashScope qwen-long-latest翻译
    if (!finalChapterTitleEn || !finalSummaryEn) {
      console.log('🌐 开始使用阿里云DashScope qwen-long-latest翻译内容...');
      sendProgress('Step 1: Translating content to English', 10);
      
      // 翻译标题
      if (!finalChapterTitleEn && finalChapterTitle) {
        console.log(`🌐 [翻译] 章节标题: ${finalChapterTitle}`);
        try {
          const translateTitleResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ALIYUN_API_KEY}`
            },
            body: JSON.stringify({
              model: 'qwen-long-latest',
              input: {
                messages: [
                  {
                    role: 'user',
                    content: `请将以下中文章节标题翻译成英文，只返回英文翻译，不要添加任何其他内容：\n${finalChapterTitle}`
                  }
                ]
              },
              parameters: {
                temperature: 0.3,
                max_tokens: 100
              }
            })
          });
          
          if (translateTitleResponse.ok) {
            const translateTitleData = await translateTitleResponse.json();
            finalChapterTitleEn = translateTitleData.output?.choices?.[0]?.message?.content?.trim() || translateTitleData.output?.text?.trim() || '';
            if (finalChapterTitleEn) {
              console.log(`✅ [翻译完成] 标题: ${finalChapterTitleEn}`);
            }
          }
        } catch (error) {
          console.error('❌ [翻译失败] 标题:', error.message);
        }
      }
      
      // 翻译摘要
      if (!finalSummaryEn && finalSummary) {
        console.log(`🌐 [翻译] 摘要: ${finalSummary.substring(0, 50)}...`);
        console.log(`🌐 [翻译] 摘要完整长度: ${finalSummary.length}字符`);
        console.log(`🌐 [翻译] 摘要结尾: ...${finalSummary.substring(Math.max(0, finalSummary.length - 100))}`);
        
        // 如果摘要太长，可能需要分段翻译
        const maxTranslationLength = 3000; // 单次翻译的最大字符数
        let translatedParts = [];
        
        if (finalSummary.length > maxTranslationLength) {
          console.log(`⚠️ 摘要过长(${finalSummary.length}字符)，将分段翻译`);
          // 按句子分段（尽量在句号、问号、感叹号处断开）
          const sentences = finalSummary.split(/([。！？.!?])/);
          let currentChunk = '';
          
          for (let i = 0; i < sentences.length; i += 2) {
            const sentence = sentences[i]?.trim();
            const punctuation = sentences[i + 1] || '';
            if (!sentence) continue;
            
            const fullSentence = sentence + punctuation;
            if ((currentChunk + fullSentence).length > maxTranslationLength && currentChunk) {
              // 翻译当前chunk
              translatedParts.push(currentChunk);
              currentChunk = fullSentence;
            } else {
              currentChunk += fullSentence;
            }
          }
          
          if (currentChunk) {
            translatedParts.push(currentChunk);
          }
        } else {
          translatedParts.push(finalSummary);
        }
        
        console.log(`📋 将分${translatedParts.length}段翻译`);
        
        try {
          // 逐段翻译
          for (let i = 0; i < translatedParts.length; i++) {
            const part = translatedParts[i];
            console.log(`🌐 [翻译] 第${i + 1}/${translatedParts.length}段，长度: ${part.length}字符`);
            
          const translateSummaryResponse = await fetch(DASHSCOPE_CHAT_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ALIYUN_API_KEY}`
            },
            body: JSON.stringify({
              model: 'qwen-long-latest',
              input: {
                messages: [
                  {
                    role: 'user',
                    content: `请将以下中文内容摘要完整翻译成英文，保持所有细节，不要限制字数，只返回英文翻译，不要添加任何其他内容：\n${part}`
                  }
                ]
              },
              parameters: {
                temperature: 0.3,
                max_tokens: 4000  // 增加token限制以确保完整翻译
              }
            })
          });
          
          if (translateSummaryResponse.ok) {
            const translateSummaryData = await translateSummaryResponse.json();
              const translatedPart = translateSummaryData.output?.choices?.[0]?.message?.content?.trim() || translateSummaryData.output?.text?.trim() || '';
              if (translatedPart) {
                console.log(`✅ [翻译完成] 第${i + 1}段: ${translatedPart.substring(0, 50)}... (长度: ${translatedPart.length}字符)`);
                if (!finalSummaryEn) {
                  finalSummaryEn = translatedPart;
                } else {
                  finalSummaryEn += ' ' + translatedPart;
                }
              } else {
                console.warn(`⚠️ [翻译警告] 第${i + 1}段翻译返回为空`);
              }
            } else {
              const errorText = await translateSummaryResponse.text();
              console.error(`❌ [翻译失败] 第${i + 1}段翻译API返回错误: ${translateSummaryResponse.status} - ${errorText}`);
            }
          }
          
          if (finalSummaryEn) {
            finalSummaryEn = finalSummaryEn.trim();
            console.log(`✅ [翻译完成] 完整摘要: ${finalSummaryEn.substring(0, 100)}... (总长度: ${finalSummaryEn.length}字符)`);
            console.log(`✅ [翻译完成] 摘要结尾: ...${finalSummaryEn.substring(Math.max(0, finalSummaryEn.length - 100))}`);
          } else {
            console.warn(`⚠️ [翻译警告] 所有段落翻译后仍为空`);
          }
        } catch (error) {
          console.error('❌ [翻译失败] 摘要:', error.message);
        }
      }
      
      // 保存翻译结果
      if (finalChapterTitleEn || finalSummaryEn) {
        const updateData = {};
        if (finalChapterTitleEn) {
          updateData.chapterTitleEn = finalChapterTitleEn;
        }
        if (finalSummaryEn) {
          updateData.summaryEn = finalSummaryEn;
        }
        await db.update('ExtractedContent', updateData, 'id = ?', [contentId]);
        console.log('✅ 英文翻译已保存');
      }
    }
    
    // 检查翻译结果，使用finalSummaryEn
    if (!finalChapterTitleEn || !finalSummaryEn) {
      console.error('❌ 英文翻译检查失败:');
      console.error(`   标题: ${finalChapterTitleEn ? '✓' : '✗'}`);
      console.error(`   摘要: ${finalSummaryEn ? `✓ (${finalSummaryEn.length}字符)` : '✗'}`);
      return res.status(400).json({
        success: false,
        message: '英文翻译失败，无法生成英文视频'
      });
    }
    
    // 确保finalSummaryEn包含完整内容
    console.log(`📝 最终使用的英文摘要长度: ${finalSummaryEn.length}字符`);
    console.log(`📝 最终使用的英文摘要预览: ${finalSummaryEn.substring(0, 200)}...`);
    
    // 步骤1: 使用阿里云DashScope Qwen TTS生成英文音频
    console.log('🎵 步骤1: 使用阿里云DashScope Qwen TTS生成英文音频...');
    
    // 获取集数信息，用于生成开场白
    const segmentIndexEn = contentObj.segmentIndex || 0;
    const bookObjEn = await db.findOne('SELECT * FROM Book WHERE id = ?', [contentObj.bookId]);
    const bookTitleEn = bookObjEn ? bookObjEn.title : '';
    
    // 查询同一本书的所有内容段，获取总集数
    let totalSegmentsEn = 0;
    if (bookObjEn) {
      const allSegmentsEn = await db.query(
        'SELECT COUNT(*) as count FROM ExtractedContent WHERE bookId = ?',
        [contentObj.bookId]
      );
      totalSegmentsEn = allSegmentsEn[0]?.count || 0;
    }
    
    // 根据集数生成英文开场白
    let openingTextEn = '';
    if (segmentIndexEn === 1 || totalSegmentsEn === 0) {
      // 第一集
      openingTextEn = bookTitleEn 
        ? `Hello, welcome to our book blog. Today we're starting with a book called "${bookTitleEn}". `
        : `Hello, welcome to our book blog. Today we're starting with a new book. `;
    } else if (segmentIndexEn === totalSegmentsEn && totalSegmentsEn > 0) {
      // 最后一集
      openingTextEn = bookTitleEn
        ? `Hello, this is the final episode of the "${bookTitleEn}" breakdown series. `
        : `Hello, this is the final episode of our book breakdown series. `;
    } else {
      // 中间集 - 随机选择一种开场白
      const middleOpeningsEn = [
        `Welcome back. In the previous episode, we discussed `,
        `Hello, this is the book blog. `,
        `Welcome back to our book blog. `
      ];
      openingTextEn = middleOpeningsEn[segmentIndexEn % middleOpeningsEn.length];
    }
    
    // 根据用户选择决定是否添加开场白
    // 确保finalSummaryEn是完整的，没有被截断
    console.log(`📝 检查finalSummaryEn完整性:`);
    console.log(`   finalSummaryEn长度: ${finalSummaryEn ? finalSummaryEn.length : 0}字符`);
    console.log(`   finalSummaryEn预览（前200字符）: ${finalSummaryEn ? finalSummaryEn.substring(0, 200) : '空'}...`);
    console.log(`   finalSummaryEn结尾（后100字符）: ${finalSummaryEn && finalSummaryEn.length > 100 ? '...' + finalSummaryEn.substring(finalSummaryEn.length - 100) : finalSummaryEn || '空'}`);
    
    // 如果finalSummaryEn为空或太短，尝试从数据库重新获取
    if (!finalSummaryEn || finalSummaryEn.trim().length < 50) {
      console.warn('⚠️ finalSummaryEn为空或太短，尝试从数据库重新获取...');
      const refreshedContentObj = await db.findOne('SELECT * FROM ExtractedContent WHERE id = ?', [contentId]);
      if (refreshedContentObj) {
        const dbSummaryEn = refreshedContentObj.summaryEn || '';
        if (dbSummaryEn && dbSummaryEn.length > finalSummaryEn.length) {
          console.log(`✅ 从数据库获取到更长的summaryEn: ${dbSummaryEn.length}字符`);
          finalSummaryEn = dbSummaryEn;
        }
      }
    }
    
    let audioText = `${finalSummaryEn}`.trim();
    // 根据 includeOpeningText 选项决定是否添加开场白
    if (includeOpeningText && openingTextEn && openingTextEn.trim()) {
      audioText = `${openingTextEn.trim()}${audioText}`;
    }
    const finalAudioText = audioText;
    console.log(`📝 添加英文开场白选项: ${includeOpeningText ? '是' : '否'}, 集数: ${segmentIndexEn}/${totalSegmentsEn}`);
    if (includeOpeningText && openingTextEn) {
      console.log(`📝 开场白: ${openingTextEn}`);
    }
    console.log('📝 最终英文文本长度:', finalAudioText.length, '字符');
    console.log('📝 最终英文文本预览（前200字符）:', finalAudioText.substring(0, 200) + '...');
    console.log('📝 最终英文文本结尾（后100字符）:', finalAudioText.length > 100 ? '...' + finalAudioText.substring(finalAudioText.length - 100) : finalAudioText);
    
    // 使用阿里云DashScope Qwen TTS进行语音合成
    console.log('🔵 ========== 使用阿里云DashScope Qwen TTS ==========');
    console.log('🔵 语言: English');
    console.log('🎵 调用阿里云DashScope TTS API，文本长度:', finalAudioText.length, '语言: English');
    
    // Qwen TTS音色：中英文都使用Ethan
    const voice = 'Ethan';
    console.log(`🎤 选择音色: ${voice} (英文)`);
    console.log(`📝 生成英文音频，文本长度: ${finalAudioText.length}，内容预览: ${finalAudioText.substring(0, 100)}...`);
    
    // 调用阿里云DashScope Qwen TTS HTTP SSE API
    const ALIYUN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    const ALIYUN_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-abe50fde91f242a682c8c6c189310db5';
    
    let englishAudioUrl;
    let audioBuffer = null;
    
    try {
      const requestBody = {
        model: 'qwen-tts',
        input: {
          text: finalAudioText,
          voice: voice,
          language_type: 'English'
        }
      };
      
      console.log('📋 请求参数:', JSON.stringify(requestBody, null, 2));
      
      const ttsResponse = await fetch(ALIYUN_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ALIYUN_API_KEY}`,
          'X-DashScope-SSE': 'enable' // 启用SSE流式响应
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 响应状态:', ttsResponse.status, ttsResponse.statusText);
      
      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error('❌ 阿里云DashScope TTS API失败:', ttsResponse.status, errorText);
        throw new Error(`阿里云DashScope TTS API失败: ${ttsResponse.status} ${ttsResponse.statusText} - ${errorText}`);
      }
      
      // 检查Content-Type判断响应格式
      const contentType = ttsResponse.headers.get('content-type') || '';
      console.log('📥 Content-Type:', contentType);
      
      let audioUrl = null;
      let audioBase64 = null;
      
      if (contentType.includes('text/event-stream')) {
        // SSE流式响应处理（与中文音频生成逻辑相同）
        console.log('📥 检测到SSE流式响应');
        const reader = ttsResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // 处理SSE行的辅助函数
        function processSSELine(line) {
          if (line.trim() === '' || line.startsWith(':')) return;
          
          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
            console.log('📥 SSE事件类型:', eventType);
            return;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6).trim();
              if (jsonStr === '[DONE]') {
                console.log('✅ 收到流结束标记');
                return;
              }
              
              // 尝试解析JSON，如果失败则尝试修复
              let data = null;
              try {
                data = JSON.parse(jsonStr);
              } catch (parseError) {
                if (jsonStr.includes('"url"')) {
                  console.warn('⚠️ JSON解析失败，但检测到url字段，尝试提取:', jsonStr.substring(0, 500));
                  const urlMatch = jsonStr.match(/"url"\s*:\s*"([^"]+)"/);
                  if (urlMatch && urlMatch[1]) {
                    audioUrl = urlMatch[1];
                    console.log('✅ 从不完整的JSON中提取到音频URL:', audioUrl);
                    return;
                  }
                }
                if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) {
                  console.warn('⚠️ JSON可能不完整，跳过:', jsonStr.substring(0, 200));
                  return;
                }
                throw parseError;
              }
              
              if (!data) return;
              console.log('📥 解析SSE数据:', JSON.stringify(data).substring(0, 300));
              
              if (data.code && data.message) {
                const errorCode = data.code || 'UnknownError';
                const errorMsg = data.message || '未知错误';
                console.error('❌ API返回错误:', errorCode, errorMsg);
                throw new Error(`阿里云DashScope TTS API错误: ${errorCode} - ${errorMsg}`);
      }
      
              if (data.output && data.output.audio) {
                const audio = data.output.audio;
                console.log('📥 找到output.audio对象:', JSON.stringify(audio).substring(0, 200));
                
                if (audio.url && audio.url.length > 0) {
                  audioUrl = audio.url;
                  console.log('✅ 从output.audio.url获取到音频URL:', audioUrl);
                }
                
                if (audio.data && audio.data.length > 0) {
                  if (!audioBase64) {
                    audioBase64 = '';
                  }
                  audioBase64 += audio.data;
                  console.log('✅ 累积output.audio.data，当前总长度:', audioBase64.length);
                }
              }
            } catch (e) {
              console.warn('⚠️ 解析SSE数据失败:', e.message, '行内容:', line.substring(0, 500));
            }
          }
        }
        
        // 读取和处理SSE流数据
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              console.log('📥 处理最后剩余的数据:', buffer.substring(0, 1000));
              if (buffer.includes('"url"')) {
                console.log('📥 检测到buffer中包含url字段');
                const urlMatch = buffer.match(/"url"\s*:\s*"([^"]+)"/);
                if (urlMatch && urlMatch[1]) {
                  audioUrl = urlMatch[1];
                  console.log('✅ 从buffer中提取到音频URL:', audioUrl);
                }
              }
              const finalLines = buffer.split('\n');
              for (const line of finalLines) {
                if (line.trim() && !line.startsWith(':')) {
                  processSSELine(line.trim());
                }
              }
            }
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          console.log('📥 收到SSE数据块（原始）:', chunk.substring(0, 200));
          
          // 检查chunk中是否包含URL
          if (chunk.includes('"url"')) {
            console.log('📥 检测到chunk中包含url字段');
            const urlMatch = chunk.match(/"url"\s*:\s*"([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
              audioUrl = urlMatch[1];
              console.log('✅ 从chunk中提取到音频URL:', audioUrl);
        }
          }
          
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() && !line.startsWith(':')) {
              processSSELine(line.trim());
            }
          }
      }
      
        console.log('📥 SSE流处理完成，audioUrl:', audioUrl ? `已获取: ${audioUrl.substring(0, 100)}...` : '未获取', 'audioBase64长度:', audioBase64 ? audioBase64.length : 0);
      } else {
        // 普通JSON响应
        console.log('📥 检测到JSON响应');
        const responseData = await ttsResponse.json();
        console.log('📥 完整响应数据:', JSON.stringify(responseData, null, 2));
        
        if (responseData.output && responseData.output.audio) {
          audioUrl = responseData.output.audio.url || responseData.output.audio;
        }
        if (responseData.audio) {
          audioUrl = responseData.audio;
        }
        if (responseData.output && responseData.output.audio && responseData.output.audio.data) {
          audioBase64 = responseData.output.audio.data;
        }
      }
      
      // 处理音频数据
      if (audioUrl) {
        console.log('📥 下载音频文件，URL:', audioUrl);
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`下载音频文件失败: ${audioResponse.statusText}`);
        }
        const audioArrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(audioArrayBuffer);
        console.log('✅ 音频下载完成，Buffer长度:', audioBuffer.length);
      } else if (audioBase64) {
        console.log('📥 解码Base64音频数据，长度:', audioBase64.length);
        audioBuffer = Buffer.from(audioBase64, 'base64');
        console.log('✅ Base64解码完成，Buffer长度:', audioBuffer.length);
      } else {
        throw new Error('阿里云DashScope TTS API未返回音频数据（未找到audio或audio_base64字段）');
      }
      
      // 将音频文件上传到七牛云
      const fileName = `audio_en_${contentId}_${Date.now()}.mp3`;
      
      console.log('📤 开始上传英文音频到七牛云...');
      sendProgress('Step 1: Uploading audio file', 30);
      
      englishAudioUrl = await uploadFile(audioBuffer, fileName, 'audio/mpeg', 'audios');
      
      console.log('✅ 英文音频上传成功，URL:', englishAudioUrl);
      
    } catch (error) {
      console.error('❌ 阿里云DashScope TTS API调用失败:', error);
      throw error;
    }
    
    // 更新内容对象
    await db.update('ExtractedContent', { audioUrlEn: englishAudioUrl, videoStatus: 'generating' }, 'id = ?', [contentId]);
    
    // 步骤2: 使用博客封面图生成英文视频（与中文视频逻辑相同）
    console.log('🎞️ 步骤2: 使用博客封面图生成英文视频...');
    
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    
    // 下载英文音频（从OSS）
    let finalEnglishAudioUrl = englishAudioUrl;
    if (finalEnglishAudioUrl.startsWith('http://')) {
      finalEnglishAudioUrl = finalEnglishAudioUrl.replace('http://', 'https://');
    }
    tempAudioPath = path.join(tempDir, `audio_en_${contentId}_${timestamp}.mp3`);
    console.log('📥 开始下载英文音频:', finalEnglishAudioUrl);
    sendProgress('Step 2: Downloading audio file', 40);
    
    let audioResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      audioResponse = await fetch(finalEnglishAudioUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      throw new Error(`下载英文音频失败: ${fetchError.message}`);
    }
    
    if (!audioResponse.ok) {
      throw new Error(`下载英文音频失败 (${audioResponse.status}): ${audioResponse.statusText}`);
    }
    
    const downloadedAudioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await fs.writeFile(tempAudioPath, downloadedAudioBuffer);
    console.log('✅ 英文音频下载完成，大小:', downloadedAudioBuffer.length, 'bytes');
    
    // 获取音频时长
    const audioDuration = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempAudioPath, (err, metadata) => {
        if (err) {
          console.error('❌ 获取音频时长失败:', err);
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          console.log('✅ 英文音频时长:', duration, '秒');
          resolve(duration);
        }
      });
    });
    
    const audioDurationSeconds = Math.ceil(audioDuration);
    console.log('📊 英文音频总时长:', audioDurationSeconds, '秒');
    
    // 使用腾讯云ASR生成英文字幕文件（基于音频URL）
    // 确保音频URL是HTTPS格式
    let audioUrlForASR = finalEnglishAudioUrl;
    if (audioUrlForASR.startsWith('http://')) {
      audioUrlForASR = audioUrlForASR.replace('http://', 'https://');
    }
    
    console.log('🎤 使用英文音频URL生成字幕:', audioUrlForASR);
    sendProgress('Step 1: Generating subtitle file', 30);
    tempSubtitlePath = await generateSubtitleFile(
      audioUrlForASR,
      'en',
      tempDir,
      contentId,
      timestamp
    );
    
    if (tempSubtitlePath) {
      console.log('✅ 英文字幕文件生成成功，路径:', tempSubtitlePath);
      sendProgress('Step 1: Subtitle generation completed', 40);
    } else {
      console.warn('⚠️ 英文字幕生成失败，视频将继续生成但不包含字幕');
      console.warn('⚠️ 请检查：1. 腾讯云ASR配置是否正确 2. 音频URL是否可访问 3. 查看上方错误日志');
      sendProgress('Step 1: Subtitle generation failed, continuing without subtitles', 40);
    }
    
    // 下载博客封面图
    console.log('📥 Starting to download blog cover image:', finalCoverImageUrl);
    let coverImageResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      coverImageResponse = await fetch(finalCoverImageUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      throw new Error(`下载博客封面图失败: ${fetchError.message}`);
    }
    
    if (!coverImageResponse.ok) {
      throw new Error(`下载博客封面图失败 (${coverImageResponse.status}): ${coverImageResponse.statusText}`);
    }
    
    const coverImageBuffer = Buffer.from(await coverImageResponse.arrayBuffer());
    const coverImagePath = path.join(tempDir, `cover_en_${contentId}_${timestamp}.jpg`);
    await fs.writeFile(coverImagePath, coverImageBuffer);
    console.log('✅ 博客封面图保存完成');
    sendProgress('Step 2: Cover image downloaded', 50);
    
    // 视频参数（9:16比例，720x1280）
    const videoWidth = 720;
    const videoHeight = 1280;
    const fps = 30;
    
    // 使用ffmpeg将博客封面图转换为视频（静态图片，匹配音频时长）
    tempVideoPath = path.join(tempDir, `video_en_${contentId}_${timestamp}.mp4`);
    console.log('🎞️ 开始生成英文视频（使用博客封面图）');
    sendProgress('Step 2: Generating video', 55);
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      // 使用ffmpeg将封面图转换为视频（循环播放以匹配音频时长）
      const ffmpegProcess = ffmpeg()
        .input(coverImagePath)
        .inputOptions([
          '-loop', '1',
          '-t', audioDurationSeconds.toString()
        ])
        .complexFilter([
          // 缩放封面图到目标尺寸（保持宽高比，居中）
          `[0:v]scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease,pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2:black[out]`
        ])
        .outputOptions([
          '-map', '[out]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', fps.toString(),
          '-t', audioDurationSeconds.toString()
        ])
        .output(tempVideoPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg视频生成命令:', commandLine);
          timeoutId = setTimeout(() => {
            console.error('❌ 视频生成超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频生成超时，请重试'));
          }, timeout);
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频生成完成');
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ FFmpeg视频生成失败:', err);
          reject(err);
        })
        .on('stderr', (stderrLine) => {
          if (stderrLine.includes('time=')) {
            console.log('📊 FFmpeg进度:', stderrLine.trim());
          }
        })
        .run();
    });
    
    // 合并视频和音频
    tempOutputPath = path.join(tempDir, `output_en_${contentId}_${timestamp}.mp4`);
    console.log('🎞️ 开始合并视频和音频');
    sendProgress('Step 2: Merging and compositing video', 75);
    
    let finalVideoPath = tempVideoPath;
    // 使用更严格的比较，考虑浮点数误差，如果视频时长 < 音频时长（即使只差0.1秒），也需要拼接
    if (videoDuration < audioDuration) {
      console.log(`⚠️ 中文视频时长(${videoDuration}秒) < 英文音频时长(${audioDuration}秒)，需要重复拼接视频`);
      // 多拼接一些，确保视频时长 >= 音频时长（添加10%的缓冲）
      const repeatCount = Math.ceil((audioDuration * 1.1) / videoDuration);
      console.log(`🔄 需要重复 ${repeatCount} 次视频（包含10%缓冲，确保视频时长 >= 音频时长）`);
      console.log(`📊 计算详情: 音频时长=${audioDuration}秒, 视频时长=${videoDuration}秒, 重复次数=${repeatCount}`);
      
      // 创建视频列表文件用于concat
      concatListPath = path.join(tempDir, `concat_list_${contentId}_${timestamp}.txt`);
      const concatListContent = Array(repeatCount).fill(`file '${tempVideoPath.replace(/'/g, "\\'")}'`).join('\n');
      await fs.writeFile(concatListPath, concatListContent);
      console.log('📝 创建视频拼接列表文件:', concatListPath);
      
      // 拼接重复的视频
      concatenatedVideoPath = path.join(tempDir, `concatenated_video_${contentId}_${timestamp}.mp4`);
      await new Promise((resolve, reject) => {
        let timeoutId = null;
        const timeout = 300000; // 5分钟超时
        
        const concatProcess = ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions([
            '-c:v copy', // 复制视频流
            '-c:a copy'  // 复制音频流（如果有）
          ])
          .output(concatenatedVideoPath)
          .on('start', (commandLine) => {
            console.log('🎬 FFmpeg拼接命令:', commandLine);
            timeoutId = setTimeout(() => {
              console.error('❌ 视频拼接超时（5分钟）');
              concatProcess.kill('SIGKILL');
              reject(new Error('视频拼接超时，请重试'));
            }, timeout);
          })
          .on('end', () => {
            if (timeoutId) clearTimeout(timeoutId);
            console.log('✅ 视频拼接完成');
            resolve(null);
          })
          .on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            console.error('❌ FFmpeg拼接失败:', err);
            // 如果copy失败，尝试重新编码
            if (err.message && err.message.includes('copy')) {
              console.log('⚠️ 视频流复制失败，尝试重新编码拼接...');
              const fallbackProcess = ffmpeg()
                .input(concatListPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions([
                  '-c:v libx264',
                  '-preset ultrafast',
                  '-crf 23',
                  '-pix_fmt yuv420p',
                  '-s 720x1280',
                  '-aspect 9:16'
                ])
                .output(concatenatedVideoPath)
                .on('end', () => {
                  console.log('✅ 视频拼接完成（使用重新编码）');
                  resolve(null);
                })
                .on('error', (fallbackErr) => {
                  console.error('❌ 重新编码拼接也失败:', fallbackErr);
                  reject(fallbackErr);
                })
                .run();
            } else {
              reject(err);
            }
          })
          .run();
      });
      
      finalVideoPath = concatenatedVideoPath;
      console.log('✅ 视频重复拼接完成，使用拼接后的视频');
      
      // 验证拼接后的视频时长是否 >= 音频时长
      const concatenatedVideoDuration = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(concatenatedVideoPath, (err, metadata) => {
          if (err) {
            console.error('❌ 获取拼接后视频时长失败:', err);
            reject(err);
          } else {
            const duration = metadata.format.duration || 0;
            console.log('📹 拼接后视频时长:', duration, '秒');
            resolve(duration);
          }
        });
      });
      
      // 如果拼接后的视频时长仍然 < 音频时长，需要继续拼接
      if (concatenatedVideoDuration < audioDuration) {
        console.log(`⚠️ 拼接后视频时长(${concatenatedVideoDuration}秒) < 音频时长(${audioDuration}秒)，需要继续拼接`);
        const additionalRepeatCount = Math.ceil((audioDuration - concatenatedVideoDuration) / videoDuration) + 1; // 多拼接一些，确保足够
        console.log(`🔄 需要额外重复 ${additionalRepeatCount} 次视频`);
        
        // 创建新的concat列表，包含原始视频和已拼接的视频
        const additionalConcatListPath = path.join(tempDir, `concat_list_additional_${contentId}_${timestamp}.txt`);
        const additionalConcatContent = [
          `file '${concatenatedVideoPath.replace(/'/g, "\\'")}'`, // 先包含已拼接的视频
          ...Array(additionalRepeatCount).fill(`file '${tempVideoPath.replace(/'/g, "\\'")}'`) // 再添加额外的重复
        ].join('\n');
        await fs.writeFile(additionalConcatListPath, additionalConcatContent);
        console.log('📝 创建额外拼接列表文件:', additionalConcatListPath);
        
        // 再次拼接
        const finalConcatenatedVideoPath = path.join(tempDir, `final_concatenated_video_${contentId}_${timestamp}.mp4`);
        await new Promise((resolve, reject) => {
          let timeoutId = null;
          const timeout = 300000;
          
          const additionalConcatProcess = ffmpeg()
            .input(additionalConcatListPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions([
              '-c:v copy',
              '-c:a copy'
            ])
            .output(finalConcatenatedVideoPath)
            .on('start', (commandLine) => {
              console.log('🎬 FFmpeg额外拼接命令:', commandLine);
              timeoutId = setTimeout(() => {
                console.error('❌ 额外视频拼接超时（5分钟）');
                additionalConcatProcess.kill('SIGKILL');
                reject(new Error('额外视频拼接超时，请重试'));
              }, timeout);
            })
            .on('end', () => {
              if (timeoutId) clearTimeout(timeoutId);
              console.log('✅ 额外视频拼接完成');
              resolve(null);
            })
            .on('error', (err) => {
              if (timeoutId) clearTimeout(timeoutId);
              console.error('❌ FFmpeg额外拼接失败:', err);
              reject(err);
            })
            .run();
        });
        
        // 更新最终视频路径和清理列表
        if (concatListPath) {
          try {
            await fs.unlink(concatListPath);
          } catch (e) {
            console.warn('⚠️ 清理旧concat列表文件失败:', e.message);
          }
        }
        try {
          await fs.unlink(concatenatedVideoPath);
        } catch (e) {
          console.warn('⚠️ 清理中间拼接视频失败:', e.message);
        }
        
        concatenatedVideoPath = finalConcatenatedVideoPath;
        concatListPath = additionalConcatListPath;
        finalVideoPath = finalConcatenatedVideoPath;
        console.log('✅ 最终视频拼接完成，确保视频时长 >= 音频时长');
      } else {
        console.log('✅ 拼接后视频时长足够，无需额外拼接');
      }
    } else {
      console.log('✅ 视频时长足够，无需重复拼接');
    }
    
    // 合并视频和音频（如果有字幕则嵌入字幕）
    tempOutputPath = path.join(tempDir, `output_en_${contentId}_${timestamp}.mp4`);
    console.log('🎞️ 开始合并视频和音频' + (tempSubtitlePath ? '（包含字幕）' : ''));
    
    // 如果有字幕文件，先验证文件是否存在
    if (tempSubtitlePath) {
      try {
        await fs.access(tempSubtitlePath);
        const stats = await fs.stat(tempSubtitlePath);
        console.log('✅ 字幕文件存在，路径:', tempSubtitlePath);
        console.log('✅ 字幕文件大小:', stats.size, '字节');
      } catch (accessError) {
        console.error('❌ 字幕文件不存在或无法访问:', tempSubtitlePath);
        console.error('❌ 错误详情:', accessError.message);
        throw new Error(`字幕文件不存在: ${tempSubtitlePath}`);
      }
    }
    
    await new Promise((resolve, reject) => {
      let timeoutId = null;
      const timeout = 300000; // 5分钟超时
      
      let ffmpegProcess = ffmpeg()
        .input(finalVideoPath) // 使用finalVideoPath（可能已拼接）
        .input(tempAudioPath);
      
      // 如果有字幕文件，添加字幕滤镜
      if (tempSubtitlePath) {
        console.log('📝 添加字幕到视频:', tempSubtitlePath);
        // 验证字幕文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(tempSubtitlePath)) {
          console.error('❌ 字幕文件不存在:', tempSubtitlePath);
          throw new Error(`字幕文件不存在: ${tempSubtitlePath}`);
        }
        const subtitleStats = fs.statSync(tempSubtitlePath);
        console.log('✅ 字幕文件存在，大小:', subtitleStats.size, '字节');
        const escapedSubtitlePath = escapeSubtitlePath(tempSubtitlePath);
        console.log('📝 转义后的字幕路径:', escapedSubtitlePath);
        
        ffmpegProcess = ffmpegProcess
          .complexFilter([
            // 缩放视频
            `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black[v]`,
            // 添加字幕（硬字幕，烧录到视频帧上）
            // 显式指定输入编码为UTF-8，确保中文字幕正确显示
            // 字幕文件已使用UTF-8 BOM编码，但显式指定charenc参数更可靠
            // 字幕样式：白色文字，无阴影，中灰色描边，位置居中（画面正中心偏下），确保在屏幕内
            // PrimaryColour=&Hffffff：白色文字
            // Outline=1：细边框
            // Shadow=0：无阴影效果
            // OutlineColour=&H606060：深灰色描边
            // Alignment=5：画面正中心（锚点在正中心）
            // WrapStyle=0：智能换行，长文本自动换行不超出屏幕（更激进的换行策略）
            // MarginL=50,MarginR=50：左右边距50像素，确保字幕不超出屏幕边界（720宽度，可用620）
            // MarginV=80：垂直边距80像素，让字幕从中心往下移动，位置固定不变
            // 注意：force_style参数值使用单引号包裹，内部不需要转义（FFmpeg会自动处理）
            // FontSize=8：字体大小8
            // OutlineColour=&H606060：深灰色描边
            `[v]subtitles='${escapedSubtitlePath}':charenc=UTF-8:force_style='FontSize=8,PrimaryColour=&Hffffff,OutlineColour=&H606060,Outline=1,Shadow=0,Alignment=5,MarginL=50,MarginR=50,MarginV=80,WrapStyle=0'[outv]`
          ])
          .outputOptions([
            '-map', '[outv]',
            '-map', '1:a',  // 映射音频流（第二个输入文件的音频）
            '-c:v libx264',
            '-preset medium',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-profile:v baseline', // 使用baseline profile确保最大兼容性
            '-level 3.0', // H.264 level 3.0，确保兼容性
            '-c:a aac',
            '-b:a 128k',
            '-shortest',
            '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
          ]);
      } else {
        // 即使没有字幕，也重新编码以确保faststart生效和兼容性
        ffmpegProcess = ffmpegProcess.outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-profile:v baseline', // 使用baseline profile确保最大兼容性
          '-level 3.0', // H.264 level 3.0，确保兼容性
          '-c:a aac',
          '-b:a 128k',
          '-shortest',
          '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
        ]);
      }
      
      ffmpegProcess = ffmpegProcess.output(tempOutputPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg合并命令:', commandLine);
          timeoutId = setTimeout(() => {
            console.error('❌ 视频合并超时（5分钟）');
            ffmpegProcess.kill('SIGKILL');
            reject(new Error('视频合并超时，请重试'));
          }, timeout);
        })
        .on('stderr', (stderrLine) => {
          // 记录所有stderr输出，特别是错误和警告
          const line = stderrLine.trim();
          // 优先记录字幕相关的所有输出
          if (line.includes('Parsed_subtitles') || line.includes('libass') || line.includes('fontselect') || 
              line.includes('Glyph') || line.includes('ASS') || line.includes('subtitles') || 
              line.includes('Subtitle') || line.includes('字幕') || line.includes('font') || 
              line.includes('Font') || line.includes('字体')) {
            console.warn('⚠️ FFmpeg字幕相关:', line);
          } else if (line.includes('time=')) {
            console.log('📊 FFmpeg进度:', line);
          } else if (line.includes('error') || line.includes('Error') || line.includes('ERROR') || 
                     line.includes('warning') || line.includes('Warning') || line.includes('WARNING')) {
            console.warn('⚠️ FFmpeg stderr:', line);
          } else if (line.length > 0 && !line.match(/^frame=\s*\d+/) && 
                     !line.match(/^Stream mapping/) && !line.match(/^Press \[q\]/) &&
                     !line.match(/^\[libx264\]/) && !line.match(/^\[Parsed_scale/) &&
                     !line.match(/^\[Parsed_pad/) && !line.match(/^Output #0/) &&
                     !line.match(/^\[out#/) && !line.match(/^\[libx264 @/) &&
                     !line.match(/^configuration:/) && !line.match(/^Input #/) &&
                     !line.match(/^Duration:/) && !line.match(/^Stream #/)) {
            // 记录其他非进度信息（排除常见的进度和状态行）
            console.log('📝 FFmpeg输出:', line);
          }
        })
        .on('end', () => {
          if (timeoutId) clearTimeout(timeoutId);
          console.log('✅ 视频合并完成');
          sendProgress('Step 2: Video merge completed', 85);
          resolve(null);
        })
        .on('error', (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('❌ FFmpeg合并失败:', err);
          console.error('❌ FFmpeg错误详情:', err.message);
          console.error('❌ FFmpeg错误堆栈:', err.stack);
          // 如果编码失败，尝试使用更快的预设
          console.log('⚠️ 视频编码失败，尝试使用ultrafast预设...');
          let fallbackProcess = ffmpeg()
            .input(finalVideoPath)
            .input(tempAudioPath);
          
          // 如果有字幕，添加字幕滤镜
          if (tempSubtitlePath) {
            fallbackProcess = fallbackProcess
              .complexFilter([
                `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black[v]`,
                `[v]subtitles='${escapeSubtitlePath(tempSubtitlePath)}':charenc=UTF-8:force_style='FontSize=8,PrimaryColour=&Hffffff,OutlineColour=&H606060,Outline=1,Shadow=0,Alignment=5,MarginV=80,MarginL=50,MarginR=50,WrapStyle=0'[outv]`
              ])
              .outputOptions([
                '-map', '[outv]',
                '-map', '1:a',  // 映射音频流（第二个输入文件的音频）
                '-c:v libx264',
                '-preset ultrafast',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-profile:v baseline', // 使用baseline profile确保最大兼容性
                '-level 3.0', // H.264 level 3.0，确保兼容性
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
                '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
              ]);
          } else {
            fallbackProcess = fallbackProcess.outputOptions([
              '-c:v libx264',
              '-preset ultrafast',
              '-crf 23',
              '-pix_fmt yuv420p',
              '-profile:v baseline', // 使用baseline profile确保最大兼容性
              '-level 3.0', // H.264 level 3.0，确保兼容性
              '-s 720x1280',
              '-aspect 9:16',
              '-c:a aac',
              '-b:a 128k',
              '-shortest',
              '-movflags +faststart' // 优化web播放，将moov atom移到文件开头
            ]);
          }
            
          fallbackProcess = fallbackProcess.output(tempOutputPath)
            .on('end', () => {
              console.log('✅ 视频合并完成（使用重新编码）');
              resolve(null);
            })
            .on('error', (fallbackErr) => {
              console.error('❌ 重新编码也失败:', fallbackErr);
              reject(fallbackErr);
            })
            .run();
        })
        .run();
    });
    
    // 上传合并后的视频到OSS
    console.log('📤 开始上传英文视频到OSS...');
    sendProgress('Step 2: Uploading video', 90);
    const videoBuffer2 = await fs.readFile(tempOutputPath);
    const fileSizeMB = (videoBuffer2.length / 1024 / 1024).toFixed(2);
    console.log(`📊 视频文件大小: ${fileSizeMB}MB`);
    
    // 设置上传超时时间（10分钟）
    const uploadStartTime = Date.now();
    let finalVideoUrl;
    try {
      finalVideoUrl = await Promise.race([
        uploadFile(videoBuffer2, `video_en_${contentId}_${timestamp}.mp4`, 'video/mp4', 'videos'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('视频上传超时，请检查网络连接或文件大小')), 10 * 60 * 1000)
        )
      ]);
      const uploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`✅ 英文视频上传成功，耗时: ${uploadTime}秒，URL:`, finalVideoUrl);
      sendProgress('Step 2: Video upload completed', 95);
    } catch (error) {
      console.error('❌ 英文视频上传失败:', error);
      console.error('错误详情:', error.message);
      throw new Error(`视频上传失败: ${error.message}`);
    }
    
    // 更新内容对象
    await db.update('ExtractedContent', { videoUrlEn: finalVideoUrl, videoStatus: 'completed' }, 'id = ?', [contentId]);
    
    // 清理临时文件（包括字幕文件）
    const cleanupFiles = [tempVideoPath, tempAudioPath, tempOutputPath, tempSubtitlePath].filter(Boolean);
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn(`⚠️ 清理临时文件失败: ${filePath}`, err.message);
      }
    }
    
    console.log('✅ 英文视频生成完成');
    
    // 发送完成消息
    cleanup();
    sendProgress('英文视频生成完成', 100);
    const responseData = {
      success: true,
      data: {
        videoUrlEn: finalVideoUrl,
        audioUrlEn: englishAudioUrl,
        chapterTitleEn: chapterTitleEn,
        summaryEn: summaryEn,
        contentId: contentId,
        language: 'en'
      }
    };
    
    if (useSSE) {
      // SSE格式响应
      responseData.completed = true;
      const finalData = JSON.stringify(responseData);
      res.write(`data: ${finalData}\n\n`);
      res.end();
    } else {
      // JSON格式响应（兼容模式）
      res.json(responseData);
    }
    
  } catch (error) {
    cleanup();
    console.error('❌ 生成英文视频失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
    
    // 清理临时文件（包括字幕文件）
    const cleanupFiles = [tempVideoPath, tempAudioPath, tempOutputPath, tempSubtitlePath].filter(Boolean);
    for (const filePath of cleanupFiles) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn(`⚠️ 清理临时文件失败: ${filePath}`, err.message);
      }
    }
    
    // 如果响应还没有发送，发送错误响应
    if (!res.headersSent) {
      // 更新状态为失败
      try {
        await db.update('ExtractedContent', { videoStatus: 'failed' }, 'id = ?', [req.params.contentId]);
      } catch (updateError) {
        console.error('❌ 更新内容状态失败:', updateError);
      }

      // 发送错误消息
      const errorResponse = {
        success: false,
        message: `生成英文视频失败: ${error.message}`,
        error: error.message || String(error)
      };
      
      // 在开发环境下返回更多调试信息
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
        errorResponse.stack = error.stack;
        errorResponse.details = JSON.stringify(error, Object.getOwnPropertyNames(error));
      }
      
      if (useSSE) {
        // SSE格式响应
        errorResponse.completed = true;
        const errorData = JSON.stringify(errorResponse);
        res.write(`data: ${errorData}\n\n`);
        res.end();
      } else {
        // JSON格式响应（兼容模式）
        res.status(500).json(errorResponse);
      }
    } else {
      console.error('❌ 响应已发送，无法发送错误响应');
    }
  }
});

// 获取书籍的提取内容列表
router.get('/:bookId/contents', async (req, res) => {
  try {
    const { bookId } = req.params;

    const contents = await db.findAll(`
      SELECT * FROM ExtractedContent 
      WHERE bookId = ? 
      ORDER BY segmentIndex ASC
    `, [bookId]);

    const contentsData = contents.map(content => ({
      id: content.id,
      chapterTitle: content.chapterTitle,
      chapterTitleEn: content.chapterTitleEn,
      summary: content.summary,
      summaryEn: content.summaryEn,
      avatarDescription: content.avatarDescription,
      estimatedDuration: content.estimatedDuration,
      videoStatus: content.videoStatus,
      videoUrl: content.videoUrl,
      videoUrlEn: content.videoUrlEn,
      audioUrl: content.audioUrl,
      audioUrlEn: content.audioUrlEn,
      silentVideoUrl: content.silentVideoUrl,
      avatarImageUrl: content.avatarImageUrl,
      segmentIndex: content.segmentIndex
    }));

    res.json({
      success: true,
      data: contentsData
    });
  } catch (error) {
    console.error('获取提取内容失败:', error);
    res.status(500).json({
      success: false,
      message: '获取提取内容失败',
      error: error.message
    });
  }
});

// 获取单个书籍详情
router.get('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '缺少书籍ID'
      });
    }

    const book = await db.findOne(`
      SELECT b.*, 
             c.id as category_id, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder
      FROM Book b
      LEFT JOIN Category c ON b.categoryId = c.id
      WHERE b.id = ?
    `, [bookId]);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }

    const bookData = {
      id: book.id,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category_id ? {
        id: book.category_id,
        name: book.category_name,
        nameCn: book.category_nameCn,
        sortOrder: book.category_sortOrder
      } : undefined,
      coverUrl: book.coverUrl,
      blogCoverUrl: book.blogCoverUrl,
      fileUrl: book.fileUrl,
      uploadDate: book.uploadDate,
      status: book.status,
      createdAt: book.createdAt
    };

    res.json({
      success: true,
      data: bookData
    });
  } catch (error) {
    console.error('获取书籍详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取书籍详情失败'
    });
  }
});

// 更新书籍（使用Master Key绕过ACL）
router.put('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, author, categoryId } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '缺少书籍ID'
      });
    }

    // 更新书籍
    const updateData = {};
    if (title) updateData.title = title;
    if (author) updateData.author = author;
    if (categoryId) updateData.categoryId = categoryId;
    
    await db.update('Book', updateData, 'id = ?', [bookId]);

    // 重新获取更新后的书籍信息（包含关联的分类）
    const updatedBook = await db.findOne(`
      SELECT b.*, c.id as category_id, c.nameCn as category_nameCn
      FROM Book b
      LEFT JOIN Category c ON b.categoryId = c.id
      WHERE b.id = ?
    `, [bookId]);

    res.json({
      success: true,
      message: '更新成功',
      data: {
        id: updatedBook.id,
        title: updatedBook.title,
        author: updatedBook.author,
        category: updatedBook.category_id ? {
          id: updatedBook.category_id,
          nameCn: updatedBook.category_nameCn
        } : null
      }
    });
  } catch (error) {
    console.error('更新书籍失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新失败'
    });
  }
});

// 删除书籍（使用Master Key绕过ACL）
router.delete('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: '缺少书籍ID'
      });
    }

    // 删除书籍
    const book = await db.findOne('SELECT id FROM Book WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: '书籍不存在'
      });
    }
    await db.remove('Book', 'id = ?', [bookId]);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除书籍失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除失败'
    });
  }
});

module.exports = router;


