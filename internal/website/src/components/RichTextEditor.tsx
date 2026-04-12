import { useEditor, EditorContent, NodeViewWrapper, type NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Node, mergeAttributes } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Code, ImagePlus, Undo, Redo, Minus, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { uploadFile, fileURL } from 'src/api/upload'

// RichTextEditorProps defines the props for the rich text editor.
export interface RichTextEditorProps {
  // HTML content value.
  value: string
  // Callback when content changes.
  onChange: (html: string) => void
}

// ToolbarButton renders a single toolbar action button.
function ToolbarButton({ onClick, active, disabled, children, title }: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="p-1.5 rounded transition-colors"
      style={{
        background: active ? 'var(--surface-hover)' : 'transparent',
        color: disabled ? 'var(--surface-border)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

// --- Upload placeholder extension ---

// ImagePlaceholder is a custom node that shows a loading state while an image is being uploaded.
const ImagePlaceholder = Node.create({
  name: 'imagePlaceholder',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      fileName: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-image-placeholder]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-image-placeholder': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePlaceholderView)
  },
})

// ImagePlaceholderView renders the upload placeholder UI.
function ImagePlaceholderView({ node }: NodeViewProps) {
  const { t } = useTranslation('editor')
  return (
    <NodeViewWrapper>
      <div
        className="app-surface-muted border app-border flex items-center gap-3 px-4 py-3 my-2 rounded-lg"
      >
        <Loader2 size={18} className="app-text-tertiary animate-spin" />
        <span className="app-text-tertiary text-sm">
          {t('editor:uploadingImage', { filename: node.attrs.fileName || 'Image' })}
        </span>
      </div>
    </NodeViewWrapper>
  )
}

// --- Resizable image node view ---

// ResizableImageView renders an image with drag-to-resize handles.
function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const [resizing, setResizing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = imgRef.current?.offsetWidth || 0

    const handleMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startXRef.current
      const newWidth = Math.max(100, startWidthRef.current + diff)
      updateAttributes({ width: newWidth })
    }

    const handleMouseUp = () => {
      setResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])

  return (
    <NodeViewWrapper className="relative inline-block my-2" style={{ width: node.attrs.width ? `${node.attrs.width}px` : undefined }}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        title={node.attrs.title || ''}
        className="block max-w-full rounded-lg"
        style={{
          width: node.attrs.width ? `${node.attrs.width}px` : undefined,
          outline: selected ? '2px solid #3b82f6' : 'none',
          cursor: 'default',
        }}
        draggable={false}
      />
      {selected && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 bottom-0 flex items-center"
          style={{ right: -6, cursor: 'ew-resize', padding: '0 3px', zIndex: 10 }}
        >
          <div
            className="rounded"
            style={{
              width: 6,
              height: 48,
              background: resizing ? '#3b82f6' : '#94a3b8',
              transition: resizing ? 'none' : 'background 0.15s',
            }}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}

// ResizableImage extends the Image extension with a width attribute and resize NodeView.
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}) },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

// --- Editor ---

let placeholderIdCounter = 0

// RichTextEditor is a Tiptap-based rich text editor with image upload support.
function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      ImagePlaceholder,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g., loading existing content)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!editor) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const currentHTML = editor.getHTML()
    // Defer setContent to avoid flushSync inside React lifecycle (Tiptap ReactNodeViewRenderer issue)
    if (value !== currentHTML) {
      queueMicrotask(() => {
        editor.commands.setContent(value, false)
      })
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Replace a placeholder node with the uploaded image, or remove it on failure.
  const replacePlaceholder = useCallback((id: string, src?: string) => {
    if (!editor) return
    const { doc, tr } = editor.state
    let found = false
    doc.descendants((node, pos) => {
      if (found) return false
      if (node.type.name === 'imagePlaceholder' && node.attrs.id === id) {
        if (src) {
          tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.image.create({ src }))
        } else {
          tr.delete(pos, pos + node.nodeSize)
        }
        found = true
        return false
      }
    })
    if (found) editor.view.dispatch(tr)
  }, [editor])

  // Handle multiple image files: batch-insert placeholders in one transaction, then upload in parallel.
  const handleImages = useCallback((files: File[]) => {
    if (!editor || files.length === 0) return

    const items = files.map((file) => ({
      id: `upload_${++placeholderIdCounter}`,
      file,
    }))

    // Insert all placeholders in a single transaction
    editor.chain().focus().insertContent(
      items.map(({ id, file }) => ({ type: 'imagePlaceholder', attrs: { id, fileName: file.name } }))
    ).run()

    // Upload all in parallel, each replaces its own placeholder
    for (const { id, file } of items) {
      uploadFile(file)
        .then((key) => replacePlaceholder(id, fileURL(key)))
        .catch((err) => {
          console.error('Image upload failed:', err)
          replacePlaceholder(id)
        })
    }
  }, [editor, replacePlaceholder])

  // Handle paste events for image upload
  useEffect(() => {
    if (!editor) return

    const handlePaste = (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return false

      const imageFiles: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length === 0) return false

      event.preventDefault()
      handleImages(imageFiles)
      return true
    }

    const handleDrop = (_view: unknown, event: DragEvent) => {
      const files = event.dataTransfer?.files
      if (!files?.length) return false

      const imageFiles: File[] = []
      for (const file of files) {
        if (file.type.startsWith('image/')) imageFiles.push(file)
      }
      if (imageFiles.length === 0) return false

      event.preventDefault()
      handleImages(imageFiles)
      return true
    }

    editor.view.props.handlePaste = handlePaste
    editor.view.props.handleDrop = handleDrop
  }, [editor, handleImages])

  if (!editor) return null

  return (
    <div className="app-surface-elevated border app-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="app-surface-muted border-b app-border flex items-center gap-0.5 flex-wrap px-2 py-1.5">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1 bg-[var(--surface-border)]" />

        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1 bg-[var(--surface-border)]" />

        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1 bg-[var(--surface-border)]" />

        <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1 bg-[var(--surface-border)]" />

        <ToolbarButton title="Insert image" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus size={16} />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo size={16} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="rich-content rich-editor-content max-w-none px-4 py-3 min-h-[240px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[220px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
      />

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) handleImages(Array.from(files))
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default RichTextEditor
