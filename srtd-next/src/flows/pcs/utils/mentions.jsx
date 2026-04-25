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

// Resolve anchors[] to substring [start,end) ranges in the live caption.
// Anchors that no longer match (caption edited) are dropped — they show
// up as greyed badges in CommentRow instead. First-occurrence wins on
// duplicates. Overlapping ranges are skipped (later anchor loses).
function resolveAnchorRanges(text, anchors) {
  const out = [];
  if (!Array.isArray(anchors) || !anchors.length || !text) return out;
  for (const a of anchors) {
    const snippet = a && a.payload && typeof a.payload.text === 'string' ? a.payload.text : '';
    if (!snippet) continue;
    const start = text.indexOf(snippet);
    if (start < 0) continue;
    const end = start + snippet.length;
    const overlaps = out.some((r) => start < r.end && end > r.start);
    if (overlaps) continue;
    out.push({ start, end, id: a.id, onClick: a.onClick });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

function renderTextSegment(segment, baseKey, idxRef) {
  if (!segment) return null;
  const parts = [];
  let last = 0; let m; let idx = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(segment)) !== null) {
    if (m.index > last) parts.push(<React.Fragment key={`${baseKey}t${idx++}`}>{segment.slice(last, m.index)}</React.Fragment>);
    const tok = m[0];
    if (tok.startsWith('@')) {
      const resolved = resolveMention(tok, idxRef.userRoles);
      parts.push(<span key={`${baseKey}m${idx++}`} className="text-terracotta font-medium">{resolved}</span>);
    } else if (tok.startsWith('#')) {
      parts.push(<span key={`${baseKey}h${idx++}`} className="text-text-soft">{tok}</span>);
    } else {
      parts.push(<a key={`${baseKey}l${idx++}`} href={ensureHref(tok)} target="_blank" rel="noreferrer" className="text-terracotta underline">{tok}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < segment.length) parts.push(<React.Fragment key={`${baseKey}t${idx++}`}>{segment.slice(last)}</React.Fragment>);
  return parts;
}

export function renderRichText(text, userRoles = [], anchors = []) {
  if (!text) return null;
  const ranges = resolveAnchorRanges(text, anchors);
  if (!ranges.length) {
    const idxRef = { userRoles };
    return renderTextSegment(text, 'r', idxRef);
  }
  const idxRef = { userRoles };
  const out = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) {
      out.push(<React.Fragment key={`pre${i}`}>{renderTextSegment(text.slice(cursor, r.start), `pre${i}-`, idxRef)}</React.Fragment>);
    }
    const inner = text.slice(r.start, r.end);
    out.push(
      <mark
        key={`a${i}-${r.id || i}`}
        data-anchor-id={r.id || ''}
        onClick={r.onClick ? (e) => { e.stopPropagation(); r.onClick(r.id); } : undefined}
        className="anchor-mark"
      >
        {renderTextSegment(inner, `a${i}-`, idxRef)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < text.length) {
    out.push(<React.Fragment key={`tail`}>{renderTextSegment(text.slice(cursor), `tail-`, idxRef)}</React.Fragment>);
  }
  return out;
}

export function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
