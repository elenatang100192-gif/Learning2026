const nodemailer = require('nodemailer');

// 创建邮件传输器
let transporter = null;

// 初始化邮件服务
function initEmailService() {
  // 如果已经初始化，直接返回
  if (transporter) {
    return transporter;
  }

  // 从环境变量读取邮件配置
  const emailConfig = {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
    }
  };

  // 检查是否配置了邮件服务
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️ 邮件服务未配置：EMAIL_USER 和 EMAIL_PASS 环境变量未设置');
    console.warn('📋 当前环境变量状态:');
    console.warn(`   EMAIL_USER: ${process.env.EMAIL_USER ? '已设置' : '未设置'}`);
    console.warn(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '已设置（已隐藏）' : '未设置'}`);
    console.warn(`   SMTP_USER: ${process.env.SMTP_USER ? '已设置' : '未设置'}`);
    console.warn(`   SMTP_PASS: ${process.env.SMTP_PASS ? '已设置（已隐藏）' : '未设置'}`);
    console.warn(`   EMAIL_HOST: ${process.env.EMAIL_HOST || process.env.SMTP_HOST || '未设置（将自动识别）'}`);
    console.warn(`   EMAIL_PORT: ${process.env.EMAIL_PORT || process.env.SMTP_PORT || '未设置（将使用默认值）'}`);
    console.warn(`   EMAIL_SECURE: ${process.env.EMAIL_SECURE || '未设置（将自动判断）'}`);
    return null;
  }

  // 如果没有配置 host，使用常见的邮件服务商默认配置
  if (!emailConfig.host) {
    // 根据邮箱域名自动选择 SMTP 服务器
    const emailDomain = emailConfig.auth.user.split('@')[1];
    if (emailDomain) {
      if (emailDomain.includes('gmail')) {
        emailConfig.host = 'smtp.gmail.com';
        emailConfig.port = 587;
        emailConfig.secure = false;
      } else if (emailDomain.includes('qq')) {
        emailConfig.host = 'smtp.qq.com';
        emailConfig.port = 587;
        emailConfig.secure = false;
      } else if (emailDomain.includes('163')) {
        emailConfig.host = 'smtp.163.com';
        emailConfig.port = 465;
        emailConfig.secure = true;
      } else if (emailDomain.includes('sina')) {
        emailConfig.host = 'smtp.sina.com';
        emailConfig.port = 587;
        emailConfig.secure = false;
      } else if (emailDomain.includes('outlook') || emailDomain.includes('hotmail')) {
        emailConfig.host = 'smtp-mail.outlook.com';
        emailConfig.port = 587;
        emailConfig.secure = false;
      } else {
        console.warn(`⚠️ 无法自动识别邮箱域名 ${emailDomain}，请手动配置 EMAIL_HOST`);
        return null;
      }
    } else {
      console.warn('⚠️ 无法从邮箱地址提取域名，请手动配置 EMAIL_HOST');
      return null;
    }
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    console.log(`✅ 邮件服务初始化成功: ${emailConfig.auth.user} (${emailConfig.host}:${emailConfig.port}, secure: ${emailConfig.secure})`);
    return transporter;
  } catch (error) {
    console.error('❌ 邮件服务初始化失败:', error);
    console.error('📋 配置详情:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      pass: emailConfig.auth.pass ? '***已设置***' : '未设置'
    });
    return null;
  }
}

// 发送 OTP 邮件
async function sendOTPEmail(email, otp) {
  try {
    // 初始化邮件服务
    const emailTransporter = initEmailService();
    
    if (!emailTransporter) {
      const errorDetails = [];
      if (!process.env.EMAIL_USER && !process.env.SMTP_USER) {
        errorDetails.push('EMAIL_USER 或 SMTP_USER 未设置');
      }
      if (!process.env.EMAIL_PASS && !process.env.SMTP_PASS && !process.env.EMAIL_PASSWORD) {
        errorDetails.push('EMAIL_PASS、SMTP_PASS 或 EMAIL_PASSWORD 未设置');
      }
      const errorMsg = errorDetails.length > 0 
        ? `邮件服务未配置：${errorDetails.join('，')}`
        : '邮件服务未配置：请检查环境变量设置';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 邮件内容
    const mailOptions = {
      from: `"NexusMind Ai" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Login Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ff6b35;">NexusMind Ai Short Video Platform</h2>
          <p>Hello,</p>
          <p>You are logging in to NexusMind Ai Short Video Platform. Please use the following verification code to complete your login:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="color: #ff6b35; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This verification code is valid for 5 minutes. Please do not share it with others.</p>
          <p style="color: #666; font-size: 14px;">If this was not your action, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
      `,
      text: `Your login verification code is: ${otp}. It is valid for 5 minutes.`
    };

    // 发送邮件
    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ OTP邮件发送成功: ${email} -> MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ OTP邮件发送失败: ${email}`, error);
    throw error;
  }
}

// 测试邮件服务
async function testEmailService(email) {
  try {
    const emailTransporter = initEmailService();
    
    if (!emailTransporter) {
      throw new Error('邮件服务未配置');
    }

    const mailOptions = {
      from: `"NexusMind Ai" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
      to: email,
      subject: '邮件服务测试',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #ff6b35;">NexusMind Ai Short Video Platform</h2>
          <p>这是一封测试邮件，如果您收到此邮件，说明邮件服务配置成功！</p>
          <p style="color: #666; font-size: 14px;">时间：${new Date().toLocaleString('zh-CN')}</p>
        </div>
      `,
      text: '这是一封测试邮件，如果您收到此邮件，说明邮件服务配置成功！'
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ 测试邮件发送成功: ${email} -> MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ 测试邮件发送失败: ${email}`, error);
    throw error;
  }
}

module.exports = {
  initEmailService,
  sendOTPEmail,
  testEmailService
};

