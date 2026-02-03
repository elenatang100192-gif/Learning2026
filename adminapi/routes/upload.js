const express = require('express');
const multer = require('multer');
const db = require('../utils/db');
const { uploadFile } = require('../utils/fileUpload');

const router = express.Router();

// 用户认证中间件
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const sessionToken = authHeader.substring(7);

    if (!sessionToken.startsWith('otp-token-')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token'
      });
    }

    const tokenParts = sessionToken.split('-');
    if (tokenParts.length >= 5) {
      const userId = tokenParts.slice(4).join('-');

      try {
        const user = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error('User lookup error:', error);
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed - user not found'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};


// 配置multer内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB for non-file fields
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// 上传视频文件（需要认证）
router.post('/video', authenticateUser, upload.single('video'), async (req, res) => {
  // 设置上传请求超时时间为5分钟
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;

    // 上传到七牛云存储
    const url = await uploadFile(buffer, originalname, mimetype, 'videos');

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: url,
        filename: originalname,
        size: buffer.length
      }
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
});

// 上传封面图片（需要认证）
router.post('/cover', authenticateUser, upload.single('cover'), async (req, res) => {
  // 设置上传请求超时时间为5分钟
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No cover image provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;

    // 上传到七牛云存储
    const url = await uploadFile(buffer, originalname, mimetype, 'covers');

    res.json({
      success: true,
      message: 'Cover image uploaded successfully',
      data: {
        url: url,
        filename: originalname,
        size: buffer.length
      }
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload cover image',
      error: error.message
    });
  }
});

// 后台管理上传视频文件（不需要认证）
router.post('/admin/video', upload.single('video'), async (req, res) => {
  // 设置上传请求超时时间为10分钟（视频文件可能较大）
  req.setTimeout(10 * 60 * 1000);
  res.setTimeout(10 * 60 * 1000);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;

    // 上传到七牛云存储
    const url = await uploadFile(buffer, originalname, mimetype, 'videos');

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: url,
        filename: originalname,
        size: buffer.length
      }
    });
  } catch (error) {
    console.error('Admin video upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
});

// 后台管理上传封面图片（不需要认证）
router.post('/admin/cover', upload.single('cover'), async (req, res) => {
  // 设置上传请求超时时间为5分钟
  req.setTimeout(5 * 60 * 1000);
  res.setTimeout(5 * 60 * 1000);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No cover image provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { bookId } = req.body; // Optional: bookId to save cover image URL to Book object
    
    const coverImageUrl = await uploadFile(buffer, originalname, mimetype, 'covers');
    
    // If bookId is provided, save the cover image URL to the Book object
    if (bookId) {
      try {
        const book = await db.findOne('SELECT id FROM Book WHERE id = ?', [bookId]);
        if (book) {
          await db.update('Book', { blogCoverUrl: coverImageUrl }, 'id = ?', [bookId]);
          console.log(`✅ Cover image URL saved to Book object: bookId=${bookId}, url=${coverImageUrl}`);
        } else {
          console.warn(`⚠️ Book not found: bookId=${bookId}`);
        }
      } catch (bookError) {
        console.error('❌ Failed to save cover image URL to Book object:', bookError);
        // Don't fail the upload if saving to Book fails
      }
    }

    res.json({
      success: true,
      message: 'Cover image uploaded successfully',
      data: {
        url: coverImageUrl,
        filename: originalname,
        size: buffer.length
      }
    });
  } catch (error) {
    console.error('Admin cover upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload cover image',
      error: error.message
    });
  }
});

module.exports = router;
