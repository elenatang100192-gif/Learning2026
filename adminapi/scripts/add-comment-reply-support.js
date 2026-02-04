/**
 * 数据库迁移脚本：添加评论回复支持和通知系统
 * 1. 添加 parentCommentId 字段支持回复
 * 2. 添加 mentionedUserIds 字段支持@用户名
 * 3. 创建 Notification 表支持@提醒
 */

// 加载环境变量（必须在其他模块之前加载）
require('dotenv').config();

const db = require('../utils/db');

async function migrate() {
  try {
    console.log('🚀 开始数据库迁移...');

    // 1. 检查并添加 parentCommentId 字段
    console.log('📝 检查 Comment 表结构...');
    const commentColumns = await db.query('DESCRIBE Comment');
    const hasParentCommentId = commentColumns.some(col => col.Field === 'parentCommentId');
    const hasMentionedUserIds = commentColumns.some(col => col.Field === 'mentionedUserIds');

    if (!hasParentCommentId) {
      console.log('➕ 添加 parentCommentId 字段...');
      await db.query(`
        ALTER TABLE Comment 
        ADD COLUMN parentCommentId INT NULL COMMENT '父评论ID，用于回复',
        ADD INDEX idx_parentCommentId (parentCommentId),
        ADD FOREIGN KEY (parentCommentId) REFERENCES Comment(id) ON DELETE CASCADE
      `);
      console.log('✅ parentCommentId 字段添加成功');
    } else {
      console.log('ℹ️  parentCommentId 字段已存在');
    }

    if (!hasMentionedUserIds) {
      console.log('➕ 添加 mentionedUserIds 字段...');
      await db.query(`
        ALTER TABLE Comment 
        ADD COLUMN mentionedUserIds JSON NULL COMMENT '被@的用户ID列表，JSON格式数组'
      `);
      console.log('✅ mentionedUserIds 字段添加成功');
    } else {
      console.log('ℹ️  mentionedUserIds 字段已存在');
    }

    // 2. 移除评论唯一约束（如果存在）
    console.log('🔍 检查评论唯一约束...');
    try {
      const constraints = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Comment' 
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%userId%videoId%'
      `);
      
      if (constraints.length > 0) {
        console.log('➖ 移除评论唯一约束...');
        for (const constraint of constraints) {
          await db.query(`ALTER TABLE Comment DROP INDEX ${constraint.CONSTRAINT_NAME}`);
          console.log(`✅ 已移除约束: ${constraint.CONSTRAINT_NAME}`);
        }
      } else {
        console.log('ℹ️  未找到评论唯一约束');
      }
    } catch (error) {
      console.log('ℹ️  检查约束时出错（可能不存在）:', error.message);
    }

    // 3. 创建 Notification 表
    console.log('📝 检查 Notification 表...');
    const tables = await db.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'Notification'
    `);

    if (tables.length === 0) {
      console.log('➕ 创建 Notification 表...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS Notification (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL COMMENT '接收通知的用户ID',
          type ENUM('mention', 'reply', 'like', 'follow') NOT NULL COMMENT '通知类型',
          relatedUserId INT NULL COMMENT '触发通知的用户ID',
          relatedCommentId INT NULL COMMENT '相关评论ID',
          relatedVideoId INT NULL COMMENT '相关视频ID',
          content TEXT NOT NULL COMMENT '通知内容（JSON格式，支持多语言）',
          isRead TINYINT(1) DEFAULT 0 COMMENT '是否已读',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_userId (userId),
          INDEX idx_isRead (isRead),
          INDEX idx_createdAt (createdAt),
          FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
          FOREIGN KEY (relatedUserId) REFERENCES User(id) ON DELETE SET NULL,
          FOREIGN KEY (relatedCommentId) REFERENCES Comment(id) ON DELETE CASCADE,
          FOREIGN KEY (relatedVideoId) REFERENCES Video(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Notification 表创建成功');
    } else {
      console.log('ℹ️  Notification 表已存在');
    }

    console.log('✅ 数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

migrate();

