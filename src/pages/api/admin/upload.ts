import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/admin/auth';
import { errorResponse, json } from '@/lib/admin/http';
import { getContentRepository } from '@/lib/content/repository';
import { detectImageMime } from '@/lib/notion/media';

export const prerender = false;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const maxBytes = 5 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const form = await request.formData();
    const file = form.get('file');
    const alt = String(form.get('alt') || '').trim();
    const width = Number(form.get('width'));
    const height = Number(form.get('height'));
    if (!(file instanceof File)) return json({ message: '請選擇圖片。' }, { status: 400 });
    if (!allowed.has(file.type))
      return json({ message: '只接受 JPG、PNG、WebP 或 AVIF。' }, { status: 400 });
    if (file.size <= 0 || file.size > maxBytes)
      return json({ message: '圖片必須小於 5 MB。' }, { status: 400 });
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (detectImageMime(signature) !== file.type) {
      return json({ message: '圖片格式與檔案內容不符。' }, { status: 400 });
    }
    if (!alt || alt.length > 240)
      return json({ message: '請填寫 240 字內的圖片替代文字。' }, { status: 400 });
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > 12000 ||
      height > 12000
    ) {
      return json({ message: '無法辨識圖片尺寸。' }, { status: 400 });
    }
    return json(
      { media: await getContentRepository().uploadImage(file, alt, { width, height }) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
