import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { notificationAPI } from '../services/leancloud';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'mention' | 'reply' | 'like' | 'follow';
  content: {
    zh: string;
    en: string;
  };
  relatedUser?: {
    id: string;
    username: string;
    email: string;
  } | null;
  relatedVideo?: {
    id: string;
    title: string;
    titleEn?: string;
  } | null;
  relatedComment?: {
    id: string;
    content: string;
  } | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);

  // 加载通知列表
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const result = await notificationAPI.getNotifications(1, 20);
      setNotifications(result.data || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载未读数量
  const loadUnreadCount = async () => {
    try {
      const count = await notificationAPI.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadUnreadCount();
    // 每30秒刷新一次未读数量
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // 打开通知列表时加载
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // 标记通知为已读
  const handleMarkAsRead = async (notificationId: string) => {
    if (markingAsRead === notificationId) return;
    
    setMarkingAsRead(notificationId);
    try {
      const success = await notificationAPI.markAsRead(notificationId);
      if (success) {
        setNotifications(notifications.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('标记通知为已读失败:', error);
      toast.error(language === 'zh' ? '操作失败' : 'Operation failed');
    } finally {
      setMarkingAsRead(null);
    }
  };

  // 标记所有通知为已读
  const handleMarkAllAsRead = async () => {
    try {
      const success = await notificationAPI.markAllAsRead();
      if (success) {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success(language === 'zh' ? '已标记全部为已读' : 'All marked as read');
      }
    } catch (error) {
      console.error('标记全部为已读失败:', error);
      toast.error(language === 'zh' ? '操作失败' : 'Operation failed');
    }
  };

  // 删除通知
  const handleDelete = async (notificationId: string) => {
    try {
      const success = await notificationAPI.deleteNotification(notificationId);
      if (success) {
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && !notification.isRead) {
          setUnreadCount(Math.max(0, unreadCount - 1));
        }
        setNotifications(notifications.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('删除通知失败:', error);
      toast.error(language === 'zh' ? '删除失败' : 'Delete failed');
    }
  };

  // 格式化时间
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return language === 'zh' ? '刚刚' : 'Just now';
    } else if (diffMins < 60) {
      return language === 'zh' ? `${diffMins}分钟前` : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return language === 'zh' ? `${diffHours}小时前` : `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return language === 'zh' ? `${diffDays}天前` : `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  return (
    <>
      {/* 小铃铛图标 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative ${className}`}
        aria-label={language === 'zh' ? '通知' : 'Notifications'}
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* 未读数量徽章 */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知列表抽屉 */}
      {isOpen && createPortal(
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed' }}
          />

          {/* 抽屉内容 */}
          <div
            className="fixed inset-x-0 bottom-0 max-w-[480px] mx-auto bg-zinc-900 rounded-t-3xl flex flex-col"
            style={{
              maxHeight: '80vh',
              height: 'auto',
              zIndex: 9999,
              position: 'fixed'
            }}
          >
            {/* 顶部拖拽条和标题 */}
            <div className="flex items-center justify-between px-4 pt-3 pb-4 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white text-lg font-semibold">
                  {language === 'zh' ? '通知' : 'Notifications'}
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-blue-400 text-sm hover:text-blue-300"
                  >
                    {language === 'zh' ? '全部已读' : 'Mark all read'}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-zinc-400 text-sm">
                    {language === 'zh' ? '加载中...' : 'Loading...'}
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-zinc-400 text-sm">
                    {language === 'zh' ? '暂无通知' : 'No notifications'}
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const content = notification.content[language] || notification.content.en || notification.content.zh;
                  const isUnread = !notification.isRead;

                  return (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isUnread
                          ? 'bg-blue-900/20 border-blue-700/50'
                          : 'bg-zinc-800/50 border-zinc-700'
                      }`}
                      onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isUnread ? 'text-white font-medium' : 'text-zinc-300'}`}>
                            {content}
                          </p>
                          {notification.relatedVideo && (
                            <p className="text-zinc-400 text-xs mt-1 truncate">
                              {language === 'zh' ? notification.relatedVideo.title : (notification.relatedVideo.titleEn || notification.relatedVideo.title)}
                            </p>
                          )}
                          <p className="text-zinc-500 text-xs mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isUnread && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                            className="text-zinc-400 hover:text-red-400 transition-colors text-xs"
                          >
                            {language === 'zh' ? '删除' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

