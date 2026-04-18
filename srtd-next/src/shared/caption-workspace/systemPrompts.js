// System-prompt builders for Caption Workspace. Each builder
// returns a string that goes into the USER content (the Worker
// already prepends its own brand-voice system prompt via the
// feature flag). Keep the return schema for angles/review strict
// so JSON.parse() can read it without a regex dance.

export function buildAnglesPrompt(brief, extras = {}) {
  const title = (extras.title || '').trim();
  const pillar = (extras.pillar || '').trim();
  return (
    'Read this brief and propose exactly 3 distinct angles for a ' +
    'LinkedIn post in GBL voice. Each angle should attack the brief ' +
    'from a different emotional or strategic direction — not three ' +
    'restatements of the same idea.\n\n' +
    (title ? `Title so far: ${title}\n` : '') +
    (pillar ? `Content pillar: ${pillar}\n` : '') +
    '\nBrief:\n' + (brief || '(no brief)') +
    '\n\nReturn a JSON object only — no preamble, no markdown, no backticks — shaped:\n' +
    '{ "angles": [ { "title": "3-5 word label", "hook": "one-sentence angle" }, … exactly 3 items ] }'
  );
}

export function buildWritePrompt(brief, angle, extras = {}) {
  const title = (extras.title || '').trim();
  return (
    'Write ONE LinkedIn caption in GBL voice based on the angle ' +
    'below. 80-120 words. Plain text (no markdown, no preamble, ' +
    'no hashtags). Return ONLY the caption.\n\n' +
    (title ? `Title: ${title}\n` : '') +
    (angle ? `Angle: ${angle.title}\nHook: ${angle.hook}\n\n` : '') +
    'Brief:\n' + (brief || '(no brief)')
  );
}

export function buildRefinePrompt(currentDraft, type) {
  const label = String(type || '').toLowerCase();
  return (
    `Rewrite this caption to make it ${label}. Keep the same ` +
    'structure and core meaning. Return ONLY the revised caption — ' +
    'no preamble, no commentary.\n\n' +
    (currentDraft || '')
  );
}

export function buildReviewPrompt(caption) {
  return (
    'QC this LinkedIn caption against the GBL brand guide and ' +
    'return a structured verdict. Check: Voice, Hook strength, ' +
    'Closing, Length, Leadership tone, Hashtag count, Overall tone.\n\n' +
    'Caption:\n' + (caption || '(empty)') +
    '\n\nReturn a JSON object only — no preamble, no markdown, no backticks — shaped:\n' +
    '{ "items": [ { "mark": "PASS" | "FLAG", "title": "check name", "text": "1 line verdict" }, … ] }'
  );
}

export function buildRewritePrompt(draft, checkedFlags) {
  const list = (checkedFlags || []).map((f, i) => `${i + 1}. ${f.title}: ${f.text}`).join('\n');
  return (
    'Rewrite this caption to address ONLY the flags listed below. ' +
    'Keep everything else intact. Return ONLY the revised caption — ' +
    'no preamble, no commentary.\n\n' +
    'Flags to fix:\n' + (list || '(none)') +
    '\n\nCurrent caption:\n' + (draft || '')
  );
}

export function buildTitleSynthPrompt(brief) {
  return (
    'Read this brief and return exactly 3-5 words that could title ' +
    'a social post. No punctuation, no quotes, no emojis — just the ' +
    'words on a single line.\n\nBrief:\n' + (brief || '(no brief)')
  );
}
