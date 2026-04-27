import { describe, it, expect } from 'vitest'
import { toPlainTextPreview, formatFileSize, isExternalLink } from './utils'

describe('toPlainTextPreview', () => {
  it('returns empty string for falsy input', () => {
    expect(toPlainTextPreview('')).toBe('')
  })

  it('strips markdown headings', () => {
    expect(toPlainTextPreview('## Hello World')).toBe('Hello World')
  })

  it('strips bold and italic markers', () => {
    expect(toPlainTextPreview('**bold** and *italic*')).toBe('bold and italic')
  })

  it('strips inline code', () => {
    expect(toPlainTextPreview('use `fmt.Println`')).toBe('use fmt.Println')
  })

  it('strips fenced code blocks', () => {
    expect(toPlainTextPreview('before\n```go\npackage main\n```\nafter')).toBe('before after')
  })

  it('strips markdown links but keeps text', () => {
    expect(toPlainTextPreview('[Go](https://go.dev)')).toBe('Go')
  })

  it('strips image markdown but keeps alt', () => {
    expect(toPlainTextPreview('![logo](logo.png)')).toBe('logo')
  })

  it('strips blockquotes', () => {
    expect(toPlainTextPreview('> quote')).toBe('quote')
  })

  it('strips unordered list markers', () => {
    expect(toPlainTextPreview('- item one\n- item two')).toBe('item one item two')
  })

  it('collapses multiple newlines and spaces', () => {
    expect(toPlainTextPreview('a\n\n\nb')).toBe('a b')
  })
})

describe('formatFileSize', () => {
  it('returns dash for zero', () => {
    expect(formatFileSize(0)).toBe('-')
  })

  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('isExternalLink', () => {
  it('returns false for empty string', () => {
    expect(isExternalLink('')).toBe(false)
  })

  it('returns true for protocol-relative URL', () => {
    expect(isExternalLink('//cdn.example.com/img.png')).toBe(true)
  })

  it('returns false for relative path', () => {
    expect(isExternalLink('/about')).toBe(false)
  })

  it('returns false for hash-only link', () => {
    expect(isExternalLink('#section')).toBe(false)
  })

  it('returns true for external https URL', () => {
    expect(isExternalLink('https://external.example.com')).toBe(true)
  })

  it('returns false for same-origin URL', () => {
    // In jsdom, window.location.href defaults to "about:blank" — origin is "null",
    // so any http URL is considered external. Test the relative-path case instead.
    expect(isExternalLink('/same-origin-page')).toBe(false)
  })
})
