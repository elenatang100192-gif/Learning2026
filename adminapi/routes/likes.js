const express = require('express');
const db = require('../utils/db');

const router = express.Router();

// 用户认证中间件 - 从session token恢复用户信息
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
      message: 'Authentication error'
    });
  }
};

// 检查是否已点赞（允许未登录用户访问，返回false）
router.get('/:videoId/status', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // 尝试获取当前用户（如果已登录）
    const authHeader = req.headers.authorization;
    let currentUser = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      if (sessionToken.startsWith('otp-token-')) {
        const tokenParts = sessionToken.split('-');
        if (tokenParts.length >= 5) {
          const userId = tokenParts.slice(4).join('-');
          try {
            currentUser = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);
          } catch (error) {
            // 用户不存在或token无效，继续执行
          }
        }
      }
    }

    // 如果用户未登录，返回false
    if (!currentUser) {
      return res.json({
        success: true,
        liked: false
      });
    }

    const result = await db.query(
      'SELECT COUNT(*) as count FROM `Like` WHERE userId = ? AND videoId = ?',
      [currentUser.id, videoId]
    );
    const count = result[0]?.count || 0;

    res.json({
      success: true,
      liked: count > 0
    });
  } catch (error) {
    console.error('Check like status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check like status'
    });
  }
});

// 点赞/取消点赞
router.post('/:videoId/toggle', authenticateUser, async (req, res) => {
  try {
    const { videoId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 验证视频是否存在
    const video = await db.findOne('SELECT id, likeCount FROM Video WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 检查是否已点赞
    const existingLike = await db.findOne(
      'SELECT id FROM `Like` WHERE userId = ? AND videoId = ?',
      [currentUser.id, videoId]
    );

    if (existingLike) {
      // 取消点赞
      await db.remove('`Like`', 'id = ?', [existingLike.id]);
      
      // 更新视频点赞数，确保不会小于0
      const newLikeCount = Math.max(0, (video.likeCount || 0) - 1);
      await db.update('Video', { likeCount: newLikeCount }, 'id = ?', [videoId]);

      res.json({
        success: true,
        liked: false,
        likeCount: newLikeCount
      });
    } else {
      // 点赞
      await db.insert('`Like`', {
        userId: currentUser.id,
        videoId: parseInt(videoId)
      });

      // 增加视频点赞数
      const newLikeCount = (video.likeCount || 0) + 1;
      await db.update('Video', { likeCount: newLikeCount }, 'id = ?', [videoId]);

      res.json({
        success: true,
        liked: true,
        likeCount: newLikeCount
      });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like'
    });
  }
});

module.exports = router;
