const express = require('express');
const db = require('../utils/db');

const router = express.Router();

console.log('🎥 Videos router loaded!');

// 测试路由
router.get('/test', (req, res) => {
  console.log('🎯 Test route hit!');
  res.json({ success: true, message: 'Videos router working!' });
});

// 获取视频列表
router.get('/', async (req, res) => {
  console.log('🎬 Videos API HIT! URL:', req.url);
  console.log('📋 Raw query:', req.query);
  console.log('📋 Parsed category:', req.query.category);
  console.log('📋 Parsed status:', req.query.status);

  try {
    const { category, status = '已发布', page = 1, limit = 20 } = req.query;
    
    // 调试：打印所有查询参数
    console.log('📋 查询参数:', {
      category: category,
      status: status,
      page: page,
      limit: limit
    });

    console.log('🎬 Videos API HIT! URL:', req.url);
    console.log('📋 Raw query:', req.query);
    console.log('📋 Parsed status:', status);

    // 构建SQL查询
    let sql = `
      SELECT v.*, 
             c.id as category_id, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
             u.id as author_id, u.username as author_username, u.email as author_email,
             b.id as book_id, b.title as book_title, b.author as book_author
      FROM Video v
      LEFT JOIN Category c ON v.categoryId = c.id
      LEFT JOIN User u ON v.authorId = u.id
      LEFT JOIN Book b ON v.bookId = b.id
      WHERE 1=1
    `;
    const params = [];

    // 过滤条件
    if (category) {
      // 按nameCn（中文名称）查询分类
      const categories = await db.findAll('SELECT id FROM Category WHERE nameCn = ?', [category]);
      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        sql += ` AND v.categoryId IN (${categoryIds.map(() => '?').join(',')})`;
        params.push(...categoryIds);
        console.log(`使用分类: ${category} (IDs: ${categoryIds.join(', ')})`);
      } else {
        console.log(`未找到分类: ${category}`);
        // 如果没有找到分类，返回空结果
        return res.json({
          success: true,
          data: [],
          pagination: { page: parseInt(page), limit: parseInt(limit) }
        });
      }
    }

    // 状态过滤（如果不传status，则返回所有状态的视频）
    if (req.query.status !== undefined && req.query.status !== '') {
      const finalStatus = req.query.status;
      sql += ` AND v.status = ?`;
      params.push(finalStatus);
      
      // 如果状态是'已发布'，同时过滤掉已禁用的视频
      if (finalStatus === '已发布') {
        sql += ` AND v.disabled = 0`;
        console.log('已发布状态：同时过滤已禁用的视频');
      }
    } else {
      // 如果没有指定status，返回所有状态的视频（但排除已禁用的视频）
      sql += ` AND v.disabled = 0`;
      console.log('未指定状态：返回所有未禁用的视频');
    }

    // 排序：优先按displayOrder排序（升序，NULL值排在最后），然后按createdAt排序（降序）
    sql += ` ORDER BY ISNULL(v.displayOrder), v.displayOrder ASC, v.createdAt DESC`;

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const videos = await db.query(sql, params);

    // 转换数据格式
    const videoData = videos.map(video => {
      // 如果没有作者（后台发布的视频），创建默认作者信息
      const authorData = video.author_id ? {
        id: video.author_id,
        username: video.author_username,
        email: video.author_email,
        avatar: null,
        joinDate: video.createdAt ? new Date(video.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        totalVideos: 0,
        totalViews: 0,
        canPublish: false,
        canComment: false
      } : {
        id: 'system-admin',
        username: 'Ashley HR Center',
        usernameCn: '爱室丽人力中心',
        email: 'admin@ashleyfurniture.com',
        avatar: null,
        joinDate: new Date().toISOString().split('T')[0],
        totalVideos: 0,
        totalViews: 0,
        canPublish: false,
        canComment: false
      };

      return {
        id: video.id,
        title: video.title,
        titleEn: video.titleEn || null,
        category: video.category_id ? {
          id: video.category_id,
          name: video.category_name,
          nameCn: video.category_nameCn,
          sortOrder: video.category_sortOrder
        } : null,
        videoUrl: video.videoUrl,
        videoUrlEn: video.videoUrlEn || null,
        coverUrl: video.coverUrl || null,
        duration: video.duration || 0,
        fileSize: video.fileSize || 0,
        status: video.status,
        disabled: video.disabled || false,
        viewCount: Math.max(0, video.viewCount || 0),
        likeCount: Math.max(0, video.likeCount || 0),
        uploadDate: video.createdAt ? new Date(video.createdAt).toISOString().split('T')[0] : null,
        publishDate: video.publishDate || null,
        displayOrder: video.displayOrder || undefined,
        author: authorData,
        book: video.book_id ? {
          id: video.book_id,
          title: video.book_title,
          author: video.book_author
        } : undefined
      };
    });

    res.json({
      success: true,
      data: videoData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get videos'
    });
  }
});

// 获取单个视频详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const video = await db.findOne(`
      SELECT v.*, 
             c.id as category_id, c.name as category_name, c.nameCn as category_nameCn,
             u.id as author_id, u.username as author_username, u.email as author_email
      FROM Video v
      LEFT JOIN Category c ON v.categoryId = c.id
      LEFT JOIN User u ON v.authorId = u.id
      WHERE v.id = ?
    `, [id]);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    const videoData = {
      id: video.id,
      title: video.title,
      titleEn: video.titleEn || null,
      category: video.category_id ? {
        id: video.category_id,
        name: video.category_name,
        nameCn: video.category_nameCn,
        sortOrder: video.category_sortOrder || 0
      } : null,
      videoUrl: video.videoUrl,
      coverUrl: video.coverUrl || null,
      duration: video.duration || 0,
      fileSize: video.fileSize || 0,
      status: video.status,
      disabled: video.disabled || false,
      viewCount: video.viewCount || 0,
      likeCount: video.likeCount || 0,
      uploadDate: video.createdAt ? new Date(video.createdAt).toISOString().split('T')[0] : null,
      publishDate: video.publishDate || null,
      author: video.author_id ? {
        id: video.author_id,
        username: video.author_username,
        email: video.author_email,
        avatar: null,
        joinDate: video.createdAt ? new Date(video.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        totalVideos: 0,
        totalViews: 0,
        canPublish: false,
        canComment: false
      } : {
        id: 'system-admin',
        username: 'Ashley HR Center',
        usernameCn: '爱室丽人力中心',
        email: 'admin@ashleyfurniture.com',
        avatar: null,
        joinDate: new Date().toISOString().split('T')[0],
        totalVideos: 0,
        totalViews: 0,
        canPublish: false,
        canComment: false
      }
    };

    res.json({
      success: true,
      data: videoData
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video'
    });
  }
});

// 增加观看次数
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;

    // 更新观看次数
    await db.query('UPDATE Video SET viewCount = COALESCE(viewCount, 0) + 1 WHERE id = ?', [id]);

    console.log(`👁️ 视频 ${id} 观看次数 +1`);

    res.json({
      success: true,
      message: 'View count incremented'
    });
  } catch (error) {
    console.error('Increment view count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to increment view count'
    });
  }
});

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

// 记录观看历史
router.post('/:id/watch', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    // 检查是否已存在观看记录
    const existingHistory = await db.findOne(
      'SELECT * FROM WatchHistory WHERE userId = ? AND videoId = ? ORDER BY watchedAt DESC LIMIT 1',
      [currentUser.id, id]
    );

    if (existingHistory) {
      // 更新观看时间
      await db.update('WatchHistory', { watchedAt: new Date() }, 'id = ?', [existingHistory.id]);
      console.log(`📺 更新观看历史: 用户 ${currentUser.id} 视频 ${id}`);
    } else {
      // 创建新的观看记录
      await db.insert('WatchHistory', {
        userId: currentUser.id,
        videoId: parseInt(id),
        watchedAt: new Date(),
        progress: 0
      });
      console.log(`📺 创建观看历史: 用户 ${currentUser.id} 视频 ${id}`);
    }

    res.json({
      success: true,
      message: 'Watch history recorded'
    });
  } catch (error) {
    console.error('Record watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record watch history'
    });
  }
});

// 发布视频到待审核状态（后台管理使用，使用Master Key绕过ACL）
router.post('/publish', async (req, res) => {
  try {
    const { title, titleEn, categoryId, videoUrl, videoUrlEn, coverUrl, duration } = req.body;

    // 验证：必须有标题（title或titleEn至少一个）、分类ID、以及视频URL（videoUrl或videoUrlEn至少一个）
    if ((!title && !titleEn) || !categoryId || (!videoUrl && !videoUrlEn)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title or titleEn, categoryId, videoUrl or videoUrlEn'
      });
    }

    // 获取分类对象
    const category = await db.findOne('SELECT * FROM Category WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // 创建视频对象
    const videoData = {
      title: title || titleEn || '',
      titleEn: titleEn || title || '',
      categoryId: parseInt(categoryId),
      videoUrl: videoUrl || '',
      videoUrlEn: videoUrlEn || null,
      coverUrl: coverUrl || null,
      duration: duration || 0,
      status: '待审核',
      disabled: 0,
      viewCount: 0,
      likeCount: 0,
      fileSize: 0,
      authorId: null
    };

    // 保存视频
    const videoId = await db.insert('Video', videoData);

    console.log(`📹 后台管理发布视频: ${title} (ID: ${videoId}), 时长: ${duration}秒`);

    // 重新获取视频以包含关联对象
    const savedVideo = await db.findOne(
      `SELECT v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
              b.id as book_id, b.title as book_title, b.author as book_author
       FROM Video v
       LEFT JOIN Category c ON v.categoryId = c.id
       LEFT JOIN Book b ON v.bookId = b.id
       WHERE v.id = ?`,
      [videoId]
    );

    // 如果没有作者（后台发布的视频），创建默认作者信息
    const authorData = {
      id: 'system-admin',
      username: 'Ashley HR Center',
      usernameCn: '爱室丽人力中心',
      email: 'admin@ashleyfurniture.com',
      avatar: null,
      joinDate: new Date().toISOString().split('T')[0],
      totalVideos: 0,
      totalViews: 0,
      canPublish: false,
      canComment: false
    };

    const responseData = {
      id: savedVideo.id,
      title: savedVideo.title,
      titleEn: savedVideo.titleEn,
      category: {
        id: savedVideo.categoryId,
        name: savedVideo.category_name,
        nameCn: savedVideo.category_nameCn,
        sortOrder: savedVideo.category_sortOrder
      },
      videoUrl: savedVideo.videoUrl,
      videoUrlEn: savedVideo.videoUrlEn || null,
      coverUrl: savedVideo.coverUrl,
      duration: savedVideo.duration || 0,
      fileSize: savedVideo.fileSize,
      status: savedVideo.status,
      disabled: savedVideo.disabled !== 0,
      viewCount: savedVideo.viewCount || 0,
      likeCount: savedVideo.likeCount || 0,
      uploadDate: savedVideo.createdAt ? new Date(savedVideo.createdAt).toISOString().split('T')[0] : null,
      publishDate: null, // 待审核状态下没有发布日期
      author: authorData,
      book: savedVideo.book_id ? {
        id: savedVideo.book_id,
        title: savedVideo.book_title,
        author: savedVideo.book_author
      } : undefined
    };

    res.status(201).json({
      success: true,
      message: 'Video submitted for review successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Publish video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish video'
    });
  }
});

// 审核视频（后台管理使用，使用Master Key绕过ACL）
router.put('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "approve" or "reject"'
      });
    }

    // 获取视频对象
    const video = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 更新视频状态
    const updateData = {};
    if (action === 'approve') {
      updateData.status = '已发布';
      updateData.disabled = 0;
      updateData.publishDate = new Date().toISOString().split('T')[0];
      if (notes) {
        updateData.reviewNotes = notes;
      }
    } else {
      updateData.status = '已驳回';
      if (notes) {
        updateData.reviewNotes = notes;
      }
    }

    await db.update('Video', updateData, 'id = ?', [id]);

    console.log(`✅ 视频审核完成: ${id} - ${action === 'approve' ? '已发布' : '已驳回'}`);

    const updatedVideo = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);

    res.json({
      success: true,
      message: action === 'approve' ? 'Video approved and published' : 'Video rejected',
      data: {
        id: updatedVideo.id,
        status: updatedVideo.status,
        publishDate: updatedVideo.publishDate,
        reviewNotes: updatedVideo.reviewNotes
      }
    });

  } catch (error) {
    console.error('Review video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review video',
      error: error.message
    });
  }
});

// 禁用/启用视频（后台管理使用，使用Master Key绕过ACL）
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { disabled } = req.body;

    if (typeof disabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid disabled value. Must be boolean'
      });
    }

    // 获取视频对象
    const video = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 更新禁用状态
    await db.update('Video', { disabled: disabled ? 1 : 0 }, 'id = ?', [id]);

    console.log(`🔄 视频状态更新: ${id} - ${disabled ? '已禁用' : '已启用'}`);

    res.json({
      success: true,
      message: disabled ? 'Video disabled' : 'Video enabled',
      data: {
        id: video.id,
        disabled: disabled
      }
    });

  } catch (error) {
    console.error('Toggle video status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle video status',
      error: error.message
    });
  }
});

// 更新视频分类（后台管理使用，使用Master Key绕过ACL）
router.put('/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing categoryId'
      });
    }

    // 获取分类对象
    const category = await db.findOne('SELECT * FROM Category WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // 获取视频对象
    const video = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 更新视频分类
    await db.update('Video', { categoryId: parseInt(categoryId) }, 'id = ?', [id]);

    console.log(`✅ 视频分类更新: ${id} - ${category.nameCn}`);

    res.json({
      success: true,
      message: 'Video category updated successfully',
      data: {
        id: video.id,
        category: {
          id: category.id,
          name: category.name,
          nameCn: category.nameCn
        }
      }
    });

  } catch (error) {
    console.error('Update video category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video category',
      error: error.message
    });
  }
});

// 更新视频显示顺序（后台管理使用，使用Master Key绕过ACL）
router.put('/:id/displayOrder', async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      return res.status(400).json({
        success: false,
        message: 'Missing displayOrder'
      });
    }

    if (typeof displayOrder !== 'number' || displayOrder < 0) {
      return res.status(400).json({
        success: false,
        message: 'displayOrder must be a non-negative number'
      });
    }

    // 获取视频对象
    const video = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 更新视频显示顺序
    await db.update('Video', { displayOrder: displayOrder }, 'id = ?', [id]);

    console.log(`✅ 视频显示顺序更新: ${id} - displayOrder: ${displayOrder}`);

    res.json({
      success: true,
      message: 'Video display order updated successfully',
      data: {
        id: video.id,
        displayOrder: displayOrder
      }
    });

  } catch (error) {
    console.error('Update video display order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video display order',
      error: error.message
    });
  }
});

// 创建视频（后台管理使用）
router.post('/', async (req, res) => {
  try {
    const videoData = req.body;

    // 验证必填字段
    if (!videoData.title || !videoData.categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, categoryId'
      });
    }

    // 获取分类对象
    const category = await db.findOne('SELECT * FROM Category WHERE id = ?', [videoData.categoryId]);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // 创建视频对象
    const newVideoData = {
      title: videoData.title || '',
      titleEn: videoData.titleEn || null,
      categoryId: parseInt(videoData.categoryId),
      bookId: videoData.bookId ? parseInt(videoData.bookId) : null,
      videoUrl: videoData.videoUrl || null,
      videoUrlEn: videoData.videoUrlEn || null,
      coverUrl: videoData.coverUrl || null,
      duration: videoData.duration || 0,
      fileSize: videoData.fileSize || 0,
      status: videoData.status || '待审核',
      disabled: videoData.disabled ? 1 : 0,
      viewCount: videoData.viewCount || 0,
      likeCount: videoData.likeCount || 0,
      authorId: videoData.authorId ? parseInt(videoData.authorId) : null,
      displayOrder: videoData.displayOrder || null,
      reviewNotes: videoData.reviewNotes || null,
      publishDate: videoData.publishDate || null,
      aiExtractDate: videoData.aiExtractDate || null
    };

    // 保存视频
    const videoId = await db.insert('Video', newVideoData);

    console.log(`📹 后台管理创建视频: ${videoData.title} (ID: ${videoId})`);

    // 重新获取视频以包含关联对象
    const savedVideo = await db.findOne(
      `SELECT v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
              b.id as book_id, b.title as book_title, b.author as book_author,
              u.id as author_id, u.username as author_username, u.email as author_email
       FROM Video v
       LEFT JOIN Category c ON v.categoryId = c.id
       LEFT JOIN Book b ON v.bookId = b.id
       LEFT JOIN User u ON v.authorId = u.id
       WHERE v.id = ?`,
      [videoId]
    );

    // 如果没有作者（后台发布的视频），创建默认作者信息
    const authorData = savedVideo.author_id ? {
      id: savedVideo.author_id,
      username: savedVideo.author_username,
      email: savedVideo.author_email
    } : {
      id: 'system-admin',
      username: 'Ashley HR Center',
      email: 'admin@ashleyfurniture.com'
    };

    const responseData = {
      id: savedVideo.id,
      title: savedVideo.title,
      titleEn: savedVideo.titleEn,
      category: {
        id: savedVideo.categoryId,
        name: savedVideo.category_name,
        nameCn: savedVideo.category_nameCn,
        sortOrder: savedVideo.category_sortOrder
      },
      book: savedVideo.book_id ? {
        id: savedVideo.book_id,
        title: savedVideo.book_title,
        author: savedVideo.book_author
      } : undefined,
      videoUrl: savedVideo.videoUrl,
      videoUrlEn: savedVideo.videoUrlEn || null,
      coverUrl: savedVideo.coverUrl,
      duration: savedVideo.duration || 0,
      fileSize: savedVideo.fileSize,
      status: savedVideo.status,
      disabled: savedVideo.disabled !== 0,
      viewCount: savedVideo.viewCount || 0,
      likeCount: savedVideo.likeCount || 0,
      uploadDate: savedVideo.createdAt ? new Date(savedVideo.createdAt).toISOString().split('T')[0] : null,
      publishDate: savedVideo.publishDate || null,
      aiExtractDate: savedVideo.aiExtractDate || null,
      author: authorData,
      displayOrder: savedVideo.displayOrder || undefined,
      reviewNotes: savedVideo.reviewNotes || null,
      createdAt: savedVideo.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create video',
      error: error.message
    });
  }
});

// 更新视频（通用更新接口，除了category和displayOrder）
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 获取视频对象
    const video = await db.findOne('SELECT * FROM Video WHERE id = ?', [id]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 构建更新数据（排除category和displayOrder，它们有专门的接口）
    const dbUpdateData = {};
    if (updateData.title !== undefined) dbUpdateData.title = updateData.title;
    if (updateData.titleEn !== undefined) dbUpdateData.titleEn = updateData.titleEn;
    if (updateData.videoUrl !== undefined) dbUpdateData.videoUrl = updateData.videoUrl;
    if (updateData.videoUrlEn !== undefined) dbUpdateData.videoUrlEn = updateData.videoUrlEn;
    if (updateData.coverUrl !== undefined) dbUpdateData.coverUrl = updateData.coverUrl;
    if (updateData.duration !== undefined) dbUpdateData.duration = updateData.duration;
    if (updateData.fileSize !== undefined) dbUpdateData.fileSize = updateData.fileSize;
    if (updateData.status !== undefined) dbUpdateData.status = updateData.status;
    if (updateData.disabled !== undefined) dbUpdateData.disabled = updateData.disabled ? 1 : 0;
    if (updateData.viewCount !== undefined) dbUpdateData.viewCount = updateData.viewCount;
    if (updateData.likeCount !== undefined) dbUpdateData.likeCount = updateData.likeCount;
    if (updateData.bookId !== undefined) dbUpdateData.bookId = updateData.bookId ? parseInt(updateData.bookId) : null;
    if (updateData.authorId !== undefined) dbUpdateData.authorId = updateData.authorId ? parseInt(updateData.authorId) : null;
    if (updateData.reviewNotes !== undefined) dbUpdateData.reviewNotes = updateData.reviewNotes;
    if (updateData.publishDate !== undefined) dbUpdateData.publishDate = updateData.publishDate;
    if (updateData.aiExtractDate !== undefined) dbUpdateData.aiExtractDate = updateData.aiExtractDate;

    // 执行更新
    await db.update('Video', dbUpdateData, 'id = ?', [id]);

    console.log(`✅ 视频更新完成: ${id}`);

    // 重新获取更新后的视频
    const updatedVideo = await db.findOne(
      `SELECT v.*, c.name as category_name, c.nameCn as category_nameCn, c.sortOrder as category_sortOrder,
              b.id as book_id, b.title as book_title, b.author as book_author,
              u.id as author_id, u.username as author_username, u.email as author_email
       FROM Video v
       LEFT JOIN Category c ON v.categoryId = c.id
       LEFT JOIN Book b ON v.bookId = b.id
       LEFT JOIN User u ON v.authorId = u.id
       WHERE v.id = ?`,
      [id]
    );

    const authorData = updatedVideo.author_id ? {
      id: updatedVideo.author_id,
      username: updatedVideo.author_username,
      email: updatedVideo.author_email
    } : {
      id: 'system-admin',
      username: 'Ashley HR Center',
      email: 'admin@ashleyfurniture.com'
    };

    const responseData = {
      id: updatedVideo.id,
      title: updatedVideo.title,
      titleEn: updatedVideo.titleEn,
      category: updatedVideo.categoryId ? {
        id: updatedVideo.categoryId,
        name: updatedVideo.category_name,
        nameCn: updatedVideo.category_nameCn,
        sortOrder: updatedVideo.category_sortOrder
      } : null,
      book: updatedVideo.book_id ? {
        id: updatedVideo.book_id,
        title: updatedVideo.book_title,
        author: updatedVideo.book_author
      } : undefined,
      videoUrl: updatedVideo.videoUrl,
      videoUrlEn: updatedVideo.videoUrlEn || null,
      coverUrl: updatedVideo.coverUrl,
      duration: updatedVideo.duration || 0,
      fileSize: updatedVideo.fileSize,
      status: updatedVideo.status,
      disabled: updatedVideo.disabled !== 0,
      viewCount: updatedVideo.viewCount || 0,
      likeCount: updatedVideo.likeCount || 0,
      uploadDate: updatedVideo.createdAt ? new Date(updatedVideo.createdAt).toISOString().split('T')[0] : null,
      publishDate: updatedVideo.publishDate || null,
      aiExtractDate: updatedVideo.aiExtractDate || null,
      author: authorData,
      displayOrder: updatedVideo.displayOrder || undefined,
      reviewNotes: updatedVideo.reviewNotes || null,
      createdAt: updatedVideo.createdAt
    };

    res.json({
      success: true,
      message: 'Video updated successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Update video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video',
      error: error.message
    });
  }
});

// 删除视频（使用Master Key绕过ACL）
router.delete('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: '缺少视频ID'
      });
    }

    // 删除视频
    const video = await db.findOne('SELECT id FROM Video WHERE id = ?', [videoId]);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: '视频不存在'
      });
    }

    await db.remove('Video', 'id = ?', [videoId]);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除视频失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除失败'
    });
  }
});

// 获取视频播放URL（返回带签名的私有URL，解决CORS和防盗链问题）
router.get('/:videoId/play-url', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { lang } = req.query; // 'zh' 或 'en'

    // 获取视频信息
    const video = await db.findOne('SELECT videoUrl, videoUrlEn FROM Video WHERE id = ?', [videoId]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 根据查询参数选择中文或英文视频
    const videoUrl = lang === 'en' && video.videoUrlEn ? video.videoUrlEn : video.videoUrl;

    if (!videoUrl) {
      return res.status(404).json({
        success: false,
        message: 'Video URL not found'
      });
    }

    // 使用七牛云私有下载URL（带签名，解决CORS和防盗链问题）
    const { getPrivateDownloadUrl } = require('../utils/fileUpload');
    const signedUrl = getPrivateDownloadUrl(videoUrl, 3600); // 1小时有效期

    res.json({
      success: true,
      data: {
        videoUrl: signedUrl,
        expiresIn: 3600
      }
    });
  } catch (error) {
    console.error('Get video play URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video play URL',
      error: error.message
    });
  }
});

// 视频代理接口（流式传输，解决CORS和防盗链问题）
router.get('/proxy/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const range = req.headers.range;
    const { lang } = req.query; // 'zh' 或 'en'

    // 获取视频信息
    const video = await db.findOne('SELECT videoUrl, videoUrlEn FROM Video WHERE id = ?', [videoId]);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // 根据查询参数选择中文或英文视频
    const videoUrl = lang === 'en' && video.videoUrlEn ? video.videoUrlEn : video.videoUrl;

    if (!videoUrl) {
      return res.status(404).json({
        success: false,
        message: 'Video URL not found'
      });
    }

    // 使用七牛云私有下载URL（带签名）
    const { getPrivateDownloadUrl } = require('../utils/fileUpload');
    let signedUrl = getPrivateDownloadUrl(videoUrl, 3600);
    
    // 确保URL有效
    if (!signedUrl || (!signedUrl.startsWith('http://') && !signedUrl.startsWith('https://'))) {
      console.error('❌ 无效的签名URL:', signedUrl);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate valid video URL',
        error: 'Invalid signed URL format'
      });
    }

    console.log('📹 使用签名URL获取视频:', signedUrl);

    // 从七牛云获取视频
    const videoResponse = await fetch(signedUrl, {
      headers: range ? { Range: range } : {}
    });

    if (!videoResponse.ok && videoResponse.status !== 206) {
      return res.status(videoResponse.status).json({
        success: false,
        message: 'Failed to fetch video from storage'
      });
    }

    // 设置CORS响应头
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // 设置响应头
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // 处理范围请求（Range requests）
    if (videoResponse.status === 206 && range) {
      const contentRange = videoResponse.headers.get('content-range');
      const contentLength = videoResponse.headers.get('content-length');
      
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.status(206);
    } else {
      const contentLength = videoResponse.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
    }

    // 流式传输视频数据
    videoResponse.body.pipe(res);
  } catch (error) {
    console.error('Video proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to proxy video',
      error: error.message
    });
  }
});

module.exports = router;
