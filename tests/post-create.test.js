import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var src = readFileSync(resolve(__dirname, '..', '06-post-create.js'), 'utf8');
var htmlSrc = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');
var pcsSrc = readFileSync(resolve(__dirname, '..', 'actions', 'pcs.js'), 'utf8');

describe('New Post Form — payload fields', function() {

  it('1. drive_link is read from #new-post-drive-link and included in payload', function() {
    expect(src).toContain("'new-post-drive-link'");
    expect(src).toContain('drive_link:');
  });

  it('2. drive_link is null when input is empty (not empty string)', function() {
    // The pattern: .trim() || null ensures null on empty
    var match = src.match(/driveLinkVal\s*=[\s\S]{0,100}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('|| null');
  });

  it('3. format is read from #new-post-format and included in payload', function() {
    expect(src).toContain("'new-post-format'");
    var payloadMatch = src.match(/const payload[\s\S]{0,500}/);
    expect(payloadMatch).toBeTruthy();
    expect(payloadMatch[0]).toContain('format:');
  });

  it('4. format is null when not selected (not empty string)', function() {
    var match = src.match(/formatVal\s*=[\s\S]{0,100}/);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('|| null');
  });

  it('5. new-post-drive-link input exists in HTML', function() {
    expect(htmlSrc).toContain('id="new-post-drive-link"');
  });

  it('6. drive_link input is cleared on form open when no draft', function() {
    expect(src).toContain("'new-post-drive-link'");
    // It should be in the array that gets cleared
    var clearMatch = src.match(/\['new-post-title'[^\]]*\]/);
    expect(clearMatch).toBeTruthy();
    expect(clearMatch[0]).toContain('new-post-drive-link');
  });
});

describe('New Post Form — NPS rgba violations removed', function() {

  var cssSrc = readFileSync(resolve(__dirname, '..', 'styles.css'), 'utf8');
  // Extract only the NPS block
  var npsStart = cssSrc.indexOf('/* -- New Post Sheet (NPS)');
  var npsEnd = cssSrc.indexOf('/* =', npsStart + 1);
  var npsBlock = cssSrc.slice(npsStart, npsEnd > 0 ? npsEnd : npsStart + 5000);

  it('7. no rgba() in NPS CSS block', function() {
    var rgbaMatches = npsBlock.match(/rgba\(/g);
    expect(rgbaMatches).toBeNull();
  });

  it('8. upload photos dashed border in HTML uses solid hex', function() {
    var uploadMatch = htmlSrc.match(/new-post-asset[\s\S]{0,300}dashed/);
    expect(uploadMatch).toBeTruthy();
    expect(uploadMatch[0]).not.toContain('rgba');
  });
});

describe('PCS — _buildDriveLinkCard', function() {

  var _buildDriveLinkCard;

  beforeAll(function() {
    window.esc = function(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
    // Extract and eval _buildDriveLinkCard
    var match = pcsSrc.match(/function _buildDriveLinkCard\(driveUrl, canManage, postId\)[\s\S]*?^}/m);
    expect(match).toBeTruthy();
    var fn = new Function('esc', match[0] + '\nreturn _buildDriveLinkCard;');
    _buildDriveLinkCard = fn(window.esc);
  });

  it('9. returns link card with View on Drive when driveUrl provided', function() {
    var html = _buildDriveLinkCard('https://drive.google.com/abc', false, 'POST-1');
    expect(html).toContain('View on Drive');
    expect(html).toContain('href="https://drive.google.com/abc"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('Edit link');
  });

  it('10. returns link card with edit/remove buttons when canManage', function() {
    var html = _buildDriveLinkCard('https://drive.google.com/abc', true, 'POST-1');
    expect(html).toContain('View on Drive');
    expect(html).toContain('Edit link');
    expect(html).toContain('Remove');
    expect(html).toContain('data-action="pcs-edit-drive-link"');
    expect(html).toContain('data-action="pcs-clear-drive-link"');
  });

  it('11. returns add button when no driveUrl and canManage true', function() {
    var html = _buildDriveLinkCard(null, true, 'POST-1');
    expect(html).toContain('+ Add drive link');
    expect(html).toContain('data-action="pcs-edit-drive-link"');
    expect(html).not.toContain('View on Drive');
  });

  it('12. returns empty string when no driveUrl and canManage false', function() {
    var html = _buildDriveLinkCard(null, false, 'POST-1');
    expect(html).toBe('');
  });

  it('13. pcs-drive-link-wrap exists in index.html', function() {
    expect(htmlSrc).toContain('id="pcs-drive-link-wrap"');
  });
});

describe('Create Post Caption — ⤢ expand + session cost + word counter', function() {

  var captionSrc = readFileSync(resolve(__dirname, '..', 'actions', 'pcs-claude-caption.js'), 'utf8');
  var cssSrc = readFileSync(resolve(__dirname, '..', 'styles.css'), 'utf8');

  it('14. 06-post-create.js wires expand button + detached open helpers', function() {
    expect(src).toContain('_npcOpenWorkspace');
    expect(src).toContain('_npcUpdateWordMeter');
    expect(src).toContain('_npcRefreshCostChip');
    expect(src).toContain('npc-expand-btn');
    expect(src).toContain('onUse:');
  });

  it('15. submitNewPost fires post_id=is.null ai_usage stamp PATCH', function() {
    expect(src).toContain('post_id=is.null');
    expect(src).toContain('/ai_usage?post_id=is.null');
  });

  it('16. saveDraft + loadDraft round-trip caption', function() {
    // Anchor on function boundaries by name — both functions sit between
    // the 'function saveDraft' / 'function loadDraft' lines and the next
    // 'function ' declaration. This avoids nested-brace regex pitfalls.
    var saveStart = src.indexOf('function saveDraft()');
    var saveEnd = src.indexOf('function loadDraft()');
    var loadStart = saveEnd;
    var loadEnd = src.indexOf('function clearDraft()');
    expect(saveStart).toBeGreaterThan(-1);
    expect(saveEnd).toBeGreaterThan(saveStart);
    expect(loadEnd).toBeGreaterThan(loadStart);
    var saveBody = src.slice(saveStart, saveEnd);
    var loadBody = src.slice(loadStart, loadEnd);
    expect(saveBody).toContain("'new-post-caption'");
    expect(saveBody).toContain('caption:');
    expect(loadBody).toContain("'new-post-caption'");
    expect(loadBody).toContain('d.caption');
  });

  it('17. no .cp-* caption class regression (client-portal namespace)', function() {
    expect(src).not.toContain('cp-caption');
  });

  it('18. no ₹85 multiplier regression — USD→INR stays at ×100', function() {
    expect(src).not.toContain('* 85');
    expect(src).not.toContain('× 85');
    expect(captionSrc).toContain('_CW_USD_TO_INR = 100');
    expect(captionSrc).not.toContain('_CW_USD_TO_INR = 85');
  });

  it('19. no unauthorized font regressions (Source Serif / JetBrains Mono)', function() {
    expect(src).not.toContain('Source Serif');
    expect(src).not.toContain('JetBrains Mono');
    expect(cssSrc).not.toContain('Source Serif');
    expect(cssSrc).not.toContain('JetBrains Mono');
  });

  it('20. Caption Workspace supports detached mode (isDetached + callbacks)', function() {
    expect(captionSrc).toContain('isDetached');
    expect(captionSrc).toContain('onUseCallback');
    expect(captionSrc).toContain('onCloseCallback');
  });

  it('21. index.html has ⤢ expand button + word meter + cost chip', function() {
    expect(htmlSrc).toContain('id="npc-expand-btn"');
    expect(htmlSrc).toContain('id="npc-word-meter"');
    expect(htmlSrc).toContain('id="npc-cost-chip"');
    expect(htmlSrc).toContain('npc-caption-wrap');
  });

  it('22. .npc-* CSS block exists + no rgba() + Fraunces 500 on caption body', function() {
    var npcStart = cssSrc.indexOf('.npc-caption-wrap');
    expect(npcStart).toBeGreaterThan(-1);
    var npcBlock = cssSrc.slice(npcStart);
    expect(npcBlock).not.toMatch(/rgba\(/);
    expect(npcBlock).toContain("'Fraunces'");
    expect(npcBlock).toContain("font-weight: 500");
  });
});
