import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { favoriteAPI, followAPI, type Video as LeanCloudVideo } from '../services/leancloud';
import { VideoCard } from './VideoCard';
import { VideoInteractions } from './VideoInteractions';
import { NotificationBell } from './NotificationBell';

interface MyFavoritesProps {
  user: { email: string } | null;
  onBack: () => void;
}

// 前端使用的Video类型
interface FrontendVideo {
  id: string;
  title: string;
  titleEn: string;
  author: string;
  authorId?: string;
  avatar: string;
  thumbnail: string;
  videoUrl: string;
  videoUrlEn?: string | null;
  category: 'Tech' | 'Culture' | 'Business';
  likes: number;
  views: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  favoriteCreatedAt?: string; // 收藏时间
}

export function MyFavorites({ user, onBack }: MyFavoritesProps) {
  const { t, language } = useLanguage();
  const [videos, setVideos] = useState<FrontendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null); // 当前播放的视频ID
  const [currentProgress, setCurrentProgress] = useState(0); // 当前视频的进度
  const [videoDuration, setVideoDuration] = useState(0); // 当前视频的总时长
  const containerRef = useRef<HTMLDivElement>(null);

  // 将LeanCloud数据转换为前端格式
  const convertToFrontendVideo = async (leanCloudVideo: LeanCloudVideo & { favoriteCreatedAt?: string }): Promise<FrontendVideo & { favoriteCreatedAt?: string }> => {
    // 转换分类
    const categoryMap: { [key: string]: 'Tech' | 'Culture' | 'Business' } = {
      '科技': 'Tech',
      '文化': 'Culture',  // 修复：数据库中使用的是"文化"
      '艺术人文': 'Culture',  // 保留兼容性
      '商业': 'Business',  // 修复：数据库中使用的是"商业"
      '商业业务': 'Business'  // 保留兼容性
    };

    // 检查关注状态（如果有作者）
    let isFollowing = false;
    if (leanCloudVideo.author?.id) {
      try {
        isFollowing = await followAPI.isFollowing(leanCloudVideo.author.id);
      } catch (error) {
        console.error('检查关注状态失败:', error);
      }
    }

    // 根据语言选择作者名称
    let authorName = '未知作者';
    if (leanCloudVideo.author) {
      if (language === 'zh' && leanCloudVideo.author.usernameCn) {
        authorName = leanCloudVideo.author.usernameCn;
      } else {
        authorName = leanCloudVideo.author.username || '未知作者';
      }
    } else {
      // 后台发布的视频，没有author
      authorName = language === 'zh' ? '爱室丽人力中心' : 'Ashley HR Center';
    }

    // 默认头像：Ashley HR Center avatar
    // 使用绝对路径确保在移动端正确加载
    const defaultAvatar = '/ashley-avatar.jpg';
    
    return {
      id: leanCloudVideo.id,
      title: leanCloudVideo.title,
      titleEn: leanCloudVideo.titleEn || '',
      author: authorName,
      authorId: leanCloudVideo.author?.id || '',
      avatar: leanCloudVideo.author?.avatar || defaultAvatar,
      thumbnail: leanCloudVideo.coverUrl,
      videoUrl: leanCloudVideo.videoUrl,
      videoUrlEn: leanCloudVideo.videoUrlEn || null,
      category: categoryMap[leanCloudVideo.category.nameCn] || 'Tech',
      likes: leanCloudVideo.likeCount,
      views: leanCloudVideo.viewCount || 0,
      comments: 0, // 收藏列表不需要评论数
      shares: 0,
      isLiked: false,
      isSaved: true, // 收藏列表中的视频都是已收藏的
      isFollowing,
      favoriteCreatedAt: leanCloudVideo.favoriteCreatedAt // 保留收藏时间
    };
  };

  // 加载收藏列表
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const favoriteVideos = await favoriteAPI.getUserFavorites(1, 100);

        const formattedVideos: FrontendVideo[] = await Promise.all(
          favoriteVideos.map(video => convertToFrontendVideo(video))
        );

        // 按收藏时间排序（新到旧），只显示当前收藏的视频，并根据语言过滤
        const sortedVideos = formattedVideos
          .filter(video => {
            // 只显示当前收藏的视频
            if (!video.isSaved) return false;
            
            // 根据语言过滤：中文模式只显示有 videoUrl 的视频，英文模式只显示有 videoUrlEn 的视频
            if (language === 'zh') {
              return video.videoUrl && video.videoUrl.trim() !== '' && video.title && video.title.trim() !== '';
            } else {
              return video.videoUrlEn && video.videoUrlEn.trim() !== '';
            }
          })
          .sort((a, b) => {
            // 获取收藏时间，如果视频有 favoriteCreatedAt 字段则使用它
            const aTime = a.favoriteCreatedAt ? new Date(a.favoriteCreatedAt).getTime() : 0;
            const bTime = b.favoriteCreatedAt ? new Date(b.favoriteCreatedAt).getTime() : 0;
            return bTime - aTime; // 新到旧
          });

        setVideos(sortedVideos);
      } catch (error) {
        console.error('加载收藏列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user, language]); // 添加 language 依赖，切换语言时重新加载并过滤视频

  // 格式化收藏时间
  const formatFavoriteTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) {
      return language === 'zh' ? `${days}天前` : `${days} days ago`;
    } else if (hours > 0) {
      return language === 'zh' ? `${hours}小时前` : `${hours} hours ago`;
    } else if (minutes > 0) {
      return language === 'zh' ? `${minutes}分钟前` : `${minutes} minutes ago`;
    } else {
      return language === 'zh' ? '刚刚' : 'Just now';
    }
  };

  // 格式化数字
  const formatCount = (count: number): string => {
    const num = Math.max(0, Number(count) || 0);
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // 处理视频点击 - 在当前页面播放
  const handleVideoClick = (video: FrontendVideo) => {
    setPlayingVideoId(video.id);
    setCurrentProgress(0);
    setVideoDuration(0);
  };

  // 处理返回列表
  const handleBackToList = () => {
    setPlayingVideoId(null);
    setCurrentProgress(0);
    setVideoDuration(0);
  };

  // 获取当前播放的视频
  const playingVideo = playingVideoId ? videos.find(v => v.id === playingVideoId) : null;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-zinc-900 pb-20">
        <div className="flex items-center justify-center h-full">
          <p className="text-white text-lg">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // 如果正在播放视频，显示播放界面
  if (playingVideo) {
    return (
      <div className="flex-1 overflow-hidden bg-black relative">
        {/* 返回按钮 - 固定在左上角 */}
        <button
          onClick={handleBackToList}
          className="fixed top-4 left-4 z-30 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-black/70 transition-colors"
          aria-label={language === 'zh' ? '返回列表' : 'Back to list'}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 视频播放区域 */}
        <div className="h-screen w-full relative bg-black">
          <VideoCard
            video={playingVideo}
            isActive={true}
            showFollowButton={true}
            onProgressUpdate={setCurrentProgress}
            onDurationUpdate={setVideoDuration}
            hasUserInteracted={true}
          />
        </div>

        {/* 右侧交互按钮 */}
        <div className="fixed right-4 bottom-52 z-20 max-w-[480px]" style={{ right: 'calc((100vw - min(100vw, 480px)) / 2 + 16px)' }}>
          <VideoInteractions 
            video={playingVideo} 
            onVideoUpdate={(videoId, updates) => {
              // 更新视频数据
              setVideos(prevVideos => 
                prevVideos.map(v => 
                  v.id === videoId ? { ...v, ...updates } : v
                )
              );
            }}
          />
        </div>

        {/* 进度条 */}
        <div 
          className="fixed left-0 right-0 z-10 px-4 max-w-[480px] mx-auto"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            pointerEvents: 'auto',
          }}
        >
          <div className="h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-200"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
        </div>

        {/* 作者信息和视频标题 */}
        <div 
          className="fixed left-0 right-0 z-10 px-4 pointer-events-none max-w-[480px] mx-auto"
          style={{
            top: '64px',
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            paddingBottom: '0px',
          }}
        >
          <div className="bg-black/30 pt-4 pb-2 -mx-4 px-4 rounded-t-lg" style={{ maxHeight: '350px' }}>
            <div className="text-white pointer-events-auto">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={playingVideo.avatar}
                  alt={playingVideo.author}
                  className="w-10 h-10 rounded-full border-2 border-white object-cover flex-shrink-0 bg-white"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('ashley-avatar.jpg')) {
                      target.src = '/ashley-avatar.jpg';
                    }
                  }}
                />
                <div className="font-semibold text-sm truncate">{playingVideo.author}</div>
              </div>
              <p 
                className="text-sm leading-relaxed pr-20"
                style={{
                  wordBreak: 'break-word',
                  display: 'block',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {language === 'zh' ? playingVideo.title : playingVideo.titleEn}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 列表视图
  if (videos.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-zinc-900 pb-20">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-white hover:text-zinc-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-lg flex-1">{language === 'zh' ? '收藏的视频' : 'Saved Videos'}</h1>
        </div>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <p className="text-white text-lg">{language === 'zh' ? '暂无收藏的视频' : 'No saved videos yet'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden bg-zinc-900">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-white hover:text-zinc-300 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg flex-1">{language === 'zh' ? '收藏的视频' : 'Saved Videos'}</h1>
        <span className="text-zinc-400 text-sm">{videos.length}</span>
      </div>

      {/* 视频列表 */}
      <div className="flex-1 overflow-y-auto pb-20 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="divide-y divide-zinc-800">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => handleVideoClick(video)}
              className="flex items-center gap-3 p-4 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer active:bg-zinc-700"
            >
              {/* 播放图标 */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>

              {/* 视频信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
                  {language === 'zh' ? video.title : video.titleEn}
                </h3>
                <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                  <span>{video.author}</span>
                  <span>•</span>
                  <span>{formatFavoriteTime(video.favoriteCreatedAt)}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500 text-xs">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    {formatCount(video.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {formatCount(video.views)}
                  </span>
                </div>
              </div>

              {/* 右侧箭头 */}
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

