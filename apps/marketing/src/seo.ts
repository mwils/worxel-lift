import { useEffect } from "react";

/**
 * Runtime head management for SPA routes. Pre-rendered routes (/, /privacy,
 * /terms) get correct static heads at build time; these hooks cover client-side
 * navigation and the routes that can't be pre-rendered (dynamic /book/:slug,
 * /booking/:token, and the 404 catch-all). Google honors rendered meta after
 * its JS pass — partial credit, but correct.
 */

/** Mark the current route noindex (thin/dynamic/404 pages). Restores on unmount. */
export function useNoindex(): void {
  useEffect(() => {
    const tag = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prev = tag?.content ?? null;
    if (tag) tag.content = "noindex";
    return () => {
      if (tag && prev !== null) tag.content = prev;
    };
  }, []);
}

/** Point the canonical tag (and title, if given) at this route. */
export function useCanonical(path: string, title?: string): void {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevHref = link?.href ?? null;
    const prevTitle = document.title;
    if (link) link.href = `https://lift.worxel.com${path}`;
    if (title) document.title = title;
    return () => {
      if (link && prevHref !== null) link.href = prevHref;
      if (title) document.title = prevTitle;
    };
  }, [path, title]);
}
