const express = require('express');
const { query, body, validationResult } = require('express-validator');
const db = require('../utils/db');
const bcrypt = require('bcrypt');

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

    const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // 我们的session token格式是: otp-token-{timestamp}-{random}-{userId}
    if (!sessionToken.startsWith('otp-token-')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token'
      });
    }

    // 从token中提取用户ID
    const tokenParts = sessionToken.split('-');
    if (tokenParts.length >= 5) {
      const userId = tokenParts.slice(4).join('-'); // 处理userId中可能包含的'-'字符

      try {
        // 从MySQL获取用户信息
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

// 搜索用户（用于@功能，需要登录但不需要管理员权限）
// 注意：必须在 router.get('/') 之前定义，否则会被 '/' 路由匹配
router.get('/search', authenticateUser, [
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    console.log('🔍 /users/search 请求:', {
      query: req.query,
      user: req.user ? { id: req.user.id, username: req.user.username } : 'no user'
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ 验证错误:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errors.array()
      });
    }

    const { q = '', limit = 20 } = req.query;
    const searchQuery = q.trim();

    // 构建SQL查询 - 搜索用户名
    // 注意：User表可能没有avatar字段，如果不存在会返回NULL
    let sql = 'SELECT id, username, email, createdAt FROM User WHERE 1=1';
    const params = [];

    // 如果有搜索条件，添加搜索过滤
    if (searchQuery) {
      sql += ` AND username LIKE ?`;
      params.push(`%${searchQuery}%`);
    }

    // 排除当前用户自己
    if (req.user && req.user.id) {
      sql += ` AND id != ?`;
      params.push(req.user.id);
    }

    // 排序和限制
    sql += ` ORDER BY username ASC LIMIT ?`;
    params.push(parseInt(limit));

    console.log('📝 SQL查询:', sql);
    console.log('📝 参数:', params);

    const users = await db.query(sql, params);
    console.log('✅ 查询成功，找到', users.length, '个用户');

    const userData = users.map(user => ({
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar || null,
      joinDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : null,
      totalVideos: 0,
      totalViews: 0,
      canPublish: false,
      canComment: false
    }));

    console.log('✅ 返回用户数据:', userData.length, '个用户');
    res.json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('❌ Search users error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// 获取用户列表（管理员功能）
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isIn(['all', 'canPublish', 'canComment', 'canAdmin', 'noPublish', 'noComment', 'noAdmin'])
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

    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;

    // 构建SQL查询
    let sql = 'SELECT * FROM User WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM User WHERE 1=1';
    const params = [];
    const countParams = [];

    // 如果有搜索条件，添加搜索过滤（支持用户名和邮箱）
    if (search) {
      sql += ` AND (username LIKE ? OR email LIKE ?)`;
      countSql += ` AND (username LIKE ? OR email LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    // 如果有状态筛选，添加状态过滤
    if (status && status !== 'all') {
      switch (status) {
        case 'canPublish':
          sql += ` AND canPublish = 1`;
          countSql += ` AND canPublish = 1`;
          break;
        case 'canComment':
          sql += ` AND canComment = 1`;
          countSql += ` AND canComment = 1`;
          break;
        case 'canAdmin':
          sql += ` AND canAdmin = 1`;
          countSql += ` AND canAdmin = 1`;
          break;
        case 'noPublish':
          sql += ` AND canPublish = 0`;
          countSql += ` AND canPublish = 0`;
          break;
        case 'noComment':
          sql += ` AND canComment = 0`;
          countSql += ` AND canComment = 0`;
          break;
        case 'noAdmin':
          sql += ` AND canAdmin = 0`;
          countSql += ` AND canAdmin = 0`;
          break;
      }
    }

    // 排序和分页
    sql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    // 获取总数和用户列表
    const totalResult = await db.query(countSql, countParams);
    const total = totalResult[0]?.total || 0;
    const users = await db.query(sql, params);

    const userData = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      totalVideos: 0, // 可以从Video表统计
      totalViews: 0, // 可以从Video表统计
      canPublish: user.canPublish !== 0,
      canComment: user.canComment !== 0,
      canAdmin: user.canAdmin !== 0
    }));

    res.json({
      success: true,
      data: userData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total
      }
    });
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users list'
    });
  }
});

// 创建新用户
router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('username').optional({ checkFalsy: true }).isLength({ min: 2, max: 50 }),
  body('password').optional().isString().isLength({ min: 6 }),
  body('canPublish').optional().isBoolean(),
  body('canComment').optional().isBoolean(),
  body('canAdmin').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { email, username, password, canPublish = true, canComment = true, canAdmin = false } = req.body;

    // 检查邮箱是否已存在
    const existingUser = await db.findOne('SELECT * FROM User WHERE email = ?', [email]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // 创建新用户
    const usernameValue = username || email.split('@')[0];
    
    // 处理密码：如果提供了密码则加密，否则不设置密码（使用OTP登录）
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    const userId = await db.insert('User', {
      email: email,
      username: usernameValue,
      password: hashedPassword,
      canPublish: canPublish ? 1 : 0,
      canComment: canComment ? 1 : 0,
      canAdmin: canAdmin ? 1 : 0
    });

    const newUser = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);

    const userData = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatar: null,
      joinDate: newUser.createdAt ? new Date(newUser.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      totalVideos: 0,
      totalViews: 0,
      canPublish: newUser.canPublish !== 0,
      canComment: newUser.canComment !== 0,
      canAdmin: newUser.canAdmin !== 0
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: userData
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// 获取用户发布记录
router.get('/publications', [
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

    const sql = `
      SELECT v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder
      FROM Video v
      LEFT JOIN Category c ON v.categoryId = c.id
      WHERE v.authorId = ?
      ORDER BY v.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    const videos = await db.query(sql, [
      currentUser.id,
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit)
    ]);

    const videoData = videos.map(video => ({
      id: video.id,
      title: video.title,
      titleEn: video.titleEn,
      category: video.categoryId ? {
        id: video.categoryId,
        name: video.category_name,
        nameCn: video.category_nameCn,
        sortOrder: video.category_sortOrder
      } : null,
      videoUrl: video.videoUrl,
      coverUrl: video.coverUrl,
      duration: video.duration || 0,
      fileSize: video.fileSize,
      status: video.status,
      disabled: video.disabled !== 0,
      viewCount: video.viewCount || 0,
      likeCount: video.likeCount || 0,
      uploadDate: video.createdAt ? new Date(video.createdAt).toISOString().split('T')[0] : null,
      publishDate: video.publishDate
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
    console.error('Get user publications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user publications'
    });
  }
});

// 获取观看历史
router.get('/watch-history', [
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

    const sql = `
      SELECT wh.*, v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
             u.id as author_id, u.username as author_username, u.email as author_email, u.createdAt as author_createdAt,
             u.canPublish as author_canPublish, u.canComment as author_canComment
      FROM WatchHistory wh
      LEFT JOIN Video v ON wh.videoId = v.id
      LEFT JOIN Category c ON v.categoryId = c.id
      LEFT JOIN User u ON v.authorId = u.id
      WHERE wh.userId = ?
      ORDER BY wh.watchedAt DESC
      LIMIT ? OFFSET ?
    `;
    const histories = await db.query(sql, [
      currentUser.id,
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit)
    ]);

    const videoData = histories.map(history => ({
      id: history.id,
      title: history.title,
      titleEn: history.titleEn,
      category: history.categoryId ? {
        id: history.categoryId,
        name: history.category_name,
        nameCn: history.category_nameCn,
        sortOrder: history.category_sortOrder
      } : null,
      videoUrl: history.videoUrl,
      coverUrl: history.coverUrl,
      duration: history.duration || 0,
      fileSize: history.fileSize,
      status: history.status,
      disabled: history.disabled !== 0,
      viewCount: history.viewCount || 0,
      likeCount: history.likeCount || 0,
      uploadDate: history.createdAt ? new Date(history.createdAt).toISOString().split('T')[0] : null,
      publishDate: history.publishDate,
      author: history.author_id ? {
        id: history.author_id,
        username: history.author_username,
        email: history.author_email,
        avatar: null,
        joinDate: history.author_createdAt ? new Date(history.author_createdAt).toISOString().split('T')[0] : null,
        totalVideos: 0,
        totalViews: 0,
        canPublish: history.author_canPublish !== 0,
        canComment: history.author_canComment !== 0
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
    console.error('Get watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watch history'
    });
  }
});

// 获取用户统计数据
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 1. 获赞总数：该用户发布的视频的likeCount之和（只统计已发布状态的）
    const videosResult = await db.query(
      'SELECT SUM(likeCount) as totalLikes, COUNT(*) as publishedCount FROM Video WHERE authorId = ? AND status = ?',
      [currentUser.id, '已发布']
    );
    const totalLikes = videosResult[0]?.totalLikes || 0;
    const publishedCount = videosResult[0]?.publishedCount || 0;

    // 3. 关注数：该用户关注的作者数量
    let followingCount = 0;
    try {
      const followingResult = await db.query(
        'SELECT COUNT(*) as count FROM Follow WHERE followerId = ?',
        [currentUser.id]
      );
      followingCount = followingResult[0]?.count || 0;
    } catch (error) {
      console.error('查询关注数失败:', error);
      followingCount = 0;
    }

    // 4. 粉丝数：关注该用户的作者数量
    let followersCount = 0;
    try {
      const followersResult = await db.query(
        'SELECT COUNT(*) as count FROM Follow WHERE followingId = ?',
        [currentUser.id]
      );
      followersCount = followersResult[0]?.count || 0;
    } catch (error) {
      console.error('查询粉丝数失败:', error);
      followersCount = 0;
    }

    // 5. 收藏数：该用户收藏的视频数量
    let favoritesCount = 0;
    try {
      const favoritesResult = await db.query(
        'SELECT COUNT(*) as count FROM Favorite WHERE userId = ?',
        [currentUser.id]
      );
      favoritesCount = favoritesResult[0]?.count || 0;
    } catch (error) {
      console.error('查询收藏数失败:', error);
      favoritesCount = 0;
    }

    res.json({
      success: true,
      data: {
        totalLikes: parseInt(totalLikes),
        publishedCount: parseInt(publishedCount),
        followingCount: parseInt(followingCount),
        followersCount: parseInt(followersCount),
        favoritesCount: parseInt(favoritesCount)
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user stats'
    });
  }
});

// 修改用户权限（管理员功能）
router.put('/:userId/permissions', [
  body('canPublish').optional().isBoolean(),
  body('canComment').optional().isBoolean(),
  body('canAdmin').optional().isBoolean(),
  body('password').optional().isString().isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { canPublish, canComment, canAdmin, password } = req.body;

    if (canPublish === undefined && canComment === undefined && canAdmin === undefined && !password) {
      return res.status(400).json({
        success: false,
        message: '至少需要提供一个权限字段（canPublish、canComment、canAdmin）或密码'
      });
    }

    // 获取用户
    const user = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新权限和密码
    const updateData = {};
    if (canPublish !== undefined) {
      updateData.canPublish = canPublish ? 1 : 0;
    }
    if (canComment !== undefined) {
      updateData.canComment = canComment ? 1 : 0;
    }
    if (canAdmin !== undefined) {
      updateData.canAdmin = canAdmin ? 1 : 0;
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await db.update('User', updateData, 'id = ?', [userId]);

    const updatedUser = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);

    const userData = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      canPublish: updatedUser.canPublish !== 0,
      canComment: updatedUser.canComment !== 0,
      canAdmin: updatedUser.canAdmin !== 0
    };

    res.json({
      success: true,
      message: '用户权限更新成功',
      user: userData
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新用户权限失败'
    });
  }
});

// 删除用户（管理员功能）
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少用户ID'
      });
    }

    // 获取用户
    const user = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 删除用户
    await db.remove('User', 'id = ?', [userId]);

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除用户失败'
    });
  }
});

module.exports = router;
