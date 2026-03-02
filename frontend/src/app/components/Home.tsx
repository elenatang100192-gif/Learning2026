import { useState } from 'react';
import { VideoFeed } from './VideoFeed';
import { useLanguage } from '../contexts/LanguageContext';

type Category = 'Tech' | 'Culture' | 'Business';

interface HomeProps {
  userEmail?: string | null;
  playVideoId?: string | null; // 要播放的视频ID
  onVideoPlayed?: () => void; // 视频播放后的回调
}

export function Home({ userEmail, playVideoId, onVideoPlayed }: HomeProps = {}) {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<Category>('Tech');

  const categories: { id: Category; label: string }[] = [
    { id: 'Tech', label: t.tech },
    { id: 'Culture', label: t.arts },
    { id: 'Business', label: t.business },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* 顶部分类导航 - 使用 fixed 定位确保在移动端可见 */}
      <div className="fixed top-0 left-0 right-0 z-50 pb-2 pt-safe pointer-events-none max-w-[480px] mx-auto">
        {/* 背景遮罩 - 增强遮罩效果 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/90 to-black/60 backdrop-blur-sm" />
        {/* 底部渐变遮罩，确保与视频内容过渡自然 */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-black/40" />
        <div className="relative flex items-center justify-center px-4 py-3 pointer-events-auto">
          {/* 分类导航 */}
          <div className="flex items-center gap-3 sm:gap-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex flex-col items-center gap-1 transition-all min-w-[60px] ${
                  activeCategory === category.id
                    ? 'text-white scale-110'
                    : 'text-white/70 scale-100'
                }`}
              >
                <span className="text-sm font-medium whitespace-nowrap">{category.label}</span>
                {activeCategory === category.id && (
                  <div className="w-full h-0.5 bg-orange-500 rounded-full mt-1" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* 占位空间，避免内容被顶部导航遮挡 */}
      <div className="h-16 flex-shrink-0" />

      {/* 视频内容区 */}
      <VideoFeed category={activeCategory} playVideoId={playVideoId} onVideoPlayed={onVideoPlayed} />
    </div>
  );
}