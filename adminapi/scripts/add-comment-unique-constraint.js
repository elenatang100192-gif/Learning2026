// 为 Comment 表添加唯一约束（一个用户一个视频只能评论一次）
const db = require('../utils/db');

async function addUniqueConstraint() {
  try {
    console.log('📊 开始为 Comment 表添加唯一约束...\n');
    
    // 1. 检查是否有重复数据
    console.log('1️⃣ 检查重复数据...');
    const duplicates = await db.query(`
      SELECT userId, videoId, COUNT(*) as count
      FROM Comment
      GROUP BY userId, videoId
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length > 0) {
      console.log(`⚠️  发现 ${duplicates.length} 组重复评论，将保留最早的评论，删除其他重复项...`);
      
      for (const dup of duplicates) {
        // 获取该用户对该视频的所有评论，按创建时间排序
        const comments = await db.query(`
          SELECT id, createdAt
          FROM Comment
          WHERE userId = ? AND videoId = ?
          ORDER BY createdAt ASC
        `, [dup.userId, dup.videoId]);
        
        // 保留第一条，删除其他
        if (comments.length > 1) {
          const idsToDelete = comments.slice(1).map(c => c.id);
          for (const id of idsToDelete) {
            await db.remove('Comment', 'id = ?', [id]);
            console.log(`   删除重复评论 ID: ${id}`);
          }
        }
      }
      console.log('✅ 重复数据清理完成\n');
    } else {
      console.log('✅ 没有发现重复数据\n');
    }
    
    // 2. 检查是否已存在唯一约束
    console.log('2️⃣ 检查是否已存在唯一约束...');
    const indexes = await db.query(`
      SHOW INDEXES FROM Comment WHERE Key_name = 'video_user'
    `);
    
    if (indexes.length > 0) {
      console.log('⚠️  唯一约束已存在，跳过添加\n');
      return;
    }
    
    // 3. 添加唯一约束
    console.log('3️⃣ 添加唯一约束...');
    await db.query(`
      ALTER TABLE Comment
      ADD UNIQUE KEY video_user (videoId, userId)
    `);
    
    console.log('✅ 唯一约束添加成功\n');
    console.log('✅ 完成！现在一个用户一个视频只能评论一次');
    
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Duplicate key') || error.message.includes('Duplicate entry')) {
      console.error('❌ 添加唯一约束失败：存在重复数据，请先清理重复数据');
    } else {
      console.error('❌ 添加唯一约束失败:', error);
    }
    process.exit(1);
  }
}

addUniqueConstraint();

