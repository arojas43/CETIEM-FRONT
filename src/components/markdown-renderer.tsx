"use client";

/**
 * Renderer de Markdown ligero sin dependencias externas.
 * Soporta: encabezados, negrita, cursiva, listas, párrafos, código inline y bloques de código.
 */

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de código ```
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className="bg-muted border border-border rounded-lg p-3 text-sm overflow-x-auto my-3 font-mono text-foreground">
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }

    // Encabezados
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h3) {
      elements.push(<h3 key={key++} className="text-base font-semibold text-foreground mt-4 mb-1">{inlineFormat(h3[1])}</h3>);
      i++; continue;
    }
    if (h2) {
      elements.push(<h2 key={key++} className="text-lg font-bold text-foreground mt-5 mb-2">{inlineFormat(h2[1])}</h2>);
      i++; continue;
    }
    if (h1) {
      elements.push(<h1 key={key++} className="text-xl font-bold text-foreground mt-5 mb-2">{inlineFormat(h1[1])}</h1>);
      i++; continue;
    }

    // Lista con * o -
    if (line.match(/^(\s*)[*\-]\s+/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^(\s*)[*\-]\s+/)) {
        const itemText = lines[i].replace(/^(\s*)[*\-]\s+/, "");
        const depth = (lines[i].match(/^(\s*)/)?.[1].length ?? 0) / 2;
        listItems.push(
          <li key={i} className={`text-foreground/90 ${depth > 0 ? "ml-5" : ""}`}>
            {inlineFormat(itemText)}
          </li>
        );
        i++;
      }
      elements.push(<ul key={key++} className="list-disc list-outside ml-5 my-2 space-y-1">{listItems}</ul>);
      continue;
    }

    // Lista numerada
    if (line.match(/^\d+\.\s+/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemText = lines[i].replace(/^\d+\.\s+/, "");
        listItems.push(
          <li key={i} className="text-foreground/90">{inlineFormat(itemText)}</li>
        );
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal list-outside ml-5 my-2 space-y-1">{listItems}</ol>);
      continue;
    }

    // Línea separadora ---
    if (line.match(/^[-*_]{3,}\s*$/)) {
      elements.push(<hr key={key++} className="my-4 border-border" />);
      i++; continue;
    }

    // Párrafo vacío
    if (line.trim() === "") {
      i++; continue;
    }

    // Párrafo normal
    elements.push(
      <p key={key++} className="text-foreground/90 my-1.5 leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return <div className={`prose-like ${className}`}>{elements}</div>;
}

/**
 * Formatea inline: negrita, cursiva, código inline, y texto plano
 */
function inlineFormat(text: string): React.ReactNode[] {
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // **bold**
      parts.push(<strong key={keyIdx++} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(<em key={keyIdx++} className="italic text-foreground/80">{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(<code key={keyIdx++} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-economia-info">{match[4]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
