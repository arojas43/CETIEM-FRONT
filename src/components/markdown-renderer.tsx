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
        <pre key={key++} className="bg-gray-100 rounded-lg p-3 text-sm overflow-x-auto my-3 font-mono text-gray-800">
          {codeLines.join("\n")}
        </pre>
      );
      i++; // saltar la línea de cierre ```
      continue;
    }

    // Encabezados
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h3) {
      elements.push(<h3 key={key++} className="text-base font-semibold text-gray-800 mt-4 mb-1">{inlineFormat(h3[1])}</h3>);
      i++; continue;
    }
    if (h2) {
      elements.push(<h2 key={key++} className="text-lg font-bold text-gray-900 mt-5 mb-2">{inlineFormat(h2[1])}</h2>);
      i++; continue;
    }
    if (h1) {
      elements.push(<h1 key={key++} className="text-xl font-bold text-gray-900 mt-5 mb-2">{inlineFormat(h1[1])}</h1>);
      i++; continue;
    }

    // Lista con * o -
    if (line.match(/^(\s*)[*\-]\s+/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^(\s*)[*\-]\s+/)) {
        const itemText = lines[i].replace(/^(\s*)[*\-]\s+/, "");
        const depth = (lines[i].match(/^(\s*)/)?.[1].length ?? 0) / 2;
        listItems.push(
          <li key={i} className={`text-gray-700 ${depth > 0 ? "ml-5" : ""}`}>
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
          <li key={i} className="text-gray-700">{inlineFormat(itemText)}</li>
        );
        i++;
      }
      elements.push(<ol key={key++} className="list-decimal list-outside ml-5 my-2 space-y-1">{listItems}</ol>);
      continue;
    }

    // Línea separadora ---
    if (line.match(/^[-*_]{3,}\s*$/)) {
      elements.push(<hr key={key++} className="my-4 border-gray-200" />);
      i++; continue;
    }

    // Párrafo vacío
    if (line.trim() === "") {
      i++; continue;
    }

    // Párrafo normal
    elements.push(
      <p key={key++} className="text-gray-800 my-1.5 leading-relaxed">
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
  // Regex para capturar **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = pattern.exec(text)) !== null) {
    // Texto antes del match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // **bold**
      parts.push(<strong key={keyIdx++} className="font-semibold text-gray-900">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(<em key={keyIdx++} className="italic">{match[3]}</em>);
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(<code key={keyIdx++} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">{match[4]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
