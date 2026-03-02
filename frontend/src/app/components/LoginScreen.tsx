import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { authAPI } from '../services/leancloud';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Mail, Lock } from 'lucide-react';
import { translations } from '../types/language';

interface LoginScreenProps {
  onLogin: (email: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { setLanguage } = useLanguage();
  // 强制使用英文翻译，但保留语言选择功能（用于应用内其他部分）
  const displayT = translations.en; // 始终使用英文文案
  
  const [loginType, setLoginType] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'zh' | 'en'>('en');
  
  // 初始化时设置默认语言为英文
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage') as 'zh' | 'en' | null;
    if (!savedLanguage) {
      setLanguage('en');
      localStorage.setItem('preferredLanguage', 'en');
      setSelectedLanguage('en');
    } else {
      setSelectedLanguage(savedLanguage);
      setLanguage(savedLanguage);
    }
  }, [setLanguage]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendOTP = async () => {
    if (!validateEmail(email)) {
      setError(displayT.emailError);
      return;
    }

    try {
      setIsSendingOTP(true);
      console.log('🚀 Starting OTP request for:', email);
      console.log('🌐 API URL:', import.meta.env.VITE_API_BASE_URL || 'https://nexusmind-api-test.ashgso.com/api/');
      
      const result = await authAPI.sendOTP(email);
      console.log('🔍 OTP API Response:', result);
      
      if (result.success) {
        setOtpSent(true);
        setStep('otp');

        // Development mode: Show OTP code
        if (result.development && result.otp) {
          console.log('🔍 Development mode detected, showing OTP:', result.otp);
          toast.success(
            'Development Mode: OTP Code Generated',
            {
              description: `Your verification code is: ${result.otp}. Please use this code to login.`,
              duration: 20000,
            }
          );
        } else if (result.otp) {
          console.log('🔍 OTP received (non-dev mode):', result.otp);
          toast.success('OTP Code Generated', {
            description: `Your verification code is: ${result.otp}`,
            duration: 20000,
          });
        } else {
          console.log('⚠️ No OTP in response, showing generic message');
          toast.success(
            displayT.codeSent || 'Code sent to your email',
            {
              description: 'Please check your inbox, spam, and promotions folders.',
              duration: 10000,
            }
          );
        }
      } else {
        const errorMsg = result.message || displayT.sendCodeError || 'Failed to send code';
        setError(errorMsg);
        console.error('❌ Failed to send OTP:', result.message);
        // 显示详细错误信息
        toast.error('Failed to send code', {
          description: errorMsg,
          duration: 10000,
        });
      }
    } catch (error: any) {
      console.error('❌ Exception in sendOTP:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        status: error?.status,
        isNetworkError: error?.isNetworkError,
        stack: error?.stack,
      });
      
      // 检查是否是网络错误
      let errorMsg = '';
      if (error?.isNetworkError || error?.message?.includes('Network error') || error?.message?.includes('Unable to connect')) {
        errorMsg = 'Network error: Unable to connect to server. Please check your internet connection.';
      } else if (error?.message) {
        errorMsg = error.message;
      } else {
        errorMsg = displayT.sendCodeError || 'Failed to send code';
      }
      
      setError(errorMsg);
      // 显示详细错误信息
      toast.error('Request Failed', {
        description: errorMsg,
        duration: 15000,
      });
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!validateEmail(email)) {
      setError(displayT.emailError);
      setIsLoading(false);
      return;
    }

    if (loginType === 'otp') {
    if (otp.length !== 6) {
        setError(displayT.codeError);
      setIsLoading(false);
      return;
    }

    try {
      const user = await authAPI.loginWithEmail(email, otp);
      if (user) {
        setLanguage(selectedLanguage);
        localStorage.setItem('preferredLanguage', selectedLanguage);
          toast.success(displayT.loginSuccess || 'Login successful!', { duration: 500 });
        onLogin(user.email);
      } else {
          setError(displayT.loginError || 'Login failed, please check your code');
      }
    } catch (error) {
        console.error('Login failed:', error);
        setError(displayT.loginError || 'Login failed, please check your code');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!password) {
        setError(displayT.passwordError || 'Please enter your password');
        setIsLoading(false);
        return;
      }

      try {
        console.log('🚀 Starting password login for:', email);
        console.log('🔐 Password length:', password.length);
        console.log('🌐 API URL:', import.meta.env.VITE_API_BASE_URL || 'https://nexusmind-api-test.ashgso.com/api/');
        
        const user = await authAPI.loginWithPassword(email, password);
        console.log('🔍 Password login API response:', user);
        
        if (user) {
          console.log('✅ Password login successful');
          setLanguage(selectedLanguage);
          localStorage.setItem('preferredLanguage', selectedLanguage);
          toast.success(displayT.loginSuccess || 'Login successful!', { duration: 500 });
          onLogin(user.email);
        } else {
          console.error('❌ Password login failed: user is null');
          setError(displayT.loginError || 'Login failed, please check your password');
        }
      } catch (error: any) {
        console.error('❌ Password login exception:', error);
        console.error('❌ Error details:', {
          message: error?.message,
          status: error?.status,
          stack: error?.stack,
        });
        
        // 显示详细错误信息
        let errorMsg = '';
        if (error?.message) {
          errorMsg = error.message;
        } else if (error?.status === 401) {
          errorMsg = '密码错误，请检查您的密码';
        } else if (error?.status === 404) {
          errorMsg = '用户不存在，请联系管理员';
        } else {
          errorMsg = displayT.loginError || 'Login failed, please check your password';
        }
        
        setError(errorMsg);
        toast.error('Login Failed', {
          description: errorMsg,
          duration: 10000,
        });
    } finally {
      setIsLoading(false);
      }
    }
  };

  return (
    <div 
      className="w-full bg-gradient-to-br from-black via-zinc-900 to-zinc-800 flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* 科技感背景效果 */}
      <div className="absolute inset-0 opacity-20" style={{ top: '-env(safe-area-inset-top, 0px)', bottom: '-env(safe-area-inset-bottom, 0px)' }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:50px_50px]" style={{ top: '-env(safe-area-inset-top, 0px)', bottom: '-env(safe-area-inset-bottom, 0px)' }}></div>
      
      
      <div className="w-full max-w-md bg-gradient-to-br from-zinc-900/90 to-black/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/10 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 2.18l8 3.6v7.72c0 4.83-3.13 9.37-8 10.68-4.87-1.31-8-5.85-8-10.68v-7.72l8-3.6z"/>
              <path d="M10.5 14.5l-2.5-2.5-1.41 1.41L10.5 17.5l7-7-1.41-1.41z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent mb-2">{displayT.loginTitle}</h1>
          <p className="text-gray-400">{displayT.loginSubtitle}</p>
        </div>

        <Tabs value={loginType} onValueChange={(value) => {
          setLoginType(value as 'otp' | 'password');
          setStep('email');
          setOtp('');
          setPassword('');
          setOtpSent(false);
          setError('');
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-800/50">
            <TabsTrigger value="otp" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Mail className="h-4 w-4 mr-2" />
              {displayT.otpLogin}
            </TabsTrigger>
            <TabsTrigger value="password" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Lock className="h-4 w-4 mr-2" />
              {displayT.passwordLogin}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="otp">
        {step === 'email' ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSendOTP(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                    {displayT.companyEmail}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                    placeholder={displayT.emailPlaceholder}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent text-white placeholder-gray-500 transition-all"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm backdrop-blur-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
                  disabled={isSendingOTP}
              className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_100%] hover:bg-right disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                  {isSendingOTP ? (displayT.sending || 'Sending...') : displayT.sendCode}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
                  {displayT.codeExpiry}
            </p>
          </form>
        ) : (
              <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                    {displayT.verificationCode}
              </label>
              <p className="text-sm text-gray-400 mb-3">
                    {displayT.sentTo} {email}
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={displayT.enterCode}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent text-center text-2xl tracking-widest font-mono text-white placeholder-gray-600 transition-all"
                maxLength={6}
                required
              />
            </div>

                {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Language
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('zh')}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedLanguage === 'zh'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-zinc-800/50 border-zinc-700 text-gray-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-semibold">中文</div>
                  <div className="text-xs text-gray-400 mt-1">Chinese</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedLanguage === 'en'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                      : 'bg-zinc-800/50 border-zinc-700 text-gray-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-semibold">English</div>
                  <div className="text-xs text-gray-400 mt-1">英文</div>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm backdrop-blur-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
                  disabled={isLoading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_100%] hover:bg-right disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
                  {isLoading ? (displayT.loggingIn || 'Logging in...') : displayT.login}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setOtp('');
                    setOtpSent(false);
                setError('');
              }}
              className="w-full text-gray-400 py-2 text-sm hover:text-orange-400 transition-colors"
            >
                  {displayT.backToEmail}
            </button>
          </form>
        )}
          </TabsContent>

          <TabsContent value="password">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {displayT.companyEmail}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={displayT.emailPlaceholder}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent text-white placeholder-gray-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {displayT.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={displayT.passwordPlaceholder}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent text-white placeholder-gray-500 transition-all"
                  required
                />
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Language
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('zh')}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedLanguage === 'zh'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-gray-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-semibold">中文</div>
                    <div className="text-xs text-gray-400 mt-1">Chinese</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('en')}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedLanguage === 'en'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-gray-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-semibold">English</div>
                    <div className="text-xs text-gray-400 mt-1">英文</div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm backdrop-blur-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_100%] hover:bg-right disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (displayT.loggingIn || 'Logging in...') : displayT.login}
              </button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}