// 检查所有分类的视频
const db = require('../utils/db');

async function checkAllCategoryVideos() {
  try {
    console.log('📊 检查所有分类和视频...\n');
    
    // 1. 检查所有分类
    const categories = await db.findAll('SELECT id, name, nameCn FROM Category ORDER BY sortOrder');
    console.log('所有分类:');
    categories.forEach(c => {
      console.log(`  ID: ${c.id}, name: ${c.name}, nameCn: ${c.nameCn}`);
    });
    console.log('');
    
    // 2. 检查每个分类下的视频
    for (const category of categories) {
      const videos = await db.query(`
        SELECT v.id, v.title, v.status, v.disabled, v.categoryId
        FROM Video v
        WHERE v.categoryId = ?
        ORDER BY v.createdAt DESC
        LIMIT 10
      `, [category.id]);
      
      console.log(`分类 "${category.nameCn}" (${category.name}) - 共 ${videos.length} 个视频:`);
      
      const publishedVideos = videos.filter(v => v.status === '已发布' && v.disabled === 0);
      const otherVideos = videos.filter(v => !(v.status === '已发布' && v.disabled === 0));
      
      if (publishedVideos.length > 0) {
        console.log(`  ✅ 已发布且未禁用 (${publishedVideos.length}):`);
        publishedVideos.forEach(v => {
          console.log(`    - ID: ${v.id}, 标题: ${v.title}`);
        });
      }
      
      if (otherVideos.length > 0) {
        console.log(`  ⚠️  其他状态 (${otherVideos.length}):`);
        otherVideos.forEach(v => {
          console.log(`    - ID: ${v.id}, 标题: ${v.title}, 状态: ${v.status}, 禁用: ${v.disabled}`);
        });
      }
      
      if (videos.length === 0) {
        console.log(`  ❌ 没有视频`);
      }
      console.log('');
    }
    
    // 3. 测试API查询
    console.log('测试API查询:');
    const testCategories = ['科技', '文化', '商业'];
    for (const catName of testCategories) {
      const categories = await db.findAll('SELECT id FROM Category WHERE nameCn = ?', [catName]);
      if (categories.length > 0) {
        const categoryIds = categories.map(c => c.id);
        const videos = await db.query(`
          SELECT v.id, v.title, v.status, v.disabled
          FROM Video v
          WHERE v.categoryId IN (${categoryIds.map(() => '?').join(',')})
            AND v.status = '已发布'
            AND v.disabled = 0
          LIMIT 5
        `, categoryIds);
        console.log(`  "${catName}": ${videos.length} 个已发布且未禁用的视频`);
      } else {
        console.log(`  "${catName}": 分类不存在`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkAllCategoryVideos();

