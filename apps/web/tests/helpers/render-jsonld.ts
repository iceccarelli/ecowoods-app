/**
 * tests/helpers/render-jsonld.ts — render a sitemap URL through its real page
 * module and return the JSON-LD nodes the page body emits.
 *
 * The root layout injects the Organization / WebSite nodes on every page
 * (app/layout.tsx), so a page that ALSO emits one would produce a duplicate.
 * This helper renders the page module only (no layout), which is exactly the
 * set of nodes a page adds on top of the layout's.
 *
 * Callers must `vi.mock` the modules that need a server (auth, next/headers,
 * next/navigation) before importing this file's consumers.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

export const APP_DIR = path.resolve(__dirname, '../../app');

export interface RouteMatch {
  file: string;
  params: Record<string, string>;
}

/** Resolve a URL pathname to its app/**\/page.tsx and the dynamic params. */
export function matchPage(pathname: string): RouteMatch | null {
  const parts = pathname.split('/').filter(Boolean);
  const walk = (dir: string, i: number, params: Record<string, string>): RouteMatch | null => {
    if (i === parts.length) {
      const f = path.join(dir, 'page.tsx');
      return existsSync(f) ? { file: f, params } : null;
    }
    const seg = parts[i]!;
    const dirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    // static segment wins over a dynamic one, as in Next
    for (const e of dirs) {
      if (e.name === seg) {
        const r = walk(path.join(dir, e.name), i + 1, params);
        if (r) return r;
      }
    }
    for (const e of dirs) {
      if (/^\(.+\)$/.test(e.name)) {
        const r = walk(path.join(dir, e.name), i, params);
        if (r) return r;
      }
    }
    for (const e of dirs) {
      const m = /^\[([^.\]]+)\]$/.exec(e.name);
      if (m) {
        const r = walk(path.join(dir, e.name), i + 1, { ...params, [m[1]!]: decodeURIComponent(seg) });
        if (r) return r;
      }
    }
    return null;
  };
  return walk(APP_DIR, 0, {});
}

export interface Rendered {
  html: string;
  nodes: Record<string, any>[];
  metadata: any;
}

/** Render the page for `pathname`; returns html, parsed JSON-LD nodes, and metadata. */
export async function renderPage(pathname: string): Promise<Rendered> {
  const m = matchPage(pathname);
  if (!m) throw new Error(`no page module for ${pathname}`);
  const mod = await import(/* @vite-ignore */ m.file);
  const props = { params: Promise.resolve(m.params), searchParams: Promise.resolve({}) };
  const el = await mod.default(props);
  const html = renderToStaticMarkup(createElement('div', null, el));
  const metadata =
    typeof mod.generateMetadata === 'function'
      ? await mod.generateMetadata(props, Promise.resolve({}))
      : (mod.metadata ?? null);
  return { html, nodes: extractJsonLd(html), metadata };
}

export function extractJsonLd(html: string): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  for (const m of html.matchAll(re)) {
    // dangerouslySetInnerHTML is emitted verbatim: no HTML-unescaping.
    out.push(JSON.parse(m[1]!));
  }
  return out;
}

/** Flatten @graph wrappers and arrays into individual nodes. */
export function flattenNodes(docs: Record<string, any>[]): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  for (const d of docs) {
    if (Array.isArray(d)) out.push(...flattenNodes(d));
    else if (Array.isArray(d['@graph'])) out.push(...flattenNodes(d['@graph']));
    else out.push(d);
  }
  return out;
}

export function isDir(p: string) {
  return existsSync(p) && statSync(p).isDirectory();
}
