import { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarTrigger } from './components/ui/sidebar';
import { Toaster } from './components/ui/sonner';
import { Dashboard } from './components/Dashboard';
import { BookManagement } from './components/BookManagement';
import { VideoManagement } from './components/VideoManagement';
import { UserManagement } from './components/UserManagement';
import { AdminLogin } from './components/AdminLogin';
import { LayoutDashboard, BookOpen, Video, Users, LogOut } from 'lucide-react';
import { Button } from './components/ui/button';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { useLanguage } from './contexts/LanguageContext';
import { apiRequest } from './services/leancloud';
import { toast } from 'sonner';

type Page = 'dashboard' | 'books' | 'videos' | 'users';

function App() {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminSessionToken');
      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await apiRequest('/auth/admin/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.success && response.user) {
          setCurrentUser(response.user);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('adminSessionToken');
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        localStorage.removeItem('adminSessionToken');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminSessionToken');
    setCurrentUser(null);
    setIsAuthenticated(false);
    toast.success('已退出登录');
  };

  const menuItems = [
    { id: 'dashboard' as const, labelKey: 'dashboard', icon: LayoutDashboard },
    { id: 'books' as const, labelKey: 'books', icon: BookOpen },
    { id: 'videos' as const, labelKey: 'videos', icon: Video },
    { id: 'users' as const, labelKey: 'users', icon: Users }
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'books':
        return <BookManagement />;
      case 'videos':
        return <VideoManagement />;
      case 'users':
        return <UserManagement />;
      default:
        return <Dashboard />;
    }
  };

  // 如果正在检查认证状态，显示加载中
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-500">检查登录状态...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，显示登录页面
  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-accent rounded-lg flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-sidebar-foreground">{t.videoApp}</h2>
                <p className="text-xs text-sidebar-foreground/60">{t.adminSystem}</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{t.mainFeatures}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => setCurrentPage(item.id)}
                          isActive={isActive}
                          className={isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{t[item.labelKey as keyof typeof t]}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar>
                <AvatarFallback className="bg-accent text-white">
                  {currentUser?.username?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground truncate">{currentUser?.username || currentUser?.email || 'Admin'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{currentUser?.email || 'admin@example.com'}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t.logout}
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto bg-background">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground">
                {menuItems.find(item => item.id === currentPage) ? t[menuItems.find(item => item.id === currentPage)!.labelKey as keyof typeof t] : t.dashboard}
              </h1>
            </div>
          </div>
          <div className="container max-w-7xl mx-auto p-6 lg:p-8">
            {renderPage()}
          </div>
        </main>

        <Toaster />
      </div>
    </SidebarProvider>
  );
}

export default App;
