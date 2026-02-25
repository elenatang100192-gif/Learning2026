// 检查特定书籍的summaryEn是否完整
require('dotenv').config();
const db = require('../utils/db');

async function checkSummaryEn() {
  try {
    const bookTitle = process.argv[2] || 'from zero to one';
    
    console.log(`📚 检查书籍 "${bookTitle}" 的summaryEn完整性...\n`);
    
    // 查找书籍
    const books = await db.query(`
      SELECT id, title, author 
      FROM Book 
      WHERE title LIKE ?
    `, [`%${bookTitle}%`]);
    
    if (books.length === 0) {
      console.log('❌ 未找到匹配的书籍');
      process.exit(1);
    }
    
    for (const book of books) {
      console.log(`\n📖 书籍: ${book.title} (ID: ${book.id})`);
      
      // 获取所有内容段
      const contents = await db.query(`
        SELECT id, segmentIndex, chapterTitle, chapterTitleEn, 
               summary, summaryEn, 
               LENGTH(summary) as summaryLength,
               LENGTH(summaryEn) as summaryEnLength
        FROM ExtractedContent 
        WHERE bookId = ?
        ORDER BY segmentIndex
      `, [book.id]);
      
      console.log(`   找到 ${contents.length} 个内容段\n`);
      
      contents.forEach((content, index) => {
        console.log(`   段 ${index + 1} (segmentIndex: ${content.segmentIndex}):`);
        console.log(`     标题: ${content.chapterTitle || content.chapterTitleEn || '无'}`);
        console.log(`     summary长度: ${content.summaryLength || 0}字符`);
        console.log(`     summaryEn长度: ${content.summaryEnLength || 0}字符`);
        
        if (content.summaryEn) {
          const summaryEn = content.summaryEn;
          console.log(`     summaryEn预览（前200字符）: ${summaryEn.substring(0, 200)}...`);
          console.log(`     summaryEn结尾（后200字符）: ${summaryEn.length > 200 ? '...' + summaryEn.substring(summaryEn.length - 200) : summaryEn}`);
          
          // 检查是否包含最后一句
          const lastSentenceKeywords = ['like and save', 'protect', 'uncalculated light', 'suggested by a system'];
          const containsLastSentence = lastSentenceKeywords.some(keyword => 
            summaryEn.toLowerCase().includes(keyword.toLowerCase())
          );
          console.log(`     是否包含最后一句关键词: ${containsLastSentence ? '✅ 包含' : '❌ 不包含'}`);
          
          // 检查是否以预期结尾结束
          const expectedEnding = 'If you\'ve ever been \'suggested\' by a system whom to love or avoid, please like and save this video. Let\'s protect that uncalculated light within us.';
          const textEndsWithExpected = summaryEn.trim().endsWith(expectedEnding.trim());
          console.log(`     是否以预期结尾结束: ${textEndsWithExpected ? '✅ 是' : '❌ 否'}`);
          
          if (!textEndsWithExpected) {
            console.log(`     实际结尾: ${summaryEn.substring(Math.max(0, summaryEn.length - 200))}`);
          }
        } else {
          console.log(`     summaryEn: 空`);
        }
        console.log('');
      });
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
    checkSummaryEn();
  } else {
    console.error('❌ 数据库连接失败，请检查配置');
    process.exit(1);
  }
});

