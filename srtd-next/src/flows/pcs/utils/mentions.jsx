import React from 'react';

// Linkifies: @mentions (terracotta text-only, no bg), #hashtags (dim), and URLs.
// Mention tokens match either plain `@shortname` or `@local@domain.com`
// so raw email mentions resolve to display names via user_roles.

const TOKEN_RE = /(@[\w.-]+(?:@[\w.-]+\.[a-z]{2,})?|#\w+|https?:\/\/\S+|(?:[\w-]+\.)+(?:com|io|in|ai|co|org|net|app|dev|xyz|me)(?:\/\S*)?)/gi;

function ensureHref(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
}

function resolveMention(token, userRoles) {
  const inner = token.slice(1);
  if (inner.includes('@')) {
    const match = Array.isArray(userRoles) ? userRoles.find(u => u.email === inner) : null;
    if (match?.name) return '@' + match.name;
    return '@' + inner.split('@')[0];
  }
  const match = Array.isArray(userRoles) ? userRoles.find(u => u.name && u.name.toLowerCase() === inner.toLowerCase()) : null;
  if (match?.name) return '@' + match.name;
  return token;
}

export function renderRichText(text, userRoles = []) {
  if (!text) return null;
  const parts = [];
  let last = 0; let m; let idx = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(<React.Fragment key={`t${idx++}`}>{text.slice(last, m.index)}</React.Fragment>);
    const tok = m[0];
    if (tok.startsWith('@')) {
      const resolved = resolveMention(tok, userRoles);
      parts.push(<span key={`m${idx++}`} className="text-terracotta font-medium">{resolved}</span>);
    } else if (tok.startsWith('#')) {
      parts.push(<span key={`h${idx++}`} className="text-text-soft">{tok}</span>);
    } else {
      parts.push(<a key={`l${idx++}`} href={ensureHref(tok)} target="_blank" rel="noreferrer" className="text-terracotta underline">{tok}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<React.Fragment key={`t${idx++}`}>{text.slice(last)}</React.Fragment>);
  return parts;
}

export function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
