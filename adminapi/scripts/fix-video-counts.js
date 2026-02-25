// 修复视频的点赞数和评论数，确保与实际数据一致
const db = require('../utils/db');

async function fixVideoCounts() {
  try {
    console.log('📊 开始检查和修复视频的点赞数和评论数...\n');
    
    // 获取所有视频
    const videos = await db.query('SELECT id, title, likeCount FROM Video');
    console.log(`找到 ${videos.length} 个视频\n`);
    
    let fixedLikeCount = 0;
    let fixedCommentCount = 0;
    
    for (const video of videos) {
      // 检查实际的点赞数
      const actualLikes = await db.query(
        'SELECT COUNT(*) as count FROM `Like` WHERE videoId = ?',
        [video.id]
      );
      const actualLikeCount = parseInt(actualLikes[0]?.count || 0, 10) || 0;
      
      // 检查实际的评论数
      const actualComments = await db.query(
        'SELECT COUNT(*) as count FROM Comment WHERE videoId = ?',
        [video.id]
      );
      const actualCommentCount = parseInt(actualComments[0]?.count || 0, 10) || 0;
      
      const dbLikeCount = parseInt(video.likeCount || 0, 10) || 0;
      
      // 如果数据库中的值与实际值不一致，修复它
      if (dbLikeCount !== actualLikeCount) {
        console.log(`修复视频 ID ${video.id}: "${video.title}"`);
        console.log(`  点赞数: ${dbLikeCount} -> ${actualLikeCount}`);
        await db.update('Video', { likeCount: actualLikeCount }, 'id = ?', [video.id]);
        fixedLikeCount++;
      }
      
      // 注意：评论数不在 Video 表中，是通过 API 实时计算的，所以不需要修复
      // 但如果 Video 表中有 commentCount 字段，也需要修复
      
      // 显示有问题的视频
      if (dbLikeCount > 0 && actualLikeCount === 0) {
        console.log(`⚠️  视频 ID ${video.id}: "${video.title}" - 数据库显示 ${dbLikeCount} 个点赞，但实际为 0`);
      }
      if (actualCommentCount > 0 && dbLikeCount === 0) {
        // 这个正常，只是信息
      }
    }
    
    console.log(`\n✅ 修复完成！`);
    console.log(`  修复了 ${fixedLikeCount} 个视频的点赞数`);
    console.log(`  评论数通过 API 实时计算，无需修复`);
    
    // 特别检查包含 "AI" 和 "fortune" 的视频
    console.log(`\n🔍 检查包含 "AI" 和 "fortune" 的视频：`);
    const aiVideos = videos.filter(v => 
      v.title && (v.title.includes('AI') || v.title.toLowerCase().includes('fortune'))
    );
    
    for (const video of aiVideos) {
      const actualLikes = await db.query(
        'SELECT COUNT(*) as count FROM `Like` WHERE videoId = ?',
        [video.id]
      );
      const actualLikeCount = parseInt(actualLikes[0]?.count || 0, 10) || 0;
      
      const actualComments = await db.query(
        'SELECT COUNT(*) as count FROM Comment WHERE videoId = ?',
        [video.id]
      );
      const actualCommentCount = parseInt(actualComments[0]?.count || 0, 10) || 0;
      
      console.log(`\n视频 ID: ${video.id}`);
      console.log(`标题: ${video.title}`);
      console.log(`数据库 likeCount: ${video.likeCount}`);
      console.log(`实际点赞数: ${actualLikeCount}`);
      console.log(`实际评论数: ${actualCommentCount}`);
      
      if (parseInt(video.likeCount || 0, 10) !== actualLikeCount) {
        console.log(`❌ 点赞数不一致！`);
      }
      if (actualCommentCount > 0) {
        console.log(`⚠️  有 ${actualCommentCount} 条评论`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

fixVideoCounts();

