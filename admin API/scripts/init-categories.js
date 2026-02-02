// 初始化分类数据
const db = require('../utils/db');

const categories = [
  { name: 'Tech', nameCn: '科技', sortOrder: 1 },
  { name: 'Culture', nameCn: '文化', sortOrder: 2 },
  { name: 'Business', nameCn: '商业', sortOrder: 3 }
];

async function initCategories() {
  try {
    console.log('📊 开始初始化分类数据...');
    
    // 插入或更新分类数据（如果已存在则跳过）
    for (const cat of categories) {
      try {
        // 检查是否已存在
        const existing = await db.findOne('SELECT id FROM Category WHERE name = ?', [cat.name]);
        if (existing) {
          console.log(`⚠️  分类已存在，跳过: ${cat.nameCn} (${cat.name})`);
        } else {
          await db.insert('Category', cat);
          console.log(`✅ 插入分类: ${cat.nameCn} (${cat.name})`);
        }
      } catch (error) {
        console.error(`❌ 插入分类失败: ${cat.nameCn}`, error);
      }
    }
    
    console.log(`✅ 成功初始化 ${categories.length} 个分类`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化分类失败:', error);
    process.exit(1);
  }
}

initCategories();

