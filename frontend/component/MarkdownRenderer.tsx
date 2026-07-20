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

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let currentList: { items: string[]; type: 'bullet' | 'checklist' } | null = null;
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
        <ul key={`list-${key}`} className="list-disc list-inside flex flex-col gap-1.5 my-3 pl-2 text-slate-300 text-xs">
          {currentList.items.map((item, i) => (
            <li key={i} className="leading-relaxed">{parseInline(item)}</li>
          ))}
        </ul>
      );
    }
    currentList = null;
  };

  const flushQuote = (key: number) => {
    if (currentQuote.length === 0) return;
    elements.push(
      <blockquote key={`quote-${key}`} className="border-l-4 border-safety-orange bg-white/5 p-4 rounded-r-xl my-4 text-xs italic text-slate-300 leading-relaxed">
        {parseInline(currentQuote.join('\n'))}
      </blockquote>
    );
    currentQuote = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we are inside a table
    if (line.startsWith('|')) {
      flushList(i);
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
      flushTable(i);
      currentQuote.push(line.replace(/^>\s*/, ''));
      continue;
    } else if (currentQuote.length > 0) {
      flushQuote(i);
    }

    // Check if we are in a list
    const listMatch = line.match(/^([*\-]\s+)(.*)$/);
    if (listMatch) {
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
      // If next line is not a list, flush the current list
      flushList(i);
    }

    // Header 3
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-heading text-sm font-bold text-white mt-4 mb-2 pb-1 border-b border-white/5 flex items-center gap-1.5">
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Header 4
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="font-heading text-xs font-semibold text-slate-200 mt-3 mb-1.5">
          {parseInline(line.slice(5))}
        </h4>
      );
      continue;
    }

    // Empty line or simple break
    if (line === '') {
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-xs text-slate-300 leading-relaxed mb-3">
        {parseInline(line)}
      </p>
    );
  }

  // Flush any remaining blocks
  flushTable(lines.length);
  flushList(lines.length);
  flushQuote(lines.length);

  return <div className="flex flex-col gap-1 text-slate-300 font-sans">{elements}</div>;
}
