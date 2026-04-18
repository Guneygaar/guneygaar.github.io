// Prompt builders for the React Caption Workspace.
//
// v1 MVP: write mode (generate 3 options) + chat mode (iterative
// conversation). Polish / QC / Rewrite / memory prompts live in
// the vanilla workspace and will be ported here only when a React
// call site actually needs them.

export function buildWritePrompt(ctx) {
  const brief = (ctx && ctx.brief) || '';
  const title = (ctx && ctx.title) || '';
  const pillar = (ctx && ctx.pillar) || '';
  const existing = (ctx && ctx.initialCaption) || '';

  if (brief) {
    return 'Here is the brief to write from:\n\n' + brief +
      '\n\nWrite 3 caption options in GBL voice. Return exactly 3 numbered options. No preamble.';
  }

  let msg = 'Generate 3 alternative caption options for this post';
  if (title) msg += ': ' + title;
  msg += '.';
  if (pillar) msg += '\nContent pillar: ' + pillar;
  if (existing) msg += '\nCurrent caption: ' + existing;
  msg += '\n\nReturn exactly 3 numbered options. No preamble.';
  return msg;
}
