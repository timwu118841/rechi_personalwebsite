import { siteConfig } from '@/config/site';
import type { SiteSettings } from './types';

export const defaultSiteSettings: SiteSettings = {
  siteTitle: siteConfig.name,
  shortTitle: siteConfig.shortName,
  siteDescription: siteConfig.description,
  authorName: siteConfig.author.name,
  authorRole: siteConfig.author.role,
  authorBio: siteConfig.author.bio,
  defaultSocialImage: {
    url: '/social-card.svg',
    alt: `${siteConfig.name}預設分享圖片`,
    width: 1200,
    height: 630,
  },
};
