'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Heading3, List, ListOrdered, Quote, Link2, Trash2
} from 'lucide-react'

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Describe your product's features, dimensions, printing details...",
  className = '',
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-orange-500 hover:text-orange-600 underline font-medium',
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `w-full min-h-[220px] max-h-[350px] overflow-y-auto bg-transparent px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:ml-4 [&_strong]:font-semibold [&_em]:italic [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:italic [&_blockquote]:text-slate-500 focus-visible:outline-none ${
          !value ? 'before:content-[attr(placeholder)] before:text-slate-400 before:pointer-events-none before:absolute' : ''
        }`,
        placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync value from outside if it changes (and is different to prevent recursive cursor jumping)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  if (!editor) {
    return null
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 bg-slate-50/20 overflow-hidden focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition duration-150 shadow-sm ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 px-3 py-2 select-none">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('bold') ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('underline') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('strike') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('code') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Inline Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('blockquote') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={setLink}
          className={`rounded p-1 transition active:scale-95 ${
            editor.isActive('link') ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
          }`}
          title="Insert Link"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition active:scale-95 ml-auto"
          title="Clear Formatting"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor Container */}
      <div className="relative bg-white flex-1 flex">
        <EditorContent editor={editor} className="w-full flex" />
      </div>
    </div>
  )
}
