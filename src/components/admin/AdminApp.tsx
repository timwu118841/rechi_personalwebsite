import { createClient, type Session } from '@supabase/supabase-js';
import { lazy, Suspense, type SyntheticEvent, useEffect, useMemo, useState } from 'react';
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

type Tab = 'articles' | 'site' | 'taxonomies';

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
  return <Dashboard session={session} onSignOut={() => client.auth.signOut()} />;
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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState('');
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error =
      search.get('error_description') ||
      search.get('error') ||
      hash.get('error_description') ||
      hash.get('error');
    if (error) {
      setOauthError(error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
  async function signInWithGoogle() {
    setBusy(true);
    setOauthError('');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (error) setOauthError('Google 登入失敗，請稍後再試。');
    setBusy(false);
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await client.auth.signInWithPassword({ email, password });
    setMessage(error ? '登入失敗，請檢查帳號密碼與管理權限。' : '登入成功。');
    setBusy(false);
  }
  return (
    <section className="admin-login">
      <div>
        <p className="admin-kicker">Private publishing</p>
        <h1>內容管理登入</h1>
        <p>只有列入管理者名單的帳號可以編輯或發布內容。</p>
      </div>
      <form onSubmit={submit}>
        <button type="button" onClick={signInWithGoogle} disabled={busy}>
          {busy ? '登入中…' : '使用 Google 登入'}
        </button>
        {oauthError && <p role="alert">{oauthError}</p>}
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
            <button disabled={busy}>{busy ? '登入中…' : '登入'}</button>
            {message && <p role="status">{message}</p>}
          </>
        )}
      </form>
    </section>
  );
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('articles');
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [editing, setEditing] = useState<AdminArticle | null>(null);
  const [message, setMessage] = useState('正在載入後台資料…');

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
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
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
          <button className="text-button" onClick={onSignOut}>
            登出
          </button>
        </div>
      </header>
      <div className="admin-workspace">
        <nav className="admin-sidebar" aria-label="後台導覽">
          <p>內容</p>
          <button className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>
            文章管理
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
          {message && (
            <p className="admin-message" role="status">
              {message}
            </p>
          )}
          {tab === 'articles' && (
            <ArticlesPanel
              articles={articles}
              categories={categories}
              contentTypes={contentTypes}
              editing={editing}
              setEditing={setEditing}
              upload={upload}
              onSave={async (article) => {
                setMessage('儲存中…');
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
                  setMessage('文章已儲存，公開快取正在更新。');
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          )}
          {tab === 'site' && settings && (
            <SiteSettingsPanel
              settings={settings}
              upload={upload}
              onSave={async (value) => {
                setMessage('儲存中…');
                try {
                  const result = await api<{ settings: SiteSettings }>('/api/admin/settings', {
                    method: 'PUT',
                    body: JSON.stringify(value),
                  });
                  setSettings(result.settings);
                  setMessage('網站設定已更新，公開快取正在更新。');
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          )}
          {tab === 'taxonomies' && (
            <TaxonomyPanel
              categories={categories}
              contentTypes={contentTypes}
              onSave={async (kind, value) => {
                setMessage('儲存中…');
                try {
                  await api('/api/admin/taxonomies', {
                    method: 'POST',
                    body: JSON.stringify({ kind, value }),
                  });
                  await reload();
                  setMessage('內容設定已更新。');
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
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
  const [uploadError, setUploadError] = useState('');
  const set = <K extends keyof AdminArticle>(key: K, next: AdminArticle[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(value);
      }}
    >
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Article editor</p>
          <h1>{value.id ? '編輯文章' : '新增文章'}</h1>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <button>儲存文章</button>
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
                  setUploadError('');
                  try {
                    set('cover', await upload(file, altInput.value.trim()));
                  } catch (error) {
                    setUploadError(
                      error instanceof Error ? error.message : '圖片上傳失敗，請再試一次。',
                    );
                  } finally {
                    event.target.value = '';
                    setUploading(false);
                  }
                }}
              />
            </label>
            {uploading && <small>圖片上傳中…</small>}
            {uploadError && <small role="alert">{uploadError}</small>}
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
  const set = <K extends keyof SiteSettings>(key: K, next: SiteSettings[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  return (
    <form
      className="admin-form narrow"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(value);
      }}
    >
      <div className="admin-title-row">
        <div>
          <p className="admin-kicker">Presentation</p>
          <h1>網站與作者</h1>
        </div>
        <button>儲存設定</button>
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
  return (
    <fieldset>
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
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <small>圖片上傳中…</small>}
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
          onSubmit={(event) => {
            event.preventDefault();
            void onSave('category', category);
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
          <button>儲存分類</button>
        </form>
        <form
          className="admin-form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave('contentType', contentType);
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
          <button>儲存內容類型</button>
        </form>
      </div>
    </section>
  );
}
