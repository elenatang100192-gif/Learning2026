// 检查Culture分类的视频
const db = require('../utils/db');

async function checkCultureVideos() {
  try {
    console.log('📊 检查分类和视频...\n');
    
    // 1. 检查所有分类
    const categories = await db.findAll('SELECT id, name, nameCn FROM Category ORDER BY sortOrder');
    console.log('所有分类:');
    categories.forEach(c => {
      console.log(`  ID: ${c.id}, name: ${c.name}, nameCn: ${c.nameCn}`);
    });
    console.log('');
    
    // 2. 查找"文化"或"Culture"分类
    const cultureCategories = await db.findAll('SELECT id, name, nameCn FROM Category WHERE nameCn = ? OR nameCn = ? OR name = ?', ['文化', '艺术人文', 'Culture']);
    console.log('Culture相关分类:');
    cultureCategories.forEach(c => {
      console.log(`  ID: ${c.id}, name: ${c.name}, nameCn: ${c.nameCn}`);
    });
    console.log('');
    
    // 3. 检查这些分类下的视频
    if (cultureCategories.length > 0) {
      const categoryIds = cultureCategories.map(c => c.id);
      const videos = await db.query(`
        SELECT v.id, v.title, v.status, v.disabled, v.categoryId,
               c.nameCn as category_nameCn, c.name as category_name
        FROM Video v
        LEFT JOIN Category c ON v.categoryId = c.id
        WHERE v.categoryId IN (${categoryIds.map(() => '?').join(',')})
        ORDER BY v.createdAt DESC
        LIMIT 10
      `, categoryIds);
      
      console.log(`找到 ${videos.length} 个Culture分类的视频:`);
      videos.forEach(v => {
        console.log(`  ID: ${v.id}, 标题: ${v.title}, 状态: ${v.status}, 禁用: ${v.disabled}, 分类: ${v.category_nameCn || v.category_name}`);
      });
    } else {
      console.log('⚠️  未找到Culture相关分类');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkCultureVideos();

