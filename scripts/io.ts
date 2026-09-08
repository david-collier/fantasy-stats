import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}

/**
 * Write `value` as pretty JSON only if the bytes differ from what is on disk.
 * Returns true when the file was written. Keeps `git status` clean on idle
 * runs so the CI commit step has nothing to do.
 */
export function writeJsonIfChanged(path: string, value: unknown): boolean {
  const next = toJson(value)
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8')
    if (prev === next) return false
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, next, 'utf8')
  return true
}

export function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return undefined
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
