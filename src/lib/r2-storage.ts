const R2_ENVIRONMENT_KEYS = [
  'R2_ACCESS_KEY_ID',
  'R2_BUCKET',
  'R2_ENDPOINT',
  'R2_PUBLIC_URL',
  'R2_SECRET_ACCESS_KEY',
] as const

type R2EnvironmentKey = (typeof R2_ENVIRONMENT_KEYS)[number]
type R2Environment = Partial<Record<R2EnvironmentKey, string | undefined>>

export type R2StorageConfig = {
  accessKeyId: string
  bucket: string
  endpoint: string
  publicURL: string
  region: string
  secretAccessKey: string
}

const normalizeURL = (value: string): string => value.trim().replace(/\/+$/, '')

const normalizeHTTPURL = (key: 'R2_ENDPOINT' | 'R2_PUBLIC_URL', value: string): string => {
  try {
    const url = new URL(value.trim())

    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol')

    return normalizeURL(url.toString())
  } catch {
    throw new Error(`${key} 必須是有效的 http/https URL`)
  }
}

export function resolveR2StorageConfig(environment: R2Environment): R2StorageConfig | null {
  const configuredKeys = R2_ENVIRONMENT_KEYS.filter((key) => environment[key]?.trim())

  if (configuredKeys.length === 0) return null

  const missingKeys = R2_ENVIRONMENT_KEYS.filter((key) => !environment[key]?.trim())

  if (missingKeys.length > 0) {
    throw new Error(`R2 設定不完整，缺少：${missingKeys.join(', ')}`)
  }

  return {
    accessKeyId: environment.R2_ACCESS_KEY_ID!.trim(),
    bucket: environment.R2_BUCKET!.trim(),
    endpoint: normalizeHTTPURL('R2_ENDPOINT', environment.R2_ENDPOINT!),
    publicURL: normalizeHTTPURL('R2_PUBLIC_URL', environment.R2_PUBLIC_URL!),
    region: 'auto',
    secretAccessKey: environment.R2_SECRET_ACCESS_KEY!.trim(),
  }
}

export function createR2PublicURL({
  filename,
  prefix,
  publicURL,
}: {
  filename: string
  prefix?: string
  publicURL: string
}): string {
  const objectKey = [prefix, filename]
    .filter(Boolean)
    .map((part) => part!.replace(/^\/+|\/+$/g, ''))
    .join('/')

  return `${normalizeURL(publicURL)}/${objectKey}`
}

export function getR2ImageRemotePattern(publicURL?: string): {
  hostname: string
  pathname: string
  port: string
  protocol: 'http' | 'https'
} | null {
  if (!publicURL?.trim()) return null

  const url = new URL(publicURL)
  const pathname = url.pathname.replace(/\/+$/, '')

  return {
    hostname: url.hostname,
    pathname: `${pathname || ''}/**`,
    port: url.port,
    protocol: url.protocol.replace(':', '') as 'http' | 'https',
  }
}
