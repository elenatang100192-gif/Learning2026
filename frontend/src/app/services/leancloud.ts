// 导入 Capacitor HTTP（绕过 WebView CORS 限制）
import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

// 检测是否在原生环境中
const isNative = Capacitor.isNativePlatform();

// 后端API配置（支持环境变量）
// 原生环境（iOS/Android）始终使用远程地址，本地开发环境可以使用本地地址
const getApiBaseUrl = () => {
  // 如果是原生环境，强制使用远程地址
  if (isNative) {
    return 'https://nexusmind-api-test.ashgso.com/api/';
  }
  // 本地开发环境：优先使用环境变量，否则使用本地地址
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/';
};

const API_BASE_URL = getApiBaseUrl();

// 调试：输出 API_BASE_URL 配置
console.log('🔧 API_BASE_URL 配置:', API_BASE_URL);
console.log('🔧 是否原生环境:', isNative);
console.log('🔧 import.meta.env.VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

// API请求辅助函数
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  // 确保 API_BASE_URL 不为空
  const baseUrl = API_BASE_URL || 'https://nexusmind-api-test.ashgso.com/api/';
  // 处理 URL 拼接：如果 baseUrl 以 / 结尾，endpoint 以 / 开头，则移除一个斜杠
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${normalizedBaseUrl}${normalizedEndpoint}`;
  
  // 调试：输出完整的 URL
  console.log('🔧 API Request URL 构建:', {
    baseUrl,
    endpoint,
    fullUrl: url
  });
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // 添加认证token（如果存在）
  const token = localStorage.getItem('sessionToken');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  try {
    console.log(`🌐 API Request: ${url}`, { method: config.method || 'GET', headers: config.headers, isNative });
    
    // 在原生环境中使用 Capacitor HTTP（绕过 WebView CORS 限制）
    if (isNative) {
      try {
        const response = await CapacitorHttp.request({
          method: (config.method as any) || 'GET',
          url: url,
          headers: config.headers as any,
          data: config.body ? (typeof config.body === 'string' ? JSON.parse(config.body) : config.body) : undefined,
        });
        
        console.log(`📥 API Response (Native): ${url}`, { 
          status: response.status, 
          data: response.data
        });

        if (response.status >= 400) {
          const errorData = typeof response.data === 'object' ? response.data : {};
          const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
          console.error(`❌ API Error (Native): ${url}`, { status: response.status, message: errorMessage, data: errorData });
          const error = new Error(errorMessage);
          (error as any).status = response.status;
          throw error;
        }

        console.log(`✅ API Success (Native): ${url}`, response.data);
        return response.data;
      } catch (nativeError: any) {
        console.warn('Native HTTP request failed, falling back to fetch:', nativeError);
        // 如果原生请求失败，回退到标准 fetch
      }
    }
    
    // Web 环境或原生请求失败时，使用标准 fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const fetchConfig: RequestInit = {
      ...config,
      signal: controller.signal,
      mode: 'cors', // CORS 模式
      credentials: 'omit', // 不发送 cookies
      cache: 'no-cache', // 禁用缓存
      redirect: 'follow', // 跟随重定向
    };
    
    const response = await fetch(url, fetchConfig);
    clearTimeout(timeoutId);
    
    console.log(`📥 API Response: ${url}`, { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
      console.error(`❌ API Error: ${url}`, { status: response.status, message: errorMessage, data: errorData });
      const error = new Error(errorMessage);
      // 添加status属性以便后续检查
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    console.log(`✅ API Success: ${url}`, data);
    return data;
  } catch (error: any) {
    // 处理网络错误（如连接失败、超时等）
    if (error.name === 'AbortError') {
      console.error(`⏱️ Request Timeout: ${url}`, error);
      const timeoutError = new Error('Request timeout: The server did not respond in time.');
      (timeoutError as any).status = 0;
      (timeoutError as any).isNetworkError = true;
      throw timeoutError;
    }
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Load failed') || error.message.includes('Failed to fetch'))) {
      console.error(`🌐 Network Error: ${url}`, error);
      console.error(`🌐 Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      const networkError = new Error('Network error: Unable to connect to server. Please check your internet connection and server status.');
      (networkError as any).status = 0;
      (networkError as any).isNetworkError = true;
      throw networkError;
    }
    // 重新抛出其他错误
    throw error;
  }
};

// 数据类型定义
export interface Category {
  id: string;
  name: string;
  nameCn: string;
  sortOrder: number;
}

export interface Video {
  id: string;
  title: string;
  titleEn?: string;
  category: Category;
  videoUrl: string;
  videoUrlEn?: string | null;
  coverUrl: string;
  duration: number;
  fileSize?: number;
  status: '待审核' | '已发布' | '已驳回' | '已禁用';
  disabled?: boolean;
  viewCount: number;
  likeCount: number;
  uploadDate: string;
  publishDate?: string;
  displayOrder?: number; // 前端手机端展示顺序，数字越小越靠前
  favoriteCreatedAt?: string; // 收藏时间（仅从收藏列表获取时存在）
  author?: User;
}

export interface User {
  id: string;
  username: string;
  usernameCn?: string; // 中文用户名
  email: string;
  avatar?: string;
  joinDate: string;
  totalVideos: number;
  totalViews: number;
  canPublish: boolean;
  canComment: boolean;
}

export interface Comment {
  id: string;
  content: string;
  user: User;
  video: Video;
  createdAt: string;
  updatedAt: string;
}

export interface Like {
  id: string;
  user: User;
  video: Video;
  createdAt: string;
}

export interface Favorite {
  id: string;
  user: User;
  video: Video;
  createdAt: string;
}

export interface WatchHistory {
  id: string;
  user: User;
  video: Video;
  watchedAt: string;
  watchDuration: number;
}

// 认证相关API
export const authAPI = {
  // 发送OTP验证码
  sendOTP: async (email: string): Promise<{success: boolean, development?: boolean, otp?: string, note?: string, message?: string}> => {
    try {
      const response = await apiRequest('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      console.log('🔍 sendOTP API raw response:', response);
      
      // 确保返回所有字段
      return {
        success: response.success !== false, // 如果response.success是undefined，默认为true
        development: response.development,
        otp: response.otp,
        note: response.note,
        message: response.message
      };
    } catch (error: any) {
      console.error('发送OTP失败:', error);
      // 提取错误消息
      const errorMessage = error?.message || '发送验证码失败，请重试';
      return { 
        success: false,
        message: errorMessage
      };
    }
  },

  // 邮箱登录（使用OTP）
  loginWithEmail: async (email: string, otpCode: string): Promise<User | null> => {
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, otp: otpCode })
      });

      if (response.success && response.user) {
        // 存储session token到localStorage
        localStorage.setItem('sessionToken', response.sessionToken);
        return response.user;
      }
      return null;
    } catch (error) {
      console.error('邮箱登录失败:', error);
      return null;
    }
  },

  // 密码登录
  loginWithPassword: async (email: string, password: string): Promise<User | null> => {
    try {
      console.log('🔐 Password login request:', { email, passwordLength: password.length, loginType: 'password' });
      
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, loginType: 'password' })
      });

      console.log('🔍 Password login API raw response:', response);

      if (response.success && response.user) {
        // 存储session token到localStorage
        localStorage.setItem('sessionToken', response.sessionToken);
        console.log('✅ Password login successful, user:', response.user);
        return response.user;
      }
      
      console.error('❌ Password login failed: response.success is false or user is missing', response);
      return null;
    } catch (error: any) {
      console.error('❌ Password login exception:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        status: error?.status,
        stack: error?.stack,
      });
      
      // 重新抛出错误，让调用者可以处理
      throw error;
    }
  },

  // 获取当前用户
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await apiRequest('/auth/me');
      return response.success ? response.user : null;
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
      return null;
    }
  },

  // 登出
  logout: async (): Promise<void> => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      localStorage.removeItem('sessionToken');
    } catch (error) {
      console.error('登出失败:', error);
      // 即使API调用失败，也要清除本地存储
      localStorage.removeItem('sessionToken');
    }
  },

  // 检查登录状态
  isLoggedIn: (): boolean => {
    return !!localStorage.getItem('sessionToken');
  }
};

// 分类相关API
export const categoryAPI = {
  // 获取所有分类
  getAll: async (): Promise<Category[]> => {
    try {
      const response = await apiRequest('/categories');
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取分类失败:', error);
      return [];
    }
  }
};

// 视频相关API
export const videoAPI = {
  // 获取视频列表（分页）
  getList: async (options: {
    category?: string;
    status?: '已发布';
    page?: number;
    limit?: number;
    sortBy?: 'newest' | 'popular' | 'trending';
  } = {}): Promise<Video[]> => {
    try {
      const params = new URLSearchParams();
      if (options.category) params.append('category', options.category);
      if (options.status) params.append('status', options.status);
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.sortBy) params.append('sortBy', options.sortBy);

      const response = await apiRequest(`/videos?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取视频列表失败:', error);
      return [];
    }
  },

  // 获取单个视频详情
  getById: async (videoId: string): Promise<Video | null> => {
    try {
      const response = await apiRequest(`/videos/${videoId}`);
      return response.success ? response.data : null;
    } catch (error) {
      console.error('获取视频详情失败:', error);
      return null;
    }
  },

  // 发布视频（用户发布到待审核状态）
  publish: async (videoData: {
    title: string;
    titleEn?: string;
    categoryId: string;
    videoUrl: string;
    coverUrl: string;
    duration: number;
  }): Promise<Video | null> => {
    try {
      const response = await apiRequest('/videos/publish', {
        method: 'POST',
        body: JSON.stringify(videoData)
      });
      return response.success ? response.data : null;
    } catch (error) {
      console.error('发布视频失败:', error);
      throw error;
    }
  },

  // 增加观看次数
  incrementViewCount: async (videoId: string): Promise<void> => {
    try {
      await apiRequest(`/videos/${videoId}/view`, { method: 'POST' });
    } catch (error) {
      console.error('增加观看次数失败:', error);
    }
  },

  // 记录观看历史
  recordWatchHistory: async (videoId: string, watchDuration: number = 0): Promise<void> => {
    try {
      await apiRequest(`/videos/${videoId}/watch`, {
        method: 'POST',
        body: JSON.stringify({ watchDuration })
      });
    } catch (error) {
      console.error('记录观看历史失败:', error);
    }
  }
};

// 点赞相关API
export const likeAPI = {
  // 检查是否已点赞
  isLiked: async (videoId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/likes/${videoId}/status`);
      return response.success ? response.liked : false;
    } catch (error: any) {
      // 401错误表示用户未登录，静默返回false
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.message?.includes('Authentication failed')) {
        return false;
      }
      console.error('检查点赞状态失败:', error);
      return false;
    }
  },

  // 点赞/取消点赞
  toggleLike: async (videoId: string): Promise<{ liked: boolean; likeCount: number }> => {
    try {
      const response = await apiRequest(`/likes/${videoId}/toggle`, { method: 'POST' });
      return response.success ? { liked: response.liked, likeCount: response.likeCount } : { liked: false, likeCount: 0 };
    } catch (error) {
      console.error('点赞操作失败:', error);
      throw error;
    }
  }
};

// 收藏相关API
export const favoriteAPI = {
  // 检查是否已收藏
  isFavorited: async (videoId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/favorites/${videoId}/status`);
      return response.success ? response.favorited : false;
    } catch (error: any) {
      // 401错误表示用户未登录，静默返回false
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.message?.includes('Authentication failed')) {
        return false;
      }
      console.error('检查收藏状态失败:', error);
      return false;
    }
  },

  // 收藏/取消收藏
  toggleFavorite: async (videoId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/favorites/${videoId}/toggle`, { method: 'POST' });
      return response.success ? response.favorited : false;
    } catch (error) {
      console.error('收藏操作失败:', error);
      throw error;
    }
  },

  // 获取用户收藏列表
  getUserFavorites: async (page: number = 1, limit: number = 20): Promise<Video[]> => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await apiRequest(`/favorites?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取收藏列表失败:', error);
      return [];
    }
  }
};

// 关注相关API
export const followAPI = {
  // 检查是否已关注
  isFollowing: async (authorId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/follows/${authorId}/status`);
      return response.success ? response.following : false;
    } catch (error: any) {
      // 401错误表示用户未登录，静默返回false
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized') || error?.message?.includes('Authentication failed')) {
        return false;
      }
      console.error('检查关注状态失败:', error);
      return false;
    }
  },

  // 关注/取消关注
  toggleFollow: async (authorId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/follows/${authorId}/toggle`, { method: 'POST' });
      return response.success ? response.following : false;
    } catch (error) {
      console.error('关注操作失败:', error);
      throw error;
    }
  }
};

// 评论相关API
export const commentAPI = {
  // 获取视频评论数量
  getCommentCount: async (videoId: string): Promise<number> => {
    try {
      const response = await apiRequest(`/comments/${videoId}/count`);
      // 确保返回的是数字类型，处理可能的字符串、null、undefined
      let count = 0;
      if (response && response.success && response.count !== undefined && response.count !== null) {
        count = parseInt(String(response.count), 10);
        if (isNaN(count)) {
          count = 0;
        }
      }
      console.log(`📊 视频 ${videoId} 的评论数: ${count} (API返回: ${response.count})`);
      return count;
    } catch (error) {
      console.error('获取评论数量失败:', error);
      return 0;
    }
  },

  // 获取视频评论
  getVideoComments: async (videoId: string, page: number = 1, limit: number = 20): Promise<Comment[]> => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const response = await apiRequest(`/comments/${videoId}?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取评论列表失败:', error);
      return [];
    }
  },

  // 添加评论（支持回复和@用户名）
  addComment: async (
    videoId: string, 
    content: string, 
    parentCommentId?: string, 
    mentionedUserIds?: string[]
  ): Promise<Comment | null> => {
    try {
      const requestBody: any = {
        content,
        parentCommentId: parentCommentId || null
      };
      
      // 只有当mentionedUserIds存在且不为空时才添加到请求体
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        requestBody.mentionedUserIds = mentionedUserIds;
        console.log('📤 发送@用户ID列表:', mentionedUserIds);
      } else {
        console.log('ℹ️ 没有@用户，不发送mentionedUserIds');
      }
      
      const response = await apiRequest(`/comments/${videoId}`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      return response.success ? response.data : null;
    } catch (error) {
      console.error('添加评论失败:', error);
      throw error;
    }
  },

  // 删除评论
  deleteComment: async (commentId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/comments/comment/${commentId}`, {
        method: 'DELETE'
      });
      return response.success;
    } catch (error) {
      console.error('删除评论失败:', error);
      throw error;
    }
  },

  // 检查用户是否已评论
  hasCommented: async (videoId: string): Promise<{ commented: boolean; commentId: string | null }> => {
    try {
      const response = await apiRequest(`/comments/${videoId}/status`);
      return response.success ? { 
        commented: response.commented || false, 
        commentId: response.commentId || null 
      } : { commented: false, commentId: null };
    } catch (error: any) {
      // 401错误表示用户未登录，静默返回false
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        return { commented: false, commentId: null };
      }
      console.error('检查评论状态失败:', error);
      return { commented: false, commentId: null };
    }
  }
};

// 通知相关API
export const notificationAPI = {
  // 获取通知列表
  getNotifications: async (page: number = 1, limit: number = 20, unreadOnly: boolean = false): Promise<{
    data: any[];
    unreadCount: number;
    pagination: { page: number; limit: number };
  }> => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (unreadOnly) {
        params.append('unreadOnly', 'true');
      }
      
      const response = await apiRequest(`/notifications?${params.toString()}`);
      return response.success ? response : { data: [], unreadCount: 0, pagination: { page, limit } };
    } catch (error) {
      console.error('获取通知列表失败:', error);
      return { data: [], unreadCount: 0, pagination: { page, limit } };
    }
  },

  // 获取未读通知数量
  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await apiRequest('/notifications/unread-count');
      return response.success ? (response.count || 0) : 0;
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
      return 0;
    }
  },

  // 标记通知为已读
  markAsRead: async (notificationId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      return response.success;
    } catch (error) {
      console.error('标记通知为已读失败:', error);
      return false;
    }
  },

  // 标记所有通知为已读
  markAllAsRead: async (): Promise<boolean> => {
    try {
      const response = await apiRequest('/notifications/read-all', {
        method: 'PATCH'
      });
      return response.success;
    } catch (error) {
      console.error('标记所有通知为已读失败:', error);
      return false;
    }
  },

  // 删除通知
  deleteNotification: async (notificationId: string): Promise<boolean> => {
    try {
      const response = await apiRequest(`/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      return response.success;
    } catch (error) {
      console.error('删除通知失败:', error);
      return false;
    }
  }
};

// 用户相关API
export const userAPI = {
  // 获取用户统计数据
  getUserStats: async (): Promise<{
    totalLikes: number;
    publishedCount: number;
    followingCount: number;
    followersCount: number;
    favoritesCount: number;
  } | null> => {
    try {
      const response = await apiRequest('/users/stats');
      return response.success ? response.data : null;
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
      return null;
    }
  },

  // 获取用户发布记录
  getUserPublications: async (page: number = 1, limit: number = 20): Promise<Video[]> => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await apiRequest(`/users/publications?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取用户发布记录失败:', error);
      return [];
    }
  },

  // 获取观看历史
  getWatchHistory: async (page: number = 1, limit: number = 20): Promise<Video[]> => {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await apiRequest(`/users/watch-history?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('获取观看历史失败:', error);
      return [];
    }
  },

  // 搜索用户（用于@功能）
  searchUsers: async (query: string = '', limit: number = 20): Promise<User[]> => {
    try {
      const params = new URLSearchParams();
      if (query) {
        params.append('q', query);
      }
      params.append('limit', limit.toString());

      const response = await apiRequest(`/users/search?${params.toString()}`);
      return response.success ? response.data : [];
    } catch (error) {
      console.error('搜索用户失败:', error);
      return [];
    }
  }
};

// 文件上传API
export const uploadAPI = {
  // 上传视频文件
  uploadVideo: async (file: File): Promise<{ url: string; filename: string; size: number }> => {
    const formData = new FormData();
    formData.append('video', file);

    // 添加认证token
    const token = localStorage.getItem('sessionToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 规范化 URL：移除 baseUrl 末尾的斜杠，确保 endpoint 以斜杠开头
    const normalizedBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const response = await fetch(`${normalizedBaseUrl}/upload/video`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    const result = await response.json();
    return result.success ? result.data : null;
  },

  // 上传封面图片
  uploadCover: async (file: File): Promise<{ url: string; filename: string; size: number }> => {
    const formData = new FormData();
    formData.append('cover', file);

    // 添加认证token
    const token = localStorage.getItem('sessionToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 规范化 URL：移除 baseUrl 末尾的斜杠，确保 endpoint 以斜杠开头
    const normalizedBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const response = await fetch(`${normalizedBaseUrl}/upload/cover`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    const result = await response.json();
    return result.success ? result.data : null;
  }
};
