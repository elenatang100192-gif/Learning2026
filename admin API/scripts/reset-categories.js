// 重置分类数据，只保留固定的3个分类：Tech, Culture, Business
const db = require('../utils/db');

const requiredCategories = [
  { name: 'Tech', nameCn: '科技', sortOrder: 1 },
  { name: 'Culture', nameCn: '文化', sortOrder: 2 },
  { name: 'Business', nameCn: '商业', sortOrder: 3 }
];

async function resetCategories() {
  try {
    console.log('📊 开始重置分类数据...');
    
    // 获取所有现有分类
    const existing = await db.query('SELECT * FROM Category');
    console.log(`当前有 ${existing.length} 个分类`);
    
    // 删除不在requiredCategories列表中的分类
    const requiredNames = requiredCategories.map(c => c.name);
    for (const cat of existing) {
      if (!requiredNames.includes(cat.name)) {
        console.log(`🗑️  删除分类: ${cat.nameCn} (${cat.name})`);
        await db.remove('Category', 'id = ?', [cat.id]);
      }
    }
    
    // 确保requiredCategories中的分类都存在
    for (const cat of requiredCategories) {
      const existing = await db.findOne('SELECT id FROM Category WHERE name = ?', [cat.name]);
      if (existing) {
        // 更新现有分类的sortOrder和nameCn（确保数据正确）
        await db.update('Category', { 
          nameCn: cat.nameCn, 
          sortOrder: cat.sortOrder 
        }, 'id = ?', [existing.id]);
        console.log(`✅ 更新分类: ${cat.nameCn} (${cat.name})`);
      } else {
        // 插入新分类
        await db.insert('Category', cat);
        console.log(`✅ 插入分类: ${cat.nameCn} (${cat.name})`);
      }
    }
    
    // 显示最终结果
    const final = await db.query('SELECT * FROM Category ORDER BY sortOrder');
    console.log(`\n✅ 重置完成！当前分类列表:`);
    final.forEach(c => {
      console.log(`  ${c.id}. ${c.nameCn} (${c.name}) - sortOrder: ${c.sortOrder}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 重置分类失败:', error);
    process.exit(1);
  }
}

resetCategories();

