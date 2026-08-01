/**
 * ArticleContent — render MDX content as HTML.
 * This component receives pre-parsed HTML from the server.
 */

import type { ReactNode } from 'react';

interface ArticleContentProps {
  content: string | ReactNode;
}

export function ArticleContent({ content }: ArticleContentProps) {
  // If content is already a React component (from MDX), render it directly
  if (typeof content !== 'string') {
    return <>{content}</>;
  }

  // Otherwise, render as HTML (from markdown/MDX parsing)
  return (
    <div
      className=\"prose prose-stone dark:prose-invert max-w-none\"
      dangerouslySetInnerHTML={{
        __html: content,
      }}
    />
  );
}
"