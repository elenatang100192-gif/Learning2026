// 添加canAdmin字段到User表
const db = require('../utils/db');

async function addCanAdminColumn() {
  try {
    console.log('📊 开始添加canAdmin字段到User表...\n');
    
    // 检查字段是否已存在
    const columns = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'User' 
      AND COLUMN_NAME = 'canAdmin'
    `);
    
    if (columns.length > 0) {
      console.log('⚠️  canAdmin字段已存在，跳过');
      process.exit(0);
    }
    
    // 添加canAdmin字段
    await db.query(`
      ALTER TABLE User 
      ADD COLUMN canAdmin TINYINT(1) DEFAULT 0 COMMENT '可以登录后台管理' 
      AFTER canComment
    `);
    
    console.log('✅ canAdmin字段添加成功');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加canAdmin字段失败:', error);
    process.exit(1);
  }
}

addCanAdminColumn();

