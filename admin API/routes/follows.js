const express = require('express');
const db = require('../utils/db');

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
      message: 'Authentication error'
    });
  }
};

// 检查是否已关注（允许未登录用户访问，返回false）
router.get('/:authorId/status', async (req, res) => {
  try {
    const { authorId } = req.params;
    
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
        following: false
      });
    }

    // 验证authorId是否为有效的用户ID
    if (!authorId || authorId === 'system-admin' || !/^\d+$/.test(authorId)) {
      return res.json({
        success: true,
        following: false
      });
    }

    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM Follow WHERE followerId = ? AND followingId = ?',
        [currentUser.id, authorId]
      );
      const count = result[0]?.count || 0;

      res.json({
        success: true,
        following: count > 0
      });
    } catch (queryError) {
      // 如果Follow表不存在或其他查询错误，返回false
      console.error('查询关注状态失败:', queryError);
      return res.json({
        success: true,
        following: false
      });
    }
  } catch (error) {
    console.error('Check follow status error:', error);
    // 对于任何错误，都返回false而不是500错误，避免影响前端体验
    res.json({
      success: true,
      following: false
    });
  }
});

// 关注/取消关注
router.post('/:authorId/toggle', authenticateUser, async (req, res) => {
  try {
    const { authorId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 不能关注自己
    if (currentUser.id.toString() === authorId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    // 验证被关注的用户是否存在
    const author = await db.findOne('SELECT id FROM User WHERE id = ?', [authorId]);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    const existingFollow = await db.findOne(
      'SELECT id FROM Follow WHERE followerId = ? AND followingId = ?',
      [currentUser.id, authorId]
    );

    if (existingFollow) {
      // 取消关注
      await db.remove('Follow', 'id = ?', [existingFollow.id]);
      res.json({
        success: true,
        following: false
      });
    } else {
      // 关注
      await db.insert('Follow', {
        followerId: currentUser.id,
        followingId: parseInt(authorId)
      });
      res.json({
        success: true,
        following: true
      });
    }
  } catch (error) {
    console.error('Toggle follow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle follow'
    });
  }
});

module.exports = router;
