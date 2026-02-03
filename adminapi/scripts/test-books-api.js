// 测试书籍相关API
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

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
  console.log('🚀 开始测试书籍API...\n');
  
  let passed = 0;
  let failed = 0;

  // 测试1: 获取分类列表
  const categoriesTest = await test('获取分类列表', async () => {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '请求失败');
    return { count: data.data.length, first: data.data[0] };
  });
  categoriesTest ? passed++ : failed++;

  // 测试2: 获取书籍列表
  const booksListTest = await test('获取书籍列表', async () => {
    const response = await fetch(`${API_BASE}/books?page=1&limit=10`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '请求失败');
    return { count: data.data.length };
  });
  booksListTest ? passed++ : failed++;

  // 测试3: 获取书籍内容（如果书籍ID存在）
  const bookContentsTest = await test('获取书籍内容', async () => {
    const response = await fetch(`${API_BASE}/books/697ac435fd1e725509316a98/contents`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || '请求失败');
    return { count: data.data.length };
  });
  bookContentsTest ? passed++ : failed++;

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

