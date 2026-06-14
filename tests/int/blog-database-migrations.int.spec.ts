import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

describe('production database migrations', () => {
  it('runs Payload migrations before the production build', () => {
    const packageJSON = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>
    }

    expect(packageJSON.scripts?.ci).toBe('npm run payload migrate && npm run build')
    expect(packageJSON.scripts?.build).toBe(
      'cross-env NODE_OPTIONS=--no-deprecation next build --webpack',
    )

    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'),
    ) as {
      buildCommand?: string
    }

    expect(vercelConfig.buildCommand).toBe('npm run ci')
  })

  it('commits an initial migration and migration index', () => {
    const migrationDirectory = path.join(projectRoot, 'src/migrations')
    const migrationFiles = fs
      .readdirSync(migrationDirectory)
      .filter((filename) => filename.endsWith('.ts') && filename !== 'index.ts')

    expect(migrationFiles.length).toBeGreaterThan(0)
    expect(fs.existsSync(path.join(migrationDirectory, 'index.ts'))).toBe(true)
  })
})
