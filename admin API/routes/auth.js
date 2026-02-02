const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../utils/db');
const { sendOTPEmail, testEmailService } = require('../utils/email');
const bcrypt = require('bcrypt');

const router = express.Router();

// 测试邮件服务
router.post('/test-email', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    console.log(`📧 测试邮件发送到: ${email}`);

    try {
      await testEmailService(email);
      console.log(`✅ 测试邮件发送成功: ${email}`);

      res.json({
        success: true,
        message: 'Test email sent successfully. Please check your inbox and spam folder.'
      });
    } catch (emailError) {
      console.error(`❌ 邮件服务错误详情:`, {
        email,
        error: emailError.message,
        stack: emailError.stack
      });

      res.status(500).json({
        success: false,
        message: `邮件服务错误: ${emailError.message}`,
        details: '请检查邮件服务配置（EMAIL_USER 和 EMAIL_PASS）'
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email service'
    });
  }
});

// 存储OTP验证码的内存缓存（生产环境应该使用Redis）
const otpCache = new Map();

// 生成6位随机数字验证码
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 开发模式：获取所有待验证的OTP（用于调试）
router.get('/debug/otps', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: '此接口仅在开发模式下可用'
    });
  }
  
  const otps = Array.from(otpCache.entries()).map(([email, data]) => ({
    email,
    otp: data.otp,
    expiresAt: new Date(data.expiresAt).toISOString(),
    expiresIn: Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000))
  }));
  
  res.json({
    success: true,
    count: otps.length,
    otps: otps
  });
});

// 发送OTP验证码
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 收到发送OTP请求: ${email}`);
    console.log(`🌍 环境: NODE_ENV=${process.env.NODE_ENV || '未设置'}`);

    // 检查用户是否存在（只允许后台管理创建的用户）
    const existingUser = await db.findOne('SELECT * FROM User WHERE email = ?', [email]);
    
    console.log(`👤 用户查询结果:`, existingUser ? `找到用户 (ID: ${existingUser.id})` : '用户不存在');

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: '用户不存在，请联系管理员注册账号'
      });
    }

    // 生成6位随机OTP验证码
    const otp = generateOTP();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10分钟后过期

    // 存储OTP到缓存
    otpCache.set(email, { otp, expiresAt });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 发送OTP验证码到邮箱: ${email}`);
    console.log(`🔢 生成的OTP: ${otp} (有效期10分钟)`);
    console.log(`📋 过期时间: ${new Date(expiresAt).toISOString()}`);
    console.log(`📋 当前缓存大小: ${otpCache.size}`);
    console.log(`🌍 环境: NODE_ENV=${process.env.NODE_ENV || '未设置'}`);

    // 开发模式：显示OTP并返回给前端
    if (process.env.NODE_ENV !== 'production') {
      // 使用 stderr 输出，确保即使日志被重定向也能看到
      console.error(`\n${'='.repeat(60)}`);
      console.error(`🔍 【开发模式】OTP验证码是: ${otp}`);
      console.error(`📧 用于邮箱: ${email}`);
      console.error(`💡 提示：开发模式下OTP会返回给前端显示，可用于测试登录`);
      console.error(`${'='.repeat(60)}\n`);
      
      // 同时输出到 stdout（用于终端显示）
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 【开发模式】OTP验证码是: ${otp}`);
      console.log(`📧 用于邮箱: ${email}`);
      console.log(`💡 提示：开发模式下OTP会返回给前端显示，可用于测试登录`);
      console.log(`${'='.repeat(60)}\n`);

      return res.json({
        success: true,
        message: 'OTP generated successfully (development mode)',
        note: `开发模式：您的OTP验证码是 ${otp}。请使用此验证码登录。`,
        otp: otp, // 在开发模式下直接返回OTP，方便前端显示
        development: true
      });
    }

    // 生产环境：发送包含OTP的邮件
    try {
      await sendOTPEmail(email, otp);
      
      console.log(`✅ OTP邮件发送成功: ${email}`);

      return res.json({
        success: true,
        message: 'OTP verification code has been sent to your email. Please check your inbox and spam folder.'
      });
    } catch (emailError) {
      console.error(`❌ 邮件服务错误:`, emailError);
      console.error(`📋 错误详情:`, {
        message: emailError.message,
        stack: emailError.stack,
        envCheck: {
          EMAIL_USER: process.env.EMAIL_USER ? '已设置' : '未设置',
          EMAIL_PASS: process.env.EMAIL_PASS ? '已设置' : '未设置',
          EMAIL_HOST: process.env.EMAIL_HOST || '未设置',
          EMAIL_PORT: process.env.EMAIL_PORT || '未设置',
          EMAIL_SECURE: process.env.EMAIL_SECURE || '未设置',
          NODE_ENV: process.env.NODE_ENV || '未设置'
        }
      });

      // 清除缓存的OTP
      otpCache.delete(email);

      // 检查是否是配置问题
      if (emailError.message.includes('未配置') || emailError.message.includes('not configured')) {
        return res.status(500).json({
          success: false,
          message: '生产环境邮件服务未配置，请使用开发模式或联系管理员',
          details: emailError.message,
          hint: '请确保在 CloudBase Run 控制台中配置了 EMAIL_USER、EMAIL_PASS、EMAIL_HOST、EMAIL_PORT、EMAIL_SECURE 环境变量，并重启服务'
        });
      }

      return res.status(500).json({
        success: false,
        message: '邮件服务暂时不可用，请稍后再试',
        details: emailError.message,
        hint: '请检查邮件服务配置和网络连接，或查看服务器日志获取更多信息'
      });
    }

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// 邮箱登录（验证码登录）
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('otp').optional().isLength({ min: 6, max: 6 }).isNumeric(),
  body('password').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { email, otp, password, loginType } = req.body; // loginType: 'otp' | 'password'

    console.log(`🔐 登录请求: email=${email}, loginType=${loginType || 'otp'}`);

    // 查找用户
    const user = await db.findOne('SELECT * FROM User WHERE email = ?', [email]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在，请联系管理员注册账号'
      });
    }

    // 根据登录类型验证
    if (loginType === 'password' && password) {
      // 密码登录
      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: '该账号未设置密码，请使用验证码登录'
        });
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: '密码错误'
        });
      }
    } else {
      // 验证码登录
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: '请提供验证码或密码'
        });
      }

      // 验证OTP
      const cachedOTP = otpCache.get(email);

      if (!cachedOTP) {
        return res.status(401).json({
          success: false,
          message: 'OTP not found or expired. Please request a new one.'
        });
      }

      // 检查OTP是否过期
      const now = Date.now();
      if (now > cachedOTP.expiresAt) {
        otpCache.delete(email);
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }

      // 验证OTP是否正确
      if (cachedOTP.otp !== otp) {
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP code. Please check your code and try again.'
        });
      }

      // OTP验证成功，清除缓存
      otpCache.delete(email);
    }

    // 生成session token (包含用户ID以便后续验证)
    const sessionToken = `otp-token-${Date.now()}-${Math.random()}-${user.id}`;

    // 获取用户详细信息
    const userData = {
      id: user.id,
      username: user.username || user.email,
      email: user.email,
      avatar: null,
      joinDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : null,
      totalVideos: 0,
      totalViews: 0,
      canPublish: user.canPublish !== 0,
      canComment: user.canComment !== 0,
      canAdmin: user.canAdmin !== 0
    };

    res.json({
      success: true,
      message: 'Login successful',
      user: userData,
      sessionToken: sessionToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// 后台管理登录（需要canAdmin权限）
router.post('/admin/login', [
  body('email').isEmail().normalizeEmail(),
  body('otp').optional().isLength({ min: 6, max: 6 }).isNumeric(),
  body('password').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { email, otp, password, loginType } = req.body;

    console.log(`🔐 后台管理登录请求: email=${email}, loginType=${loginType || 'otp'}`);

    // 查找用户
    const user = await db.findOne('SELECT * FROM User WHERE email = ?', [email]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查后台管理权限
    if (user.canAdmin === 0) {
      return res.status(403).json({
        success: false,
        message: '您没有后台管理权限，请联系管理员'
      });
    }

    // 根据登录类型验证
    if (loginType === 'password' && password) {
      // 密码登录
      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: '该账号未设置密码，请使用验证码登录'
        });
      }

      // 验证密码
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: '密码错误'
        });
      }
    } else {
      // 验证码登录
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: '请提供验证码或密码'
        });
      }

      // 验证OTP
      const cachedOTP = otpCache.get(email);

      if (!cachedOTP) {
        return res.status(401).json({
          success: false,
          message: 'OTP not found or expired. Please request a new one.'
        });
      }

      // 检查OTP是否过期
      const now = Date.now();
      if (now > cachedOTP.expiresAt) {
        otpCache.delete(email);
        return res.status(401).json({
          success: false,
          message: 'OTP has expired. Please request a new one.'
        });
      }

      // 验证OTP是否正确
      if (cachedOTP.otp !== otp) {
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP code. Please check your code and try again.'
        });
      }

      // OTP验证成功，清除缓存
      otpCache.delete(email);
    }

    // 生成session token
    const sessionToken = `admin-token-${Date.now()}-${Math.random()}-${user.id}`;

    // 获取用户详细信息
    const userData = {
      id: user.id,
      username: user.username || user.email,
      email: user.email,
      avatar: null,
      joinDate: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : null,
      canPublish: user.canPublish !== 0,
      canComment: user.canComment !== 0,
      canAdmin: user.canAdmin !== 0
    };

    res.json({
      success: true,
      message: 'Admin login successful',
      user: userData,
      sessionToken: sessionToken
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// 用户认证中间件
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const sessionToken = authHeader.substring(7);

    // 支持两种token格式：otp-token- 和 admin-token-
    if (!sessionToken.startsWith('otp-token-') && !sessionToken.startsWith('admin-token-')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token'
      });
    }

    const tokenParts = sessionToken.split('-');
    if (tokenParts.length >= 5) {
      const userId = tokenParts.slice(4).join('-');

      try {
        const user = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error('User lookup error:', error);
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed - user not found'
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// 后台管理认证中间件（需要canAdmin权限）
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const sessionToken = authHeader.substring(7);

    // 后台管理必须使用admin-token-
    if (!sessionToken.startsWith('admin-token-')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token'
      });
    }

    const tokenParts = sessionToken.split('-');
    if (tokenParts.length >= 5) {
      const userId = tokenParts.slice(4).join('-');

      try {
        const user = await db.findOne('SELECT * FROM User WHERE id = ?', [userId]);
        if (user) {
          // 检查后台管理权限
          if (user.canAdmin === 0) {
            return res.status(403).json({
              success: false,
              message: '您没有后台管理权限'
            });
          }
          req.user = user;
          return next();
        }
      } catch (error) {
        console.error('User lookup error:', error);
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed - user not found'
    });

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// 获取当前用户信息
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const currentUser = req.user;

    const userData = {
      id: currentUser.id,
      username: currentUser.username || currentUser.email,
      email: currentUser.email,
      avatar: null,
      joinDate: currentUser.createdAt ? new Date(currentUser.createdAt).toISOString().split('T')[0] : null,
      totalVideos: 0,
      totalViews: 0,
      canPublish: currentUser.canPublish !== 0,
      canComment: currentUser.canComment !== 0,
      canAdmin: currentUser.canAdmin !== 0
    };

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
});

// 获取当前后台管理员信息
router.get('/admin/me', authenticateAdmin, async (req, res) => {
  try {
    const currentUser = req.user;

    const userData = {
      id: currentUser.id,
      username: currentUser.username || currentUser.email,
      email: currentUser.email,
      avatar: null,
      joinDate: currentUser.createdAt ? new Date(currentUser.createdAt).toISOString().split('T')[0] : null,
      canPublish: currentUser.canPublish !== 0,
      canComment: currentUser.canComment !== 0,
      canAdmin: currentUser.canAdmin !== 0
    };

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin info'
    });
  }
});

// 登出
router.post('/logout', async (req, res) => {
  try {
    // MySQL不需要特殊的登出操作，前端删除token即可
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

module.exports = {
  router,
  authenticateUser,
  authenticateAdmin
};
