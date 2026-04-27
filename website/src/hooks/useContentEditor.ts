import { useState, useEffect, useCallback } from 'react'
import { getContent, createContent, updateContent } from 'src/api/content'
import type { ContentStatus, CreateContentArgs, Content } from 'src/types/content'

// UseContentEditorOptions defines the parameters for the useContentEditor hook.
interface UseContentEditorOptions {
  id?: string
  onLoadError: () => void
}

// UseContentEditorLoadResult is the callback type for custom content field extraction.
type OnLoadCallback = (data: Content) => void

// UseContentEditorReturn provides shared editor state and save logic.
interface UseContentEditorReturn {
  isNew: boolean
  loading: boolean
  saving: boolean
  title: string
  setTitle: (v: string) => void
  category: string
  setCategory: (v: string) => void
  tags: string[]
  setTags: (v: string[]) => void
  contentStatus: ContentStatus
  setContentStatus: (v: ContentStatus) => void
  save: (data: CreateContentArgs) => Promise<string | undefined>
}

// useContentEditor encapsulates the shared state and content-loading logic
// used by VideoEditorForm, GalleryEditorForm, and ArticleEditorForm.
// If onLoad is provided, it is called after the common fields are populated,
// so each form can extract its type-specific fields (attachments, speaker, etc.).
export function useContentEditor(
  { id, onLoadError }: UseContentEditorOptions,
  onLoad?: OnLoadCallback,
): UseContentEditorReturn {
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [contentStatus, setContentStatus] = useState<ContentStatus>('draft')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        const c = res.data
        setTitle(c.title)
        setCategory(c.category)
        setTags(c.tags || [])
        setContentStatus(c.status || 'published')

        // Let the consumer extract type-specific fields (attachments, speaker, body, etc.)
        onLoad?.(c)
      })
      .catch(() => onLoadError())
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (data: CreateContentArgs): Promise<string | undefined> => {
    if (saving) return
    setSaving(true)
    try {
      if (isNew) {
        const res = await createContent(data)
        return res.data.id
      }
      const res = await updateContent(id!, data)
      return res.data.id
    } catch {
      return undefined
    } finally {
      setSaving(false)
    }
  }, [id, isNew, saving])

  return {
    isNew, loading, saving,
    title, setTitle,
    category, setCategory,
    tags, setTags,
    contentStatus, setContentStatus,
    save,
  }
}
