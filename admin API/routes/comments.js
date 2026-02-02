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

// 获取视频评论数量（允许未登录用户访问）
router.get('/:videoId/count', async (req, res) => {
  try {
    const { videoId } = req.params;

    const result = await db.query(
      'SELECT COUNT(*) as count FROM Comment WHERE videoId = ?',
      [videoId]
    );
    const count = result[0]?.count || 0;

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get comment count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comment count'
    });
  }
});

// 获取视频评论列表（允许未登录用户访问）
router.get('/:videoId', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    const { videoId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const sql = `
      SELECT c.*, u.username, u.email, u.createdAt as user_createdAt, u.canPublish, u.canComment
      FROM Comment c
      LEFT JOIN User u ON c.userId = u.id
      WHERE c.videoId = ?
      ORDER BY c.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    const comments = await db.query(sql, [videoId, limit, (page - 1) * limit]);

    const commentData = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      user: {
        id: comment.userId,
        username: comment.username,
        email: comment.email,
        avatar: null,
        joinDate: comment.user_createdAt ? new Date(comment.user_createdAt).toISOString().split('T')[0] : null,
        totalVideos: 0,
        totalViews: 0,
        canPublish: comment.canPublish !== 0,
        canComment: comment.canComment !== 0
      },
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
      updatedAt: comment.updatedAt ? new Date(comment.updatedAt).toISOString() : null
    }));

    res.json({
      success: true,
      data: commentData
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comments'
    });
  }
});

// 添加评论（需要登录且有评论权限）
router.post('/:videoId', authenticateUser, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content } = req.body;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 检查用户是否有评论权限
    const canComment = currentUser.canComment;
    if (canComment === 0 || canComment === false) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to comment'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
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

    const commentId = await db.insert('Comment', {
      videoId: parseInt(videoId),
      userId: currentUser.id,
      content: content.trim(),
      parentId: null,
      likeCount: 0
    });

    const savedComment = await db.findOne(
      'SELECT * FROM Comment WHERE id = ?',
      [commentId]
    );

    const commentData = {
      id: savedComment.id,
      content: savedComment.content,
      user: {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        avatar: null,
        joinDate: currentUser.createdAt ? new Date(currentUser.createdAt).toISOString().split('T')[0] : null,
        totalVideos: 0,
        totalViews: 0,
        canPublish: currentUser.canPublish !== 0,
        canComment: currentUser.canComment !== 0
      },
      createdAt: savedComment.createdAt ? new Date(savedComment.createdAt).toISOString() : null,
      updatedAt: savedComment.updatedAt ? new Date(savedComment.updatedAt).toISOString() : null
    };

    res.json({
      success: true,
      data: commentData
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

module.exports = router;
