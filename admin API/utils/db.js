const mysql = require('mysql2/promise');

// 检查必需的环境变量
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ 缺少必需的环境变量: ${name}。请在 .env 文件中设置此变量。`);
  }
  return value;
}

// MySQL数据库配置（必须从环境变量读取）
const DB_CONFIG = {
  host: requireEnv('DB_HOSTNAME'),
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: requireEnv('DB_USERNAME'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 创建连接池
const pool = mysql.createPool(DB_CONFIG);

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL数据库连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL数据库连接失败:', error.message);
    return false;
  }
}

// 执行查询的辅助函数
async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('❌ 数据库查询失败:', error.message);
    console.error('SQL:', sql);
    console.error('参数:', params);
    throw error;
  }
}

// 执行事务
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 获取单个记录
async function findOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// 获取所有记录
async function findAll(sql, params = []) {
  return await query(sql, params);
}

// 插入记录并返回ID
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await query(sql, values);
  return result.insertId;
}

// 更新记录
async function update(table, data, where, whereParams = []) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  const params = [...values, ...whereParams];
  const result = await query(sql, params);
  return result.affectedRows;
}

// 删除记录
async function remove(table, where, whereParams = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  const result = await query(sql, whereParams);
  return result.affectedRows;
}

module.exports = {
  pool,
  query,
  transaction,
  findOne,
  findAll,
  insert,
  update,
  remove,
  testConnection
};

