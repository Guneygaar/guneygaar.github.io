import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

var src = readFileSync(resolve(__dirname, '..', '06-post-create.js'), 'utf8');
var htmlSrc = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');

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
