export const postTextColorStyles = {
  ink: { label: '墨黑', css: { color: '#111827' } },
  charcoal: { label: '深灰', css: { color: '#374151' } },
  gray: { label: '灰色', css: { color: '#6B7280' } },
  silver: { label: '淺灰', css: { color: '#9CA3AF' } },
  navy: { label: '藏青', css: { color: '#172554' } },
  blue: { label: '藍色', css: { color: '#1D4ED8' } },
  lake: { label: '湖藍', css: { color: '#0369A1' } },
  cyan: { label: '青色', css: { color: '#0891B2' } },
  wine: { label: '酒紅', css: { color: '#7F1D1D' } },
  red: { label: '紅色', css: { color: '#DC2626' } },
  orange: { label: '橘色', css: { color: '#C2410C' } },
  gold: { label: '金棕', css: { color: '#A16207' } },
  forest: { label: '深綠', css: { color: '#14532D' } },
  green: { label: '綠色', css: { color: '#15803D' } },
  plum: { label: '深紫', css: { color: '#581C87' } },
  purple: { label: '紫色', css: { color: '#7E22CE' } },
} as const

const postFontSizes = [
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
  '28px',
  '32px',
  '36px',
  '40px',
] as const

export const postFontSizeStyles = Object.fromEntries(
  postFontSizes.map((size) => [size, { label: size, css: { 'font-size': size } }]),
) as Record<(typeof postFontSizes)[number], { label: string; css: { 'font-size': string } }>
