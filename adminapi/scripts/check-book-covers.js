// 检查书籍封面关联情况
require('dotenv').config();
const db = require('../utils/db');

async function checkBookCovers() {
  try {
    console.log('📚 检查所有书籍的封面关联情况...\n');
    
    // 获取所有书籍
    const books = await db.query(`
      SELECT id, title, author, blogCoverUrl 
      FROM Book 
      ORDER BY id
    `);
    
    console.log(`找到 ${books.length} 本书籍:\n`);
    
    books.forEach(book => {
      console.log(`ID: ${book.id}`);
      console.log(`  书名: ${book.title}`);
      console.log(`  作者: ${book.author}`);
      if (book.blogCoverUrl) {
        // 从URL中提取bookId（如果文件名包含bookId）
        const urlMatch = book.blogCoverUrl.match(/blog_cover_(\d+)_/);
        const urlBookId = urlMatch ? urlMatch[1] : '未知';
        console.log(`  封面URL: ${book.blogCoverUrl}`);
        console.log(`  URL中的bookId: ${urlBookId}`);
        
        if (urlBookId !== '未知' && parseInt(urlBookId) !== book.id) {
          console.log(`  ⚠️ 警告: URL中的bookId (${urlBookId}) 与书籍ID (${book.id}) 不匹配！`);
        }
      } else {
        console.log(`  封面URL: 无`);
      }
      console.log('');
    });
    
    // 检查是否有重复的封面URL
    const coverUrlMap = {};
    books.forEach(book => {
      if (book.blogCoverUrl) {
        if (!coverUrlMap[book.blogCoverUrl]) {
          coverUrlMap[book.blogCoverUrl] = [];
        }
        coverUrlMap[book.blogCoverUrl].push(book);
      }
    });
    
    const duplicateCovers = Object.entries(coverUrlMap).filter(([url, books]) => books.length > 1);
    if (duplicateCovers.length > 0) {
      console.log('\n⚠️ 发现重复的封面URL:\n');
      duplicateCovers.forEach(([url, books]) => {
        console.log(`  封面URL: ${url}`);
        console.log(`  关联的书籍:`);
        books.forEach(book => {
          console.log(`    - ID: ${book.id}, 书名: ${book.title}`);
        });
        console.log('');
      });
    } else {
      console.log('\n✅ 没有发现重复的封面URL');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

// 测试数据库连接
db.testConnection().then(success => {
  if (success) {
    checkBookCovers();
  } else {
    console.error('❌ 数据库连接失败，请检查配置');
    process.exit(1);
  }
});

