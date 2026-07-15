import { createClient, type Session } from '@supabase/supabase-js';
import {
  lazy,
  Suspense,
  type ButtonHTMLAttributes,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Category, ContentType, MediaAsset, SiteSettings } from '@/lib/content/types';
import type { JSONContent } from '@tiptap/react';
import '@/styles/admin.css';
import { slugFromTitle } from '@/lib/content/slug';

const MarkdownTiptapEditor = lazy(() => import('./MarkdownTiptapEditor'));

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

type Tab = 'notion' | 'articles' | 'site' | 'taxonomies';

type DashboardApi = <T>(path: string, init?: RequestInit) => Promise<T>;

interface NotionSourceStatus {
  id: string;
  external_id: string;
  state: string;
  article_id?: string | null;
  last_synced_at?: string | null;
  working_copy_id?: string | null;
}

interface PublicationCandidateStatus {
  id: string;
  source_revision_id: string;
  working_copy_version: number;
  candidate_hash: string;
  state: string;
  activation_at?: string;
  title: string;
}

interface WorkerResult {
  claimed: number;
  completed: number;
  failed: number;
  exhaustedBudget: boolean;
}

interface PublicationJob {
  id?: string;
  state?: string;
}

type ToastKind = 'success' | 'error';

type CandidateFilter = 'active' | 'history';

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
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

function emptyArticle(categories: Category[], contentTypes: ContentType[]): AdminArticle {
  return {
    id: '',
    slug: '',
    title: '',
    description: '',
    body: '',
    status: 'draft',
    publishedAt: localDateTime(),
    contentType: contentTypes[0]?.slug || '',
    category: categories[0]?.slug || '',
    tags: [],
    featured: false,
    privacyReviewed: false,
    legalReviewed: false,
  };
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
  const [tab, setTab] = useState<Tab>('notion');
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [editing, setEditing] = useState<AdminArticle | null>(null);
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
        api<{ categories: Category[]; contentTypes: ContentType[] }>('/api/admin/taxonomies'),
      ]);
      setArticles(articleData.articles);
      setSettings(settingData.settings);
      setCategories(taxonomyData.categories);
      setContentTypes(taxonomyData.contentTypes);
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
        <div>
          <p className="admin-kicker">即時內容管理</p>
          <strong>{settings?.shortTitle || '內容管理'}</strong>
        </div>
        <div className="admin-account">
          <span>{session.user.email}</span>
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
          <p>內容</p>
          <button className={tab === 'notion' ? 'active' : ''} onClick={() => setTab('notion')}>
            Notion 發布
          </button>
          <button className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>
            舊文章管理
          </button>
          <p>網站設定</p>
          <button className={tab === 'site' ? 'active' : ''} onClick={() => setTab('site')}>
            網站與作者
          </button>
          <button
            className={tab === 'taxonomies' ? 'active' : ''}
            onClick={() => setTab('taxonomies')}
          >
            分類與內容類型
          </button>
        </nav>
        <main className="admin-main">
          {tab === 'notion' && <NotionEditorialPanel api={api} articles={articles} />}
          {tab === 'articles' && (
            <ArticlesPanel
              articles={articles}
              categories={categories}
              contentTypes={contentTypes}
              editing={editing}
              setEditing={setEditing}
              upload={upload}
              onSave={async (article) => {
                try {
                  const path = article.id
                    ? `/api/admin/articles/${article.id}`
                    : '/api/admin/articles';
                  await api(path, {
                    method: article.id ? 'PUT' : 'POST',
                    body: JSON.stringify({
                      ...article,
                      publishedAt: new Date(article.publishedAt).toISOString(),
                    }),
                  });
                  setEditing(null);
                  await reload();
                  showToast('success', '文章已儲存，公開快取正在更新。');
                } catch (error) {
                  showToast('error', (error as Error).message);
                }
              }}
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
              contentTypes={contentTypes}
              onSave={async (kind, value) => {
                try {
                  await api('/api/admin/taxonomies', {
                    method: 'POST',
                    body: JSON.stringify({ kind, value }),
                  });
                  await reload();
                  showToast('success', '內容設定已更新。');
                } catch (error) {
                  showToast('error', (error as Error).message);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function NotionEditorialPanel({ api, articles }: { api: DashboardApi; articles: AdminArticle[] }) {
  const [pageId, setPageId] = useState('');
  const [sources, setSources] = useState<NotionSourceStatus[]>([]);
  const [candidates, setCandidates] = useState<PublicationCandidateStatus[]>([]);
  const [selected, setSelected] = useState<PublicationCandidateStatus | null>(null);
  const [preview, setPreview] = useState('');
  const [articleForSource, setArticleForSource] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState<CandidateFilter>('active');
  const [pollingCandidateId, setPollingCandidateId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();
  const busy = busyAction !== null;
  const selectedActivationTime = selected?.activation_at
    ? Date.parse(selected.activation_at)
    : Number.NaN;
  const canPublishImmediately = Boolean(
    (selected?.state === 'prepared' || selected?.state === 'ready_to_activate') &&
    Number.isFinite(selectedActivationTime) &&
    selectedActivationTime <= Date.now(),
  );
  const visibleCandidates = useMemo(() => {
    const history = new Set(['published', 'superseded', 'cancelled']);
    return candidates.filter((candidate) =>
      candidateFilter === 'history' ? history.has(candidate.state) : !history.has(candidate.state),
    );
  }, [candidateFilter, candidates]);

  const refresh = async (): Promise<PublicationCandidateStatus[]> => {
    const [sourceData, candidateData] = await Promise.all([
      api<{ sources: NotionSourceStatus[] }>('/api/admin/notion/sources?view=active'),
      api<{ candidates: PublicationCandidateStatus[] }>(
        `/api/admin/notion/candidates?view=${candidateFilter}`,
      ),
    ]);
    setSources(sourceData.sources);
    setCandidates(candidateData.candidates);
    setSelected((current) =>
      current ? candidateData.candidates.find((item) => item.id === current.id) || null : null,
    );
    return candidateData.candidates;
  };

  useEffect(() => {
    void refresh().catch((error) => showToast('error', (error as Error).message));
  }, [candidateFilter]);

  useEffect(() => {
    if (!selected?.activation_at || canPublishImmediately) return;
    const delay = Date.parse(selected.activation_at) - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = window.setTimeout(
      () => {
        void refresh();
      },
      Math.min(delay + 50, 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [canPublishImmediately, selected?.activation_at]);

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

  const pollCandidate = async (candidateId: string) => {
    setPollingCandidateId(candidateId);
    try {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const result = await api<{ candidate: PublicationCandidateStatus }>(
          `/api/admin/notion/candidates/${candidateId}`,
        );
        const next = result.candidate;
        setCandidates((current) => current.map((item) => (item.id === candidateId ? next : item)));
        setSelected((current) => (current?.id === candidateId ? next : current));
        if (['published', 'media_failed', 'superseded', 'cancelled'].includes(next.state))
          return next;
      }
    } finally {
      setPollingCandidateId(null);
    }
    return null;
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

  const publish = async (immediate = false) => {
    if (!selected) return;
    await runAction(immediate ? 'publish-now' : 'publish', async () => {
      const publishPath = `/api/admin/notion/candidates/${selected.id}/publish${immediate ? '?immediate=true' : ''}`;
      const publicationResponse = await api<{ publication: PublicationJob }>(publishPath, {
        method: 'POST',
        body: JSON.stringify({
          expectedRevisionId: selected.source_revision_id,
          expectedMetadataVersion: selected.working_copy_version,
          expectedCandidateHash: selected.candidate_hash,
          idempotencyKey: operationId(),
        }),
      });
      const workerResult = immediate ? await runWorkerNow() : null;
      const refreshedCandidates = await refresh();
      const refreshedCandidate = refreshedCandidates.find(
        (candidate) => candidate.id === selected.id,
      );
      const polledCandidate =
        immediate && refreshedCandidate ? await pollCandidate(refreshedCandidate.id) : null;
      const jobId = publicationResponse.publication?.id;
      if (immediate && jobId) {
        for (let attempt = 0; attempt < 15; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const { job } = await api<{ job: PublicationJob }>(`/api/admin/notion/jobs/${jobId}`);
          if (['succeeded', 'failed', 'cancelled'].includes(String(job.state))) break;
        }
      }
      const finalCandidate = polledCandidate || refreshedCandidate;
      if (workerResult && finalCandidate?.state !== 'published') {
        showToast(
          'error',
          `立即發布尚未完成（目前狀態：${finalCandidate?.state || '未知'}）：${workerSummary(workerResult)}。`,
        );
      } else if (workerResult?.failed) {
        showToast('error', `發布工作執行失敗：${workerSummary(workerResult)}。`);
      } else {
        showToast(
          'success',
          immediate
            ? `立即發布工作已執行：${workerResult ? workerSummary(workerResult) : ''}。`
            : '發布工作已排入佇列，worker 會在設定時間完成 freshness gate。',
        );
      }
    });
  };

  const requestImmediatePublish = () => {
    if (canPublishImmediately) setPublishConfirmOpen(true);
  };

  const loadPreview = async () => {
    if (!selected) return;
    await runAction('preview', async () => {
      const result = await api<{
        preview: { title: string; description: string; bodyMarkdown: string };
      }>(`/api/admin/notion/candidates/${selected.id}/preview`);
      setPreview(
        `${result.preview.title}\n\n${result.preview.description}\n\n${result.preview.bodyMarkdown}`,
      );
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

  const prepare = async (sourceId: string) => {
    await runAction(`prepare-${sourceId}`, async () => {
      await api(`/api/admin/notion/sources/${sourceId}/candidate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showToast('success', '已建立不可變發布候選，可在到期後立即發布。');
      await refresh();
    });
  };

  return (
    <section>
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Editorial source</p>
          <h1>Notion 文章發布</h1>
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
          重新整理
        </LoadingButton>
      </div>
      <p className="admin-message">
        正文只在 Notion 編輯；這裡只負責同步、預覽候選版本與發布。同步不會改變目前公開文章。
      </p>
      <div className="admin-form-card">
        <h2>同步 Notion 頁面</h2>
        <p>可同步設定的 root page 直屬頁面，或單獨貼上 page ID。</p>
        <div className="button-row">
          <LoadingButton
            className="secondary"
            onClick={() => void syncRoot()}
            disabled={busy}
            loading={busyAction === 'sync-root'}
          >
            立即同步 Root 直屬頁面
          </LoadingButton>
          <input
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            placeholder="Notion page ID"
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
      <div className="admin-two-columns">
        <div className="admin-form-card">
          <h2>來源狀態</h2>
          <div className="admin-list">
            {sources.map((source) => (
              <div className="admin-list-item" key={source.id}>
                <span>
                  <strong>{source.external_id}</strong>
                  <small>{source.last_synced_at || '尚未同步'}</small>
                </span>
                <span>
                  <span className={`status status-${source.state}`}>{source.state}</span>
                  {!source.article_id && (
                    <span className="button-row">
                      <select
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
                    </span>
                  )}
                  {source.working_copy_id && (
                    <LoadingButton
                      className="secondary"
                      disabled={busy}
                      loading={busyAction === `prepare-${source.id}`}
                      onClick={() => void prepare(source.id)}
                    >
                      建立發布候選
                    </LoadingButton>
                  )}
                </span>
              </div>
            ))}
            {!sources.length && <p className="admin-empty">尚未綁定 Notion 來源。</p>}
          </div>
        </div>
        <div className="admin-form-card">
          <h2>發布候選</h2>
          <div className="admin-list">
            <div className="admin-filter-tabs" role="tablist" aria-label="候選版本篩選">
              {(['active', 'history'] as const).map((filter) => (
                <button
                  type="button"
                  role="tab"
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
                  <strong>{candidate.title}</strong>
                  <small>{candidate.activation_at || '立即發布'}</small>
                </span>
                <span className={`status status-${candidate.state}`}>{candidate.state}</span>
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
        <div className="admin-form-card">
          <h2>發布候選：{selected.title}</h2>
          <p>候選 hash：{selected.candidate_hash}</p>
          <div className="button-row">
            <LoadingButton
              disabled={
                busy ||
                pollingCandidateId !== null ||
                ['published', 'superseded', 'cancelled'].includes(selected.state)
              }
              loading={busyAction === 'publish'}
              onClick={() => void publish(false)}
            >
              排入發布
            </LoadingButton>
            <LoadingButton
              className="publish-now"
              disabled={busy || pollingCandidateId !== null || !canPublishImmediately}
              loading={busyAction === 'publish-now'}
              onClick={requestImmediatePublish}
              title={
                canPublishImmediately
                  ? '立即執行已到期的發布候選'
                  : '候選須處於 prepared 或 ready_to_activate，且已到發布時間'
              }
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
          {preview && <pre className="admin-preview">{preview}</pre>}
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
            <p className="admin-kicker">Ready to publish</p>
            <h2 id="publish-confirm-title">立即發布這個候選版本？</h2>
            <p id="publish-confirm-description">
              「{selected.title}」已到發布時間。送出後仍會重新檢查 Notion
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
                  void publish(true);
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

function ArticlesPanel({
  articles,
  categories,
  contentTypes,
  editing,
  setEditing,
  upload,
  onSave,
}: {
  articles: AdminArticle[];
  categories: Category[];
  contentTypes: ContentType[];
  editing: AdminArticle | null;
  setEditing: (article: AdminArticle | null) => void;
  upload: (file: File, alt: string) => Promise<MediaAsset>;
  onSave: (article: AdminArticle) => Promise<void>;
}) {
  if (editing) {
    return (
      <ArticleEditor
        key={editing.id || 'new-article'}
        article={editing}
        categories={categories}
        contentTypes={contentTypes}
        upload={upload}
        onCancel={() => setEditing(null)}
        onSave={onSave}
      />
    );
  }
  return (
    <section>
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Content</p>
          <h1>文章管理</h1>
        </div>
        <button onClick={() => setEditing(emptyArticle(categories, contentTypes))}>新增文章</button>
      </div>
      <div className="admin-list">
        {articles.map((article) => (
          <button
            className="admin-list-item"
            key={article.id}
            onClick={() => setEditing(normalizeAdminArticle(article))}
          >
            <span>
              <strong>{article.title}</strong>
              <small>/{article.slug}</small>
            </span>
            <span className={`status status-${article.status}`}>
              {article.status === 'published'
                ? '已發布'
                : article.status === 'draft'
                  ? '草稿'
                  : '已下架'}
            </span>
          </button>
        ))}
        {!articles.length && <p className="admin-empty">還沒有文章，從右上角新增第一篇。</p>}
      </div>
    </section>
  );
}

function ArticleEditor({
  article,
  categories,
  contentTypes,
  upload,
  onCancel,
  onSave,
}: {
  article: AdminArticle;
  categories: Category[];
  contentTypes: ContentType[];
  upload: (file: File, alt: string) => Promise<MediaAsset>;
  onCancel: () => void;
  onSave: (article: AdminArticle) => Promise<void>;
}) {
  const [value, setValue] = useState(article);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, dismissToast } = useToast();
  const set = <K extends keyof AdminArticle>(key: K, next: AdminArticle[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="admin-form"
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
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Article editor</p>
          <h1>{value.id ? '編輯文章' : '新增文章'}</h1>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <LoadingButton loading={saving} disabled={saving || uploading}>
            儲存文章
          </LoadingButton>
        </div>
      </div>
      <div className="admin-two-columns">
        <div className="admin-form-card admin-form-main">
          <label>
            文章標題
            <input
              value={value.title}
              onChange={(event) => set('title', event.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label>
            網址代稱
            <input
              value={value.slug}
              onChange={(event) => set('slug', event.target.value.normalize('NFC'))}
              maxLength={120}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => set('slug', slugFromTitle(value.title))}
            >
              {value.slug ? '重新產生網址代稱' : '依標題產生網址代稱'}
            </button>
          </label>
          <label>
            文章摘要
            <textarea
              rows={3}
              value={value.description}
              onChange={(event) => set('description', event.target.value)}
              required
              minLength={20}
              maxLength={180}
            />
          </label>
          <label>
            文章內容
            <Suspense fallback={<div className="tiptap-editor-loading">正在載入編輯器…</div>}>
              <MarkdownTiptapEditor
                value={value.body}
                bodyJson={value.bodyJson}
                onChange={(body) =>
                  setValue((current) => ({ ...current, body, bodyJson: undefined }))
                }
                onDocumentChange={(document: JSONContent) => set('bodyJson', document)}
                onUpload={upload}
              />
            </Suspense>
          </label>
        </div>
        <aside className="admin-form-card admin-form-side">
          <label>
            狀態
            <select
              value={value.status}
              onChange={(event) => set('status', event.target.value as AdminArticle['status'])}
            >
              <option value="draft">草稿</option>
              <option value="published">已發布</option>
              <option value="unpublished">已下架</option>
            </select>
          </label>
          <label>
            發布時間
            <input
              type="datetime-local"
              value={value.publishedAt}
              onChange={(event) => set('publishedAt', event.target.value)}
              required
            />
          </label>
          <label>
            內容類型
            <select
              value={value.contentType}
              onChange={(event) => set('contentType', event.target.value)}
              required
            >
              {contentTypes.map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            文章分類
            <select
              value={value.category}
              onChange={(event) => set('category', event.target.value)}
              required
            >
              {categories.map((item) => (
                <option value={item.slug} key={item.slug}>
                  {item.name}
                  {item.visible ? '' : '（隱藏）'}
                </option>
              ))}
            </select>
          </label>
          <label>
            標籤（逗號分隔）
            <input
              value={value.tags.join(', ')}
              onChange={(event) =>
                set(
                  'tags',
                  event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.featured}
              onChange={(event) => set('featured', event.target.checked)}
            />
            首頁精選
          </label>
          <fieldset>
            <legend>文章封面</legend>
            {value.cover && (
              <img className="admin-cover-preview" src={value.cover.url} alt={value.cover.alt} />
            )}
            <label>
              替代文字
              <input id="cover-alt" defaultValue={value.cover?.alt || ''} />
            </label>
            <label className="file-label">
              選擇圖片
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  const altInput = document.querySelector<HTMLInputElement>('#cover-alt');
                  if (!file || !altInput?.value.trim()) return;
                  setUploading(true);
                  try {
                    set('cover', await upload(file, altInput.value.trim()));
                    showToast('success', '文章封面已上傳。');
                  } catch (error) {
                    showToast(
                      'error',
                      error instanceof Error ? error.message : '圖片上傳失敗，請再試一次。',
                    );
                  } finally {
                    event.target.value = '';
                    setUploading(false);
                  }
                }}
              />
            </label>
            {uploading && (
              <small className="admin-upload-progress" role="status">
                <span className="admin-button-spinner" aria-hidden="true" /> 圖片上傳中…
              </small>
            )}
          </fieldset>
          <label>
            SEO 標題
            <input
              value={value.seoTitle || ''}
              onChange={(event) => set('seoTitle', event.target.value)}
              maxLength={70}
            />
          </label>
          <label>
            SEO 描述
            <textarea
              rows={3}
              value={value.seoDescription || ''}
              onChange={(event) => set('seoDescription', event.target.value)}
              maxLength={180}
            />
          </label>
          <label>
            Canonical URL
            <input
              type="url"
              value={value.canonicalUrl || ''}
              onChange={(event) => set('canonicalUrl', event.target.value)}
            />
          </label>
          <fieldset>
            <legend>發布檢查</legend>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={value.privacyReviewed}
                onChange={(event) => set('privacyReviewed', event.target.checked)}
              />
              已確認移除可識別個資
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={value.legalReviewed}
                onChange={(event) => set('legalReviewed', event.target.checked)}
              />
              已確認不構成個案法律意見
            </label>
          </fieldset>
        </aside>
      </div>
    </form>
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
  contentTypes,
  onSave,
}: {
  categories: Category[];
  contentTypes: ContentType[];
  onSave: (kind: 'category' | 'contentType', value: Category | ContentType) => Promise<void>;
}) {
  const [category, setCategory] = useState<Category>({
    slug: '',
    name: '',
    description: '',
    order: 100,
    visible: true,
  });
  const [contentType, setContentType] = useState<ContentType>({
    slug: '',
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState<'category' | 'contentType' | null>(null);
  return (
    <section>
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Organization</p>
          <h1>分類與內容類型</h1>
        </div>
      </div>
      <div className="admin-two-columns">
        <form
          className="admin-form-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving('category');
            try {
              await onSave('category', category);
            } finally {
              setSaving(null);
            }
          }}
        >
          <h2>文章分類</h2>
          <p>用來組織文章主題，例如契約、職涯或工作方法。</p>
          {categories.map((item) => (
            <button
              type="button"
              className="taxonomy-edit"
              key={item.slug}
              onClick={() => setCategory(item)}
            >
              {item.name}
              <small>{item.visible ? '顯示中' : '已隱藏'}</small>
            </button>
          ))}
          <label>
            名稱
            <input
              value={category.name}
              onChange={(event) => setCategory({ ...category, name: event.target.value })}
              required
            />
          </label>
          <label>
            網址代稱
            <input
              value={category.slug}
              onChange={(event) => setCategory({ ...category, slug: event.target.value })}
              required
            />
          </label>
          <label>
            說明
            <textarea
              rows={3}
              value={category.description}
              onChange={(event) => setCategory({ ...category, description: event.target.value })}
              required
            />
          </label>
          <label>
            排序
            <input
              type="number"
              min="0"
              value={category.order}
              onChange={(event) => setCategory({ ...category, order: Number(event.target.value) })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={category.visible}
              onChange={(event) => setCategory({ ...category, visible: event.target.checked })}
            />
            顯示在前台
          </label>
          <LoadingButton loading={saving === 'category'} disabled={saving !== null}>
            儲存分類
          </LoadingButton>
        </form>
        <form
          className="admin-form-card"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving('contentType');
            try {
              await onSave('contentType', contentType);
            } finally {
              setSaving(null);
            }
          }}
        >
          <h2>內容類型</h2>
          <p>定義文章形式，例如法律文章、生活隨筆或讀書筆記。</p>
          {contentTypes.map((item) => (
            <button
              type="button"
              className="taxonomy-edit"
              key={item.slug}
              onClick={() => setContentType(item)}
            >
              {item.name}
            </button>
          ))}
          <label>
            名稱
            <input
              value={contentType.name}
              onChange={(event) => setContentType({ ...contentType, name: event.target.value })}
              required
            />
          </label>
          <label>
            網址代稱
            <input
              value={contentType.slug}
              onChange={(event) => setContentType({ ...contentType, slug: event.target.value })}
              required
            />
          </label>
          <label>
            說明
            <textarea
              rows={3}
              value={contentType.description}
              onChange={(event) =>
                setContentType({ ...contentType, description: event.target.value })
              }
              required
            />
          </label>
          <LoadingButton loading={saving === 'contentType'} disabled={saving !== null}>
            儲存內容類型
          </LoadingButton>
        </form>
      </div>
    </section>
  );
}
