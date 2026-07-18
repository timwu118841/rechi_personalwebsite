import { createClient, type Session } from '@supabase/supabase-js';
import {
  type ButtonHTMLAttributes,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Category, MediaAsset, SiteSettings } from '@/lib/content/types';
import '@/styles/admin.css';
import { renderMarkdown } from '@/lib/content/markdown';

interface Props {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  passwordLoginEnabled?: boolean;
}

interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  bodyJson?: unknown;
  status: 'draft' | 'published' | 'unpublished';
  publicationVersion?: number;
  publishedAt: string;
  contentType: string;
  category: string;
  tags: string[];
  featured: boolean;
  cover?: MediaAsset;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  privacyReviewed: boolean;
  legalReviewed: boolean;
}

type Tab = 'articles' | 'site' | 'taxonomies';

type DashboardApi = <T>(path: string, init?: RequestInit) => Promise<T>;
type ShowToast = (kind: ToastKind, message: string) => void;

interface NotionSourceStatus {
  id: string;
  external_id: string;
  state: string;
  article_id?: string | null;
  last_synced_at?: string | null;
  working_copy_id?: string | null;
  working_copy_version?: number | null;
  manual_summary?: string | null;
  slug?: string | null;
  category_slug?: string | null;
  tags?: string[];
  name?: string | null;
  title?: string | null;
  page_title?: string | null;
}

interface PublicationCandidateStatus {
  id: string;
  source_revision_id: string;
  working_copy_version: number;
  candidate_hash: string;
  state: string;
  activation_at?: string;
  title: string;
  failure_reason?: string | null;
}

interface WorkerResult {
  claimed: number;
  completed: number;
  failed: number;
  exhaustedBudget: boolean;
}

interface PublicationJob {
  id?: string;
  job_id?: string;
  candidate_id?: string | null;
  state?: string;
  error?: string | null;
}

interface PublicationDiagnostic {
  kind: 'success' | 'media' | 'stale' | 'failure' | 'timeout';
  message: string;
}

type ToastKind = 'success' | 'error';

type CandidateFilter = 'active' | 'history';

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

const statusLabels: Record<string, string> = {
  active: '已啟用',
  onboarding: '設定中',
  archived: '已封存',
  error: '同步異常',
  draft: '草稿',
  prepared: '待發布',
  ready_to_activate: '可發布',
  queued: '處理中',
  processing: '處理中',
  published: '已發布',
  unpublished: '已下架',
  superseded: '已更新',
  cancelled: '已取消',
  failed: '處理失敗',
  media_failed: '圖片處理失敗',
  unknown: '狀態未知',
};

function StatusBadge({ state }: { state: string }) {
  const normalizedState = diagnosticState(state);
  return (
    <span
      className={`status status-${normalizedState}`}
      aria-label={`狀態：${statusLabels[state] || state}`}
    >
      {statusLabels[state] || state}
    </span>
  );
}

function formatAdminDate(value?: string | null, fallback = '尚未同步') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function tagsFromInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，、\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function validateTags(tags: string[]): string | null {
  if (tags.length > 20) return '標籤最多 20 個。';
  if (tags.some((tag) => tag.length > 40)) return '每個標籤最多 40 個字元。';
  return null;
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), kind, message });
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setToast(null);
      },
      kind === 'error' ? 8_000 : 5_000,
    );
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast, dismissToast };
}

function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div className="admin-toast-region" aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}>
      <div
        key={toast.id}
        className={`admin-toast admin-toast-${toast.kind}`}
        role={toast.kind === 'error' ? 'alert' : 'status'}
      >
        <span className="admin-toast-mark" aria-hidden="true">
          {toast.kind === 'success' ? '✓' : '!'}
        </span>
        <p>{toast.message}</p>
        <button
          type="button"
          className="admin-toast-close"
          onClick={onDismiss}
          aria-label="關閉通知"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function LoadingButton({
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {loading && <span className="admin-button-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return localDateTime();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function diagnosticState(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value) ? value : 'unknown';
}

function sanitizedDiagnostic(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [已隱藏]')
    .replace(/\b(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, '$1=[已隱藏]')
    .replace(/https?:\/\/[^\s]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return '[連結已隱藏]';
      }
    })
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[憑證已隱藏]')
    .slice(0, 240);
}

function publicationFailureMessage(value: unknown): string {
  const diagnostic = sanitizedDiagnostic(value);
  if (/column reference .* is ambiguous/i.test(diagnostic)) {
    return '發布服務的資料庫版本尚未更新，請套用最新 migration 後再試。';
  }
  return diagnostic ? `發布工作未完成：${diagnostic}` : '發布工作未完成，請重新整理後再試。';
}

/** Keep legacy/partially migrated rows from crashing the editor render. */
export function normalizeAdminArticle(article: Partial<AdminArticle>): AdminArticle {
  const bodyJson = article.bodyJson as { type?: unknown; content?: unknown } | undefined;
  return {
    id: typeof article.id === 'string' ? article.id : '',
    slug: typeof article.slug === 'string' ? article.slug : '',
    title: typeof article.title === 'string' ? article.title : '',
    description: typeof article.description === 'string' ? article.description : '',
    body: typeof article.body === 'string' ? article.body : '',
    bodyJson:
      bodyJson?.type === 'doc' && Array.isArray(bodyJson.content) ? article.bodyJson : undefined,
    status:
      article.status === 'published' || article.status === 'unpublished' ? article.status : 'draft',
    publicationVersion:
      typeof article.publicationVersion === 'number' ? article.publicationVersion : 0,
    publishedAt: localDateTime(article.publishedAt),
    contentType: typeof article.contentType === 'string' ? article.contentType : '',
    category: typeof article.category === 'string' ? article.category : '',
    tags: Array.isArray(article.tags)
      ? article.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    featured: Boolean(article.featured),
    cover:
      article.cover && typeof article.cover === 'object' && typeof article.cover.url === 'string'
        ? article.cover
        : undefined,
    seoTitle: typeof article.seoTitle === 'string' ? article.seoTitle : undefined,
    seoDescription: typeof article.seoDescription === 'string' ? article.seoDescription : undefined,
    canonicalUrl: typeof article.canonicalUrl === 'string' ? article.canonicalUrl : undefined,
    privacyReviewed: Boolean(article.privacyReviewed),
    legalReviewed: Boolean(article.legalReviewed),
  };
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export default function AdminApp({
  supabaseUrl,
  supabasePublishableKey,
  passwordLoginEnabled = true,
}: Props) {
  const client = useMemo(
    () =>
      supabaseUrl && supabasePublishableKey
        ? createClient(supabaseUrl, supabasePublishableKey, {
            auth: { flowType: 'pkce', detectSessionInUrl: true },
          })
        : null,
    [supabaseUrl, supabasePublishableKey],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!client) {
      setChecking(false);
      return;
    }
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (!client) {
    return (
      <AdminNotice
        title="管理後台尚未連接資料庫"
        message="請先設定 PUBLIC_SUPABASE_URL 與 PUBLIC_SUPABASE_PUBLISHABLE_KEY。管理員權限由 Supabase 的 admin_users 資料表判定；敏感金鑰只應設定在伺服器環境。公開網站目前仍可使用本機示範內容。"
      />
    );
  }
  if (checking) return <AdminNotice title="正在確認登入狀態…" message="請稍候。" />;
  if (!session) return <Login client={client} passwordLoginEnabled={passwordLoginEnabled} />;
  return (
    <Dashboard
      session={session}
      onSignOut={async () => {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }}
    />
  );
}

function AdminNotice({ title, message }: { title: string; message: string }) {
  return (
    <section className="admin-notice">
      <p className="admin-kicker">Admin</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <a href="/">回到網站</a>
    </section>
  );
}

function Login({ client, passwordLoginEnabled }: { client: any; passwordLoginEnabled: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<'google' | 'password' | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error =
      search.get('error_description') ||
      search.get('error') ||
      hash.get('error_description') ||
      hash.get('error');
    if (error) {
      showToast('error', error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);
  async function signInWithGoogle() {
    setBusyAction('google');
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/admin` },
      });
      if (error) throw error;
    } catch {
      showToast('error', 'Google 登入失敗，請稍後再試。');
      setBusyAction(null);
    }
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction('password');
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast('success', '登入成功。');
    } catch {
      showToast('error', '登入失敗，請檢查帳號密碼與管理權限。');
    } finally {
      setBusyAction(null);
    }
  }
  return (
    <section className="admin-login">
      <Toast toast={toast} onDismiss={dismissToast} />
      <div>
        <p className="admin-kicker">Private publishing</p>
        <h1>內容管理登入</h1>
        <p>只有列入管理者名單的帳號可以編輯或發布內容。</p>
      </div>
      <form onSubmit={submit}>
        <LoadingButton
          type="button"
          onClick={signInWithGoogle}
          disabled={busyAction !== null}
          loading={busyAction === 'google'}
        >
          使用 Google 登入
        </LoadingButton>
        {passwordLoginEnabled && (
          <>
            <label>
              電子郵件
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              密碼
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <LoadingButton disabled={busyAction !== null} loading={busyAction === 'password'}>
              登入
            </LoadingButton>
          </>
        )}
      </form>
    </section>
  );
}

export function Dashboard({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('articles');
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  const api = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${session.access_token}`,
        ...init.headers,
      },
    });
    const data = await response.json().catch(() => ({ message: '伺服器回應格式錯誤。' }));
    if (!response.ok) throw new Error(data.message || '操作失敗。');
    return data;
  };

  const reload = async () => {
    try {
      const [articleData, settingData, taxonomyData] = await Promise.all([
        api<{ articles: AdminArticle[] }>('/api/admin/articles'),
        api<{ settings: SiteSettings }>('/api/admin/settings'),
        api<{ categories: Category[] }>('/api/admin/taxonomies'),
      ]);
      setArticles(articleData.articles);
      setSettings(settingData.settings);
      setCategories(taxonomyData.categories);
    } catch (error) {
      showToast('error', (error as Error).message);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const upload = async (file: File, alt: string) => {
    const dimensions = await imageDimensions(file);
    const form = new FormData();
    form.set('file', file);
    form.set('alt', alt);
    form.set('width', String(dimensions.width));
    form.set('height', String(dimensions.height));
    const result = await api<{ media: MediaAsset }>('/api/admin/upload', {
      method: 'POST',
      body: form,
    });
    return result.media;
  };

  return (
    <div className="admin-shell">
      <Toast toast={toast} onDismiss={dismissToast} />
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            R
          </span>
          <div>
            <p className="admin-kicker">內容工作台</p>
            <strong>{settings?.shortTitle || '內容管理'}</strong>
          </div>
        </div>
        <div className="admin-account">
          <span className="admin-account-email">{session.user.email}</span>
          <a href="/" target="_blank" rel="noreferrer">
            檢視網站
          </a>
          <LoadingButton
            className="text-button"
            loading={signingOut}
            onClick={() => {
              setSigningOut(true);
              void onSignOut().catch((error) => {
                showToast('error', error instanceof Error ? error.message : '登出失敗。');
                setSigningOut(false);
              });
            }}
          >
            登出
          </LoadingButton>
        </div>
      </header>
      <div className="admin-workspace">
        <nav className="admin-sidebar" aria-label="後台導覽">
          <p>發布管理</p>
          <button
            className={tab === 'articles' ? 'active' : ''}
            aria-current={tab === 'articles' ? 'page' : undefined}
            onClick={() => setTab('articles')}
          >
            <span aria-hidden="true">▤</span>
            文章管理
          </button>
          <p>網站設定</p>
          <button className={tab === 'site' ? 'active' : ''} onClick={() => setTab('site')}>
            <span aria-hidden="true">◇</span>
            網站與作者
          </button>
          <button
            className={tab === 'taxonomies' ? 'active' : ''}
            onClick={() => setTab('taxonomies')}
          >
            <span aria-hidden="true">⌘</span>
            文章分類
          </button>
        </nav>
        <main className="admin-main">
          {tab === 'articles' && (
            <ArticleManagementWorkspace
              api={api}
              articles={articles}
              categories={categories}
              onReload={reload}
            />
          )}
          {tab === 'site' && settings && (
            <SiteSettingsPanel
              settings={settings}
              upload={upload}
              onSave={async (value) => {
                try {
                  const result = await api<{ settings: SiteSettings }>('/api/admin/settings', {
                    method: 'PUT',
                    body: JSON.stringify(value),
                  });
                  setSettings(result.settings);
                  showToast('success', '網站設定已更新，公開快取正在更新。');
                } catch (error) {
                  showToast('error', (error as Error).message);
                }
              }}
            />
          )}
          {tab === 'taxonomies' && (
            <TaxonomyPanel
              categories={categories}
              onSave={async (value) => {
                try {
                  const result = await api<{ item: Category }>('/api/admin/taxonomies', {
                    method: 'POST',
                    body: JSON.stringify({ kind: 'category', value }),
                  });
                  setCategories((current) =>
                    [...current.filter((item) => item.slug !== result.item.slug), result.item].sort(
                      (left, right) =>
                        left.order - right.order || left.name.localeCompare(right.name),
                    ),
                  );
                  showToast('success', '文章分類已儲存。');
                  return result.item;
                } catch (error) {
                  showToast('error', (error as Error).message);
                  return null;
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ArticleManagementWorkspace({
  api,
  articles,
  categories,
  onReload,
}: {
  api: DashboardApi;
  articles: AdminArticle[];
  categories: Category[];
  onReload: () => Promise<void>;
}) {
  const [focusedArticleId, setFocusedArticleId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  const focusPublishingSource = (articleId: string) => {
    setFocusedArticleId(articleId);
    window.requestAnimationFrame(() => {
      document.getElementById('article-publishing')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <section>
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">內容工作流程</p>
          <h1>文章管理</h1>
          <p className="admin-page-description">
            在同一個工作區完成 Notion 同步、文章設定、預覽、發布與下架。
          </p>
        </div>
        <span className="admin-summary-badge">
          <strong>{articles.filter((article) => article.status !== 'draft').length}</strong>
          篇可管理文章
        </span>
      </div>

      <nav className="admin-workflow-jumps" aria-label="文章管理快速導覽">
        <a href="#notion-sync">
          <span>1</span>
          <strong>同步 Notion</strong>
          <small>取得最新正文</small>
        </a>
        <a href="#article-publishing">
          <span>2</span>
          <strong>設定與發布</strong>
          <small>摘要、網址、預覽</small>
        </a>
        <a href="#published-articles">
          <span>3</span>
          <strong>管理文章</strong>
          <small>檢視、下架、重發</small>
        </a>
      </nav>

      <NotionEditorialPanel
        api={api}
        articles={articles}
        categories={categories}
        focusedArticleId={focusedArticleId}
        onFocusHandled={() => setFocusedArticleId(null)}
        showToast={showToast}
      />
      <PublishedArticlesPanel
        api={api}
        articles={articles}
        categories={categories}
        onReload={onReload}
        onRepublish={focusPublishingSource}
        showToast={showToast}
      />
    </section>
  );
}

function PublishedArticlesPanel({
  api,
  articles,
  categories,
  onReload,
  onRepublish,
  showToast,
}: {
  api: DashboardApi;
  articles: AdminArticle[];
  categories: Category[];
  onReload: () => Promise<void>;
  onRepublish: (articleId: string) => void;
  showToast: ShowToast;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminArticle | null>(null);
  const [reason, setReason] = useState('');
  const [unpublishing, setUnpublishing] = useState(false);
  const [featuredArticleId, setFeaturedArticleId] = useState<string | null>(null);
  const [classificationArticleId, setClassificationArticleId] = useState<string | null>(null);
  const [articleCategory, setArticleCategory] = useState('');
  const [articleTags, setArticleTags] = useState('');
  const [savingClassification, setSavingClassification] = useState(false);
  const managedArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return articles
      .filter((article) => article.status === 'published' || article.status === 'unpublished')
      .filter(
        (article) =>
          !normalizedQuery ||
          article.title.toLocaleLowerCase('zh-TW').includes(normalizedQuery) ||
          article.slug.toLocaleLowerCase('zh-TW').includes(normalizedQuery),
      );
  }, [articles, query]);

  const unpublish = async () => {
    if (!selected) return;
    setUnpublishing(true);
    try {
      await api(`/api/admin/notion/articles/${selected.id}/unpublish`, {
        method: 'POST',
        body: JSON.stringify({
          expectedPublicationVersion: selected.publicationVersion || 0,
          reason: reason.trim() || null,
          idempotencyKey:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : String(Date.now()),
        }),
      });
      await onReload();
      setSelected(null);
      setReason('');
      showToast('success', '文章已下架；需要恢復時可從 Notion 同步最新內容後重新發布。');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '文章下架失敗。');
    } finally {
      setUnpublishing(false);
    }
  };

  const updateFeatured = async (article: AdminArticle) => {
    const featured = !article.featured;
    setFeaturedArticleId(article.id);
    try {
      await api(`/api/admin/articles/${article.id}/featured`, {
        method: 'PATCH',
        body: JSON.stringify({ featured }),
      });
      await onReload();
      showToast(
        'success',
        featured ? `「${article.title}」已設為首頁精選文章。` : '已取消首頁精選文章。',
      );
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '精選文章設定失敗。');
    } finally {
      setFeaturedArticleId(null);
    }
  };

  const editClassification = (article: AdminArticle) => {
    if (classificationArticleId === article.id) {
      setClassificationArticleId(null);
      return;
    }
    setClassificationArticleId(article.id);
    setArticleCategory(article.category);
    setArticleTags(article.tags.join('、'));
  };

  const saveClassification = async (article: AdminArticle) => {
    const tags = tagsFromInput(articleTags);
    const tagError = validateTags(tags);
    if (!articleCategory) {
      showToast('error', '請選擇文章分類。');
      return;
    }
    if (tagError) {
      showToast('error', tagError);
      return;
    }
    setSavingClassification(true);
    try {
      await api(`/api/admin/articles/${article.id}/classification`, {
        method: 'PATCH',
        body: JSON.stringify({ category: articleCategory, tags }),
      });
      await onReload();
      setClassificationArticleId(null);
      showToast('success', '文章分類與標籤已更新。');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '文章分類與標籤更新失敗。');
    } finally {
      setSavingClassification(false);
    }
  };

  return (
    <section
      id="published-articles"
      className="admin-workflow-section admin-published-section"
      aria-labelledby="published-articles-title"
    >
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">步驟 3 · 公開內容</p>
          <h2 id="published-articles-title">已發布與已下架文章</h2>
          <p className="admin-page-description">
            管理網站上的文章；重新發布會直接展開同一頁內綁定的 Notion 來源。
          </p>
        </div>
        <span className="admin-count">{managedArticles.length}</span>
      </div>

      <div className="admin-form-card admin-article-toolbar">
        <label className="admin-search-field">
          <span>搜尋文章</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="輸入標題或網址代稱"
          />
        </label>
        <p>文章內容以 Notion 為準；已下架文章仍保留，可同步最新內容後重新發布。</p>
      </div>

      <div className="admin-article-grid" aria-live="polite">
        {managedArticles.map((article) => (
          <article
            className={`admin-article-card${article.featured ? ' admin-article-card-featured' : ''}`}
            key={article.id}
          >
            <div className="admin-article-card-topline">
              <div className="admin-article-badges">
                <StatusBadge state={article.status} />
                {article.featured && <span className="admin-featured-badge">精選文章</span>}
              </div>
              <time dateTime={article.publishedAt}>
                {article.status === 'published' ? '發布於 ' : '最後發布於 '}
                {formatAdminDate(article.publishedAt)}
              </time>
            </div>
            <div>
              <h2>{article.title}</h2>
              <p>{article.description || '尚未設定文章摘要。'}</p>
            </div>
            <div className="admin-article-meta">
              <span>網址</span>
              <strong>/articles/{article.slug}</strong>
              <span>分類</span>
              <strong>
                {categories.find((category) => category.slug === article.category)?.name ||
                  article.category}
              </strong>
              <span>標籤</span>
              <strong>{article.tags.length ? article.tags.join('、') : '尚未設定'}</strong>
            </div>
            <button
              type="button"
              className="secondary admin-classification-toggle"
              aria-expanded={classificationArticleId === article.id}
              onClick={() => editClassification(article)}
            >
              {classificationArticleId === article.id ? '收起分類與標籤' : '編輯分類與標籤'}
            </button>
            {classificationArticleId === article.id && (
              <div className="admin-article-classification-form">
                <label htmlFor={`article-category-${article.id}`}>文章分類</label>
                <select
                  id={`article-category-${article.id}`}
                  value={articleCategory}
                  onChange={(event) => setArticleCategory(event.target.value)}
                >
                  <option value="">選擇分類</option>
                  {categories.map((category) => (
                    <option value={category.slug} key={category.slug}>
                      {category.name}
                      {category.visible ? '' : '（隱藏）'}
                    </option>
                  ))}
                </select>
                <label htmlFor={`article-tags-${article.id}`}>文章標籤</label>
                <input
                  id={`article-tags-${article.id}`}
                  value={articleTags}
                  onChange={(event) => setArticleTags(event.target.value)}
                  placeholder="例如：勞動法、契約、訴訟"
                />
                <small>使用逗號或頓號分隔，最多 20 個。</small>
                <LoadingButton
                  type="button"
                  loading={savingClassification}
                  onClick={() => void saveClassification(article)}
                >
                  儲存分類與標籤
                </LoadingButton>
              </div>
            )}
            {article.status === 'published' && (
              <LoadingButton
                type="button"
                className={`admin-featured-control${article.featured ? ' active' : ''}`}
                loading={featuredArticleId === article.id}
                disabled={featuredArticleId !== null && featuredArticleId !== article.id}
                aria-pressed={article.featured}
                onClick={() => void updateFeatured(article)}
              >
                {article.featured ? '取消精選文章' : '設為精選文章'}
              </LoadingButton>
            )}
            <div className="admin-article-actions">
              {article.status === 'published' ? (
                <>
                  <a
                    className="admin-link-button"
                    href={`/articles/${encodeURIComponent(article.slug)}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    檢視文章
                  </a>
                  <button className="admin-danger-button" onClick={() => setSelected(article)}>
                    下架文章
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => onRepublish(article.id)}>
                  從 Notion 重新發布
                </button>
              )}
            </div>
          </article>
        ))}
        {!managedArticles.length && (
          <div className="admin-form-card admin-empty admin-article-empty">
            <strong>{query.trim() ? '找不到符合條件的文章' : '目前沒有可管理文章'}</strong>
            <span>
              {query.trim() ? '請嘗試其他標題或網址代稱。' : '完成首次發布後，文章會顯示在這裡。'}
            </span>
          </div>
        )}
      </div>

      {selected && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unpublish-confirm-title"
            aria-describedby="unpublish-confirm-description"
          >
            <p className="admin-kicker">文章下架</p>
            <h2 id="unpublish-confirm-title">確定要下架這篇文章？</h2>
            <p id="unpublish-confirm-description">
              「{selected.title}」將不再出現在公開網站，但內容與 Notion 來源都會保留。
            </p>
            <label className="admin-dialog-field">
              <span>備註（選填）</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="例如：內容需要更新"
              />
            </label>
            <div className="button-row admin-dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={unpublishing}
                onClick={() => {
                  setSelected(null);
                  setReason('');
                }}
              >
                取消
              </button>
              <LoadingButton
                type="button"
                className="admin-danger-button"
                loading={unpublishing}
                onClick={() => void unpublish()}
              >
                確認下架
              </LoadingButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function NotionEditorialPanel({
  api,
  articles,
  categories,
  focusedArticleId,
  onFocusHandled,
  showToast,
}: {
  api: DashboardApi;
  articles: AdminArticle[];
  categories: Category[];
  focusedArticleId: string | null;
  onFocusHandled: () => void;
  showToast: ShowToast;
}) {
  const [pageId, setPageId] = useState('');
  const [sources, setSources] = useState<NotionSourceStatus[]>([]);
  const [candidates, setCandidates] = useState<PublicationCandidateStatus[]>([]);
  const [selected, setSelected] = useState<PublicationCandidateStatus | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    bodyMarkdown: string;
  } | null>(null);
  const [slugForSource, setSlugForSource] = useState<Record<string, string>>({});
  const [summaryForSource, setSummaryForSource] = useState<Record<string, string>>({});
  const [categoryForSource, setCategoryForSource] = useState<Record<string, string>>({});
  const [tagsForSource, setTagsForSource] = useState<Record<string, string>>({});
  const [articleForSource, setArticleForSource] = useState<Record<string, string>>({});
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [republishSourceId, setRepublishSourceId] = useState<string | null>(null);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>('active');
  const [pollingCandidateId, setPollingCandidateId] = useState<string | null>(null);
  const [publicationDiagnostic, setPublicationDiagnostic] = useState<PublicationDiagnostic | null>(
    null,
  );
  const busy = busyAction !== null;
  const canPublish = Boolean(
    selected?.state === 'prepared' || selected?.state === 'ready_to_activate',
  );
  const visibleCandidates = useMemo(() => {
    const history = new Set(['published', 'superseded', 'cancelled']);
    return candidates.filter((candidate) =>
      candidateFilter === 'history' ? history.has(candidate.state) : !history.has(candidate.state),
    );
  }, [candidateFilter, candidates]);
  const articlesById = useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  );

  const refresh = async (): Promise<void> => {
    const [sourceData, candidateData] = await Promise.all([
      api<{ sources: NotionSourceStatus[] }>('/api/admin/notion/sources?view=all'),
      api<{ candidates: PublicationCandidateStatus[] }>(
        `/api/admin/notion/candidates?view=${candidateFilter}`,
      ),
    ]);
    setSources(sourceData.sources);
    setSummaryForSource((current) =>
      Object.fromEntries(
        sourceData.sources.map((source) => [
          source.id,
          current[source.id] ?? source.manual_summary ?? '',
        ]),
      ),
    );
    setCategoryForSource((current) =>
      Object.fromEntries(
        sourceData.sources.map((source) => [
          source.id,
          current[source.id] ?? source.category_slug ?? categories[0]?.slug ?? '',
        ]),
      ),
    );
    setTagsForSource((current) =>
      Object.fromEntries(
        sourceData.sources.map((source) => [
          source.id,
          current[source.id] ?? (source.tags || []).join('、'),
        ]),
      ),
    );
    setSourcesLoaded(true);
    setCandidates(candidateData.candidates);
    setSelected((current) =>
      current ? candidateData.candidates.find((item) => item.id === current.id) || null : null,
    );
  };

  useEffect(() => {
    void refresh().catch((error) => showToast('error', (error as Error).message));
  }, [candidateFilter]);

  useEffect(() => {
    if (!focusedArticleId || !sourcesLoaded) return;
    const source = sources.find((item) => item.article_id === focusedArticleId);
    if (source) {
      setExpandedSourceId(source.id);
      setRepublishSourceId(source.id);
      showToast('success', '已找到原本的 Notion 來源；請先同步最新內容，再建立發布候選。');
    } else {
      showToast('error', '找不到這篇文章綁定的 Notion 來源，請先同步主要頁面。');
    }
    onFocusHandled();
  }, [focusedArticleId, onFocusHandled, showToast, sources, sourcesLoaded]);

  const operationId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Date.now());

  const workerSummary = ({ claimed, completed, failed, exhaustedBudget }: WorkerResult) => {
    const remaining = exhaustedBudget ? '，仍有工作待處理' : '';
    return `處理 ${completed}/${claimed} 個工作，失敗 ${failed} 個${remaining}`;
  };

  const runWorkerNow = async (): Promise<WorkerResult> => {
    const result = await api<{ accepted: true; result: WorkerResult }>('/api/admin/notion/worker', {
      method: 'POST',
    });
    return result.result;
  };

  const pollImmediatePublication = async (candidateId: string, jobId: string) => {
    setPollingCandidateId(candidateId);
    try {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 800));
        const [{ candidate }, { job }] = await Promise.all([
          api<{ candidate: PublicationCandidateStatus }>(
            `/api/admin/notion/candidates/${candidateId}`,
          ),
          api<{ job: PublicationJob }>(`/api/admin/notion/jobs/${jobId}`),
        ]);
        if (candidate.id !== candidateId) {
          return {
            kind: 'failure' as const,
            message: `發布狀態無法確認：候選回應不符。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
        if (job.id !== jobId || job.candidate_id !== candidateId) {
          return {
            kind: 'failure' as const,
            message: `發布狀態無法確認：工作與候選不符。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
        setSelected(candidate);
        if (candidate.state === 'published' && job.state === 'succeeded') {
          return {
            kind: 'success' as const,
            message: `立即發布完成。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
        if (candidate.state === 'media_failed') {
          const reason = sanitizedDiagnostic(candidate.failure_reason);
          return {
            kind: 'media' as const,
            message: `媒體處理失敗${reason ? `（${reason}）` : ''}。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
        if (['superseded', 'cancelled'].includes(candidate.state)) {
          return {
            kind: 'stale' as const,
            message: `候選已失效（${diagnosticState(candidate.state)}）。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
        if (job.error && job.state !== 'succeeded') {
          return {
            kind: 'failure' as const,
            message: publicationFailureMessage(job.error),
          };
        }
        if (['failed', 'cancelled'].includes(String(job.state))) {
          const error = sanitizedDiagnostic(job.error);
          return {
            kind: 'failure' as const,
            message: `發布工作失敗（${diagnosticState(job.state)}${error ? `：${error}` : ''}）。候選 ID：${candidateId}；工作 ID：${jobId}。`,
          };
        }
      }
    } finally {
      setPollingCandidateId(null);
    }
    return {
      kind: 'timeout' as const,
      message: `等待發布結果逾時，請重新整理後再確認。候選 ID：${candidateId}；工作 ID：${jobId}。`,
    };
  };

  const runAction = async (action: string, operation: () => Promise<void>) => {
    setBusyAction(action);
    try {
      await operation();
    } catch (error) {
      showToast('error', (error as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const enqueueAndRun = async (body: Record<string, unknown>, label: string, action: string) => {
    await runAction(action, async () => {
      await api('/api/admin/notion/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const result = await runWorkerNow();
      await refresh();
      showToast(
        result.failed > 0 ? 'error' : 'success',
        `${label}同步完成：${workerSummary(result)}。`,
      );
    });
  };

  const sync = async () => {
    if (!pageId.trim()) {
      showToast('error', '請貼上 Notion page ID。');
      return;
    }
    await enqueueAndRun(
      { pageId: pageId.trim(), idempotencyKey: operationId() },
      'Notion 頁面',
      'sync-page',
    );
  };

  const syncRoot = async () => {
    await enqueueAndRun(
      { root: true, idempotencyKey: operationId() },
      'Root 直屬頁面',
      'sync-root',
    );
  };

  const syncSource = async (sourceId: string) => {
    await enqueueAndRun(
      { sourceId, idempotencyKey: operationId() },
      'Notion 最新內容',
      `sync-source-${sourceId}`,
    );
  };

  const publish = async () => {
    if (!selected) return;
    const candidate = selected;
    await runAction('publish-now', async () => {
      setPublicationDiagnostic(null);
      const publicationResponse = await api<{ publication: PublicationJob }>(
        `/api/admin/notion/candidates/${candidate.id}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({
            expectedRevisionId: candidate.source_revision_id,
            expectedMetadataVersion: candidate.working_copy_version,
            expectedCandidateHash: candidate.candidate_hash,
            idempotencyKey: operationId(),
          }),
        },
      );
      await runWorkerNow();
      await refresh();
      const jobId = publicationResponse.publication?.id || publicationResponse.publication?.job_id;
      if (!jobId) {
        const diagnostic = {
          kind: 'failure' as const,
          message: `發布工作未回傳可追蹤的工作 ID。候選 ID：${candidate.id}；工作 ID：未知。`,
        };
        setPublicationDiagnostic(diagnostic);
        showToast('error', diagnostic.message);
      } else {
        const diagnostic = await pollImmediatePublication(candidate.id, jobId);
        setPublicationDiagnostic(diagnostic);
        showToast(diagnostic.kind === 'success' ? 'success' : 'error', diagnostic.message);
      }
    });
  };

  const requestImmediatePublish = () => {
    if (canPublish) setPublishConfirmOpen(true);
  };

  const loadPreview = async () => {
    if (!selected) return;
    await runAction('preview', async () => {
      const result = await api<{
        preview: { title: string; description: string; bodyMarkdown: string };
      }>(`/api/admin/notion/candidates/${selected.id}/preview`);
      setPreview(result.preview);
      showToast('success', '候選版本預覽已載入。');
    });
  };

  const bind = async (sourceId: string) => {
    const articleId = articleForSource[sourceId];
    if (!articleId) {
      showToast('error', '請先選擇要綁定的既有文章。');
      return;
    }
    await runAction(`bind-${sourceId}`, async () => {
      await api(`/api/admin/notion/sources/${sourceId}/bind`, {
        method: 'POST',
        body: JSON.stringify({ articleId }),
      });
      showToast('success', '來源已綁定；目前公開快照尚未變更。');
      await refresh();
    });
  };

  const saveSummary = async (source: NotionSourceStatus) => {
    const summary = (summaryForSource[source.id] || '').trim().replace(/\s+/g, ' ');
    if (summary.length < 20 || summary.length > 180) {
      showToast('error', '文章摘要必須介於 20 到 180 個字元。');
      return;
    }
    if (!source.working_copy_version) {
      showToast('error', '此來源目前沒有可編輯的文章版本。');
      return;
    }
    await runAction(`summary-${source.id}`, async () => {
      await api(`/api/admin/notion/sources/${source.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          summary,
          expectedWorkingCopyVersion: source.working_copy_version,
        }),
      });
      await refresh();
      showToast('success', '文章摘要已儲存；後續 Notion 同步不會覆寫。');
    });
  };

  const saveSourceClassification = async (source: NotionSourceStatus) => {
    const category = categoryForSource[source.id] || '';
    const tags = tagsFromInput(tagsForSource[source.id] || '');
    const tagError = validateTags(tags);
    if (!category) {
      showToast('error', '請選擇文章分類。');
      return;
    }
    if (tagError) {
      showToast('error', tagError);
      return;
    }
    if (!source.working_copy_version) {
      showToast('error', '此來源目前沒有可編輯的文章版本。');
      return;
    }
    await runAction(`classification-${source.id}`, async () => {
      await api(`/api/admin/notion/sources/${source.id}/classification`, {
        method: 'PATCH',
        body: JSON.stringify({
          category,
          tags,
          expectedWorkingCopyVersion: source.working_copy_version,
        }),
      });
      await refresh();
      showToast('success', '文章分類與標籤已儲存；後續 Notion 同步不會覆寫。');
    });
  };

  const prepare = async (sourceId: string) => {
    const source = sources.find((item) => item.id === sourceId);
    const savedSummary = source?.manual_summary?.trim() || '';
    if (savedSummary.length < 20 || savedSummary.length > 180) {
      showToast('error', '請先儲存 20 到 180 字的文章摘要。');
      return;
    }
    await runAction(`prepare-${sourceId}`, async () => {
      await api(`/api/admin/notion/sources/${sourceId}/candidate`, {
        method: 'POST',
        body: JSON.stringify({ slug: slugForSource[sourceId]?.trim() || undefined }),
      });
      showToast('success', '已建立不可變發布候選，可在到期後立即發布。');
      await refresh();
    });
  };

  return (
    <section className="admin-editorial-workflow">
      <section
        id="notion-sync"
        className="admin-workflow-section"
        aria-labelledby="notion-sync-title"
      >
        <div className="admin-title-row">
          <div>
            <p className="admin-kicker">步驟 1 · 內容來源</p>
            <h2 id="notion-sync-title">Notion 同步</h2>
            <p className="admin-page-description">
              這裡只負責取得 Notion 最新正文，不會直接改動公開文章。
            </p>
          </div>
          <LoadingButton
            className="secondary"
            onClick={() =>
              void runAction('refresh', async () => {
                await refresh();
                showToast('success', 'Notion 狀態已更新。');
              })
            }
            disabled={busy}
            loading={busyAction === 'refresh'}
          >
            重新整理同步狀態
          </LoadingButton>
        </div>
        <div className="admin-message" role="note">
          <strong>只同步，不發布</strong>
          <span>正文維持在 Notion 編輯；完成同步後，再到下一區設定摘要、網址與發布。</span>
        </div>
        <div className="admin-form-card admin-sync-card">
          <div>
            <p className="admin-section-label">同步範圍</p>
            <h3>取得 Notion 最新內容</h3>
            <p>同步主要頁面下的所有文章，或指定單一 Notion 頁面。</p>
          </div>
          <div className="button-row admin-sync-actions">
            <LoadingButton
              className="secondary"
              onClick={() => void syncRoot()}
              disabled={busy}
              loading={busyAction === 'sync-root'}
            >
              同步主要頁面
            </LoadingButton>
            <input
              value={pageId}
              onChange={(event) => setPageId(event.target.value)}
              placeholder="貼上 Notion 頁面 ID"
              aria-label="Notion page ID"
            />
            <LoadingButton
              onClick={() => void sync()}
              disabled={busy}
              loading={busyAction === 'sync-page'}
            >
              立即同步
            </LoadingButton>
          </div>
        </div>
      </section>

      <div
        id="article-publishing"
        className="admin-workflow-section"
        aria-labelledby="article-publishing-title"
      >
        <div className="admin-title-row">
          <div>
            <p className="admin-kicker">步驟 2 · 文章設定</p>
            <h2 id="article-publishing-title">待發布文章</h2>
            <p className="admin-page-description">
              選擇已同步來源，在這裡設定摘要與網址，建立候選後預覽並發布。
            </p>
          </div>
          <span className="admin-summary-badge">
            <strong>{visibleCandidates.length}</strong>
            個處理中版本
          </span>
        </div>
      </div>
      <div
        id="article-publishing-content"
        className="admin-two-columns"
        aria-labelledby="article-publishing-title"
      >
        <div className="admin-form-card">
          <div className="admin-card-heading">
            <div>
              <p className="admin-section-label">已連接內容</p>
              <h2>Root Page 來源</h2>
            </div>
            <span className="admin-count">{sources.length}</span>
          </div>
          <p className="admin-source-list-description">
            顯示 Root Page 已同步的全部文章，包括已發布與已下架內容。
          </p>
          <div className="admin-source-list">
            {sources.map((source) => (
              <div className="admin-source-row" key={source.id}>
                <div className="admin-source-summary">
                  <span className="admin-source-name">
                    <strong>
                      {source.name ||
                        source.title ||
                        source.page_title ||
                        (source.external_id === 'root' ? '主要頁面' : 'Notion 頁面')}
                    </strong>
                    <small className="admin-source-slug" title={source.slug || '尚未設定'}>
                      Slug：{source.slug || '尚未設定'}
                    </small>
                    <small>最近同步：{formatAdminDate(source.last_synced_at)}</small>
                  </span>
                  <span className="admin-source-statuses">
                    <StatusBadge state={source.state} />
                    {source.article_id && articlesById.get(source.article_id) && (
                      <StatusBadge state={articlesById.get(source.article_id)?.status || 'draft'} />
                    )}
                  </span>
                  <button
                    type="button"
                    className="secondary admin-source-toggle"
                    aria-expanded={expandedSourceId === source.id}
                    aria-controls={`source-controls-${source.id}`}
                    onClick={() =>
                      setExpandedSourceId((current) => (current === source.id ? null : source.id))
                    }
                  >
                    {expandedSourceId === source.id ? '收起' : '管理'}
                  </button>
                </div>
                {expandedSourceId === source.id && (
                  <div className="admin-source-controls" id={`source-controls-${source.id}`}>
                    {republishSourceId === source.id && (
                      <p className="admin-source-note">
                        重新發布流程：先同步 Notion 最新內容，再建立候選、預覽並發布。
                      </p>
                    )}
                    <div className="admin-source-control-group admin-source-sync-control">
                      <span>Notion 內容</span>
                      <LoadingButton
                        className="secondary"
                        disabled={busy}
                        loading={busyAction === `sync-source-${source.id}`}
                        onClick={() => void syncSource(source.id)}
                      >
                        同步 Notion 最新內容
                      </LoadingButton>
                    </div>
                    {!source.article_id && (
                      <div className="admin-source-control-group">
                        <label htmlFor={`source-article-${source.id}`}>綁定既有文章</label>
                        <select
                          id={`source-article-${source.id}`}
                          value={articleForSource[source.id] || ''}
                          onChange={(event) =>
                            setArticleForSource((current) => ({
                              ...current,
                              [source.id]: event.target.value,
                            }))
                          }
                          aria-label="選擇要綁定的文章"
                        >
                          <option value="">選擇既有文章</option>
                          {articles.map((article) => (
                            <option value={article.id} key={article.id}>
                              {article.title}
                            </option>
                          ))}
                        </select>
                        <LoadingButton
                          className="secondary"
                          disabled={busy}
                          loading={busyAction === `bind-${source.id}`}
                          onClick={() => void bind(source.id)}
                        >
                          綁定
                        </LoadingButton>
                      </div>
                    )}
                    {source.working_copy_id && (
                      <>
                        <div className="admin-source-control-group admin-source-summary-control">
                          <label htmlFor={`source-summary-${source.id}`}>文章摘要</label>
                          <span className="admin-source-summary-input">
                            <textarea
                              id={`source-summary-${source.id}`}
                              value={summaryForSource[source.id] || ''}
                              onChange={(event) =>
                                setSummaryForSource((current) => ({
                                  ...current,
                                  [source.id]: event.target.value,
                                }))
                              }
                              rows={3}
                              minLength={20}
                              maxLength={180}
                              placeholder="請手動輸入 20–180 字文章摘要"
                              aria-label="文章摘要"
                            />
                            <small>{(summaryForSource[source.id] || '').trim().length}/180</small>
                          </span>
                          <LoadingButton
                            className="secondary"
                            disabled={busy}
                            loading={busyAction === `summary-${source.id}`}
                            onClick={() => void saveSummary(source)}
                          >
                            儲存摘要
                          </LoadingButton>
                        </div>
                        <div className="admin-source-control-group admin-source-classification-control">
                          <label htmlFor={`source-category-${source.id}`}>文章分類</label>
                          <span className="admin-source-classification-inputs">
                            <select
                              id={`source-category-${source.id}`}
                              value={categoryForSource[source.id] || ''}
                              onChange={(event) =>
                                setCategoryForSource((current) => ({
                                  ...current,
                                  [source.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">選擇分類</option>
                              {categories.map((category) => (
                                <option value={category.slug} key={category.slug}>
                                  {category.name}
                                  {category.visible ? '' : '（隱藏）'}
                                </option>
                              ))}
                            </select>
                            <input
                              value={tagsForSource[source.id] || ''}
                              onChange={(event) =>
                                setTagsForSource((current) => ({
                                  ...current,
                                  [source.id]: event.target.value,
                                }))
                              }
                              placeholder="標籤：勞動法、契約、訴訟"
                              aria-label="文章標籤"
                            />
                            <small>標籤使用逗號或頓號分隔，最多 20 個。</small>
                          </span>
                          <LoadingButton
                            className="secondary"
                            disabled={busy}
                            loading={busyAction === `classification-${source.id}`}
                            onClick={() => void saveSourceClassification(source)}
                          >
                            儲存分類與標籤
                          </LoadingButton>
                        </div>
                        <div className="admin-source-control-group admin-source-slug-control">
                          <label htmlFor={`source-slug-${source.id}`}>網址代稱</label>
                          <input
                            id={`source-slug-${source.id}`}
                            value={slugForSource[source.id] || ''}
                            onChange={(event) =>
                              setSlugForSource((current) => ({
                                ...current,
                                [source.id]: event.target.value.normalize('NFC'),
                              }))
                            }
                            maxLength={120}
                            placeholder="依 Notion 設定或標題產生"
                            aria-label="手動設定網址代稱"
                          />
                          <LoadingButton
                            className="secondary"
                            disabled={
                              busy ||
                              (source.manual_summary?.trim().length || 0) < 20 ||
                              (source.manual_summary?.trim().length || 0) > 180
                            }
                            loading={busyAction === `prepare-${source.id}`}
                            onClick={() => void prepare(source.id)}
                          >
                            建立發布候選
                          </LoadingButton>
                        </div>
                      </>
                    )}
                    {source.article_id && !source.working_copy_id && (
                      <p className="admin-source-note">此來源目前沒有可管理的草稿版本。</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!sources.length && <p className="admin-empty">尚未綁定 Notion 來源。</p>}
          </div>
        </div>
        <div className="admin-form-card">
          <div className="admin-card-heading">
            <div>
              <p className="admin-section-label">準備發布</p>
              <h2>發布候選</h2>
            </div>
            <span className="admin-count">{visibleCandidates.length}</span>
          </div>
          <div className="admin-list">
            <div className="admin-filter-tabs" role="tablist" aria-label="候選版本篩選">
              {(['active', 'history'] as const).map((filter) => (
                <button
                  type="button"
                  role="tab"
                  key={filter}
                  aria-selected={candidateFilter === filter}
                  className={candidateFilter === filter ? 'active' : 'secondary'}
                  onClick={() => setCandidateFilter(filter)}
                >
                  {filter === 'active' ? '進行中' : '歷史紀錄'}
                </button>
              ))}
            </div>
            {visibleCandidates.map((candidate) => (
              <button
                className="admin-list-item"
                key={candidate.id}
                onClick={() => setSelected(candidate)}
                aria-pressed={selected?.id === candidate.id}
              >
                <span>
                  <strong className="admin-breakable-text">{candidate.title}</strong>
                  <small className="admin-breakable-text">可立即發布</small>
                </span>
                <StatusBadge state={candidate.state} />
              </button>
            ))}
            {!visibleCandidates.length && (
              <p className="admin-empty">
                {candidateFilter === 'active'
                  ? '目前沒有進行中的發布候選。'
                  : '目前沒有歷史發布紀錄。'}
              </p>
            )}
          </div>
        </div>
      </div>
      {selected && (
        <div className="admin-form-card admin-candidate-detail">
          <div className="admin-card-heading">
            <div>
              <p className="admin-section-label">候選版本</p>
              <h2 className="admin-breakable-text">{selected.title}</h2>
            </div>
            <StatusBadge state={selected.state} />
          </div>
          <div className="button-row">
            <LoadingButton
              className="publish-now"
              disabled={busy || pollingCandidateId !== null || !canPublish}
              loading={busyAction === 'publish-now'}
              onClick={requestImmediatePublish}
              title={canPublish ? '立即發布候選版本' : '候選須處於 prepared 或 ready_to_activate'}
            >
              立即發布
            </LoadingButton>
            <LoadingButton
              className="secondary"
              disabled={busy || pollingCandidateId !== null}
              loading={busyAction === 'preview'}
              onClick={() => void loadPreview()}
            >
              載入預覽
            </LoadingButton>
          </div>
          {preview && (
            <div className="admin-dialog-backdrop" role="presentation">
              <section
                className="admin-dialog admin-preview-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-preview-title"
              >
                <div className="admin-title-row">
                  <p className="admin-kicker">文章預覽</p>
                  <button
                    type="button"
                    className="secondary admin-dialog-close"
                    onClick={() => setPreview(null)}
                    aria-label="關閉預覽"
                  >
                    關閉
                  </button>
                </div>
                <article className="admin-preview-content">
                  <h2 id="admin-preview-title">{preview.title}</h2>
                  <p className="admin-preview-description">{preview.description}</p>
                  <div
                    className="admin-preview-body"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(preview.bodyMarkdown) }}
                  />
                </article>
              </section>
            </div>
          )}
        </div>
      )}
      {publicationDiagnostic && (
        <div
          className={`admin-publication-diagnostic admin-publication-${publicationDiagnostic.kind}`}
          role={publicationDiagnostic.kind === 'success' ? 'status' : 'alert'}
          aria-live={publicationDiagnostic.kind === 'success' ? 'polite' : 'assertive'}
        >
          <strong>{publicationDiagnostic.kind === 'success' ? '發布完成' : '發布診斷'}</strong>
          <p>{publicationDiagnostic.message}</p>
        </div>
      )}
      {selected && publishConfirmOpen && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-confirm-title"
            aria-describedby="publish-confirm-description"
          >
            <p className="admin-kicker">準備發布</p>
            <h2 id="publish-confirm-title">立即發布這個候選版本？</h2>
            <p id="publish-confirm-description">
              「{selected.title}」送出後會立即重新檢查 Notion
              freshness、圖片與資料庫版本，任何一項不符都會停止發布。
            </p>
            <div className="button-row admin-dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setPublishConfirmOpen(false)}
              >
                先不要
              </button>
              <LoadingButton
                type="button"
                className="publish-now"
                loading={busyAction === 'publish-now'}
                onClick={() => {
                  setPublishConfirmOpen(false);
                  void publish();
                }}
              >
                確認立即發布
              </LoadingButton>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SiteSettingsPanel({
  settings,
  upload,
  onSave,
}: {
  settings: SiteSettings;
  upload: (file: File, alt: string) => Promise<MediaAsset>;
  onSave: (settings: SiteSettings) => Promise<void>;
}) {
  const [value, setValue] = useState(settings);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SiteSettings>(key: K, next: SiteSettings[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="admin-form narrow"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave(value);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Presentation</p>
          <h1>網站與作者</h1>
        </div>
        <LoadingButton loading={saving}>儲存設定</LoadingButton>
      </div>
      <div className="admin-form-card">
        <h2>網站資訊</h2>
        <label>
          網站標題
          <input
            value={value.siteTitle}
            onChange={(event) => set('siteTitle', event.target.value)}
            required
          />
        </label>
        <label>
          導覽短標題
          <input
            value={value.shortTitle}
            onChange={(event) => set('shortTitle', event.target.value)}
            required
          />
        </label>
        <label>
          網站描述
          <textarea
            rows={3}
            value={value.siteDescription}
            onChange={(event) => set('siteDescription', event.target.value)}
            required
          />
        </label>
        <h2>作者資訊</h2>
        <label>
          作者姓名
          <input
            value={value.authorName}
            onChange={(event) => set('authorName', event.target.value)}
            required
          />
        </label>
        <label>
          作者身分
          <input
            value={value.authorRole}
            onChange={(event) => set('authorRole', event.target.value)}
            required
          />
        </label>
        <label>
          作者簡介
          <textarea
            rows={5}
            value={value.authorBio}
            onChange={(event) => set('authorBio', event.target.value)}
            required
          />
        </label>
        <MediaUpload
          label="作者圖片"
          value={value.authorImage}
          onChange={(media) => set('authorImage', media)}
          upload={upload}
        />
        <MediaUpload
          label="預設文章／社群圖片"
          value={value.defaultSocialImage}
          onChange={(media) => set('defaultSocialImage', media)}
          upload={upload}
        />
      </div>
    </form>
  );
}

function MediaUpload({
  label,
  value,
  onChange,
  upload,
}: {
  label: string;
  value?: MediaAsset;
  onChange: (media: MediaAsset) => void;
  upload: (file: File, alt: string) => Promise<MediaAsset>;
}) {
  const [alt, setAlt] = useState(value?.alt || '');
  const [busy, setBusy] = useState(false);
  const { toast, showToast, dismissToast } = useToast();
  return (
    <fieldset>
      <Toast toast={toast} onDismiss={dismissToast} />
      <legend>{label}</legend>
      {value && <img className="admin-cover-preview" src={value.url} alt={value.alt} />}
      <label>
        替代文字
        <input value={alt} onChange={(event) => setAlt(event.target.value)} />
      </label>
      <label className="file-label">
        上傳圖片
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !alt.trim()) return;
            setBusy(true);
            try {
              onChange(await upload(file, alt.trim()));
              showToast('success', `${label}已上傳。`);
            } catch (uploadError) {
              showToast(
                'error',
                uploadError instanceof Error ? uploadError.message : '圖片上傳失敗，請再試一次。',
              );
            } finally {
              event.target.value = '';
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && (
        <small className="admin-upload-progress" role="status">
          <span className="admin-button-spinner" aria-hidden="true" /> 圖片上傳中…
        </small>
      )}
    </fieldset>
  );
}

function TaxonomyPanel({
  categories,
  onSave,
}: {
  categories: Category[];
  onSave: (value: Category) => Promise<Category | null>;
}) {
  const emptyCategory = (): Category => ({
    slug: '',
    name: '',
    description: '',
    order: 100,
    visible: true,
  });
  const [category, setCategory] = useState<Category>({
    slug: '',
    name: '',
    description: '',
    order: 100,
    visible: true,
  });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalizedCategory = {
    ...category,
    slug: category.slug.trim().toLowerCase(),
    name: category.name.trim(),
    description: category.description.trim(),
  };
  const categoryIsValid = Boolean(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedCategory.slug) &&
    normalizedCategory.name &&
    normalizedCategory.description &&
    Number.isInteger(normalizedCategory.order) &&
    normalizedCategory.order >= 0 &&
    normalizedCategory.order <= 10000,
  );
  const saveCategory = async () => {
    if (!categoryIsValid || saving) return;
    setSaving(true);
    try {
      const saved = await onSave(normalizedCategory);
      if (saved) {
        setSelectedSlug(saved.slug);
        setCategory(saved);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <section>
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Organization</p>
          <h1>文章分類</h1>
          <p className="admin-page-description">分類會顯示在前台，讀者可以依主題瀏覽文章。</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setSelectedSlug(null);
            setCategory(emptyCategory());
          }}
        >
          新增分類
        </button>
      </div>
      <div className="admin-message" role="note">
        <strong>分類與格式分工</strong>
        <span>文章分類是讀者看得到的主題；內容類型由系統固定管理，目前不需要另外設定。</span>
      </div>
      <div className="admin-taxonomy-layout">
        <aside className="admin-form-card admin-taxonomy-list" aria-label="現有文章分類">
          <div className="admin-card-heading">
            <div>
              <p className="admin-section-label">現有分類</p>
              <h2>選擇要編輯的分類</h2>
            </div>
            <span className="admin-count">{categories.length}</span>
          </div>
          <div className="admin-list">
            {categories.map((item) => (
              <button
                type="button"
                className="taxonomy-edit"
                key={item.slug}
                aria-pressed={selectedSlug === item.slug}
                onClick={() => {
                  setSelectedSlug(item.slug);
                  setCategory({ ...item });
                }}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>/{item.slug}</small>
                </span>
                <small>{item.visible ? '前台顯示' : '已隱藏'}</small>
              </button>
            ))}
          </div>
        </aside>
        <form
          className="admin-form-card admin-taxonomy-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveCategory();
          }}
        >
          <div>
            <p className="admin-section-label">{selectedSlug ? '編輯分類' : '新增分類'}</p>
            <h2>{selectedSlug ? category.name : '建立文章分類'}</h2>
          </div>
          <label htmlFor="category-name">
            分類名稱
            <input
              id="category-name"
              value={category.name}
              onChange={(event) => setCategory({ ...category, name: event.target.value })}
              maxLength={80}
              placeholder="例如：法律實務"
              required
            />
          </label>
          <label htmlFor="category-slug">
            分類網址代稱
            <input
              id="category-slug"
              value={category.slug}
              onChange={(event) =>
                setCategory({
                  ...category,
                  slug: event.target.value.toLowerCase().replace(/\s+/g, '-'),
                })
              }
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={100}
              readOnly={selectedSlug !== null}
              aria-describedby="category-slug-help"
              placeholder="legal-practice"
              required
            />
            <small id="category-slug-help">
              {selectedSlug
                ? '為避免既有文章網址失效，建立後不能修改。'
                : '僅限小寫英文、數字與連字號。'}
            </small>
          </label>
          <label htmlFor="category-description">
            分類說明
            <textarea
              id="category-description"
              rows={3}
              value={category.description}
              onChange={(event) => setCategory({ ...category, description: event.target.value })}
              maxLength={180}
              placeholder="說明這個分類收錄哪些文章"
              required
            />
          </label>
          <label htmlFor="category-order">
            排序
            <input
              id="category-order"
              type="number"
              min="0"
              max="10000"
              value={category.order}
              onChange={(event) => setCategory({ ...category, order: Number(event.target.value) })}
              required
            />
          </label>
          <label className="checkbox" htmlFor="category-visible">
            <input
              id="category-visible"
              type="checkbox"
              checked={category.visible}
              onChange={(event) => setCategory({ ...category, visible: event.target.checked })}
            />
            顯示在前台
          </label>
          <LoadingButton
            type="button"
            loading={saving}
            disabled={saving || !categoryIsValid}
            onClick={() => void saveCategory()}
          >
            儲存分類
          </LoadingButton>
        </form>
      </div>
    </section>
  );
}
