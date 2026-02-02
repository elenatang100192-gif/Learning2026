import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { apiRequest } from '../services/leancloud';
import { Shield, Mail, Lock, Loader } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (user: any) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [loginType, setLoginType] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = async () => {
    if (!validateEmail(email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    try {
      setIsSendingOTP(true);
      const response = await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      console.log('📧 发送验证码响应:', response);
      
      if (response.success) {
        setOtpSent(true);
        if (response.development && response.otp) {
          console.log('✅ 开发模式验证码:', response.otp);
          toast.success('验证码已生成（开发模式）', {
            description: `您的验证码是: ${response.otp}`,
            duration: 20000
          });
        } else if (response.otp) {
          // 即使没有development标志，如果有otp也显示
          console.log('✅ 验证码:', response.otp);
          toast.success('验证码已生成', {
            description: `您的验证码是: ${response.otp}`,
            duration: 20000
          });
        } else {
          toast.success('验证码已发送', {
            description: '请检查您的邮箱（包括垃圾邮件文件夹）'
          });
        }
      } else {
        console.error('❌ 发送验证码失败:', response.message);
        toast.error(response.message || '发送验证码失败');
      }
    } catch (error: any) {
      console.error('发送验证码失败:', error);
      toast.error(error.message || '发送验证码失败');
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }

    if (loginType === 'otp' && otp.length !== 6) {
      toast.error('请输入6位验证码');
      return;
    }

    if (loginType === 'password' && !password) {
      toast.error('请输入密码');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiRequest('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          loginType,
          ...(loginType === 'otp' ? { otp } : { password })
        })
      });

      if (response.success && response.user) {
        // 保存session token
        localStorage.setItem('adminSessionToken', response.sessionToken);
        toast.success('登录成功');
        onLogin(response.user);
      } else {
        toast.error(response.message || '登录失败');
      }
    } catch (error: any) {
      console.error('登录失败:', error);
      toast.error(error.message || '登录失败，请检查您的凭据');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">后台管理系统</h1>
          <p className="text-sm text-gray-500 mt-2">请使用管理员账号登录</p>
        </div>

        <Tabs value={loginType} onValueChange={(value) => {
          setLoginType(value as 'otp' | 'password');
          setOtpSent(false);
          setOtp('');
          setPassword('');
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="otp">
              <Mail className="h-4 w-4 mr-2" />
              验证码登录
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="h-4 w-4 mr-2" />
              密码登录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="otp">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-otp">邮箱地址</Label>
                <Input
                  id="email-otp"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setOtpSent(false);
                  }}
                  disabled={isLoading}
                  required
                />
              </div>

              {!otpSent ? (
                <Button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={isSendingOTP || !validateEmail(email)}
                  className="w-full"
                >
                  {isSendingOTP ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    '发送验证码'
                  )}
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp">验证码</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="请输入6位验证码"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={isLoading}
                      maxLength={6}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                      }}
                      className="flex-1"
                    >
                      重新发送
                    </Button>
                    <Button type="submit" disabled={isLoading || otp.length !== 6} className="flex-1">
                      {isLoading ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        '登录'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </TabsContent>

          <TabsContent value="password">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-password">邮箱地址</Label>
                <Input
                  id="email-password"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading || !email || !password} className="w-full">
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

