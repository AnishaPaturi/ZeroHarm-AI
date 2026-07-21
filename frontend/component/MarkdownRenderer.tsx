import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  const parseInline = (text: string): React.ReactNode[] => {
    // Basic inline parser for bold **text** and code `text`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-safety-orange text-xs">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  // Pre-process raw markdown text to fix missing linebreaks before headers, after section titles, and before list items
  const normalizedContent = content
    .replace(/(#{1,6}\s+)(Summary|Relevant Regulations|Historical Incidents|Recommended Actions|Integrated Prevention Plan|Regulatory Compliance Check|Preemptive Safety Focus)\s+([^#\n]+)/gi, '$1$2\n$3')
    .replace(/([^\n])\s*(#{1,6}\s+)/g, '$1\n\n$2')
    .replace(/([^\n])\s*([*\-]\s+)/g, '$1\n$2');

  const lines = normalizedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let currentList: { items: string[]; type: 'bullet' | 'checklist' } | null = null;
  let currentNumList: { items: { prefix: string; text: string }[] } | null = null;
  let currentQuote: string[] = [];

  const flushTable = (key: number) => {
    if (!currentTable) return;
    elements.push(
      <div key={`table-${key}`} className="overflow-x-auto my-3 rounded-xl border border-white/10 bg-black/20">
        <table className="min-w-full divide-y divide-white/10 text-xs">
          <thead className="bg-white/5 text-slate-300 font-semibold">
            <tr>
              {currentTable.headers.map((h, i) => (
                <th key={i} className="px-4 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {currentTable.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2">{parseInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTable = null;
  };

  const flushList = (key: number) => {
    if (!currentList) return;
    if (currentList.type === 'checklist') {
      elements.push(
        <div key={`list-${key}`} className="flex flex-col gap-2 my-3">
          {currentList.items.map((item, i) => {
            const isChecked = item.startsWith('[x]') || item.startsWith('[X]');
            const cleanText = item.replace(/^\[[ xX]\]\s*/, '');
            return (
              <div key={i} className="flex items-start gap-2 bg-white/5 border border-white/5 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={isChecked}
                  readOnly
                  className="w-4 h-4 rounded border-white/10 bg-black/30 text-safety-orange focus:ring-0 focus:ring-offset-0 mt-0.5 pointer-events-none accent-safety-orange"
                />
                <span className="text-slate-300 text-xs leading-relaxed">{parseInline(cleanText)}</span>
              </div>
            );
          })}
        </div>
      );
    } else {
      elements.push(
        <div key={`list-${key}`} className="flex flex-col gap-1.5 my-3 pl-2 text-slate-300 text-xs">
          {currentList.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-safety-orange mt-1.5 flex-shrink-0" />
              <span className="leading-relaxed">{parseInline(item)}</span>
            </div>
          ))}
        </div>
      );
    }
    currentList = null;
  };

  const flushNumList = (key: number) => {
    if (!currentNumList) return;
    elements.push(
      <div key={`numlist-${key}`} className="flex flex-col gap-1.5 my-3 pl-2 text-slate-300 text-xs">
        {currentNumList.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="font-semibold text-safety-orange flex-shrink-0 font-mono w-5 text-right">{item.prefix}.</span>
            <span className="leading-relaxed">{parseInline(item.text)}</span>
          </div>
        ))}
      </div>
    );
    currentNumList = null;
  };

  const flushQuote = (key: number) => {
    if (currentQuote.length === 0) return;
    const firstLine = currentQuote[0].trim();
    const alertTags = ['[!WARNING]', '[!TIP]', '[!NOTE]', '[!IMPORTANT]', '[!CAUTION]'] as const;
    let detectedTag: typeof alertTags[number] | null = null;
    let inlineText = '';
    
    for (const tag of alertTags) {
      if (firstLine.startsWith(tag)) {
        detectedTag = tag;
        inlineText = firstLine.slice(tag.length).trim();
        break;
      }
    }

    if (detectedTag) {
      const contentLines = inlineText ? [inlineText, ...currentQuote.slice(1)] : currentQuote.slice(1);
      let bg = '';
      let border = '';
      let text = '';
      let titleColor = '';
      let titleText = '';
      
      if (detectedTag === '[!WARNING]') {
        bg = 'bg-red-500/10';
        border = 'border-red-500/20';
        text = 'text-red-300';
        titleColor = 'text-red-400';
        titleText = '⚠️ Warning';
      } else if (detectedTag === '[!TIP]') {
        bg = 'bg-emerald-500/10';
        border = 'border-emerald-500/20';
        text = 'text-emerald-300';
        titleColor = 'text-emerald-400';
        titleText = '💡 Pro Tip';
      } else if (detectedTag === '[!NOTE]') {
        bg = 'bg-blue-500/10';
        border = 'border-blue-500/20';
        text = 'text-blue-300';
        titleColor = 'text-blue-400';
        titleText = 'ℹ️ Note';
      } else if (detectedTag === '[!IMPORTANT]') {
        bg = 'bg-amber-500/10';
        border = 'border-amber-500/20';
        text = 'text-amber-300';
        titleColor = 'text-amber-400';
        titleText = '⚠️ Important';
      } else if (detectedTag === '[!CAUTION]') {
        bg = 'bg-red-600/15';
        border = 'border-red-600/30';
        text = 'text-red-300';
        titleColor = 'text-red-500';
        titleText = '🛑 Caution';
      }
      
      elements.push(
        <div key={`quote-${key}`} className={`my-4 p-4 ${bg} border ${border} rounded-2xl ${text} font-sans text-xs leading-relaxed`}>
          <div className={`font-bold flex items-center gap-1.5 mb-2 ${titleColor} uppercase tracking-wider text-[10px]`}>
            <span>{titleText}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {contentLines.map((l, index) => (
              <p key={index}>{parseInline(l)}</p>
            ))}
          </div>
        </div>
      );
    } else {
      elements.push(
        <blockquote key={`quote-${key}`} className="border-l-4 border-safety-orange bg-white/5 p-4 rounded-r-xl my-4 text-xs italic text-slate-300 leading-relaxed">
          {currentQuote.map((l, index) => (
            <p key={index}>{parseInline(l)}</p>
          ))}
        </blockquote>
      );
    }
    currentQuote = [];
  };

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we are inside a code block
    if (inCodeBlock) {
      if (line.startsWith('```')) {
        inCodeBlock = false;
        elements.push(
          <pre key={`code-${i}`} className="bg-black/40 border border-white/10 p-4 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto my-3">
            <code className="block whitespace-pre">{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        codeBlockLines.push(lines[i]); // Keep original spaces and tabs
      }
      continue;
    }

    if (line.startsWith('```')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      inCodeBlock = true;
      codeBlockLang = line.slice(3).trim();
      continue;
    }

    // Check if we are inside a table
    if (line.startsWith('|')) {
      flushList(i);
      flushNumList(i);
      flushQuote(i);
      
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip separator row (e.g. |---|---|)
      if (cells.every(c => c.startsWith('-'))) {
        continue;
      }
      
      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    } else if (currentTable) {
      flushTable(i);
    }

    // Check if we are in a quote
    if (line.startsWith('>')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      currentQuote.push(line.replace(/^>\s*/, ''));
      continue;
    } else if (currentQuote.length > 0) {
      flushQuote(i);
    }

    // Check if we are in a bullet list
    const listMatch = line.match(/^([*\-]\s+)(.*)$/);
    if (listMatch) {
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      
      const content = listMatch[2].trim();
      const isChecklist = content.startsWith('[ ]') || content.startsWith('[x]') || content.startsWith('[X]');
      
      if (!currentList) {
        currentList = { items: [content], type: isChecklist ? 'checklist' : 'bullet' };
      } else {
        currentList.items.push(content);
      }
      continue;
    } else if (currentList) {
      flushList(i);
    }

    // Check if we are in a numbered list
    const numListMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numListMatch) {
      flushList(i);
      flushTable(i);
      flushQuote(i);
      
      const numPrefix = numListMatch[1];
      const content = numListMatch[2].trim();
      
      if (!currentNumList) {
        currentNumList = { items: [{ prefix: numPrefix, text: content }] };
      } else {
        currentNumList.items.push({ prefix: numPrefix, text: content });
      }
      continue;
    } else if (currentNumList) {
      flushNumList(i);
    }

    // Header 1
    if (line.startsWith('# ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h1 key={i} className="font-heading text-lg font-bold text-white mt-6 mb-3 pb-1 border-b border-white/10 flex items-center gap-1.5">
          {parseInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Header 2
    if (line.startsWith('## ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h2 key={i} className="font-heading text-base font-bold text-white mt-5 mb-2.5 pb-1 border-b border-white/5 flex items-center gap-1.5">
          {parseInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Header 3
    if (line.startsWith('### ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h3 key={i} className="font-heading text-sm font-bold text-white mt-4 mb-2 pb-1 border-b border-white/5 flex items-center gap-1.5">
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Header 4
    if (line.startsWith('#### ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h4 key={i} className="font-heading text-xs font-semibold text-slate-200 mt-3 mb-1.5">
          {parseInline(line.slice(5))}
        </h4>
      );
      continue;
    }

    // Header 5
    if (line.startsWith('##### ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h5 key={i} className="font-heading text-[11px] font-semibold text-slate-300 mt-2.5 mb-1">
          {parseInline(line.slice(6))}
        </h5>
      );
      continue;
    }

    // Header 6
    if (line.startsWith('###### ')) {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(
        <h6 key={i} className="font-heading text-[10px] font-semibold text-slate-400 mt-2 mb-1 uppercase tracking-wider">
          {parseInline(line.slice(7))}
        </h6>
      );
      continue;
    }

    // Horizontal rule
    if (line === '---') {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      elements.push(<hr key={i} className="border-white/10 my-4" />);
      continue;
    }

    // Empty line or simple break
    if (line === '') {
      flushList(i);
      flushNumList(i);
      flushTable(i);
      flushQuote(i);
      continue;
    }

    // Normal paragraph
    flushList(i);
    flushNumList(i);
    flushTable(i);
    flushQuote(i);
    elements.push(
      <p key={i} className="text-xs text-slate-300 leading-relaxed mb-3">
        {parseInline(line)}
      </p>
    );
  }

  // Flush any remaining blocks
  flushTable(lines.length);
  flushList(lines.length);
  flushNumList(lines.length);
  flushQuote(lines.length);
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre key={`code-end`} className="bg-black/40 border border-white/10 p-4 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto my-3">
        <code className="block whitespace-pre">{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return <div className="flex flex-col gap-1 text-slate-300 font-sans">{elements}</div>;
}
