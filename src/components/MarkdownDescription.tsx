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

  // Split text by lines to handle paragraphs and lists
  const lines = cleanText.split('\n')
  return (
    <div className={`space-y-1.5 leading-relaxed text-sm text-slate-600 ${className}`}>
      {lines.map((line, idx) => {
        // Bullet list
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const content = line.trim().substring(2)
          return (
            <ul key={idx} className="list-disc list-inside ml-3 text-slate-600">
              <li>{parseInlineMarkdown(content)}</li>
            </ul>
          )
        }
        
        // Headings
        if (line.trim().startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold uppercase tracking-wider text-slate-800 mt-2 mb-1">
              {parseInlineMarkdown(line.trim().substring(4))}
            </h4>
          )
        }
        if (line.trim().startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-slate-800 mt-3 mb-1">
              {parseInlineMarkdown(line.trim().substring(3))}
            </h3>
          )
        }
        if (line.trim().startsWith('# ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-slate-900 mt-3 mb-1.5">
              {parseInlineMarkdown(line.trim().substring(2))}
            </h2>
          )
        }

        // Empty line
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-slate-600">
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
