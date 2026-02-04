const express = require('express');
const { query, validationResult } = require('express-validator');
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
      message: 'Authentication failed'
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// 获取通知列表（需要登录）
router.get('/', authenticateUser, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean()
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

    const currentUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    let sql = `
      SELECT n.*,
             u.username as related_username,
             u.email as related_email,
             v.title as video_title,
             v.titleEn as video_titleEn,
             c.content as comment_content
      FROM Notification n
      LEFT JOIN User u ON n.relatedUserId = u.id
      LEFT JOIN Video v ON n.relatedVideoId = v.id
      LEFT JOIN Comment c ON n.relatedCommentId = c.id
      WHERE n.userId = ?
    `;
    const params = [currentUser.id];

    if (unreadOnly) {
      sql += ' AND n.isRead = 0';
    }

    sql += ' ORDER BY n.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const notifications = await db.query(sql, params);

    // 解析通知内容和相关数据
    const notificationData = notifications.map(notif => {
      let content = {};
      try {
        if (notif.content) {
          content = typeof notif.content === 'string' 
            ? JSON.parse(notif.content) 
            : notif.content;
        }
      } catch (e) {
        console.error('解析通知内容失败:', e);
        content = { zh: notif.content || '', en: notif.content || '' };
      }

      return {
        id: notif.id,
        type: notif.type,
        content: content,
        relatedUser: notif.related_username ? {
          id: notif.relatedUserId,
          username: notif.related_username,
          email: notif.related_email
        } : null,
        relatedVideo: notif.relatedVideoId ? {
          id: notif.relatedVideoId,
          title: notif.video_title,
          titleEn: notif.video_titleEn
        } : null,
        relatedComment: notif.relatedCommentId ? {
          id: notif.relatedCommentId,
          content: notif.comment_content
        } : null,
        isRead: notif.isRead === 1,
        createdAt: notif.createdAt ? new Date(notif.createdAt).toISOString() : null
      };
    });

    // 获取未读通知数量
    const unreadCountResult = await db.query(
      'SELECT COUNT(*) as count FROM Notification WHERE userId = ? AND isRead = 0',
      [currentUser.id]
    );
    const unreadCount = parseInt(unreadCountResult[0]?.count || 0, 10) || 0;

    res.json({
      success: true,
      data: notificationData,
      unreadCount,
      pagination: {
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications'
    });
  }
});

// 标记通知为已读（需要登录）
router.patch('/:id/read', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // 验证通知属于当前用户
    const notification = await db.findOne(
      'SELECT id FROM Notification WHERE id = ? AND userId = ?',
      [id, currentUser.id]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await db.update('Notification', { isRead: 1 }, { id: parseInt(id) });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// 标记所有通知为已读（需要登录）
router.patch('/read-all', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;

    await db.query(
      'UPDATE Notification SET isRead = 1 WHERE userId = ? AND isRead = 0',
      [currentUser.id]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// 删除通知（需要登录）
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // 验证通知属于当前用户
    const notification = await db.findOne(
      'SELECT id FROM Notification WHERE id = ? AND userId = ?',
      [id, currentUser.id]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await db.remove('Notification', { id: parseInt(id) });

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// 获取未读通知数量（需要登录）
router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;

    const result = await db.query(
      'SELECT COUNT(*) as count FROM Notification WHERE userId = ? AND isRead = 0',
      [currentUser.id]
    );
    const count = parseInt(result[0]?.count || 0, 10) || 0;

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

module.exports = router;

