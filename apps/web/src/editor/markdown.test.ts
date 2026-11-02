import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("Markdown preview renderer", () => {
  it("escapes HTML before applying formatting", () => {
    const html = renderMarkdown(
      '<script>alert("xss")</script> and **bold**',
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders headings, emphasis, and inline code", () => {
    const html = renderMarkdown(
      "# Title\n\nUse *care* and `npm test`.",
    );

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<em>care</em>");
    expect(html).toContain("<code>npm test</code>");
  });

  it("renders unordered and ordered lists", () => {
    const html = renderMarkdown("- One\n- Two\n\n1. First\n2. Second");

    expect(html).toContain("<ul><li>One</li><li>Two</li></ul>");
    expect(html).toContain("<ol><li>First</li><li>Second</li></ol>");
  });

  it("renders blockquotes after escaping", () => {
    const html = renderMarkdown("> Stay curious.");

    expect(html).toContain("<blockquote>Stay curious.</blockquote>");
  });

  it("renders fenced code blocks without formatting their contents", () => {
    const html = renderMarkdown("```\n**keep literal**\n```");

    expect(html).toContain("<pre><code>**keep literal**</code></pre>");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(renderMarkdown("   \n  ")).toBe("");
  });
});
