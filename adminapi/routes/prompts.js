const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateAdmin } = require('./auth');

// 初始化prompts表（如果不存在）
const ensurePromptsTable = async () => {
  try {
    // 尝试查询表，如果表不存在会抛出错误
    await db.query('SELECT 1 FROM prompts LIMIT 1');
    // 表存在，直接返回
    return true;
  } catch (error) {
    // 如果错误是表不存在，则创建表
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
      try {
        console.log('📝 Creating prompts table...');
        await db.query(`
          CREATE TABLE IF NOT EXISTS prompts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            key_name VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键名',
            value TEXT NOT NULL COMMENT '配置值',
            description VARCHAR(500) COMMENT '配置描述',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_key_name (key_name)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Prompt配置表'
        `);
        console.log('✅ prompts表创建成功');
        return true;
      } catch (createError) {
        console.error('❌ 创建prompts表失败:', createError);
        throw createError;
      }
    } else {
      // 其他错误，直接抛出
      throw error;
    }
  }
};

// 获取书籍拆解Prompt配置
router.get('/book-decomposition', async (req, res) => {
  try {
    // 确保表存在
    await ensurePromptsTable();
    
    const rows = await db.query(
      'SELECT value FROM prompts WHERE key_name = ?',
      ['book_decomposition_prompt']
    );

    if (rows && rows.length > 0) {
      res.json({
        success: true,
        prompt: rows[0].value
      });
    } else {
      // 如果数据库中没有，返回404，让前端使用默认值
      res.status(404).json({
        success: false,
        message: 'Prompt配置不存在'
      });
    }
  } catch (error) {
    console.error('❌ 获取书籍拆解Prompt失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Prompt配置失败',
      error: error.message
    });
  }
});

// 保存书籍拆解Prompt配置（需要管理员权限）
router.post('/book-decomposition', authenticateAdmin, async (req, res) => {
  try {
    // 确保表存在
    await ensurePromptsTable();
    
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Prompt内容不能为空'
      });
    }

    // 使用INSERT ... ON DUPLICATE KEY UPDATE来支持插入或更新
    await db.query(`
      INSERT INTO prompts (key_name, value, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        updated_at = CURRENT_TIMESTAMP
    `, [
      'book_decomposition_prompt',
      prompt,
      '书籍拆解Prompt模板，用于生成视频脚本'
    ]);

    res.json({
      success: true,
      message: 'Prompt配置已保存'
    });
  } catch (error) {
    console.error('❌ 保存书籍拆解Prompt失败:', error);
    res.status(500).json({
      success: false,
      message: '保存Prompt配置失败',
      error: error.message
    });
  }
});

module.exports = router;

