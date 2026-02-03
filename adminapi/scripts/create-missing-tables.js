// 创建缺失的表
const db = require('../utils/db');

const tables = [
  {
    name: 'User',
    sql: `CREATE TABLE IF NOT EXISTS User (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      email VARCHAR(255),
      password VARCHAR(255),
      canPublish TINYINT(1) DEFAULT 0,
      canComment TINYINT(1) DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY email (email),
      KEY email_idx (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'Comment',
    sql: `CREATE TABLE IF NOT EXISTS Comment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      videoId INT,
      userId INT,
      content TEXT NOT NULL,
      parentId INT COMMENT '父评论ID（用于回复）',
      likeCount INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY videoId (videoId),
      KEY userId (userId),
      KEY parentId (parentId),
      FOREIGN KEY (videoId) REFERENCES Video(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'Like',
    sql: `CREATE TABLE IF NOT EXISTS \`Like\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      videoId INT,
      userId INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY video_user (videoId, userId),
      KEY videoId (videoId),
      KEY userId (userId),
      FOREIGN KEY (videoId) REFERENCES Video(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'Favorite',
    sql: `CREATE TABLE IF NOT EXISTS Favorite (
      id INT AUTO_INCREMENT PRIMARY KEY,
      videoId INT,
      userId INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY video_user (videoId, userId),
      KEY videoId (videoId),
      KEY userId (userId),
      FOREIGN KEY (videoId) REFERENCES Video(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'Follow',
    sql: `CREATE TABLE IF NOT EXISTS Follow (
      id INT AUTO_INCREMENT PRIMARY KEY,
      followerId INT COMMENT '关注者ID',
      followingId INT COMMENT '被关注者ID',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY follower_following (followerId, followingId),
      KEY followerId (followerId),
      KEY followingId (followingId),
      FOREIGN KEY (followerId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (followingId) REFERENCES User(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'WatchHistory',
    sql: `CREATE TABLE IF NOT EXISTS WatchHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      videoId INT,
      watchedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      progress INT DEFAULT 0 COMMENT '观看进度（秒）',
      KEY userId (userId),
      KEY videoId (videoId),
      KEY watchedAt (watchedAt),
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (videoId) REFERENCES Video(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
];

async function createTables() {
  try {
    console.log('📊 开始创建缺失的表...\n');
    
    // 先检查现有表
    const existingTables = await db.query('SHOW TABLES');
    const existingTableNames = existingTables.map(t => Object.values(t)[0]);
    console.log('现有表:', existingTableNames.join(', '));
    console.log('');
    
    for (const table of tables) {
      try {
        if (existingTableNames.includes(table.name)) {
          console.log(`⚠️  ${table.name} 表已存在，跳过`);
          continue;
        }
        
        await db.query(table.sql);
        console.log(`✅ ${table.name} 表创建成功`);
      } catch (error) {
        if (error.message.includes('already exists') || error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  ${table.name} 表已存在，跳过`);
        } else {
          console.error(`❌ ${table.name} 表创建失败:`, error.message);
        }
      }
    }
    
    console.log('\n✅ 表创建完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

createTables();

