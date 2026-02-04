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

// 检查用户是否已评论（允许未登录用户访问）- 必须在 /:videoId 之前定义
router.get('/:videoId/status', async (req, res) => {
  try {
    console.log('📝 GET /:videoId/status route matched:', req.path, req.params);
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
        commented: false,
        commentId: null
      });
    }

    // 检查是否已评论
    const existingComment = await db.findOne(
      'SELECT id FROM Comment WHERE userId = ? AND videoId = ?',
      [currentUser.id, videoId]
    );

    res.json({
      success: true,
      commented: !!existingComment,
      commentId: existingComment ? existingComment.id : null
    });
  } catch (error) {
    console.error('Check comment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check comment status'
    });
  }
});

// 获取视频评论数量（允许未登录用户访问）- 必须在 /:videoId 之前定义
router.get('/:videoId/count', async (req, res) => {
  try {
    console.log('📝 GET /:videoId/count route matched:', req.path, req.params);
    const { videoId } = req.params;

    const result = await db.query(
      'SELECT COUNT(*) as count FROM Comment WHERE videoId = ?',
      [videoId]
    );
    // 确保 count 是数字类型，处理可能的 null/undefined/字符串
    // MySQL COUNT(*) 返回的是数字字符串，需要转换为数字
    let count = 0;
    if (result && result[0] && result[0].count !== undefined && result[0].count !== null) {
      count = parseInt(String(result[0].count), 10);
      // 如果转换失败，确保为 0
      if (isNaN(count)) {
        count = 0;
      }
    }

    console.log(`📊 视频 ${videoId} 的评论数: ${count} (原始值: ${result[0]?.count}, 类型: ${typeof result[0]?.count})`);

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
    console.log('📝 GET /:videoId route matched:', req.path, req.params);
    
    // 如果路径以 /status 或 /count 结尾，说明路由顺序有问题，返回404
    if (req.path.endsWith('/status') || req.path.endsWith('/count')) {
      console.error('❌ Route order issue: /:videoId matched instead of /:videoId/status or /:videoId/count');
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.path,
        method: req.method
      });
    }
    
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

    // 获取评论列表，支持层级结构（父评论和回复）
    const sql = `
      SELECT c.*, 
             u.username, u.email, u.createdAt as user_createdAt, u.canPublish, u.canComment,
             parent_user.username as parent_username,
             parent_user.id as parent_userId
      FROM Comment c
      LEFT JOIN User u ON c.userId = u.id
      LEFT JOIN Comment parent_comment ON c.parentCommentId = parent_comment.id
      LEFT JOIN User parent_user ON parent_comment.userId = parent_user.id
      WHERE c.videoId = ?
      ORDER BY 
        COALESCE(c.parentCommentId, c.id) ASC,  -- 父评论和回复分组
        c.createdAt ASC  -- 同一组内按时间排序
      LIMIT ? OFFSET ?
    `;
    const comments = await db.query(sql, [videoId, limit, (page - 1) * limit]);

    // 解析 mentionedUserIds JSON字段
    const commentData = comments.map(comment => {
      let mentionedUserIds = [];
      try {
        if (comment.mentionedUserIds) {
          mentionedUserIds = typeof comment.mentionedUserIds === 'string' 
            ? JSON.parse(comment.mentionedUserIds) 
            : comment.mentionedUserIds;
        }
      } catch (e) {
        console.error('解析 mentionedUserIds 失败:', e);
      }

      return {
      id: comment.id,
      content: comment.content,
        parentCommentId: comment.parentCommentId || null,
        parentUsername: comment.parent_username || null,
        parentUserId: comment.parent_userId || null,
        mentionedUserIds: mentionedUserIds,
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
      };
    });

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

    // 解析请求参数：支持回复评论和@用户名
    const { parentCommentId, mentionedUserIds } = req.body;
    
    // 验证父评论是否存在（如果是回复）
    if (parentCommentId) {
      const parentComment = await db.findOne(
        'SELECT id, videoId FROM Comment WHERE id = ?',
        [parentCommentId]
      );
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found'
        });
      }
      if (parentComment.videoId !== parseInt(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Parent comment does not belong to this video'
        });
      }
    }

    // 解析@的用户ID列表
    let mentionedIds = [];
    console.log('📥 接收到的 mentionedUserIds:', mentionedUserIds, typeof mentionedUserIds);
    
    if (mentionedUserIds) {
      if (Array.isArray(mentionedUserIds)) {
        mentionedIds = mentionedUserIds
          .map(id => typeof id === 'string' ? parseInt(id, 10) : id) // 确保是数字
          .filter(id => id && !isNaN(id) && id !== currentUser.id); // 排除自己和无效ID
        console.log('✅ 从数组解析的用户ID:', mentionedIds);
      } else if (typeof mentionedUserIds === 'string') {
        try {
          const parsed = JSON.parse(mentionedUserIds);
          if (Array.isArray(parsed)) {
            mentionedIds = parsed
              .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
              .filter(id => id && !isNaN(id) && id !== currentUser.id);
            console.log('✅ 从JSON字符串解析的用户ID:', mentionedIds);
          }
        } catch (e) {
          console.error('❌ 解析 mentionedUserIds 失败:', e);
        }
      }
    }
    
    console.log('📋 最终解析的用户ID列表:', mentionedIds);

    // 提取@用户名（从content中提取）
    const mentionRegex = /@(\w+)/g;
    const mentionsInContent = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentionsInContent.push(match[1]);
    }

    // 如果content中有@但没有提供mentionedUserIds，尝试根据用户名查找用户ID
    if (mentionsInContent.length > 0 && mentionedIds.length === 0) {
      const placeholders = mentionsInContent.map(() => '?').join(',');
      const mentionedUsers = await db.query(
        `SELECT id FROM User WHERE username IN (${placeholders})`,
        mentionsInContent
      );
      mentionedIds = mentionedUsers.map(u => u.id).filter(id => id && id !== currentUser.id);
    }

    // 插入评论
    const commentId = await db.insert('Comment', {
      videoId: parseInt(videoId),
      userId: currentUser.id,
      content: content.trim(),
      parentCommentId: parentCommentId ? parseInt(parentCommentId) : null,
      mentionedUserIds: mentionedIds.length > 0 ? JSON.stringify(mentionedIds) : null,
      likeCount: 0
    });

    // 创建@提醒通知
    if (mentionedIds.length > 0) {
      console.log('🔔 开始创建@提醒通知，被@的用户ID:', mentionedIds);
      const video = await db.findOne('SELECT id, title FROM Video WHERE id = ?', [videoId]);
      console.log('📹 视频信息:', video);
      
      for (const mentionedUserId of mentionedIds) {
        try {
          console.log(`🔔 正在为用户 ${mentionedUserId} 创建@提醒通知...`);
          
          // 创建多语言通知内容
          const notificationContent = {
            zh: `${currentUser.username} 在视频 "${video.title}" 的评论中@了你`,
            en: `${currentUser.username} mentioned you in a comment on video "${video.title}"`
          };

          const notificationData = {
            userId: mentionedUserId,
            type: 'mention',
            relatedUserId: currentUser.id,
            relatedCommentId: commentId,
            relatedVideoId: parseInt(videoId),
            content: JSON.stringify(notificationContent),
            isRead: 0
          };
          
          console.log('📝 通知数据:', notificationData);
          
          const notificationId = await db.insert('Notification', notificationData);
          console.log(`✅ 成功创建@提醒通知，通知ID: ${notificationId}, 用户ID: ${mentionedUserId}`);
        } catch (error) {
          console.error(`❌ 创建@提醒通知失败 (用户ID: ${mentionedUserId}):`, error);
          console.error('❌ 错误堆栈:', error.stack);
        }
      }
    } else {
      console.log('ℹ️ 没有被@的用户，跳过创建通知');
    }

    // 如果是回复，创建回复提醒通知
    if (parentCommentId) {
      const parentComment = await db.findOne(
        'SELECT userId FROM Comment WHERE id = ?',
        [parentCommentId]
      );
      if (parentComment && parentComment.userId !== currentUser.id) {
        try {
          const video = await db.findOne('SELECT id, title FROM Video WHERE id = ?', [videoId]);
          const notificationContent = {
            zh: `${currentUser.username} 回复了你在视频 "${video.title}" 的评论`,
            en: `${currentUser.username} replied to your comment on video "${video.title}"`
          };

          await db.insert('Notification', {
            userId: parentComment.userId,
            type: 'reply',
            relatedUserId: currentUser.id,
            relatedCommentId: commentId,
            relatedVideoId: parseInt(videoId),
            content: JSON.stringify(notificationContent),
            isRead: 0
          });
        } catch (error) {
          console.error('创建回复提醒通知失败:', error);
        }
      }
    }

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

// 删除评论（只能删除自己的评论）- 使用明确的路径避免与 /:videoId 冲突
router.delete('/comment/:commentId', authenticateUser, async (req, res) => {
  try {
    console.log('📝 DELETE /comment/:commentId route matched:', req.path, req.params);
    const { commentId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 查找评论
    const comment = await db.findOne('SELECT * FROM Comment WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // 检查是否是评论所有者
    if (comment.userId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments'
      });
    }

    // 删除评论
    await db.remove('Comment', 'id = ?', [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment'
    });
  }
});

module.exports = router;
