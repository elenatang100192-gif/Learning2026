import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoCard, ProgressBar } from './VideoCard';
import { VideoInteractions } from './VideoInteractions';
import { NotificationBell } from './NotificationBell';
import { videoAPI, categoryAPI, likeAPI, favoriteAPI, commentAPI, followAPI, type Video as LeanCloudVideo } from '../services/leancloud';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';

// 前端Video类型定义，与VideoCard和VideoInteractions兼容
interface FrontendVideo {
  id: string;
  title: string;
  titleEn: string;
  author: string;
  authorId?: string;
  avatar: string;
  thumbnail: string;
  videoUrl: string;
  videoUrlEn?: string | null; // 添加英文视频URL字段
  category: 'Tech' | 'Culture' | 'Business';
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  displayOrder?: number; // 前端手机端展示顺序，数字越小越靠前
}

interface VideoFeedProps {
  category: 'Tech' | 'Culture' | 'Business';
  showFollowButton?: boolean; // 是否显示关注按钮
  playVideoId?: string | null; // 要播放的视频ID
  onVideoPlayed?: () => void; // 视频播放后的回调
}

export function VideoFeed({ category, showFollowButton = false, playVideoId, onVideoPlayed }: VideoFeedProps) {
  const { language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<FrontendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0); // 当前视频的进度
  const [videoDuration, setVideoDuration] = useState(0); // 当前视频的总时长（秒）
  const [currentVideoTime, setCurrentVideoTime] = useState(0); // 当前视频的播放时间（秒）
  const [isFollowing, setIsFollowing] = useState(false); // 当前视频的关注状态
  const [hasUserInteracted, setHasUserInteracted] = useState(false); // 跟踪用户是否已交互
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({}); // 存储视频元素引用
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 用于延迟跳过，避免频繁触发

  // 当 currentIndex 变化时，更新关注状态和进度
  useEffect(() => {
    if (videos.length > 0 && currentIndex >= 0 && currentIndex < videos.length) {
      const currentVideo = videos[currentIndex];
      setIsFollowing(currentVideo.isFollowing);
      setCurrentProgress(0); // 切换视频时重置进度
      setVideoDuration(0); // 切换视频时重置时长，等待新视频加载
      setCurrentVideoTime(0); // 切换视频时重置播放时间
    }
  }, [currentIndex, videos]);

  // 监听 playVideoId 变化，跳转到指定视频
  useEffect(() => {
    if (playVideoId && videos.length > 0 && containerRef.current) {
      const targetIndex = videos.findIndex(v => v.id === playVideoId);
      if (targetIndex >= 0 && targetIndex !== currentIndex) {
        setCurrentIndex(targetIndex);
        // 滚动到目标视频
        const targetElement = containerRef.current.children[targetIndex] as HTMLElement;
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // 通知视频已播放
        if (onVideoPlayed) {
          setTimeout(() => onVideoPlayed(), 500);
        }
      }
    }
  }, [playVideoId, videos, currentIndex, onVideoPlayed]);

  // 将LeanCloud数据转换为前端格式
  const convertToFrontendVideo = async (leanCloudVideo: LeanCloudVideo): Promise<FrontendVideo> => {
    // 检查点赞状态
    const isLiked = await likeAPI.isLiked(leanCloudVideo.id);

    // 检查收藏状态
    const isFavorited = await favoriteAPI.isFavorited(leanCloudVideo.id);

    // 检查关注状态（如果有作者）
    let isFollowing = false;
    if (leanCloudVideo.author?.id) {
      isFollowing = await followAPI.isFollowing(leanCloudVideo.author.id);
    }

    // 转换分类
    const categoryMap: { [key: string]: 'Tech' | 'Culture' | 'Business' } = {
      '科技': 'Tech',
      '文化': 'Culture',  // 修复：数据库中使用的是"文化"
      '艺术人文': 'Culture',  // 保留兼容性
      '商业': 'Business',
      '商业业务': 'Business'  // 保留兼容性
    };

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
      videoUrl: leanCloudVideo.videoUrl, // 中文视频URL
      videoUrlEn: leanCloudVideo.videoUrlEn || null, // 英文视频URL
      category: categoryMap[leanCloudVideo.category.nameCn] || 'Tech',
      likes: Math.max(0, parseInt(String(leanCloudVideo.likeCount || 0), 10) || 0), // 确保 likeCount 是数字类型
      // 直接使用视频列表接口返回的 commentCount，避免重复API调用
      comments: Math.max(0, parseInt(String(leanCloudVideo.commentCount || 0), 10) || 0), // 确保 commentCount 是数字类型
      shares: 0,   // TODO: 添加分享功能
      isLiked,
      isSaved: isFavorited,
      isFollowing,
      displayOrder: leanCloudVideo.displayOrder
    };
  };

  // 获取视频数据（优化：避免切换分类时的黑屏）
  useEffect(() => {
    const loadVideos = async () => {
      // 不立即设置 loading，保持旧视频显示
      setLoading(true);
      try {
        // 根据分类获取视频
        const categoryMap = {
          Tech: '科技',
          Culture: '文化',  // 修复：数据库中使用的是"文化"而不是"艺术人文"
          Business: '商业'
        };

        const categoryName = categoryMap[category];
        
        const videoList = await videoAPI.getList({
          category: categoryName,
          status: '已发布',
          limit: 100
        });

        // 将LeanCloud数据转换为前端格式
        const formattedVideos: FrontendVideo[] = await Promise.all(
          videoList.map(video => convertToFrontendVideo(video))
        );

        // 根据语言过滤视频：
        // - 英文模式：只显示有videoUrlEn的视频
        // - 中文模式：只显示有videoUrl的视频
        const filteredVideos = language === 'en' 
          ? formattedVideos.filter(video => video.videoUrlEn && video.videoUrlEn.trim() !== '')
          : formattedVideos.filter(video => {
              // 中文模式：必须有videoUrl
              return video.videoUrl && 
                     video.videoUrl.trim() !== '' && 
                     video.title && 
                     video.title.trim() !== '';
            });

        // 去重：根据视频ID去重，确保同一个视频只出现一次
        const seenIds = new Set<string>();
        const uniqueVideos: FrontendVideo[] = [];
        
        for (const video of filteredVideos) {
          if (!seenIds.has(video.id)) {
            seenIds.add(video.id);
            uniqueVideos.push(video);
          } else {
            console.warn(`⚠️ 发现重复视频ID: ${video.id}, 标题: ${video.title}`);
          }
        }

        // 按displayOrder排序（升序），displayOrder为undefined/null的排在后面，然后按createdAt排序（降序）
        uniqueVideos.sort((a, b) => {
          const orderA = a.displayOrder !== undefined && a.displayOrder !== null ? a.displayOrder : Number.MAX_SAFE_INTEGER;
          const orderB = b.displayOrder !== undefined && b.displayOrder !== null ? b.displayOrder : Number.MAX_SAFE_INTEGER;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // 如果displayOrder相同，按uploadDate降序排序（最新的在前）
          const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
          const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
          return dateB - dateA;
        });

        // 如果去重后数量减少，记录详细信息
        if (uniqueVideos.length < filteredVideos.length) {
          console.warn(`⚠️ 发现重复视频，已去重。原始数量: ${filteredVideos.length}, 去重后: ${uniqueVideos.length}`);
          const duplicateVideos = filteredVideos.filter((v, i, self) => 
            self.findIndex((item) => item.id === v.id) !== i
          );
          console.warn('重复的视频详情:', duplicateVideos.map(v => ({ 
            id: v.id, 
            title: v.title, 
            titleEn: v.titleEn,
            videoUrl: v.videoUrl,
            videoUrlEn: v.videoUrlEn
          })));
        }
        
        // 额外检查：根据标题和视频URL去重（防止不同ID但内容相同的视频）
        // 特别处理"The Power Law and Venture Capital"这类英文标题
        const finalVideos: FrontendVideo[] = [];
        const seenKeys = new Set<string>();
        const seenTitles = new Set<string>();
        
        for (const video of uniqueVideos) {
          // 使用title作为唯一键（如果标题相同，可能是重复发布）
          const titleKey = video.title.trim().toLowerCase();
          
          // 如果标题已经出现过，检查是否是重复
          if (seenTitles.has(titleKey)) {
            console.warn(`⚠️ 发现相同标题的重复视频: "${video.title}" (ID: ${video.id})`);
            // 保留第一个出现的视频，跳过后续重复的
            continue;
          }
          
          seenTitles.add(titleKey);
          
          // 同时使用title + videoUrl作为唯一键（如果videoUrl相同，可能是重复发布）
          const urlKey = `${video.title}_${video.videoUrl || video.videoUrlEn || ''}`;
          if (!seenKeys.has(urlKey)) {
            seenKeys.add(urlKey);
            finalVideos.push(video);
          } else {
            console.warn(`⚠️ 发现相同标题和视频URL的重复视频: ${video.title} (ID: ${video.id})`);
          }
        }
        
        if (finalVideos.length < uniqueVideos.length) {
          console.warn(`⚠️ 根据标题和URL去重，从 ${uniqueVideos.length} 减少到 ${finalVideos.length}`);
          const removedVideos = uniqueVideos.filter(v => !finalVideos.includes(v));
          console.warn('被移除的重复视频:', removedVideos.map(v => ({ 
            id: v.id, 
            title: v.title,
            titleEn: v.titleEn
          })));
        }

        // 确保最终列表也按displayOrder排序（防止后续处理破坏排序）
        finalVideos.sort((a, b) => {
          const orderA = a.displayOrder !== undefined && a.displayOrder !== null ? a.displayOrder : Number.MAX_SAFE_INTEGER;
          const orderB = b.displayOrder !== undefined && b.displayOrder !== null ? b.displayOrder : Number.MAX_SAFE_INTEGER;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // 如果displayOrder相同，按uploadDate降序排序（最新的在前）
          const dateA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
          const dateB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
          return dateB - dateA;
        });
        
        // 先设置视频列表，保持旧视频显示直到新视频准备好
        setVideos(finalVideos);
        setLoading(false); // 立即设置 loading 为 false，让新视频显示
        
        // 延迟重置索引和滚动，确保新视频已渲染
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // 如果指定了要播放的视频ID，找到它并跳转
            if (playVideoId) {
              const targetIndex = finalVideos.findIndex(v => v.id === playVideoId);
              if (targetIndex >= 0) {
                setCurrentIndex(targetIndex);
                // 滚动到目标视频
                if (containerRef.current) {
                  const targetElement = containerRef.current.children[targetIndex] as HTMLElement;
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
                // 通知视频已播放
                if (onVideoPlayed) {
                  setTimeout(() => onVideoPlayed(), 500);
                }
              } else {
                setCurrentIndex(0);
                if (containerRef.current) {
                  containerRef.current.scrollTo({
                    top: 0,
                    behavior: 'instant',
                  });
                }
              }
            } else {
              setCurrentIndex(0);
              // 确保滚动到顶部（使用 instant 避免滚动动画导致的黑屏）
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: 0,
                  behavior: 'instant', // 使用 instant 避免滚动过程中的黑屏
                });
              }
            }
          });
        });
      } catch (error) {
        console.error('加载视频失败:', error);
        toast.error('加载视频失败');
        // 不清空视频列表，保持显示旧视频
        setLoading(false);
      }
    };

    loadVideos();
  }, [category, language]); // 添加language依赖，切换语言时重新加载并过滤视频

  // 监听滚动事件，更新当前视频索引（优化：使用 Intersection Observer 精确检测）
  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    // 使用 Intersection Observer 精确检测哪个视频在视口中
    const videoContainers = container.querySelectorAll('.h-screen');
    const observers: IntersectionObserver[] = [];
    
    videoContainers.forEach((videoContainer, index) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // 如果视频容器在视口中且可见度超过 50%
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              const newIndex = index;
              console.log(`📹 检测到视频索引变化: ${newIndex}, 视频标题: ${videos[newIndex]?.title || '未知'}`);
              
              // 标记用户已交互（滚动）
              if (!hasUserInteracted) {
                setHasUserInteracted(true);
              }
              
              // 如果索引变化，立即更新
              if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
                // 如果是向下滚动（newIndex > currentIndex），检查当前视频是否已播放完成
                const isVideoFinished = videoDuration > 0 && currentVideoTime >= videoDuration - 0.5; // 留0.5秒容差
                if (newIndex > currentIndex && isVideoFinished) {
                  // 如果视频已播放完成，自动跳过到下一个视频
                  // 清除之前的跳过定时器
                  if (skipTimeoutRef.current) {
                    clearTimeout(skipTimeoutRef.current);
                  }
                  
                  // 延迟跳过，确保滚动动画完成
                  skipTimeoutRef.current = setTimeout(() => {
                    if (newIndex < videos.length - 1) {
                      // 继续滚动到下一个视频
                      const nextIndex = newIndex + 1;
                      const nextElement = container.children[nextIndex] as HTMLElement;
                      if (nextElement) {
                        nextElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        console.log(`⏭️ 自动跳过已完成的视频: ${nextIndex}, 视频标题: ${videos[nextIndex]?.title || '未知'}`);
                        setCurrentIndex(nextIndex);
                      }
                    } else {
                      // 已经是最后一个视频，正常切换
                      setCurrentIndex(newIndex);
                    }
                  }, 300);
                } else {
                  // 正常切换视频
                  setCurrentIndex(newIndex);
                }
                
                // 强制暂停所有非激活的视频
                const allVideos = container.querySelectorAll('video');
                allVideos.forEach((video) => {
                  const videoElement = video as HTMLVideoElement;
                  const videoContainerElement = video.closest('.h-screen');
                  const videoIndex = Array.from(videoContainers).indexOf(videoContainerElement as Element);
                  
                  // 只有当前索引的视频可以播放，其他都暂停
                  if (videoIndex !== newIndex) {
                    if (!videoElement.paused) {
                      videoElement.pause();
                    }
                  }
                });
              }
            }
          });
        },
        {
          threshold: [0.5], // 当视频容器 50% 以上可见时触发
          rootMargin: '0px',
        }
      );
      
      observer.observe(videoContainer);
      observers.push(observer);
    });
    
    // 备用方案：使用滚动事件（如果 Intersection Observer 不可用）
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      // 标记用户已交互（滚动）
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }
      
      // 清除之前的定时器
      clearTimeout(scrollTimeout);
      
      // 延迟计算，等待滚动稳定
      scrollTimeout = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const windowHeight = window.innerHeight;
        
        // 更精确的计算：找到最接近视口中心的视频
        let closestIndex = 0;
        let minDistance = Infinity;
        
        videoContainers.forEach((videoContainer, index) => {
          const rect = videoContainer.getBoundingClientRect();
          const containerTop = rect.top + container.scrollTop;
          const centerY = scrollTop + windowHeight / 2;
          const distance = Math.abs(containerTop + windowHeight / 2 - centerY);

          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });
        
        if (closestIndex !== currentIndex && closestIndex >= 0 && closestIndex < videos.length) {
          // 如果是向下滚动（closestIndex > currentIndex），检查当前视频是否已播放完成
          const isVideoFinished = videoDuration > 0 && currentVideoTime >= videoDuration - 0.5; // 留0.5秒容差
          if (closestIndex > currentIndex && isVideoFinished) {
            // 如果视频已播放完成，自动跳过到下一个视频
            // 清除之前的跳过定时器
            if (skipTimeoutRef.current) {
              clearTimeout(skipTimeoutRef.current);
            }
            
            // 延迟跳过，确保滚动动画完成
            skipTimeoutRef.current = setTimeout(() => {
              if (closestIndex < videos.length - 1) {
                // 继续滚动到下一个视频
                const nextIndex = closestIndex + 1;
                const nextElement = container.children[nextIndex] as HTMLElement;
                if (nextElement) {
                  nextElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  console.log(`⏭️ 自动跳过已完成的视频: ${nextIndex}, 视频标题: ${videos[nextIndex]?.title || '未知'}`);
                  setCurrentIndex(nextIndex);
                }
              } else {
                // 已经是最后一个视频，正常切换
                console.log(`📹 滚动检测到视频索引变化: ${closestIndex}, 视频标题: ${videos[closestIndex]?.title || '未知'}`);
                setCurrentIndex(closestIndex);
              }
            }, 300);
          } else {
            // 正常切换视频
            console.log(`📹 滚动检测到视频索引变化: ${closestIndex}, 视频标题: ${videos[closestIndex]?.title || '未知'}`);
            setCurrentIndex(closestIndex);
          }
        }
      }, 100);
  };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      // 清理所有 observers
      observers.forEach(observer => observer.disconnect());
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      if (skipTimeoutRef.current) {
        clearTimeout(skipTimeoutRef.current);
      }
    };
  }, [currentIndex, videos.length, hasUserInteracted, videos, currentVideoTime, videoDuration]);

  // 切换分类时重置索引和滚动位置（优化：避免黑屏）
  // 注意：这个逻辑已经在 loadVideos 中处理，这里移除避免重复执行

  // 获取当前视频
  const currentVideo = videos.length > 0 && currentIndex >= 0 && currentIndex < videos.length 
    ? videos[currentIndex] 
    : null;

  // 处理关注/取消关注
  const handleFollow = async () => {
    if (!currentVideo || !currentVideo.authorId) return;

    try {
      const following = await followAPI.toggleFollow(currentVideo.authorId);
      setIsFollowing(following);
      // 更新视频列表中的关注状态
      setVideos(prevVideos => 
        prevVideos.map(v => 
          v.id === currentVideo.id ? { ...v, isFollowing: following } : v
        )
      );
      toast.success(following ? (language === 'zh' ? '已关注' : 'Following') : (language === 'zh' ? '已取消关注' : 'Unfollowed'));
    } catch (error) {
      console.error('关注操作失败:', error);
      toast.error(language === 'zh' ? '操作失败，请重试' : 'Operation failed, please try again');
    }
  };

  // 处理进度条拖动
  const handleSeek = useCallback((targetTime: number) => {
    if (!currentVideo) return;
    
    // 确保时间在有效范围内
    if (targetTime < 0) targetTime = 0;
    if (videoDuration > 0 && targetTime > videoDuration) {
      targetTime = videoDuration;
    }
    
    // 获取当前视频的DOM元素
    const videoElement = document.querySelector(`video[data-video-id="${currentVideo.id}"]`) as HTMLVideoElement;
    if (videoElement && videoElement.duration > 0) {
      // 设置视频播放位置
      videoElement.currentTime = targetTime;
      
      // 立即更新进度显示
      const progress = (targetTime / videoElement.duration) * 100;
      setCurrentProgress(progress);
      
      // 如果视频暂停中，拖动后继续播放
      if (videoElement.paused && videoElement.readyState >= 2) {
        videoElement.play().catch((error) => {
          console.error('拖动后播放失败:', error);
        });
      }
    }
  }, [currentVideo, videoDuration]);

  return (
    <>
    <div
      ref={containerRef}
      className="flex-1 overflow-y-scroll snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      style={{
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch', // iOS 平滑滚动
      }}
    >
      {videos.map((video, index) => (
        <div
          key={video.id}
            className="h-screen w-full snap-start snap-always flex-shrink-0 relative bg-black"
            style={{
              minHeight: '-webkit-fill-available', // iOS Safari 支持
              paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
          <VideoCard
            video={video}
            isActive={index === currentIndex}
            showFollowButton={showFollowButton}
            onProgressUpdate={index === currentIndex ? setCurrentProgress : undefined}
            onTimeUpdate={index === currentIndex ? setCurrentVideoTime : undefined}
            onSeek={index === currentIndex ? handleSeek : undefined}
            onDurationUpdate={index === currentIndex ? setVideoDuration : undefined}
            hasUserInteracted={hasUserInteracted}
          />
        </div>
      ))}
    </div>

      {/* Fixed 定位的覆盖层元素 - 根据当前视频更新 */}
      {currentVideo && (
        <>
          {/* 右上角通知铃铛 */}
          <div className="fixed top-4 right-4 z-30 max-w-[480px]" style={{ right: 'calc((100vw - min(100vw, 480px)) / 2 + 16px)' }}>
            <NotificationBell />
          </div>

          {/* 右侧交互按钮 */}
          <div className="fixed right-4 bottom-52 z-20 max-w-[480px]" style={{ right: 'calc((100vw - min(100vw, 480px)) / 2 + 16px)' }}>
            <VideoInteractions 
              video={currentVideo} 
              onVideoUpdate={(videoId, updates) => {
                // 更新 videos 数组中对应视频的数据
                setVideos(prevVideos => 
                  prevVideos.map(v => 
                    v.id === videoId ? { ...v, ...updates } : v
                  )
                );
                console.log(`🔄 更新视频数据: ID=${videoId}`, updates);
              }}
            />
          </div>

          {/* 进度条 - 使用可拖动的ProgressBar组件 */}
          <div 
            className="fixed left-0 right-0 z-10 px-4 max-w-[480px] mx-auto"
            style={{
              bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
              pointerEvents: 'auto', // 启用交互
            }}
          >
            <ProgressBar
              progress={currentProgress}
              duration={videoDuration}
              onSeek={handleSeek}
            />
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
            {/* 遮罩层 - 位置在底部，高度自适应，确保字幕区域（距离底部400px）在遮罩上方可见，不重叠 */}
            <div className="bg-black/30 pt-4 pb-2 -mx-4 px-4 rounded-t-lg" style={{ maxHeight: '350px' }}>
              <div className="text-white pointer-events-auto">
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={currentVideo.avatar}
                    alt={currentVideo.author}
                    className="w-10 h-10 rounded-full border-2 border-white object-cover flex-shrink-0 bg-white"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('ashley-avatar.jpg')) {
                        target.src = '/ashley-avatar.jpg';
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{currentVideo.author}</div>
                    {showFollowButton && currentVideo.authorId && currentVideo.authorId.trim() !== '' && (
                      <button 
                        onClick={handleFollow}
                        className={`px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 transition-colors whitespace-nowrap ${
                          isFollowing 
                            ? 'bg-zinc-700 text-white hover:bg-zinc-600' 
                            : 'bg-white text-black hover:bg-white/90'
                        }`}
                      >
                        {isFollowing ? (language === 'zh' ? '已关注' : 'Following') : (language === 'zh' ? '关注' : 'Follow')}
                      </button>
                    )}
                  </div>
                </div>
                {/* 视频标题 - 在第一屏完整展示，自适应高度，如果内容过长可以滚动查看 */}
                <p 
                  className="text-sm leading-relaxed pr-20"
                  style={{
                    wordBreak: 'break-word',
                    display: 'block',
                    maxHeight: '280px', // 遮罩最大高度350px - 作者信息行60px - padding 10px = 280px
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch', // iOS平滑滚动
                  }}
                >
                  {language === 'zh' ? currentVideo.title : currentVideo.titleEn}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
