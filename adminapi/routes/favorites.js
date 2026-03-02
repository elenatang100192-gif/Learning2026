const express = require('express');
const { query, validationResult } = require('express-validator');
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

// 检查是否已收藏（未登录时返回false，不返回401）
router.get('/:videoId/status', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // 尝试获取当前用户（如果未登录，则返回false）
    let currentUser = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        if (sessionToken.startsWith('otp-token-')) {
          const tokenParts = sessionToken.split('-');
          if (tokenParts.length >= 5) {
            const userId = tokenParts.slice(4).join('-');
            currentUser = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);
          }
        }
      }
    } catch (authError) {
      // 认证失败，用户未登录，返回false
      console.log('用户未登录，返回收藏状态为false');
    }

    // 如果用户未登录，直接返回false
    if (!currentUser) {
      return res.json({
        success: true,
        favorited: false
      });
    }

    const result = await db.query(
      'SELECT COUNT(*) as count FROM Favorite WHERE userId = ? AND videoId = ?',
      [currentUser.id, videoId]
    );
    const count = result[0]?.count || 0;

    res.json({
      success: true,
      favorited: count > 0
    });
  } catch (error) {
    console.error('Check favorite status error:', error);
    // 发生错误时也返回false，而不是500错误
    res.json({
      success: true,
      favorited: false
    });
  }
});

// 收藏/取消收藏
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
    const video = await db.findOne('SELECT id FROM Video WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    const existingFavorite = await db.findOne(
      'SELECT id FROM Favorite WHERE userId = ? AND videoId = ?',
      [currentUser.id, videoId]
    );

    if (existingFavorite) {
      // 取消收藏
      await db.remove('Favorite', 'id = ?', [existingFavorite.id]);
      res.json({
        success: true,
        favorited: false
      });
    } else {
      // 收藏
      await db.insert('Favorite', {
        userId: currentUser.id,
        videoId: parseInt(videoId)
      });
      res.json({
        success: true,
        favorited: true
      });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle favorite'
    });
  }
});

// 获取用户收藏列表
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], authenticateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const sql = `
      SELECT f.id as favorite_id, f.userId as favorite_userId, f.videoId as favorite_videoId, f.createdAt as favorite_createdAt,
             v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
             u.id as author_id, u.username as author_username, u.email as author_email, u.createdAt as author_createdAt,
             u.canPublish as author_canPublish, u.canComment as author_canComment
      FROM Favorite f
      LEFT JOIN Video v ON f.videoId = v.id
      LEFT JOIN Category c ON v.categoryId = c.id
      LEFT JOIN User u ON v.authorId = u.id
      WHERE f.userId = ?
      ORDER BY f.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    const favorites = await db.query(sql, [
      currentUser.id,
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit)
    ]);

    const videoData = favorites.map(fav => ({
      id: fav.id,
      title: fav.title,
      titleEn: fav.titleEn,
      category: fav.categoryId ? {
        id: fav.categoryId,
        name: fav.category_name,
        nameCn: fav.category_nameCn,
        sortOrder: fav.category_sortOrder
      } : null,
      videoUrl: fav.videoUrl,
      coverUrl: fav.coverUrl,
      duration: fav.duration || 0,
      fileSize: fav.fileSize,
      status: fav.status,
      disabled: fav.disabled !== 0,
      viewCount: fav.viewCount || 0,
      likeCount: fav.likeCount || 0,
      uploadDate: fav.createdAt ? new Date(fav.createdAt).toISOString().split('T')[0] : null,
      publishDate: fav.publishDate,
      favoriteCreatedAt: fav.favorite_createdAt ? new Date(fav.favorite_createdAt).toISOString() : null, // 收藏时间
      author: fav.author_id ? {
        id: fav.author_id,
        username: fav.author_username,
        email: fav.author_email,
        avatar: null,
        joinDate: fav.author_createdAt ? new Date(fav.author_createdAt).toISOString().split('T')[0] : null,
        totalVideos: 0,
        totalViews: 0,
        canPublish: fav.author_canPublish !== 0,
        canComment: fav.author_canComment !== 0
      } : undefined
    }));

    res.json({
      success: true,
      data: videoData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get favorites'
    });
  }
});

module.exports = router;
