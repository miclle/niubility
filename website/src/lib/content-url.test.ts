import { describe, it, expect } from 'vitest'
import { contentDetailPath, contentEditPath, contentNewPath } from './content-url'

describe('contentDetailPath', () => {
  it('builds video detail path', () => {
    expect(contentDetailPath({ id: 'abc', type: 'video' })).toBe('/video/abc')
  })

  it('builds article detail path', () => {
    expect(contentDetailPath({ id: '123', type: 'article' })).toBe('/article/123')
  })

  it('builds gallery detail path', () => {
    expect(contentDetailPath({ id: 'g1', type: 'gallery' })).toBe('/gallery/g1')
  })

  it('builds podcast detail path', () => {
    expect(contentDetailPath({ id: 'p1', type: 'podcast' })).toBe('/podcast/p1')
  })

  it('appends hash when provided', () => {
    expect(contentDetailPath({ id: 'abc', type: 'video' }, 'comments')).toBe('/video/abc#comments')
  })

  it('omits hash when not provided', () => {
    expect(contentDetailPath({ id: 'abc', type: 'video' })).not.toContain('#')
  })
})

describe('contentEditPath', () => {
  it('builds edit path', () => {
    expect(contentEditPath({ id: 'abc', type: 'article' })).toBe('/article/abc/edit')
  })
})

describe('contentNewPath', () => {
  it('builds new path for video', () => {
    expect(contentNewPath('video')).toBe('/video/new')
  })

  it('builds new path for gallery', () => {
    expect(contentNewPath('gallery')).toBe('/gallery/new')
  })

  it('builds new path for article', () => {
    expect(contentNewPath('article')).toBe('/article/new')
  })

  it('builds new path for podcast', () => {
    expect(contentNewPath('podcast')).toBe('/podcast/new')
  })
})
