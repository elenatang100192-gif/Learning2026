-- 数据库表结构
-- 注意：请根据实际需求调整字段类型和约束

-- 分类表
CREATE TABLE IF NOT EXISTS `Category` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL COMMENT '英文名称',
  `nameCn` VARCHAR(255) NOT NULL COMMENT '中文名称',
  `sortOrder` INT DEFAULT 0 COMMENT '排序',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 书籍表
CREATE TABLE IF NOT EXISTS `Book` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL COMMENT '书名',
  `author` VARCHAR(255) NOT NULL COMMENT '作者',
  `isbn` VARCHAR(100) COMMENT 'ISBN',
  `categoryId` INT COMMENT '分类ID',
  `coverUrl` TEXT COMMENT '封面URL',
  `blogCoverUrl` TEXT COMMENT '博客封面URL',
  `fileUrl` TEXT COMMENT '文件URL',
  `uploadDate` VARCHAR(50) COMMENT '上传日期',
  `status` ENUM('待处理', '提取中', '已完成') DEFAULT '待处理' COMMENT '状态',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `categoryId` (`categoryId`),
  KEY `status` (`status`),
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 提取内容表
CREATE TABLE IF NOT EXISTS `ExtractedContent` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bookId` INT NOT NULL COMMENT '书籍ID',
  `segmentIndex` INT DEFAULT 0 COMMENT '段落索引',
  `chapterTitle` TEXT COMMENT '章节标题',
  `chapterTitleEn` TEXT COMMENT '章节标题（英文）',
  `summary` TEXT COMMENT '摘要',
  `summaryEn` TEXT COMMENT '摘要（英文）',
  `keyPoints` JSON COMMENT '关键点',
  `avatarDescription` TEXT COMMENT '数字人形象描述',
  `estimatedDuration` INT DEFAULT 0 COMMENT '预计时长（秒）',
  `videoStatus` ENUM('pending', 'generating', 'completed', 'failed') DEFAULT 'pending' COMMENT '视频状态',
  `videoUrl` TEXT COMMENT '视频URL',
  `videoUrlEn` TEXT COMMENT '视频URL（英文）',
  `audioUrl` TEXT COMMENT '音频URL',
  `audioUrlEn` TEXT COMMENT '音频URL（英文）',
  `silentVideoUrl` TEXT COMMENT '无声视频URL',
  `avatarImageUrl` TEXT COMMENT '数字人形象图片URL',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `bookId` (`bookId`),
  KEY `segmentIndex` (`segmentIndex`),
  KEY `videoStatus` (`videoStatus`),
  FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 视频表
CREATE TABLE IF NOT EXISTS `Video` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL COMMENT '标题',
  `titleEn` VARCHAR(500) COMMENT '标题（英文）',
  `categoryId` INT COMMENT '分类ID',
  `bookId` INT COMMENT '书籍ID',
  `extractedContentId` INT COMMENT '提取内容ID',
  `videoUrl` TEXT NOT NULL COMMENT '视频URL',
  `videoUrlEn` TEXT COMMENT '视频URL（英文）',
  `coverUrl` TEXT COMMENT '封面URL',
  `duration` INT DEFAULT 0 COMMENT '时长（秒）',
  `fileSize` BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  `status` ENUM('待审核', '已发布', '已驳回', '已禁用') DEFAULT '待审核' COMMENT '状态',
  `disabled` TINYINT(1) DEFAULT 0 COMMENT '是否禁用',
  `viewCount` INT DEFAULT 0 COMMENT '观看次数',
  `likeCount` INT DEFAULT 0 COMMENT '点赞次数',
  `uploadDate` VARCHAR(50) COMMENT '上传日期',
  `publishDate` VARCHAR(50) COMMENT '发布日期',
  `aiExtractDate` VARCHAR(50) COMMENT 'AI提取日期',
  `authorId` INT COMMENT '作者ID',
  `reviewNotes` TEXT COMMENT '审核备注',
  `displayOrder` INT DEFAULT 0 COMMENT '显示顺序',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `categoryId` (`categoryId`),
  KEY `bookId` (`bookId`),
  KEY `status` (`status`),
  KEY `displayOrder` (`displayOrder`),
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`extractedContentId`) REFERENCES `ExtractedContent`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户表（如果需要）
CREATE TABLE IF NOT EXISTS `User` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) COMMENT '用户名',
  `email` VARCHAR(255) UNIQUE COMMENT '邮箱',
  `password` VARCHAR(255) COMMENT '密码（加密）',
  `canPublish` TINYINT(1) DEFAULT 0 COMMENT '可以发布',
  `canComment` TINYINT(1) DEFAULT 1 COMMENT '可以评论',
  `canAdmin` TINYINT(1) DEFAULT 0 COMMENT '可以登录后台管理',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文件表（用于存储文件信息）
CREATE TABLE IF NOT EXISTS `File` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(500) NOT NULL COMMENT '文件名',
  `url` TEXT NOT NULL COMMENT '文件URL',
  `size` BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  `mimeType` VARCHAR(100) COMMENT 'MIME类型',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

