import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Save, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { promptAPI } from '../services/leancloud';

export function PromptManagement() {
  const [bookDecompositionPrompt, setBookDecompositionPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 默认的书籍拆解prompt模板
  const defaultPrompt = `你是一位拥有十年经验的资深书籍解读人，擅长将复杂的书本思想转化为直击人心的故事。请根据我上传的书籍文件为我深度拆解成{segments}视频脚本，目标是创作一段"让人看完久久不能平静"的视频脚本。

请遵循以下要求：
1. **角色设定**：你不是在做学术报告，而是一位"灵魂摆渡人"式的讲述者——温柔、深刻、有洞察力，能看透人性的脆弱与光辉。
2. **选择书籍**：上传的书籍《{bookTitle}》。
3. **脚本风格**：
   - 情感真挚，语言富有文学性与哲思；
   - 能引发观众强烈共鸣，甚至落泪；
   - 不仅讲"书说了什么"，更要讲"它如何照见我们的人生"。
4. **结构设计（每段视频2分钟左右）**：
   - 【开场】：用一句极具冲击力的提问或金句抓住注意力，制造悬念；
   - 【中段】：以故事化方式讲述书中核心情节或思想；
   - 【高潮】：情感升华，将书的主题与现代人内心的孤独、挣扎、希望连接起来；
   - 【结尾】：温柔收尾，给出一句治愈人心的结语，并自然引导点赞收藏。
5. **输出格式**：
   - 脚本只需包含旁白；
   - 语言口语化。

书籍内容：
{bookContent}

现在，请为我生成这样{segments}刻骨铭心的书籍讲解视频脚本。每集需要包含：

1. chapterTitle (Chinese) - 本集标题（中文），具有吸引力和概括性
2. chapterTitleEn (English) - Episode Title (English) - REQUIRED
3. summary (Chinese, 约200字) - 本集的核心内容总结，包含开场、中段、高潮、结尾的完整内容。要具体、有价值，避免概括性表述。直接阐述核心思想和洞察，不要使用"本书认为"、"作者指出"等表述。语言要富有情感和文学性。
4. summaryEn (English, 约200-300字) - Summary (English) - 完整翻译中文summary，保持所有细节和情感色彩 - REQUIRED
5. avatarDescription (description of gender, age, profession, style) - 数字人形象描述，应该是一位温柔、深刻、有洞察力的讲述者
6. estimatedDuration (seconds) - 预计视频时长（秒），约120秒（2分钟）

IMPORTANT: 
- You MUST provide English translations (chapterTitleEn, summaryEn) for ALL segments. Do not skip any English fields.
- The summary should reflect the emotional depth and literary quality described above.
- Extract ESSENCE and CORE IDEAS, NOT general summaries or overviews.
- Be SPECIFIC and CONCRETE. Avoid vague statements.
- Focus on EMOTIONAL resonance and HUMAN insights that connect the book's themes to modern life.
- Language should be conversational, literary, and philosophical.

Return in JSON format:
{
  "segments": [
    {
      "chapterTitle": "Episode标题（具有吸引力和概括性）",
      "chapterTitleEn": "Episode Title",
      "summary": "核心内容总结（约200字，包含开场、中段、高潮、结尾的完整内容，富有情感和文学性）",
      "summaryEn": "Summary (complete English translation, maintaining all details and emotional depth from Chinese summary, approximately 200-300 words)",
      "avatarDescription": "形象描述（温柔、深刻、有洞察力的讲述者）",
      "estimatedDuration": 120
    }
  ]
}`;

  // 加载prompt配置
  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    try {
      setLoading(true);
      const data = await promptAPI.getBookDecompositionPrompt();
      if (data && data.prompt) {
        setBookDecompositionPrompt(data.prompt);
      } else {
        // 如果没有保存的prompt，使用默认值
        setBookDecompositionPrompt(defaultPrompt);
      }
    } catch (error: any) {
      // 404错误是正常的（配置不存在），静默处理，使用默认值
      if (error.status === 404 || (error.message && error.message.includes('不存在'))) {
        console.log('No saved prompt configuration found, using default template');
        setBookDecompositionPrompt(defaultPrompt);
      } else {
        // 其他错误才显示提示
        console.error('Failed to load prompt:', error);
        setBookDecompositionPrompt(defaultPrompt);
        toast.error('Failed to load prompt configuration, using default template');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!bookDecompositionPrompt.trim()) {
      toast.error('Prompt content cannot be empty');
      return;
    }

    try {
      setSaving(true);
      await promptAPI.saveBookDecompositionPrompt(bookDecompositionPrompt);
      toast.success('Prompt configuration saved successfully');
    } catch (error: any) {
      console.error('Failed to save prompt:', error);
      toast.error(error.message || 'Failed to save, please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to the default template? Your current changes will be lost.')) {
      setBookDecompositionPrompt(defaultPrompt);
      toast.info('Reset to default template');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Prompt Management</h1>
          <p className="text-muted-foreground mt-1">Manage book decomposition prompt configuration</p>
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Prompt Management</h1>
          <p className="text-muted-foreground mt-1">Manage book decomposition prompt configuration, customize and save</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadPrompt} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <Label className="text-lg font-semibold">Book Decomposition Prompt Template</Label>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This prompt is used for book decomposition to generate video scripts. The following variables are supported:
            </p>
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-2">Available Variables:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="bg-background px-1 py-0.5 rounded">&#123;segments&#125;</code> - Number of video segments (e.g., 5, 10, 20, 30)</li>
                <li><code className="bg-background px-1 py-0.5 rounded">&#123;bookTitle&#125;</code> - Book title</li>
                <li><code className="bg-background px-1 py-0.5 rounded">&#123;bookContent&#125;</code> - Book content text</li>
              </ul>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt Content</Label>
            <Textarea
              id="prompt"
              value={bookDecompositionPrompt}
              onChange={(e) => setBookDecompositionPrompt(e.target.value)}
              placeholder="Enter book decomposition prompt..."
              className="min-h-[600px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Character count: {bookDecompositionPrompt.length}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={handleReset} variant="outline">
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <div className="space-y-2">
          <h3 className="font-semibold">Usage Instructions</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>After modifying the prompt template, click the "Save Configuration" button to save changes</li>
            <li>The saved prompt will be used in the next book decomposition</li>
            <li>You can use variables <code className="bg-background px-1 py-0.5 rounded">&#123;segments&#125;</code>, <code className="bg-background px-1 py-0.5 rounded">&#123;bookTitle&#125;</code>, and <code className="bg-background px-1 py-0.5 rounded">&#123;bookContent&#125;</code> to dynamically insert content</li>
            <li>Click "Reset to Default" to restore the system default template</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

