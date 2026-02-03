// 创建测试管理员账号
const db = require('../utils/db');
const bcrypt = require('bcrypt');

async function createTestAdmin() {
  try {
    const testEmail = 'admin@test.com';
    const testPassword = 'admin123';
    const testUsername = 'Test Admin';

    console.log('📊 开始创建测试管理员账号...\n');

    // 检查用户是否已存在
    const existingUser = await db.findOne('SELECT * FROM User WHERE email = ?', [testEmail]);
    
    if (existingUser) {
      console.log('⚠️  用户已存在，更新密码和权限...');
      
      // 更新密码和权限
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      await db.update('User', {
        password: hashedPassword,
        canPublish: 1,
        canComment: 1,
        canAdmin: 1
      }, 'email = ?', [testEmail]);
      
      console.log('✅ 用户权限已更新');
    } else {
      // 创建新用户
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const userId = await db.insert('User', {
        email: testEmail,
        username: testUsername,
        password: hashedPassword,
        canPublish: 1,
        canComment: 1,
        canAdmin: 1
      });
      
      console.log('✅ 测试管理员账号创建成功');
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 测试账号信息:');
    console.log('='.repeat(60));
    console.log(`邮箱: ${testEmail}`);
    console.log(`密码: ${testPassword}`);
    console.log(`用户名: ${testUsername}`);
    console.log(`权限: 可以发布、可以评论、可以访问后台管理`);
    console.log('='.repeat(60));
    console.log('\n💡 提示:');
    console.log('   - 可以使用密码登录');
    console.log('   - 也可以使用验证码登录');
    console.log('   - 验证码会在开发模式下显示在前端页面和服务器日志中');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ 创建测试账号失败:', error);
    process.exit(1);
  }
}

createTestAdmin();

