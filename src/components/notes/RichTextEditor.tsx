import Placeholder from '@tiptap/extension-placeholder'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table/kit'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Table,
  TableProperties,
  Undo,
  Redo,
} from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toEditorHtml } from '@/lib/richTextUtils'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  minHeight?: string
  className?: string
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className={cn('h-3.5 w-3.5', editor.isActive('bold') && 'text-primary')} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className={cn('h-3.5 w-3.5', editor.isActive('italic') && 'text-primary')} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={setLink}
        title="Link"
      >
        <LinkIcon className={cn('h-3.5 w-3.5', editor.isActive('link') && 'text-primary')} />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className={cn('h-3.5 w-3.5', editor.isActive('heading', { level: 1 }) && 'text-primary')} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className={cn('h-3.5 w-3.5', editor.isActive('heading', { level: 2 }) && 'text-primary')} />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        disabled={!editor.can().chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert table"
      >
        <Table className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        disabled={!editor.can().chain().focus().toggleHeaderRow().run()}
        title="Toggle header row"
      >
        <TableProperties className="h-3.5 w-3.5" />
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        title="Undo"
      >
        <Undo className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        title="Redo"
      >
        <Redo className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  minHeight = '200px',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit,
      Placeholder.configure({ placeholder: placeholder ?? 'Start typing…' }),
    ],
    content: toEditorHtml(value || ''),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-w-0 focus:outline-none px-3 py-2',
      },
      handleDOMEvents: {
        blur: () => onBlur?.(),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const html = toEditorHtml(value || '')
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (editor) editor.setEditable(!disabled)
  }, [editor, disabled])

  return (
    <div
      className={cn(
        'flex flex-col rounded-md border bg-background',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div className="shrink-0">
        <Toolbar editor={editor} />
      </div>
      <div
        className="min-w-0"
        style={{ minHeight }}
      >
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:min-h-[theme(spacing.40)] [&_.ProseMirror]:outline-none"
        />
      </div>
    </div>
  )
}
