import React, { useState, useRef, useEffect } from 'react';
import { VideoInteractions } from './VideoInteractions';
import { useLanguage } from '../contexts/LanguageContext';
import { videoAPI, followAPI } from '../services/leancloud';
import { toast } from 'sonner';

interface Video {
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
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  showFollowButton?: boolean; // 是否显示关注按钮，默认false（home页面不显示）
  onProgressUpdate?: (progress: number) => void; // 进度更新回调
  hasUserInteracted?: boolean; // 用户是否已交互（用于决定是否可以自动播放声音）
}

export function VideoCard({ video, isActive, showFollowButton = false, onProgressUpdate, hasUserInteracted: parentHasUserInteracted = false }: VideoCardProps) {
  const { t, language } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false); // 初始不显示播放按钮，登录后自动播放
  const [progress, setProgress] = useState(0);
  const [isFollowing, setIsFollowing] = useState(video.isFollowing);
  const [isMuted, setIsMuted] = useState(!parentHasUserInteracted); // 如果用户已交互，默认不静音
  const [hasUserInteracted, setHasUserInteracted] = useState(parentHasUserInteracted); // 跟踪用户是否已交互
  const [hasError, setHasError] = useState(false); // 跟踪视频加载错误状态
  const [retryCount, setRetryCount] = useState(0); // 重试次数
  const [isLoading, setIsLoading] = useState(true); // 跟踪视频是否正在加载

  // 当video.isFollowing变化时更新状态
  useEffect(() => {
    setIsFollowing(video.isFollowing);
  }, [video.isFollowing]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 根据语言选择视频URL：英文优先使用videoUrlEn，如果没有则使用videoUrl
  const currentVideoUrl = language === 'en' && video.videoUrlEn 
    ? video.videoUrlEn 
    : video.videoUrl;

  // 当语言或视频URL变化时，更新视频源（优化：避免不必要的重新加载，避免黑屏）
  useEffect(() => {
    if (!videoRef.current) return;
    
    // 检查当前视频源
    const currentSrc = videoRef.current.src;
    const normalizedCurrentSrc = currentSrc ? new URL(currentSrc).pathname : '';
    const normalizedNewSrc = new URL(currentVideoUrl, window.location.href).pathname;
    
    // 只有当URL真正变化时才重新加载
    if (normalizedCurrentSrc === normalizedNewSrc || currentSrc.endsWith(currentVideoUrl)) {
      // URL 没有变化，不需要重新加载
      return;
    }
    
    const wasPlaying = !videoRef.current.paused;
    const currentTime = videoRef.current.currentTime;
    
    // 重置错误状态和重试次数
    setHasError(false);
    setRetryCount(0);
    setIsLoading(true); // URL 变化时，开始加载
    
    // 直接设置新源，不清空（避免黑屏）
    // 使用 requestAnimationFrame 确保在下一帧设置，避免闪烁
    requestAnimationFrame(() => {
      if (!videoRef.current) return;
    videoRef.current.src = currentVideoUrl;
      // 不立即调用 load()，让浏览器自然加载
    
    // 如果之前正在播放，恢复播放状态
    if (wasPlaying && isActive) {
        const tryResume = () => {
          if (!videoRef.current) return;
          // 检查网络状态
          if (videoRef.current.networkState === 2) {
            setHasError(true);
            setIsLoading(true); // 网络错误，显示 loading
            return;
          }
          if (videoRef.current.readyState >= 2) {
      videoRef.current.currentTime = currentTime;
            videoRef.current.muted = isMuted;
      videoRef.current.play().then(() => {
                setHasError(false);
                setIsPlaying(true);
                setIsLoading(false); // 播放成功，隐藏 loading
                setShowControls(false);
      }).catch(() => {
                setHasError(true);
                setIsLoading(true); // 播放失败，显示 loading
      });
          } else {
            setIsLoading(true); // 等待加载
            videoRef.current.addEventListener('canplay', tryResume, { once: true });
          }
        };
        tryResume();
      }
    });
  }, [currentVideoUrl, isActive, isMuted]);

  // 当用户交互状态变化时，更新静音状态
  useEffect(() => {
    if (parentHasUserInteracted && !hasUserInteracted) {
      setHasUserInteracted(true);
      if (videoRef.current && isActive) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, [parentHasUserInteracted, isActive]);

  // 当视频激活时自动播放，否则暂停（优化：无缝切换，无黑屏，支持分类切换）
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      // 如果用户已经交互过，取消静音并播放
      if (hasUserInteracted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      } else {
        // 首次加载时保持静音以支持自动播放
        videoRef.current.muted = true;
        setIsMuted(true);
      }
      
      // 立即尝试播放（不等待，实现无缝切换）
      const tryPlay = () => {
        if (!videoRef.current || !isActive) return;
        
        // 检查网络状态，如果是错误状态，显示 loading 并等待重试
        if (videoRef.current.networkState === 2) {
          console.warn('⚠️ 视频网络错误，显示 loading 等待重试');
          setHasError(true);
          setIsLoading(true); // 显示 loading，因为会自动重试
          setShowControls(false); // 隐藏播放按钮
          return;
        }
        
        // 如果视频还没加载完成，显示 loading
        if (videoRef.current.readyState < 4) {
          setIsLoading(true);
        }
        
        // 确保视频源已设置
        if (!videoRef.current.src || videoRef.current.src === '') {
          videoRef.current.src = currentVideoUrl;
        }
        
        // 如果视频已经加载了足够的元数据，立即播放
        if (videoRef.current.readyState >= 2) {
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            setHasError(false);
            setIsLoading(false); // 加载完成
            setShowControls(false); // 播放成功后隐藏控制按钮
          }).catch((error) => {
            console.error('自动播放失败:', error);
            setHasError(true);
            setIsLoading(true); // 播放失败，继续显示 loading
          });
        } else if (videoRef.current.readyState >= 1) {
          // 如果有元数据，也可以尝试播放
          videoRef.current.play().then(() => {
            setIsPlaying(true);
            setHasError(false);
            setIsLoading(false); // 加载完成
            setShowControls(false);
          }).catch(() => {
            // 如果失败，等待 canplay
            setIsLoading(true); // 等待加载
            const onCanPlay = () => {
              if (!videoRef.current || !isActive) return;
              videoRef.current.removeEventListener('canplay', onCanPlay);
              videoRef.current.play().then(() => {
                setIsPlaying(true);
                setHasError(false);
                setIsLoading(false); // 加载完成
                setShowControls(false);
              }).catch(() => {
                setHasError(true);
                setIsLoading(true); // 继续显示 loading
              });
            };
            videoRef.current.addEventListener('canplay', onCanPlay, { once: true });
          });
        } else {
          // 如果视频还没加载，等待加载完成
          setIsLoading(true); // 开始加载
          const onCanPlay = () => {
            if (!videoRef.current || !isActive) return;
            videoRef.current.removeEventListener('canplay', onCanPlay);
            videoRef.current.play().then(() => {
              setIsPlaying(true);
              setHasError(false);
              setIsLoading(false); // 加载完成
              setShowControls(false);
            }).catch(() => {
              setHasError(true);
              setIsLoading(true); // 继续显示 loading
            });
          };
          
          videoRef.current.addEventListener('canplay', onCanPlay, { once: true });
          
          // 如果视频还没开始加载，触发加载
          if (videoRef.current.readyState === 0) {
            videoRef.current.load();
          }
          
          // 返回清理函数
          return () => {
            if (videoRef.current) {
              videoRef.current.removeEventListener('canplay', onCanPlay);
            }
          };
        }
      };
      
      // 立即尝试播放，不等待 requestAnimationFrame（确保快速响应）
      // 但先检查 isActive 状态
      if (isActive) {
        tryPlay();
      }
      
      // 同时使用 requestAnimationFrame 作为备用（确保 DOM 更新后也能播放）
      const rafId = requestAnimationFrame(() => {
        // 再次检查 isActive 状态，确保状态没有变化
        if (isActive && videoRef.current) {
          tryPlay();
        } else if (!isActive && videoRef.current && !videoRef.current.paused) {
          // 如果状态变为非激活，立即暂停
          videoRef.current.pause();
          setIsPlaying(false);
        }
      });

      // 记录观看历史和增加观看次数
      const recordWatch = async () => {
        try {
          await videoAPI.recordWatchHistory(video.id, 0);
          // 延迟几秒后增加观看次数，避免重复计数
          setTimeout(async () => {
            await videoAPI.incrementViewCount(video.id);
          }, 3000);
        } catch (error) {
          console.error('记录观看失败:', error);
        }
      };
      recordWatch();
      
      // 返回清理函数（必须在最后）
      return () => {
        cancelAnimationFrame(rafId);
      };
    } else {
      // 非激活状态时强制暂停并重置播放状态
      if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    }
  }, [isActive, hasUserInteracted]);

  // 处理播放/暂停切换
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      // 暂停当前视频
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true); // 暂停时显示控制按钮
    } else {
      // 播放当前视频（只有激活的视频才能播放）
      if (isActive) {
        // 检查网络状态，如果是错误状态，先尝试重新加载
        if (videoRef.current.networkState === 2) {
          console.log('🔄 检测到网络错误，尝试重新加载视频...');
          setRetryCount(prev => prev + 1);
          setIsLoading(true); // 显示 loading
          videoRef.current.src = '';
          videoRef.current.load();
          setTimeout(() => {
            if (videoRef.current && isActive) {
              videoRef.current.src = currentVideoUrl;
              videoRef.current.load();
              setHasError(false);
              setIsLoading(true); // 继续显示 loading
            }
          }, 500);
          return; // 等待重新加载完成
        }
        
        // 确保视频已加载
        if (videoRef.current.readyState < 2) {
          setIsLoading(true); // 开始加载
          videoRef.current.load();
        }
        videoRef.current.muted = isMuted; // 使用当前静音状态
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          setHasError(false);
          setIsLoading(false); // 播放成功，隐藏 loading
          setShowControls(false); // 播放成功后隐藏控制按钮
        }).catch((error) => {
          console.error('播放失败:', error);
          console.error('视频 URL:', currentVideoUrl);
          console.error('视频元素状态:', {
            paused: videoRef.current?.paused,
            readyState: videoRef.current?.readyState,
            networkState: videoRef.current?.networkState,
            error: videoRef.current?.error?.message || videoRef.current?.error?.code
          });
          setHasError(true);
          setIsPlaying(false);
          setIsLoading(true); // 播放失败，显示 loading
          // 如果是网络错误，尝试重新加载
          if (videoRef.current && videoRef.current.networkState === 2 && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (videoRef.current && isActive) {
                videoRef.current.load();
              }
            }, 2000);
          }
        });
      }
    }

    // 注意：showControls 已经在暂停/播放时正确设置了
    // 不需要额外的自动隐藏逻辑，因为：
    // - 暂停时：setShowControls(true) - 显示播放按钮
    // - 播放时：setShowControls(false) - 隐藏播放按钮
  };

  // 更新进度条
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(progress);
    // 通知父组件进度更新
    if (onProgressUpdate && isActive) {
      onProgressUpdate(progress);
    }
  };

  // 视频结束时循环播放（只有激活的视频才循环）
  const handleVideoEnd = () => {
    if (videoRef.current && isActive && isPlaying) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true; // iOS 需要 muted 才能播放
      videoRef.current.play().catch((error) => {
        console.error('循环播放失败:', error);
        console.error('视频 URL:', currentVideoUrl);
      });
    }
  };

  // 点击视频区域切换播放状态
  const handleVideoClick = (e: React.MouseEvent) => {
    // 如果点击的是交互按钮区域，不处理
    if ((e.target as HTMLElement).closest('.video-interactions')) {
      return;
    }
    // 标记用户已交互
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      // 用户交互后，尝试取消静音
      if (videoRef.current && isActive) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
    togglePlay();
  };

  // 处理关注/取消关注
  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video.authorId) return;

    try {
      const following = await followAPI.toggleFollow(video.authorId);
      setIsFollowing(following);
      toast.success(following ? (language === 'zh' ? '已关注' : 'Following') : (language === 'zh' ? '已取消关注' : 'Unfollowed'));
    } catch (error) {
      console.error('关注操作失败:', error);
      toast.error(language === 'zh' ? '操作失败，请重试' : 'Operation failed, please try again');
    }
  };

  // 切换静音/取消静音
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    
    // 标记用户已交互
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    
    const newMutedState = !isMuted;
    videoRef.current.muted = newMutedState;
    setIsMuted(newMutedState);
    
    // 显示提示
    if (newMutedState) {
      toast.info(language === 'zh' ? '已静音' : 'Muted');
    } else {
      toast.info(language === 'zh' ? '已取消静音' : 'Unmuted');
    }
  };

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* 视频 - 抖音风格：固定位置，自适应不同手机尺寸 */}
      <div className="absolute inset-0 w-full h-full" style={{ top: '-env(safe-area-inset-top, 0px)' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover bg-black"
          src={currentVideoUrl}
          poster={video.thumbnail}
          loop={false}
          playsInline
          muted={isMuted}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnd}
          onClick={handleVideoClick}
          onError={(e) => {
            const videoEl = e.target as HTMLVideoElement;
            const error = videoEl.error;
            
            // HTML5 视频错误代码
            const errorMessages: { [key: number]: string } = {
              1: 'MEDIA_ERR_ABORTED - 用户中止',
              2: 'MEDIA_ERR_NETWORK - 网络错误',
              3: 'MEDIA_ERR_DECODE - 解码错误',
              4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 视频格式不支持或无法解码'
            };
            
            console.error('❌ 视频加载错误:', {
              url: currentVideoUrl,
              code: error?.code,
              message: error?.message || errorMessages[error?.code || 0] || '未知错误',
              networkState: videoEl.networkState,
              readyState: videoEl.readyState,
              errorType: errorMessages[error?.code || 0] || '未知错误类型'
            });
            
            // 设置错误状态，隐藏播放按钮
            setHasError(true);
            setIsPlaying(false);
            setShowControls(false);
            
            // 如果是网络错误（networkState: 2）或格式不支持错误（代码 4）或解码错误（代码 3）
            if (videoEl.networkState === 2 || error?.code === 2 || error?.code === 4 || error?.code === 3) {
              console.warn('⚠️ 视频加载错误:', {
                code: error?.code,
                message: error?.message,
                networkState: videoEl.networkState,
                readyState: videoEl.readyState,
                url: currentVideoUrl
              });
              
              // networkState: 2 表示网络错误，需要重试，显示 loading
              if (videoEl.networkState === 2 && retryCount < 3) {
                console.log(`🔄 网络错误，尝试重新加载视频 (第 ${retryCount + 1} 次)...`);
                setRetryCount(prev => prev + 1);
                setIsLoading(true); // 网络错误，显示 loading 等待重试
                
                // 延迟重试，避免立即重试导致的问题
                setTimeout(() => {
                  if (videoEl && isActive && videoEl.networkState === 2) {
                    videoEl.src = '';
                    videoEl.load();
                    setTimeout(() => {
                      if (videoEl && isActive) {
                        videoEl.src = currentVideoUrl;
                        videoEl.load();
                        setHasError(false); // 重置错误状态，准备重试
                        setIsLoading(true); // 继续显示 loading
                      }
                    }, 500);
                  }
                }, 2000 * (retryCount + 1)); // 递增延迟
              } else if (videoEl.networkState === 3) {
                // networkState: 3 表示 NETWORK_NO_SOURCE，可能是 iOS 模拟器限制
                console.warn('⚠️ iOS 模拟器可能不支持此视频格式或存在网络限制');
                console.warn('💡 建议：在真机上测试，或检查视频服务器配置');
                setIsLoading(true); // 显示 loading
                
                // 尝试重新加载一次
                setTimeout(() => {
                  if (videoEl && isActive && videoEl.networkState === 3) {
                    console.log('🔄 尝试重新加载视频...');
                    videoEl.src = '';
                    videoEl.load();
                    setTimeout(() => {
                      if (videoEl && isActive) {
                        videoEl.src = currentVideoUrl;
                        videoEl.load();
                        setHasError(false);
                        setIsLoading(true); // 继续显示 loading
                      }
                    }, 500);
                  }
                }, 2000);
              } else {
                // 其他错误，不显示 loading（因为不会重试）
                setIsLoading(false);
              }
            } else {
              // 其他类型的错误，不显示 loading
              setIsLoading(false);
            }
          }}
          onLoadedData={() => {
            console.log('✅ 视频数据加载完成:', currentVideoUrl);
            // 重置错误状态和重试次数
            setHasError(false);
            setRetryCount(0);
            setIsLoading(false); // 数据加载完成
            // 只有激活状态时才播放
            if (isActive && !isPlaying && videoRef.current) {
              videoRef.current.muted = isMuted;
              videoRef.current.play().then(() => {
                setIsPlaying(true);
                setIsLoading(false); // 播放成功，隐藏 loading
                setShowControls(false); // 播放成功后隐藏控制按钮
              }).catch((error) => {
                console.error('onLoadedData 后播放失败:', error);
                setHasError(true);
                setIsLoading(true); // 播放失败，继续显示 loading
              });
            } else if (!isActive && videoRef.current && !videoRef.current.paused) {
              // 如果不是激活状态，确保暂停
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }}
          onCanPlay={() => {
            console.log('✅ 视频可以播放:', currentVideoUrl);
            // 重置错误状态
            setHasError(false);
            setIsLoading(false); // 可以播放，隐藏 loading
            // 只有激活状态时才播放
            if (isActive && !isPlaying && videoRef.current) {
              videoRef.current.muted = isMuted;
              videoRef.current.play().then(() => {
                setIsPlaying(true);
                setIsLoading(false); // 播放成功，隐藏 loading
                setShowControls(false); // 播放成功后隐藏控制按钮
              }).catch((error) => {
                console.error('onCanPlay 后播放失败:', error);
                setHasError(true);
                setIsLoading(true); // 播放失败，继续显示 loading
              });
            } else if (!isActive && videoRef.current && !videoRef.current.paused) {
              // 如果不是激活状态，确保暂停
              videoRef.current.pause();
              setIsPlaying(false);
            }
          }}
          onLoadedMetadata={() => {
            console.log('✅ 视频元数据加载完成:', currentVideoUrl);
            if (videoRef.current) {
              console.log('📊 视频信息:', {
                duration: videoRef.current.duration,
                videoWidth: videoRef.current.videoWidth,
                videoHeight: videoRef.current.videoHeight,
                readyState: videoRef.current.readyState,
                networkState: videoRef.current.networkState
              });
              // 检查网络状态，如果是错误状态，设置错误标志并显示 loading
              if (videoRef.current.networkState === 2) {
                console.error('⚠️ 视频元数据加载时检测到网络错误');
                setHasError(true);
                setIsLoading(true); // 网络错误，显示 loading 等待重试
              } else {
                setHasError(false);
                // 如果 readyState < 4，还在加载中
                if (videoRef.current.readyState < 4) {
                  setIsLoading(true);
                } else {
                  setIsLoading(false);
                }
              }
              // 只有激活状态时才播放
              if (isActive && !isPlaying && !hasError) {
                videoRef.current.muted = isMuted;
                videoRef.current.play().then(() => {
                  setIsPlaying(true);
                  setIsLoading(false); // 播放成功，隐藏 loading
                  setShowControls(false); // 播放成功后隐藏控制按钮
                }).catch((error) => {
                  console.error('onLoadedMetadata 后播放失败:', error);
                  setHasError(true);
                  setIsLoading(true); // 播放失败，继续显示 loading
                });
              } else if (!isActive && !videoRef.current.paused) {
                // 如果不是激活状态，确保暂停
                videoRef.current.pause();
                setIsPlaying(false);
              }
            }
          }}
          onWaiting={() => {
            console.log('⏳ 视频缓冲中:', currentVideoUrl);
            setIsLoading(true); // 缓冲中，显示 loading
          }}
          onStalled={() => {
            console.warn('⚠️ 视频加载停滞:', currentVideoUrl);
            setIsLoading(true); // 停滞，显示 loading
            // 如果视频停滞超过 5 秒，尝试重新加载
            if (videoRef.current && isActive) {
              setTimeout(() => {
                if (videoRef.current && videoRef.current.networkState === 2) {
                  console.log('🔄 视频停滞超时，尝试重新加载...');
                  setHasError(true);
                  setIsLoading(true); // 继续显示 loading
                  if (retryCount < 3) {
                    setRetryCount(prev => prev + 1);
                    videoRef.current.load();
                  }
                }
              }, 5000);
            }
          }}
          onPlaying={() => {
            // 视频开始播放时，确保隐藏 loading
            setIsLoading(false);
            setIsPlaying(true);
          }}
          onProgress={() => {
            // 监控加载进度
            if (videoRef.current && isActive) {
              const buffered = videoRef.current.buffered;
              if (buffered.length > 0) {
                const loaded = (buffered.end(buffered.length - 1) / videoRef.current.duration) * 100;
                if (loaded > 0 && loaded < 100) {
                  console.log(`📊 视频加载进度: ${loaded.toFixed(1)}%`);
                }
              }
            }
          }}
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            backgroundColor: '#000', // 确保背景是黑色，避免白屏
            marginTop: '-env(safe-area-inset-top, 0px)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            height: 'calc(100% + env(safe-area-inset-top, 0px))',
          }}
        />
      </div>

      {/* 播放/暂停图标 - 居中显示，缩小尺寸（仅在非错误状态时显示） */}
      {showControls && !isPlaying && !hasError && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30">
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      
      {/* Loading 提示 - 当视频加载中或网络错误时显示 */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30">
            {/* Loading 旋转动画 */}
            <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      )}

      {/* 静音/取消静音按钮 - 右上角 */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-black/70 transition-colors"
        aria-label={isMuted ? (language === 'zh' ? '取消静音' : 'Unmute') : (language === 'zh' ? '静音' : 'Mute')}
      >
        {isMuted ? (
          // 静音图标
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          // 取消静音图标
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

    </div>
  );
}