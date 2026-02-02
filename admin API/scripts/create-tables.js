// 创建数据库表的脚本
const db = require('../utils/db');
const fs = require('fs');
const path = require('path');

async function createTables() {
  try {
    console.log('📊 开始创建数据库表...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割SQL语句（按分号分割，但要注意字符串中的分号）
    // 移除注释行
    const lines = sql.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('--');
    });
    const cleanSql = lines.join('\n');
    
    // 按分号分割，但保留CREATE TABLE语句完整
    const statements = cleanSql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length > 10);
    
    console.log(`📝 找到 ${statements.length} 条SQL语句`);
    
    // 执行每条SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await db.query(statement);
          console.log(`✅ 执行第 ${i + 1} 条SQL语句成功`);
        } catch (error) {
          // 如果表已存在，忽略错误
          if (error.message.includes('already exists') || error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log(`⚠️  第 ${i + 1} 条SQL语句：表已存在，跳过`);
          } else {
            console.error(`❌ 执行第 ${i + 1} 条SQL语句失败:`, error.message);
            console.error('SQL:', statement.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('✅ 数据库表创建完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建数据库表失败:', error);
    process.exit(1);
  }
}

createTables();

