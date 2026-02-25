// 创建 prompts 表的脚本
require('dotenv').config();
const db = require('../utils/db');

async function createPromptsTable() {
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
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建prompts表失败:', error);
    process.exit(1);
  }
}

// 测试数据库连接
db.testConnection().then(success => {
  if (success) {
    createPromptsTable();
  } else {
    console.error('❌ 数据库连接失败，请检查配置');
    process.exit(1);
  }
});

