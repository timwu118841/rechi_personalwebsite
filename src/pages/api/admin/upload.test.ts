import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdmin, getContentRepository } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getContentRepository: vi.fn(),
}));

vi.mock('@/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/lib/content/repository', () => ({ getContentRepository }));

import { POST } from './upload';

describe('admin image upload endpoint', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    getContentRepository.mockReset();
    requireAdmin.mockResolvedValue({ id: 'admin-id' });
  });

  it('rejects executable text disguised with an image MIME type', async () => {
    const uploadImage = vi.fn();
    getContentRepository.mockReturnValue({ uploadImage });
    const form = new FormData();
    form.set(
      'file',
      new File(['<script>alert(document.domain)</script>'], 'payload.png', {
        type: 'image/png',
      }),
    );
    form.set('alt', '惡意測試圖片');
    form.set('width', '640');
    form.set('height', '480');
    const request = new Request('https://example.com/api/admin/upload', {
      method: 'POST',
      body: form,
    });

    const response = await POST({ request } as never);

    expect(response.status).toBe(400);
    expect(uploadImage).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ message: '圖片格式與檔案內容不符。' });
  });

  it('accepts an allowed MIME type when the file signature matches', async () => {
    const media = { id: 'media-id', url: 'https://example.com/image.png' };
    const uploadImage = vi.fn(async () => media);
    getContentRepository.mockReturnValue({ uploadImage });
    const form = new FormData();
    form.set(
      'file',
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'safe.png', {
        type: 'image/png',
      }),
    );
    form.set('alt', '安全圖片');
    form.set('width', '640');
    form.set('height', '480');
    const request = new Request('https://example.com/api/admin/upload', {
      method: 'POST',
      body: form,
    });

    const response = await POST({ request } as never);

    expect(response.status).toBe(201);
    expect(uploadImage).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({ media });
  });
});
