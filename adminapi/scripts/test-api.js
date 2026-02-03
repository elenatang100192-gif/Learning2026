// API测试脚本
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

// 测试函数
async function test(name, fn) {
  try {
    console.log(`\n🧪 测试: ${name}`);
    const result = await fn();
    console.log(`✅ 通过: ${name}`);
    if (result) {
      console.log(`   结果:`, JSON.stringify(result).substring(0, 200));
    }
    return true;
  } catch (error) {
    console.error(`❌ 失败: ${name}`);
    console.error(`   错误:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始API测试...\n');
  
  let passed = 0;
  let failed = 0;

  // 测试1: 健康检查
  const healthTest = await test('健康检查', async () => {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  });
  healthTest ? passed++ : failed++;

  // 测试2: 获取分类列表
  const categoriesTest = await test('获取分类列表', async () => {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '请求失败');
    return { count: data.data.length };
  });
  categoriesTest ? passed++ : failed++;

  // 测试3: 获取视频列表
  const videosTest = await test('获取视频列表', async () => {
    const response = await fetch(`${API_BASE}/videos?page=1&limit=10`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '请求失败');
    return { count: data.data.length, page: data.pagination?.page };
  });
  videosTest ? passed++ : failed++;

  // 测试4: 数据库连接测试
  const dbTest = await test('数据库连接', async () => {
    const db = require('../utils/db');
    const tables = await db.query('SHOW TABLES');
    return { tableCount: tables.length };
  });
  dbTest ? passed++ : failed++;

  // 测试5: 测试分类表查询
  const categoryTableTest = await test('分类表查询', async () => {
    const db = require('../utils/db');
    const categories = await db.findAll('SELECT * FROM Category LIMIT 5');
    return { count: categories.length };
  });
  categoryTableTest ? passed++ : failed++;

  // 测试6: 测试视频表查询
  const videoTableTest = await test('视频表查询', async () => {
    const db = require('../utils/db');
    const videos = await db.findAll('SELECT COUNT(*) as count FROM Video');
    return videos[0];
  });
  videoTableTest ? passed++ : failed++;

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log(`📊 测试总结:`);
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

