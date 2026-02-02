import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { userAPI, type Video as LeanCloudVideo } from '../services/leancloud';
import { toast } from 'sonner';

interface MyPublicationsProps {
  user: { email: string } | null;
  onBack: () => void;
  refreshTrigger?: number; // 添加刷新触发器
  initialTab?: 'all' | 'pending' | 'approved' | 'rejected';
}

// 前端使用的Publication类型
interface Publication {
  id: string;
  title: string;
  titleEn: string;
  coverUrl: string;
  videoUrl: string;
  status: '待审核' | '已发布' | '已驳回';
  uploadDate: string;
  viewCount: number;
  likeCount: number;
  category: string;
}

export function MyPublications({ user, onBack, refreshTrigger, initialTab = 'all' }: MyPublicationsProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>(initialTab);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载发布记录的函数
  const loadPublications = async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    try {
      const userVideos = await userAPI.getUserPublications();

      if (!Array.isArray(userVideos)) {
        console.error('API返回的数据不是数组:', userVideos);
        return;
      }

      // 转换数据格式
      const formattedPublications: Publication[] = userVideos.map(video => ({
          id: video.id,
          title: video.title,
          titleEn: video.titleEn || '',
          coverUrl: video.coverUrl,
          videoUrl: video.videoUrl,
          status: video.status,
          uploadDate: video.uploadDate,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          category: video.category?.nameCn || '未知分类'
      }));

      setPublications(formattedPublications);
    } catch (error) {
      console.error('加载发布记录失败:', error);
      toast.error('加载发布记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时刷新数据
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 监听refreshTrigger变化
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      // 延迟一小段时间确保后端数据已保存
      const timer = setTimeout(() => {
        loadPublications();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [refreshTrigger, user]);

  // 获取用户发布记录
  useEffect(() => {
    if (refreshKey > 0 && user) {
      loadPublications();
    }
  }, [user, refreshKey]);

  // 状态映射
  const statusMap = {
    '待审核': 'pending',
    '已发布': 'approved',
    '已驳回': 'rejected'
  };

  const filteredPublications =
    activeTab === 'all'
      ? publications
      : publications.filter((pub) => statusMap[pub.status] === activeTab);

  const tabs = [
    { id: 'all', label: language === 'zh' ? '全部' : 'All', count: publications.length },
    { id: 'pending', label: t.pending, count: publications.filter(p => p.status === '待审核').length },
    { id: 'approved', label: t.approved, count: publications.filter(p => p.status === '已发布').length },
    { id: 'rejected', label: t.rejected, count: publications.filter(p => p.status === '已驳回').length },
  ];

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 pb-20">
      {/* 顶部栏 */}
      <div className="flex items-center gap-4 p-4 border-b border-zinc-800">
        <button
          onClick={onBack}
          className="text-white hover:text-zinc-300 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-semibold text-lg">{t.myPublicationsTitle}</h1>
      </div>

      {/* 状态筛选标签 */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-orange-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 发布列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredPublications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 px-8">
            <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-center">{t.noPublications}</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {filteredPublications.map((publication) => (
              <PublicationCard key={publication.id} publication={publication} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PublicationCard({ publication }: { publication: Publication }) {
  const { t, language } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);

  const statusConfig = {
    pending: {
      label: t.pending,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    approved: {
      label: t.approved,
      color: 'bg-green-500',
      textColor: 'text-green-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    rejected: {
      label: t.rejected,
      color: 'bg-red-500',
      textColor: 'text-red-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const categoryLabels = {
    '科技': language === 'zh' ? '💻 科技' : '💻 ' + t.tech,
    '文化': language === 'zh' ? '🎨 文化' : '🎨 ' + t.arts,  // 修复：数据库中使用的是"文化"
    '艺术人文': language === 'zh' ? '🎨 艺术人文' : '🎨 ' + t.arts,  // 保留兼容性
    '商业': language === 'zh' ? '💼 商业' : '💼 ' + t.business,  // 修复：数据库中使用的是"商业"
    '商业业务': language === 'zh' ? '💼 商业业务' : '💼 ' + t.business,  // 保留兼容性
  };

  // 状态映射：中文 -> 英文key
  const statusKeyMap = {
    '待审核': 'pending',
    '已发布': 'approved',
    '已驳回': 'rejected',
  };

  const statusKey = statusKeyMap[publication.status] || 'pending';
  const config = statusConfig[statusKey];

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* 缩略图 */}
        <div className="w-32 h-24 bg-zinc-700 rounded-lg flex-shrink-0 overflow-hidden">
          <img
            src={publication.thumbnail}
            alt={publication.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* 内容信息 */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="text-white font-medium text-sm line-clamp-2 mb-1">
              {publication.title}
            </h3>
            <p className="text-zinc-500 text-xs mb-2">
              {categoryLabels[publication.category]}
            </p>
          </div>

          {/* 状态标签 */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 ${config.textColor}`}>
              {config.icon}
              <span className="text-xs font-medium">{config.label}</span>
            </div>
            <span className="text-zinc-600 text-xs">·</span>
            <span className="text-zinc-500 text-xs">{publication.submittedAt}</span>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {publication.status === 'rejected' && (
        <div className="border-t border-zinc-700">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full px-3 py-2 flex items-center justify-between text-zinc-400 hover:text-white transition-colors"
          >
            <span className="text-sm">{language === 'zh' ? '查看拒绝原因' : 'View Rejection Reason'}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetails && (
            <div className="px-3 pb-3">
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <p className="text-red-400 text-xs leading-relaxed">
                  {publication.rejectionReason}
                </p>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-2 rounded-lg transition-colors">
                    {language === 'zh' ? '重新提交' : 'Resubmit'}
                  </button>
                  <button className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-2 rounded-lg transition-colors">
                    {language === 'zh' ? '删除' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 已通过的操作按钮 */}
      {publication.status === 'approved' && (
        <div className="border-t border-zinc-700 p-3">
          <button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white text-sm py-2 rounded-lg transition-colors">
            {language === 'zh' ? '查看数据' : 'View Data'}
          </button>
        </div>
      )}
    </div>
  );
}