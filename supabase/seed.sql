-- Deterministic local seed. Auth users are created by CI/e2e bootstrap because
-- Supabase Auth owns their password hashes and identities.
insert into public.content_types (slug, name, description)
values ('legal-articles', '法律文章', '整理法律實務經驗、制度與工作方法。')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, name, description, display_order, visible)
values
  ('legal-practice', '法律實務', '從契約、爭議與日常法律工作中整理可帶走的判斷方法。', 10, true),
  ('experience', '經驗分享', '記錄法律工作與職涯現場的觀察。', 20, true),
  ('work-methods', '工作方法', '整理溝通、研究與決策流程。', 30, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order,
  visible = excluded.visible;

insert into public.site_settings (
  id, site_title, short_title, site_description, author_name, author_role, author_bio
)
values (
  1,
  '法律實務筆記',
  '法律筆記',
  '從實務現場出發，記錄法律工作、制度觀察與日常生活中的法律思考。',
  'Local Admin',
  '法律實務工作者',
  '本地測試用管理員內容，僅供資料庫整合測試使用。'
)
on conflict (id) do nothing;
