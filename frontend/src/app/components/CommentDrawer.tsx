import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { authAPI, commentAPI, userAPI, User } from '../services/leancloud';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  user: User;
  createdAt: string;
  updatedAt: string;
  parentCommentId?: string | null;
  parentUsername?: string | null;
  parentUserId?: string | null;
  mentionedUserIds?: string[];
}

interface Video {
  id: string;
  title: string;
  titleEn?: string;
  author: string;
  authorId?: string; // 视频作者ID
  avatar: string;
  comments: number;
  isFollowing?: boolean;
}

interface CommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video;
  onCommentAdded?: () => void; // 评论添加后的回调
}

// 生成首字母头像的函数
const getInitialsAvatar = (username: string): string => {
  if (!username) return 'U';
  
  // 分割用户名，获取首字母
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    // 如果有多个单词，取每个单词的首字母（如 "Sam Wang" -> "SW"）
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else {
    // 如果只有一个单词，取前两个字符（如 "Sam" -> "SA"）
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

export function CommentDrawer({ isOpen, onClose, video, onCommentAdded }: CommentDrawerProps) {
  const { t, language } = useLanguage();
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [canComment, setCanComment] = useState(true); // 默认允许评论
  const [hasCommented, setHasCommented] = useState(false); // 是否已评论（已移除限制，但保留状态用于UI）
  const [userCommentId, setUserCommentId] = useState<string | null>(null); // 用户的评论ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // 当前用户ID
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null); // 正在删除的评论ID
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null); // 正在回复的评论
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // @搜索查询，null表示没有@输入
  const [showMentionList, setShowMentionList] = useState(false); // 显示@用户列表
  const [mentionPosition, setMentionPosition] = useState(0); // @在文本中的位置
  const [availableUsers, setAvailableUsers] = useState<User[]>([]); // 可@的用户列表
  const [allUsers, setAllUsers] = useState<User[]>([]); // 所有用户列表（从后台管理获取）

  // 获取评论列表
  useEffect(() => {
    const loadComments = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const commentList = await commentAPI.getVideoComments(video.id);
        setComments(commentList);
      } catch (error) {
        console.error('获取评论失败:', error);
        toast.error(language === 'zh' ? '获取评论失败' : 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [isOpen, video.id, language]);

  // 获取用户评论权限和评论状态
  useEffect(() => {
    const checkCommentPermissionAndStatus = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser();
        if (currentUser) {
          // 只有登录用户且有评论权限才能评论
          setCanComment(currentUser.canComment !== false);
          setCurrentUserId(currentUser.id);
          
          // 检查用户是否已评论过这个视频
          const commentStatus = await commentAPI.hasCommented(video.id);
          setHasCommented(commentStatus.commented);
          setUserCommentId(commentStatus.commentId);
        } else {
          // 未登录用户不能评论
          setCanComment(false);
          setHasCommented(false);
          setUserCommentId(null);
          setCurrentUserId(null);
        }
      } catch (error) {
        console.error('获取用户权限失败:', error);
        // 如果获取失败，默认不允许评论（需要登录）
        setCanComment(false);
        setHasCommented(false);
        setUserCommentId(null);
        setCurrentUserId(null);
      }
    };

    if (isOpen) {
      checkCommentPermissionAndStatus();
    }
  }, [isOpen, video.id]);

  // 获取所有用户列表（从后台管理）
  useEffect(() => {
    const loadAllUsers = async () => {
      if (!isOpen) return;
      
      try {
        // 获取所有用户（不传搜索参数，获取前50个用户）
        const users = await userAPI.searchUsers('', 50);
        setAllUsers(users);
        console.log('📋 加载用户列表（从后台管理）:', { count: users.length, users: users.map(u => u.username) });
      } catch (error) {
        console.error('获取用户列表失败:', error);
        // 如果获取失败，使用空数组
        setAllUsers([]);
      }
    };

    loadAllUsers();
  }, [isOpen]);

  // 处理@输入，搜索用户（从后台管理的用户列表搜索）
  useEffect(() => {
    const handleMentionSearch = async () => {
      // 重要：只有当mentionQuery不为null且不为空字符串时才显示用户列表
      // mentionQuery为null时，表示没有@输入，不显示列表
      // mentionQuery为空字符串时，也不显示列表（避免一点开comment就显示）
      if (!mentionQuery || mentionQuery.trim().length === 0) {
        setAvailableUsers([]);
        setShowMentionList(false);
        return;
      }

      try {
        const query = mentionQuery.trim().toLowerCase();
        
        // 如果allUsers为空，先尝试从API获取
        let usersToSearch = allUsers;
        if (usersToSearch.length === 0) {
          usersToSearch = await userAPI.searchUsers('', 50);
          setAllUsers(usersToSearch);
        }

        // 从后台管理的用户列表中搜索匹配的用户
        const matchedUsers = usersToSearch.filter(user => {
          const username = user.username?.toLowerCase() || '';
          // 模糊匹配：用户名包含查询字符串的任何部分
          return username.includes(query);
        });

        // 按匹配度排序（优先级：完全匹配 > 开头匹配 > 包含匹配）
        matchedUsers.sort((a, b) => {
          const aUsername = a.username?.toLowerCase() || '';
          const bUsername = b.username?.toLowerCase() || '';
          
          // 完全匹配优先
          if (aUsername === query && bUsername !== query) return -1;
          if (aUsername !== query && bUsername === query) return 1;
          
          // 开头匹配次优先
          const aStartsWith = aUsername.startsWith(query);
          const bStartsWith = bUsername.startsWith(query);
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // 按匹配位置排序（匹配位置越靠前越好）
          const aIndex = aUsername.indexOf(query);
          const bIndex = bUsername.indexOf(query);
          if (aIndex !== bIndex) return aIndex - bIndex;
          
          // 最后按字母顺序排序
          return aUsername.localeCompare(bUsername);
        });

        const displayUsers = matchedUsers.slice(0, 10); // 最多显示10个
        setAvailableUsers(displayUsers);
        setShowMentionList(displayUsers.length > 0);
        
        console.log('🔍 @搜索用户（从后台管理）:', {
          query: mentionQuery,
          totalUsers: usersToSearch.length,
          matchedUsers: matchedUsers.length,
          displayUsers: displayUsers.length,
          users: displayUsers.map(u => u.username)
        });
      } catch (error) {
        console.error('搜索用户失败:', error);
        setShowMentionList(false);
        setAvailableUsers([]);
      }
    };

    handleMentionSearch();
  }, [mentionQuery, allUsers, currentUserId]);

  // 提取@的用户ID（从后台管理的用户列表中查找）
  const extractMentionedUserIds = (text: string): string[] => {
    // 匹配@用户名（支持字母、数字、下划线、中文字符和空格）
    const mentionRegex = /@([\w\u4e00-\u9fa5\s]+)/g;
    const mentionedUsernames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedUsernames.push(match[1].trim());
    }

    console.log('🔍 提取的@用户名:', mentionedUsernames);
    console.log('👥 所有用户列表:', allUsers.map(u => ({ id: u.id, username: u.username })));

    // 从后台管理的用户列表中找到对应的用户ID
    const mentionedIds: string[] = [];
    mentionedUsernames.forEach(username => {
      const user = allUsers.find(u => {
        // 精确匹配或忽略大小写匹配
        const match = u.username === username || 
                     u.username?.toLowerCase() === username.toLowerCase() ||
                     u.username?.trim() === username.trim();
        return match;
      });
      if (user) {
        console.log(`✅ 找到用户: ${username} -> ID: ${user.id}`);
        if (!mentionedIds.includes(user.id)) {
          mentionedIds.push(user.id);
        }
      } else {
        console.warn(`⚠️ 未找到用户: ${username}`);
      }
    });

    console.log('📋 最终提取的用户ID列表:', mentionedIds);
    return mentionedIds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !canComment || submitting) return;

    setSubmitting(true);
    try {
      // 提取@的用户ID
      const mentionedUserIds = extractMentionedUserIds(commentText);
      
      // 添加评论（支持回复和@）
      const newComment = await commentAPI.addComment(
        video.id,
        commentText.trim(),
        replyingTo?.id || undefined,
        mentionedUserIds.length > 0 ? mentionedUserIds : undefined
      );

      if (newComment) {
        // 重新加载评论列表以获取完整的层级结构
        const commentList = await commentAPI.getVideoComments(video.id);
        setComments(commentList);
        setCommentText('');
        setReplyingTo(null);
        setShowMentionList(false);
        setMentionQuery(null);
        toast.success(language === 'zh' ? '评论成功' : 'Comment added');
        // 通知父组件评论已添加
        if (onCommentAdded) {
          onCommentAdded();
        }
      }
    } catch (error: any) {
      console.error('添加评论失败:', error);
      if (error?.status === 403 || error?.message?.includes('permission')) {
        toast.error(language === 'zh' ? '您没有评论权限' : 'You do not have permission to comment');
        setCanComment(false);
      } else {
        toast.error(language === 'zh' ? '评论失败，请重试' : 'Failed to add comment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 处理回复按钮点击
  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.user.username} `);
    // 聚焦到输入框（需要延迟以确保DOM更新）
    setTimeout(() => {
      const input = document.querySelector('.comment-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 100);
  };

  // 取消回复
  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
    setShowMentionList(false);
    setMentionQuery(null);
  };

  // 处理输入变化，检测@符号
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommentText(value);

    // 检测@符号
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // 如果@后面没有空格、换行符或另一个@，说明正在输入用户名
      // 注意：允许空格，因为用户名可能包含空格（如@Bruce Chen）
      if (!textAfterAt.includes('\n') && !textAfterAt.includes('@')) {
        // 提取@后的查询字符串（保留空格，因为用户名可能包含空格）
        const query = textAfterAt; // 不trim，保留空格以便匹配"Bruce Chen"这样的用户名
        setMentionQuery(query); // 设置查询字符串（可能为空，表示刚输入@）
        setMentionPosition(lastAtIndex);
        console.log('📝 检测到@输入:', { query, position: lastAtIndex, textAfterAt });
      } else {
        // @后面有换行符或另一个@，关闭列表
        setShowMentionList(false);
        setMentionQuery(null);
      }
    } else {
      // 没有@符号，关闭列表
      setShowMentionList(false);
      setMentionQuery(null);
    }
  };

  // 选择@的用户
  const handleSelectMention = (user: User) => {
    const textBeforeAt = commentText.substring(0, mentionPosition);
    const queryLength = mentionQuery ? mentionQuery.length : 0;
    const textAfterAt = commentText.substring(mentionPosition + 1 + queryLength);
    const newText = `${textBeforeAt}@${user.username} ${textAfterAt}`;
    setCommentText(newText);
    setShowMentionList(false);
    setMentionQuery(null);
    
    // 聚焦到输入框
    setTimeout(() => {
      const input = document.querySelector('.comment-input') as HTMLInputElement;
      if (input) {
        input.focus();
        const newPosition = textBeforeAt.length + user.username.length + 2; // +2 for @ and space
        input.setSelectionRange(newPosition, newPosition);
      }
    }, 100);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (deleting || !commentId) return;

    setDeleting(commentId);
    try {
      const success = await commentAPI.deleteComment(commentId);
      if (success) {
        // 从评论列表中移除
        setComments(comments.filter(c => c.id !== commentId));
        setHasCommented(false);
        setUserCommentId(null);
        toast.success(language === 'zh' ? '评论已删除' : 'Comment deleted');
        // 通知父组件评论已删除
        if (onCommentAdded) {
          onCommentAdded();
        }
      }
    } catch (error: any) {
      console.error('删除评论失败:', error);
      if (error?.status === 403) {
        toast.error(language === 'zh' ? '您只能删除自己的评论' : 'You can only delete your own comments');
      } else {
        toast.error(language === 'zh' ? '删除失败，请重试' : 'Failed to delete comment');
      }
    } finally {
      setDeleting(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
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
        {/* 顶部拖拽条 */}
        <div className="flex items-center justify-center py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="w-12 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* 评论标题栏 */}
        <div className="px-4 pt-3 pb-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          {/* 评论数量 */}
          <div className="text-white text-sm font-medium">
            {comments.length} {language === 'zh' ? '条评论' : 'Comments'}
          </div>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4" style={{ minHeight: 0, maxHeight: 'calc(80vh - 200px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-zinc-400 text-sm">
                {language === 'zh' ? '加载中...' : 'Loading...'}
              </p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-zinc-400 text-sm">
                {language === 'zh' ? '暂无评论，快来发表第一条评论吧！' : 'No comments yet. Be the first to comment!'}
              </p>
            </div>
          ) : (
            (() => {
              // 组织评论为层级结构
              const parentComments = comments.filter(c => !c.parentCommentId);
              const repliesMap = new Map<string, Comment[]>();
              comments.filter(c => c.parentCommentId).forEach(reply => {
                const parentId = reply.parentCommentId!;
                if (!repliesMap.has(parentId)) {
                  repliesMap.set(parentId, []);
                }
                repliesMap.get(parentId)!.push(reply);
              });

              // 渲染评论内容（支持@高亮，包括带空格的用户名如@Bruce Chen）
              const renderCommentContent = (content: string, mentionedUserIds?: string[]) => {
                if (!content) return <></>;
                
                // 使用正则表达式匹配@用户名（支持字母、数字、下划线、中文字符和空格）
                // 匹配格式：@用户名（用户名可以包含字母、数字、下划线、中文字符和空格）
                // 例如：@Bruce Chen, @张三, @user123, @Bruce_Chen
                const mentionRegex = /@([\w\u4e00-\u9fa5\s]+)/g;
                const parts: (string | JSX.Element)[] = [];
                let lastIndex = 0;
                let match;
                let keyIndex = 0;

                while ((match = mentionRegex.exec(content)) !== null) {
                  // 添加@之前的文本
                  if (match.index > lastIndex) {
                    parts.push(<span key={`text-${keyIndex++}`}>{content.substring(lastIndex, match.index)}</span>);
                  }
                  
                  // 添加@用户名（蓝色高亮）
                  const fullMatch = match[0]; // 包含@的完整匹配，如"@Bruce Chen"
                  parts.push(
                    <span key={`mention-${keyIndex++}`} className="text-blue-400 font-medium">
                      {fullMatch}
                    </span>
                  );
                  
                  lastIndex = mentionRegex.lastIndex;
                }
                
                // 添加剩余的文本
                if (lastIndex < content.length) {
                  parts.push(<span key={`text-${keyIndex++}`}>{content.substring(lastIndex)}</span>);
                }
                
                // 如果没有匹配到任何@，直接返回原文本
                if (parts.length === 0) {
                  return <>{content}</>;
                }
                
                return <>{parts}</>;
              };

              // 渲染单个评论
              const renderComment = (comment: Comment, isReply: boolean = false) => {
              const initials = getInitialsAvatar(comment.user.username);
              const avatarColor = getAvatarColor(comment.user.username);
                const isOwnComment = currentUserId && comment.user.id === currentUserId;
                const replies = repliesMap.get(comment.id) || [];
              
              return (
                  <div key={comment.id} className={isReply ? 'ml-8 mt-3' : ''}>
                    <div className="flex gap-3 items-start">
                  {/* 头像 - 首字母头像 */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColor} text-white text-sm font-semibold`}>
                    {initials}
                  </div>
                  {/* 评论内容区域 */}
                  <div className="flex-1 min-w-0">
                        {/* 用户名和操作按钮 */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{comment.user.username}</p>
                            {comment.parentUsername && (
                              <span className="text-zinc-400 text-xs">
                                {language === 'zh' ? '回复' : 'replied to'} @{comment.parentUsername}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {canComment && !isOwnComment && (
                              <button
                                onClick={() => handleReply(comment)}
                                className="text-zinc-400 hover:text-blue-400 transition-colors text-xs"
                              >
                                {language === 'zh' ? '回复' : 'Reply'}
                              </button>
                            )}
                            {isOwnComment && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deleting === comment.id}
                                className="text-zinc-400 hover:text-red-500 transition-colors text-xs disabled:opacity-50"
                              >
                                {deleting === comment.id 
                                  ? (language === 'zh' ? '删除中...' : 'Deleting...')
                                  : (language === 'zh' ? '删除' : 'Delete')
                                }
                              </button>
                            )}
                          </div>
                        </div>
                    {/* 评论内容 */}
                        <p className="text-white text-sm mb-2 break-words leading-relaxed">
                          {renderCommentContent(comment.content, comment.mentionedUserIds)}
                        </p>
                  </div>
                    </div>
                    {/* 回复列表 */}
                    {replies.length > 0 && (
                      <div className="mt-2">
                        {replies.map(reply => renderComment(reply, true))}
                      </div>
                    )}
                </div>
              );
              };

              return parentComments.map(comment => renderComment(comment));
            })()
          )}
        </div>

        {/* 评论输入框 */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900">
          {!canComment && (
            <div className="mb-3 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <p className="text-zinc-400 text-sm text-center">
                {language === 'zh' ? '您没有评论权限，请联系管理员开通' : 'You do not have permission to comment. Please contact administrator.'}
              </p>
            </div>
          )}
          {replyingTo && (
            <div className="mb-3 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg flex items-center justify-between">
              <p className="text-blue-300 text-sm">
                {language === 'zh' ? `回复 @${replyingTo.user.username}` : `Replying to @${replyingTo.user.username}`}
              </p>
              <button
                onClick={handleCancelReply}
                className="text-blue-300 hover:text-blue-200 text-xs"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          )}
          <div className="relative">
            <input
              type="text"
              value={commentText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                // 如果按ESC键，关闭@列表
                if (e.key === 'Escape') {
                  setShowMentionList(false);
                  setMentionQuery(null);
                }
                // 如果按Enter且@列表显示，阻止默认提交并选择第一个用户
                if (e.key === 'Enter' && showMentionList && availableUsers.length > 0) {
                  e.preventDefault();
                  handleSelectMention(availableUsers[0]);
                }
              }}
              placeholder={
                !canComment 
                  ? (language === 'zh' ? '您没有评论权限' : 'No permission to comment')
                  : replyingTo
                  ? (language === 'zh' ? `回复 @${replyingTo.user.username}...` : `Reply to @${replyingTo.user.username}...`)
                  : (language === 'zh' ? '说点什么...输入@可以@用户' : 'Say something...Type @ to mention users')
              }
              disabled={!canComment}
              className={`comment-input flex-1 w-full bg-zinc-800 text-white placeholder:text-zinc-400 px-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !canComment ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            {/* @用户列表 */}
            {showMentionList && availableUsers.length > 0 && (
              <div 
                className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                style={{ 
                  zIndex: 10000,
                  position: 'absolute',
                  maxWidth: '100%'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                {/* 搜索提示 */}
                {mentionQuery && mentionQuery.trim().length > 0 && (
                  <div className="px-4 py-2 text-xs text-zinc-400 border-b border-zinc-700 bg-zinc-800/50">
                    {language === 'zh' 
                      ? `搜索: "${mentionQuery}" (找到 ${availableUsers.length} 个用户)` 
                      : `Search: "${mentionQuery}" (${availableUsers.length} users found)`
                    }
                  </div>
                )}
                {availableUsers.map((user, index) => {
                  // 高亮匹配的部分
                  const highlightUsername = (username: string, query: string) => {
                    if (!query || !query.trim()) return <>{username}</>;
                    const lowerUsername = username.toLowerCase();
                    const lowerQuery = query.toLowerCase().trim();
                    const index = lowerUsername.indexOf(lowerQuery);
                    if (index === -1) return <>{username}</>;
                    
                    return (
                      <>
                        {username.substring(0, index)}
                        <span className="text-blue-400 font-semibold">
                          {username.substring(index, index + query.length)}
                        </span>
                        {username.substring(index + query.length)}
                      </>
                    );
                  };

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectMention(user);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors flex items-center gap-2 cursor-pointer ${
                        index === 0 ? 'bg-zinc-700/20' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(user.username || '')} text-white text-xs font-semibold`}>
                        {getInitialsAvatar(user.username || '')}
                      </div>
                      <span className="text-white text-sm">
                        {highlightUsername(user.username || '', mentionQuery)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* 调试信息（开发环境） */}
            {process.env.NODE_ENV === 'development' && showMentionList && (
              <div className="absolute top-full left-0 mt-1 text-xs text-zinc-400 bg-zinc-900/90 px-2 py-1 rounded whitespace-nowrap" style={{ zIndex: 10001 }}>
                查询: "{mentionQuery}", 找到 {availableUsers.length} 个用户
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="submit"
              disabled={!commentText.trim() || !canComment || submitting}
              className="bg-blue-600 text-white px-6 py-3 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {submitting ? (language === 'zh' ? '发送中...' : 'Sending...') : t.send}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}