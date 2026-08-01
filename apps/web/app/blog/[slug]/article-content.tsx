/**
 * ArticleContent — renders the pre-converted HTML body of an article
 * inside the .tlx-body typography scope (see globals.css).
 * `content` is HTML produced server-side by lib/content/markdown.ts
 * from first-party, repo-controlled markdown.
 */

interface ArticleContentProps {
  content: string;
}

export function ArticleContent({ content }: ArticleContentProps) {
  return <div className="tlx-body" dangerouslySetInnerHTML={{ __html: content }} />;
}
