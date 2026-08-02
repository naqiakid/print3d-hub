import React from 'react'

export function cleanDescription(description: string | null | undefined): string {
  if (!description) return ''
  return description
    .replace(/\s*<!-- ASSEMBLY_METADATA: .*? -->/g, '')
    .replace(/\s*<!-- MESH_MAPPING: .*? -->/g, '')
    .replace(/\s*<!-- ALLOWED_FILAMENTS: .*? -->/g, '')
    .replace(/\s*<!-- TEXT_MESH_INDEX: .*? -->/g, '')
    .replace(/\s*<!-- GCODE_STATS: .*? -->/g, '')
    .replace(/\s*<!-- DESIGNER_METADATA: .*? -->/g, '')
    .trim()
}

export default function MarkdownDescription({
  description,
  className = '',
}: {
  description: string | null | undefined
  className?: string
}) {
  const cleanText = cleanDescription(description)
  if (!cleanText) return null

  const isHTML = /<[a-z][\s\S]*>/i.test(cleanText)
  if (isHTML) {
    return (
      <div 
        className={`space-y-2 text-slate-600 text-sm leading-relaxed ${className} [&_ul]:list-disc [&_ul]:list-inside [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:ml-4 [&_strong]:font-semibold [&_strong]:text-slate-850 [&_em]:italic [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-850 [&_h3]:mt-3 [&_h3]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:italic [&_blockquote]:text-slate-500`}
        dangerouslySetInnerHTML={{ __html: cleanText }}
      />
    )
  }

  // Split text by lines to handle paragraphs and lists
  const lines = cleanText.split('\n')
  return (
    <div className={`space-y-1.5 leading-relaxed text-sm text-slate-605 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        
        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />
        }

        // Determine if line has indentation in original text (e.g. starting with 2+ spaces or a tab)
        const indentMatch = line.match(/^(\s+)(.*)$/)
        const isIndented = indentMatch && (indentMatch[1].includes('\t') || indentMatch[1].length >= 2)
        const indentClass = isIndented ? 'ml-6' : ''

        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2)
          return (
            <div key={idx} className={`pl-6 -indent-6 text-slate-600 text-sm ${indentClass}`}>
              <span className="inline-block w-6 text-slate-400 text-center pr-2 select-none">•</span>
              {parseInlineMarkdown(content)}
            </div>
          )
        }

        // Numbered list (e.g., 1. Item, 10. Item)
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
        if (numberedMatch) {
          const num = numberedMatch[1]
          const content = numberedMatch[2]
          return (
            <div key={idx} className={`pl-6 -indent-6 text-slate-655 text-sm ${indentClass}`}>
              <span className="inline-block w-6 text-slate-400 font-semibold text-right pr-2 select-none">{num}.</span>
              {parseInlineMarkdown(content)}
            </div>
          )
        }
        
        // Blockquote
        if (trimmed.startsWith('> ')) {
          const content = trimmed.substring(2)
          return (
            <blockquote key={idx} className={`border-l-4 border-slate-200 pl-4 py-0.5 italic text-slate-500 text-sm ${indentClass}`}>
              {parseInlineMarkdown(content)}
            </blockquote>
          )
        }

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className={`text-xs font-bold uppercase tracking-wider text-slate-800 mt-3 mb-1 ${indentClass}`}>
              {parseInlineMarkdown(trimmed.substring(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className={`text-sm font-bold text-slate-800 mt-4 mb-1.5 ${indentClass}`}>
              {parseInlineMarkdown(trimmed.substring(3))}
            </h3>
          )
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className={`text-base font-bold text-slate-900 mt-4 mb-2 ${indentClass}`}>
              {parseInlineMarkdown(trimmed.substring(2))}
            </h2>
          )
        }

        // Standard paragraph
        return (
          <p key={idx} className={`text-slate-600 ${indentClass}`}>
            {parseInlineMarkdown(line)}
          </p>
        )
      })}
    </div>
  )
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  let parts: React.ReactNode[] = []
  let remaining = text

  // Regex to match bold (**text**), italic (*text*), code (`text`), and links ([text](url))
  const inlineRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g
  const matches = [...remaining.matchAll(inlineRegex)]

  if (matches.length === 0) {
    return [remaining]
  }

  let lastIndex = 0
  matches.forEach((match, idx) => {
    const matchText = match[0]
    const matchIndex = match.index!

    // Add plain text before match
    if (matchIndex > lastIndex) {
      parts.push(remaining.substring(lastIndex, matchIndex))
    }

    if (matchText.startsWith('**') && matchText.endsWith('**')) {
      parts.push(<strong key={idx} className="font-semibold text-slate-800">{matchText.slice(2, -2)}</strong>)
    } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
      parts.push(<em key={idx} className="italic">{matchText.slice(1, -1)}</em>)
    } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
      parts.push(
        <code key={idx} className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200/60 font-mono text-[11px] text-orange-600">
          {matchText.slice(1, -1)}
        </code>
      )
    } else if (matchText.startsWith('[') && matchText.includes('](')) {
      const closingBracket = matchText.indexOf('](')
      const label = matchText.substring(1, closingBracket)
      const url = matchText.substring(closingBracket + 2, matchText.length - 1)
      parts.push(
        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600 underline font-medium">
          {label}
        </a>
      )
    }

    lastIndex = matchIndex + matchText.length
  })

  // Add trailing plain text
  if (lastIndex < remaining.length) {
    parts.push(remaining.substring(lastIndex))
  }

  return parts
}
