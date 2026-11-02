const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);
}

function renderInline(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

/**
 * Small, intentionally limited Markdown renderer. All input is HTML-escaped
 * before any formatting tags are added, so stored or generated text cannot
 * inject markup into the preview.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown.trim()) {
    return "";
  }

  const lines = escapeHtml(markdown).replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let codeLines: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      html.push(`<p>${paragraph.map(renderInline).join("<br />")}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (listType) {
      html.push(
        `<${listType}>${listItems
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join("")}</${listType}>`,
      );
      listType = null;
      listItems = [];
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (codeLines === null) {
        flushParagraph();
        flushList();
        codeLines = [];
      } else {
        html.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
        codeLines = null;
      }
      continue;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      html.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    const unorderedItem = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextListType = unorderedItem ? "ul" : "ol";

      if (listType && listType !== nextListType) {
        flushList();
      }

      listType = nextListType;
      listItems.push((unorderedItem ?? orderedItem)![1]!);
      continue;
    }

    // Lines are HTML-escaped before block parsing, so a Markdown quote marker
    // appears as the entity "&gt;" here.
    const quote = line.match(/^\s*&gt;\s?(.*)$/);

    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${renderInline(quote[1]!)}</blockquote>`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (codeLines !== null) {
    html.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}
