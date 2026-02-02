// 文件上传辅助函数（上传到七牛云并保存文件信息到数据库）
const qiniu = require('qiniu');
const db = require('./db');

// 七牛云配置（从环境变量或默认值）
const QINIU_URL = process.env.QINIU_URL || 'https://trainspace.ashgso.com';
const QINIU_BUCKET = process.env.QINIU_BUCKET || 'trainspace';
const QINIU_ACCESS_KEY = process.env.QINIU_ACCESS_KEY || 'LovYLFiZZuPFtvGLTjlCXe3l7YcJq3yEmsCOBpSU';
const QINIU_SECRET_KEY = process.env.QINIU_SECRET_KEY || 'ISfANLfFxsgWn0cFlZD2jLlmEbBV4QSnjW5Y_55u';

const qiniuConfig = new qiniu.conf.Config();
qiniuConfig.zone = qiniu.zone.Zone_z2; // 华南区域（根据错误提示，bucket trainspace在z2区域）
const mac = new qiniu.auth.digest.Mac(QINIU_ACCESS_KEY, QINIU_SECRET_KEY);

/**
 * 上传文件到七牛云并保存文件信息到数据库
 * @param {Buffer} buffer - 文件内容
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME类型
 * @returns {Promise<string>} 文件URL
 */
async function uploadFile(buffer, fileName, mimeType = 'application/octet-stream', folder = 'general') {
  try {
    // 上传到七牛云
    const qiniuPath = `${folder}/${Date.now()}_${fileName}`;
    console.log('📤 上传文件到七牛云:', qiniuPath);
    
    // 生成上传凭证
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${QINIU_BUCKET}:${qiniuPath}`,
    });
    const uploadToken = putPolicy.uploadToken(mac);
    
    // 配置上传参数
    const formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
    const putExtra = new qiniu.form_up.PutExtra();
    
    // 如果是视频文件，设置特殊的元数据以优化播放
    if (mimeType.startsWith('video/')) {
      // 设置文件元数据，确保CDN正确处理视频文件
      putExtra.mimeType = mimeType;
      // 设置缓存控制，确保视频文件可以被正确缓存和流式传输
      putExtra.params = {
        'x:cache-control': 'public, max-age=31536000',
        'x:content-type': mimeType
      };
    }
    
    // 上传文件
    return new Promise((resolve, reject) => {
      formUploader.put(uploadToken, qiniuPath, buffer, putExtra, async (respErr, respBody, respInfo) => {
        if (respErr) {
          console.error('❌ 七牛云上传失败:', respErr);
          reject(new Error(`七牛云上传失败: ${respErr.message || respErr}`));
          return;
        }
        
        if (respInfo.statusCode === 200) {
          // 构建文件URL（使用自定义域名）
          const qiniuDomain = QINIU_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const fileUrl = `https://${qiniuDomain}/${respBody.key}`;
          
          // 保存文件信息到数据库
          try {
            await db.insert('File', {
              name: fileName,
              url: fileUrl,
              size: buffer.length,
              mimeType: mimeType
            });
            console.log('✅ 文件信息已保存到数据库');
          } catch (dbError) {
            console.warn('⚠️ 保存文件信息到数据库失败:', dbError.message);
            // 即使数据库保存失败，也返回URL
          }
          
          console.log('✅ 文件上传到七牛云成功，URL:', fileUrl);
          resolve(fileUrl);
        } else {
          console.error('❌ 七牛云上传失败，状态码:', respInfo.statusCode, '响应:', respBody);
          reject(new Error(`七牛云上传失败: ${respInfo.statusCode} - ${JSON.stringify(respBody)}`));
        }
      });
    });
  } catch (error) {
    console.error('❌ 上传文件失败:', error);
    throw error;
  }
}

/**
 * 生成七牛云私有下载URL（带签名，解决CORS和防盗链问题）
 * @param {string} fileUrl - 文件URL
 * @param {number} expiresIn - 过期时间（秒），默认3600秒（1小时）
 * @returns {string} 带签名的下载URL
 */
function getPrivateDownloadUrl(fileUrl, expiresIn = 3600) {
  try {
    const bucketManager = new qiniu.rs.BucketManager(mac, qiniuConfig);
    const qiniuDomain = QINIU_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // 从完整URL中提取文件路径
    let fileKey;
    try {
      // 如果fileUrl是完整URL，解析它
      const urlObj = new URL(fileUrl);
      fileKey = urlObj.pathname.substring(1); // 移除开头的 '/'
    } catch (e) {
      // 如果fileUrl不是完整URL，可能是相对路径，直接使用
      fileKey = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    }
    
    // 生成私有下载URL（带签名）
    // 注意：privateDownloadUrl返回的URL可能不包含协议，需要手动添加
    let privateUrl = bucketManager.privateDownloadUrl(qiniuDomain, fileKey, expiresIn);
    
    // 确保URL包含协议
    if (!privateUrl.startsWith('http://') && !privateUrl.startsWith('https://')) {
      privateUrl = `https://${privateUrl}`;
    }
    
    return privateUrl;
  } catch (error) {
    console.error('❌ 生成私有下载URL失败:', error);
    console.error('❌ fileUrl:', fileUrl);
    // 如果生成失败，返回原始URL（确保有协议）
    if (fileUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return `https://${fileUrl}`;
    }
    return fileUrl;
  }
}

module.exports = {
  uploadFile,
  getPrivateDownloadUrl
};

