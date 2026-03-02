import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { authAPI, userAPI, favoriteAPI } from '../services/leancloud';

interface ProfileProps {
  user: { email: string; username?: string } | null;
  onLogout: () => void;
  onNavigateToPublications?: () => void;
  onNavigateToFavorites?: () => void;
}

// 生成首字母头像的函数（和评论一样）
const getInitialsAvatar = (username: string): string => {
  if (!username) return 'U';
  
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else {
    return username.substring(0, 2).toUpperCase();
  }
};

// 生成头像背景色的函数（基于用户名）
const getAvatarColor = (username: string): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

export function Profile({ user, onLogout, onNavigateToPublications, onNavigateToFavorites }: ProfileProps) {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState({
    totalLikes: 0,
    publishedCount: 0,
    followingCount: 0,
    followersCount: 0,
    favoritesCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{ username: string; email: string } | null>(null);

  // 加载用户数据的函数
  const loadUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 获取当前用户详细信息
      const currentUser = await authAPI.getCurrentUser();
      if (currentUser) {
        setUserInfo({
          username: currentUser.username || currentUser.email.split('@')[0],
          email: currentUser.email
        });
      }

      // 获取用户统计数据
      const userStats = await userAPI.getUserStats();
      if (userStats) {
        // 根据当前语言模式计算收藏数量
        let filteredFavoritesCount = 0;
        try {
          const favoriteVideos = await favoriteAPI.getUserFavorites(1, 100);
          console.log(`📊 当前语言: ${language}, 收藏视频总数: ${favoriteVideos.length}`);
          
          // 根据语言过滤收藏视频
          const filteredVideos = favoriteVideos.filter(video => {
            if (language === 'zh') {
              const hasVideoUrl = video.videoUrl && video.videoUrl.trim() !== '';
              const hasTitle = video.title && video.title.trim() !== '';
              return hasVideoUrl && hasTitle;
            } else {
              const hasVideoUrlEn = video.videoUrlEn && video.videoUrlEn.trim() !== '';
              if (!hasVideoUrlEn) {
                console.log(`⚠️ 视频 ${video.id} 没有 videoUrlEn:`, {
                  id: video.id,
                  title: video.title,
                  titleEn: video.titleEn,
                  videoUrl: video.videoUrl,
                  videoUrlEn: video.videoUrlEn
                });
              }
              return hasVideoUrlEn;
            }
          });
          
          filteredFavoritesCount = filteredVideos.length;
          console.log(`✅ 过滤后的收藏数量: ${filteredFavoritesCount} (语言: ${language})`);
        } catch (error) {
          console.error('获取收藏列表失败:', error);
          // 如果获取失败，使用后端返回的总数
          filteredFavoritesCount = userStats.favoritesCount;
        }
        
        setStats({
          ...userStats,
          favoritesCount: filteredFavoritesCount
        });
      }
    } catch (error) {
      console.error('加载用户数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取用户信息和统计数据
  useEffect(() => {
    loadUserData();
  }, [user, language]); // 添加 language 依赖，切换语言时重新计算收藏数量

  // 监听收藏更新事件，刷新统计数据
  useEffect(() => {
    const handleFavoriteUpdate = () => {
      loadUserData();
    };

    window.addEventListener('favoriteUpdated', handleFavoriteUpdate);
    return () => {
      window.removeEventListener('favoriteUpdated', handleFavoriteUpdate);
    };
  }, [user, language]); // 添加 language 依赖，确保语言切换时也更新

  const displayUsername = userInfo?.username || user?.email?.split('@')[0] || (language === 'zh' ? '用户' : 'User');
  const displayEmail = userInfo?.email || user?.email || '';
  const initials = getInitialsAvatar(displayUsername);
  const avatarColor = getAvatarColor(displayUsername);

  const statsData = [
    { label: language === 'zh' ? '获赞' : 'Likes', value: formatNumber(stats.totalLikes) },
    { label: language === 'zh' ? '关注' : 'Following', value: formatNumber(stats.followingCount) },
    { label: language === 'zh' ? '粉丝' : 'Followers', value: formatNumber(stats.followersCount) },
  ];

  const menuItems = [
    { icon: '💾', label: language === 'zh' ? '收藏的视频' : 'Saved Videos', count: stats.favoritesCount, action: onNavigateToFavorites },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-900 pb-20">
      {/* 用户信息卡片 */}
      <div className="bg-gradient-to-br from-orange-600 to-orange-500 p-6 pb-8">
        <div className="flex items-center gap-4 mb-6">
          {/* 首字母头像（和评论一样） */}
          <div className={`w-20 h-20 ${avatarColor} rounded-full flex items-center justify-center text-white text-2xl font-bold backdrop-blur-sm border-2 border-white/30`}>
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-xl mb-1">
              {displayUsername}
            </h2>
            <p className="text-white/80 text-sm">{displayEmail}</p>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="flex justify-around bg-white/10 backdrop-blur-sm rounded-xl p-4">
          {loading ? (
            <div className="text-white text-sm">{language === 'zh' ? '加载中...' : 'Loading...'}</div>
          ) : (
            statsData.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-white font-bold text-xl mb-1">{stat.value}</div>
                <div className="text-white/70 text-sm">{stat.label}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 功能菜单 */}
      <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-white font-medium">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.count !== null && (
                <span className="text-zinc-400 text-sm">{item.count}</span>
              )}
              <svg
                className="w-5 h-5 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* 退出登录按钮 */}
      <div className="p-4">
        <button
          onClick={onLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-4 rounded-xl transition-colors"
        >
          {t.logout}
        </button>
      </div>
    </div>
  );
}