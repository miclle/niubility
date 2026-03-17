import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useCallback, useEffect, useRef } from 'react'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Code, ImagePlus, Undo, Redo, Minus } from 'lucide-react'

import { uploadFile } from 'src/api/upload'

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
        background: active ? '#e5e5e5' : 'transparent',
        color: disabled ? '#d4d4d4' : '#606060',
      }}
    >
      {children}
    </button>
  )
}

// RichTextEditor is a Tiptap-based rich text editor with image upload support.
function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
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
    // Only update if the external value differs from editor state (avoid cursor jump)
    if (value !== currentHTML) {
      editor.commands.setContent(value, false)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle image upload and insertion
  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return
    try {
      const url = await uploadFile(file, 'images')
      editor.chain().focus().setImage({ src: url }).run()
    } catch (err) {
      console.error('Image upload failed:', err)
    }
  }, [editor])

  // Handle paste events for image upload
  useEffect(() => {
    if (!editor) return

    const handlePaste = (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return false

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) handleImageUpload(file)
          return true
        }
      }
      return false
    }

    const handleDrop = (_view: unknown, event: DragEvent) => {
      const files = event.dataTransfer?.files
      if (!files?.length) return false

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          event.preventDefault()
          handleImageUpload(file)
          return true
        }
      }
      return false
    }

    editor.view.props.handlePaste = handlePaste
    editor.view.props.handleDrop = handleDrop
  }, [editor, handleImageUpload])

  if (!editor) return null

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5" style={{ borderBottom: '1px solid #e5e5e5', background: '#fafafa' }}>
        <ToolbarButton title="加粗" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1" style={{ background: '#e5e5e5' }} />

        <ToolbarButton title="标题 1" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton title="标题 2" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading2 size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1" style={{ background: '#e5e5e5' }} />

        <ToolbarButton title="无序列表" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton title="有序列表" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1" style={{ background: '#e5e5e5' }} />

        <ToolbarButton title="代码块" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton title="分割线" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={16} />
        </ToolbarButton>

        <div className="w-px h-5 mx-1" style={{ background: '#e5e5e5' }} />

        <ToolbarButton title="插入图片" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus size={16} />
        </ToolbarButton>

        <div className="flex-1" />

        <ToolbarButton title="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton title="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo size={16} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-4 py-3 min-h-[240px] focus-within:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[220px] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2"
      />

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImageUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default RichTextEditor
