import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Source-regex analysis tests for the avatar crop modal in 12-profiles.js.
// Follows the same pattern as tests/critical-handlers.test.js — we verify
// the structural contract of the crop pipeline (file selection → crop modal
// → handleAvatarUpload) so a future refactor can't silently bypass the crop
// step or break the canvas math.

var profilesSrc = fs.readFileSync(
  path.join(__dirname, '..', '12-profiles.js'),
  'utf8'
);

var indexHtml = fs.readFileSync(
  path.join(__dirname, '..', 'index.html'),
  'utf8'
);

describe('Avatar crop modal — index.html overlay', function() {
  it('exposes #prof-crop-overlay element with z-index above prof-overlay', function() {
    expect(indexHtml).toContain('id="prof-crop-overlay"');
    // prof-overlay sits at z-index 1500 — crop must sit above it
    expect(indexHtml).toMatch(
      /id="prof-crop-overlay"[^>]*z-index:\s*1600/
    );
  });

  it('crop overlay starts hidden', function() {
    expect(indexHtml).toMatch(
      /id="prof-crop-overlay"[^>]*display:\s*none/
    );
  });

  it('crop overlay uses 8-digit hex backdrop (no rgba)', function() {
    // CLAUDE.md design rule: NO rgba(), use 8-digit hex like #000000B3
    var overlayMatch = indexHtml.match(/id="prof-crop-overlay"[^>]*background:\s*([^;"]+)/);
    expect(overlayMatch).toBeTruthy();
    expect(overlayMatch[1]).toMatch(/^#[0-9a-fA-F]{6,8}$/);
    expect(overlayMatch[1]).not.toMatch(/rgba/);
  });
});

describe('Avatar crop modal — source contract (12-profiles.js)', function() {

  // ====================================================
  // 1. Photo input wiring — must route through crop modal
  // ====================================================
  describe('photo input → crop modal wiring', function() {
    it('photoInput.onchange calls openAvatarCropModal, NOT handleAvatarUpload directly', function() {
      // Find the prof-photo-input change handler block
      var m = profilesSrc.match(
        /photoInput\.onchange\s*=\s*function\s*\(\)\s*\{[\s\S]*?\};/
      );
      expect(m).toBeTruthy();
      var handler = m[0];
      expect(handler).toContain('openAvatarCropModal(this.files[0])');
      // Must NOT call handleAvatarUpload directly from the file picker
      expect(handler).not.toContain('handleAvatarUpload(this.files[0])');
    });
  });

  // ====================================================
  // 2. openAvatarCropModal — validation gate
  // ====================================================
  describe('openAvatarCropModal — validation', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(
        /function openAvatarCropModal\(file\)\s*\{[\s\S]*?\n\}/
      );
      src = m ? m[0] : '';
    });

    it('function exists with signature (file)', function() {
      expect(src).toBeTruthy();
      expect(src).toContain('function openAvatarCropModal(file)');
    });

    it('rejects non-image file types via showToast', function() {
      expect(src).toMatch(
        /validTypes\s*=\s*\['image\/jpeg',\s*'image\/png',\s*'image\/webp'\]/
      );
      expect(src).toMatch(/showToast\(['"]Only JPG, PNG, or WebP allowed['"]/);
    });

    it('caps raw input at 10MB (cropped output gets re-compressed)', function() {
      expect(src).toMatch(/file\.size\s*>\s*10\s*\*\s*1024\s*\*\s*1024/);
      expect(src).toMatch(/showToast\(['"]Image must be under 10MB['"]/);
    });

    it('uses FileReader + Image to load the source bitmap before mounting', function() {
      expect(src).toContain('new FileReader()');
      expect(src).toContain('new Image()');
      expect(src).toContain('reader.readAsDataURL(file)');
      expect(src).toContain('_cropMountModal(img, file)');
    });

    it('handles FileReader and Image error paths', function() {
      expect(src).toMatch(/reader\.onerror/);
      expect(src).toMatch(/img\.onerror/);
    });
  });

  // ====================================================
  // 3. _cropMountModal — state initialization
  // ====================================================
  describe('_cropMountModal — state init', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(
        /function _cropMountModal\(img,\s*originalFile\)\s*\{[\s\S]*?\n\}/
      );
      src = m ? m[0] : '';
    });

    it('function exists', function() {
      expect(src).toBeTruthy();
    });

    it('mounts into #prof-crop-overlay element', function() {
      expect(src).toContain("getElementById('prof-crop-overlay')");
    });

    it('computes minScale so image fully covers the crop circle', function() {
      // minScale = max(2R/img.width, 2R/img.height)
      expect(src).toMatch(
        /minScale\s*=\s*Math\.max\(\s*\(2\s*\*\s*R\)\s*\/\s*img\.width,\s*\(2\s*\*\s*R\)\s*\/\s*img\.height\s*\)/
      );
    });

    it('caps maxScale at 8x minScale', function() {
      expect(src).toMatch(/maxScale\s*=\s*minScale\s*\*\s*8/);
    });

    it('initializes window._cropState with required fields', function() {
      expect(src).toContain('window._cropState');
      // Required fields for the inverse mapping in _cropConfirm
      expect(src).toMatch(/img:\s*img/);
      expect(src).toMatch(/originalFile:\s*originalFile/);
      expect(src).toMatch(/stage:\s*STAGE/);
      expect(src).toMatch(/radius:\s*R/);
      expect(src).toMatch(/scale:\s*minScale/);
      expect(src).toMatch(/tx:\s*0/);
      expect(src).toMatch(/ty:\s*0/);
    });

    it('renders modal HTML and shows the overlay', function() {
      expect(src).toContain('_cropModalHtml(STAGE, R)');
      expect(src).toMatch(/overlay\.style\.display\s*=\s*['"]flex['"]/);
    });

    it('wires both Cancel and Save buttons', function() {
      expect(src).toContain("getElementById('crop-cancel-btn')");
      expect(src).toContain("getElementById('crop-save-btn')");
      expect(src).toContain('= closeAvatarCropModal');
      expect(src).toContain('= _cropConfirm');
    });

    it('stage size is mobile-first (capped between 240 and 340)', function() {
      expect(src).toMatch(/Math\.max\(240,\s*Math\.min\(vw\s*-\s*48,\s*340\)\)/);
    });
  });

  // ====================================================
  // 4. _cropModalHtml — required UI elements
  // ====================================================
  describe('_cropModalHtml — UI structure', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(
        /function _cropModalHtml\(STAGE,\s*R\)\s*\{[\s\S]*?\n\}/
      );
      src = m ? m[0] : '';
    });

    it('emits a canvas with id crop-canvas', function() {
      expect(src).toContain('id="crop-canvas"');
    });

    it('emits an SVG circular crop overlay (mask + gold ring)', function() {
      expect(src).toContain('<mask');
      expect(src).toContain('<circle');
      // Gold ring around the crop circle
      expect(src).toContain('#C8A84B');
    });

    it('emits Cancel and Save buttons with correct IDs', function() {
      expect(src).toContain('id="crop-cancel-btn"');
      expect(src).toContain('id="crop-save-btn"');
    });

    it('emits a zoom slider', function() {
      expect(src).toContain('id="crop-zoom-slider"');
      expect(src).toContain('type="range"');
    });

    it('uses touch-action:none on canvas (iOS Safari gesture handoff)', function() {
      expect(src).toMatch(/id="crop-canvas"[^>]*touch-action:\s*none/);
    });

    it('SVG overlay has pointer-events:none so canvas captures gestures', function() {
      expect(src).toMatch(/<svg[\s\S]*?pointer-events:\s*none/);
    });
  });

  // ====================================================
  // 5. _cropConstrain — pan/zoom limits
  // ====================================================
  describe('_cropConstrain — bounds', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(
        /function _cropConstrain\(\)\s*\{[\s\S]*?\n\}/
      );
      src = m ? m[0] : '';
    });

    it('clamps scale between minScale and maxScale', function() {
      expect(src).toMatch(/s\.scale\s*<\s*s\.minScale/);
      expect(src).toMatch(/s\.scale\s*>\s*s\.maxScale/);
    });

    it('keeps the image always covering the crop circle (symmetric tx/ty bounds)', function() {
      // maxTx = (img.width * scale)/2 - radius
      expect(src).toMatch(
        /maxTx\s*=\s*\(s\.img\.width\s*\*\s*s\.scale\)\s*\/\s*2\s*-\s*s\.radius/
      );
      expect(src).toMatch(
        /maxTy\s*=\s*\(s\.img\.height\s*\*\s*s\.scale\)\s*\/\s*2\s*-\s*s\.radius/
      );
    });
  });

  // ====================================================
  // 6. Gesture handlers — touch + mouse + wheel
  // ====================================================
  describe('gesture handlers', function() {
    it('_cropTouchStart handles 1-finger and 2-finger starts', function() {
      var m = profilesSrc.match(/function _cropTouchStart\(e\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      expect(src).toContain('e.preventDefault()');
      expect(src).toMatch(/e\.touches\.length\s*===\s*1/);
      expect(src).toMatch(/e\.touches\.length\s*===\s*2/);
      // Stash startScale + startDist for pinch
      expect(src).toContain('s.startScale = s.scale');
      expect(src).toContain('s.startDist =');
    });

    it('_cropTouchMove translates 1-finger drag and 2-finger pinch', function() {
      var m = profilesSrc.match(/function _cropTouchMove\(e\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      expect(src).toContain('e.preventDefault()');
      // Pinch: scale = startScale * (dist / startDist)
      expect(src).toMatch(
        /s\.scale\s*=\s*s\.startScale\s*\*\s*\(dist\s*\/\s*s\.startDist\)/
      );
      // Drag: redraw and constrain on every move
      expect(src).toContain('_cropConstrain()');
      expect(src).toContain('_cropDraw()');
    });

    it('_cropWheel scales by ~8% per wheel tick', function() {
      var m = profilesSrc.match(/function _cropWheel\(e\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      expect(src).toContain('e.preventDefault()');
      expect(src).toMatch(/e\.deltaY\s*<\s*0\s*\?\s*1\.08\s*:\s*1\s*\/\s*1\.08/);
    });

    it('_cropMouseDown wires document-level move/up listeners (drag-pan)', function() {
      var m = profilesSrc.match(/function _cropMouseDown\(e\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      expect(src).toContain("addEventListener('mousemove', move)");
      expect(src).toContain("addEventListener('mouseup', up)");
      expect(src).toContain("removeEventListener('mousemove', move)");
      expect(src).toContain("removeEventListener('mouseup', up)");
    });

    it('_cropWireGestures registers touch handlers with passive:false', function() {
      var m = profilesSrc.match(/function _cropWireGestures\(\)\s*\{[\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      // iOS Safari requires passive:false for preventDefault to work
      expect(src).toMatch(/touchstart[\s\S]*?passive:\s*false/);
      expect(src).toMatch(/touchmove[\s\S]*?passive:\s*false/);
      expect(src).toMatch(/wheel[\s\S]*?passive:\s*false/);
    });
  });

  // ====================================================
  // 7. _cropDraw — DPR-aware canvas painting
  // ====================================================
  describe('_cropDraw — DPR-aware rendering', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(/function _cropDraw\(\)\s*\{[\s\S]*?\n\}/);
      src = m ? m[0] : '';
    });

    it('reads devicePixelRatio for crisp retina rendering', function() {
      expect(src).toContain('window.devicePixelRatio');
    });

    it('resizes canvas backing store to stage * DPR', function() {
      expect(src).toMatch(/canvas\.width\s*=\s*s\.stage\s*\*\s*DPR/);
      expect(src).toMatch(/canvas\.height\s*=\s*s\.stage\s*\*\s*DPR/);
    });

    it('draws image at scale + translate (centered + offset)', function() {
      expect(src).toMatch(/iw\s*=\s*s\.img\.width\s*\*\s*s\.scale/);
      expect(src).toMatch(/dx\s*=\s*\(s\.stage\s*-\s*iw\)\s*\/\s*2\s*\+\s*s\.tx/);
      expect(src).toContain('ctx.drawImage(s.img, dx, dy, iw, ih)');
    });
  });

  // ====================================================
  // 8. _cropConfirm — output dimensions + integration
  // ====================================================
  describe('_cropConfirm — output + upload integration', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(/function _cropConfirm\(\)\s*\{[\s\S]*?\n\}/);
      src = m ? m[0] : '';
    });

    it('function exists', function() {
      expect(src).toBeTruthy();
    });

    it('output canvas is 512x512 (square)', function() {
      expect(src).toMatch(/OUTPUT\s*=\s*512/);
      expect(src).toMatch(/out\.width\s*=\s*OUTPUT/);
      expect(src).toMatch(/out\.height\s*=\s*OUTPUT/);
    });

    it('source rect side length is (2*R)/scale (perfect square)', function() {
      expect(src).toMatch(/srcSize\s*=\s*\(2\s*\*\s*R\)\s*\/\s*s\.scale/);
      expect(src).toMatch(/srcW\s*=\s*srcSize/);
      expect(src).toMatch(/srcH\s*=\s*srcSize/);
    });

    it('clamps source rect to image bounds (Safari drawImage safety)', function() {
      expect(src).toMatch(/srcX\s*<\s*0/);
      expect(src).toMatch(/srcY\s*<\s*0/);
      expect(src).toMatch(/srcX\s*\+\s*srcW\s*>\s*s\.img\.width/);
      expect(src).toMatch(/srcY\s*\+\s*srcH\s*>\s*s\.img\.height/);
    });

    it('exports the cropped canvas via toBlob as image/jpeg', function() {
      expect(src).toMatch(/out\.toBlob\([\s\S]*?['"]image\/jpeg['"]/);
    });

    it('hands the cropped File off to handleAvatarUpload (preserves upload pipeline)', function() {
      expect(src).toContain('new File([blob]');
      expect(src).toContain('handleAvatarUpload(croppedFile)');
      // Must close the modal before kicking off the upload so the progress
      // ring inside the profile panel is visible
      expect(src).toMatch(/closeAvatarCropModal\(\);[\s\S]*?handleAvatarUpload/);
    });

    it('produces a .jpg-named File regardless of original extension', function() {
      expect(src).toMatch(/\.replace\(\/\\\.\[\^\.\]\+\$\/,\s*['"]\.jpg['"]\)/);
    });
  });

  // ====================================================
  // 9. closeAvatarCropModal — does not steal modalOpen
  //    from the still-open profile panel
  // ====================================================
  describe('closeAvatarCropModal — no modalOpen leak', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(/function closeAvatarCropModal\(\)\s*\{[\s\S]*?\n\}/);
      src = m ? m[0] : '';
    });

    it('hides overlay and clears innerHTML', function() {
      expect(src).toMatch(/overlay\.style\.display\s*=\s*['"]none['"]/);
      expect(src).toMatch(/overlay\.innerHTML\s*=\s*['"]['"]/);
    });

    it('clears window._cropState', function() {
      expect(src).toMatch(/window\._cropState\s*=\s*null/);
    });

    it('does NOT assign AppState.ui.modalOpen (profile panel still owns it)', function() {
      // Strip line comments before checking — the explanatory comment is fine
      var stripped = src.replace(/\/\/[^\n]*/g, '');
      expect(stripped).not.toMatch(/AppState\.ui\.modalOpen\s*=/);
    });

    it('does NOT assign document.body.style.overflow (profile panel still owns it)', function() {
      var stripped = src.replace(/\/\/[^\n]*/g, '');
      expect(stripped).not.toMatch(/document\.body\.style\.overflow\s*=/);
    });
  });

  // ====================================================
  // 10. handleAvatarUpload — still wired in unchanged
  // ====================================================
  describe('handleAvatarUpload — upload pipeline preserved', function() {
    var src;
    beforeAll(function() {
      var m = profilesSrc.match(
        /async function handleAvatarUpload\(file\)\s*\{[\s\S]*?\n\}/
      );
      src = m ? m[0] : '';
    });

    it('still uploads to the R2 worker /upload endpoint', function() {
      expect(src).toBeTruthy();
      expect(src).toContain('srtd-r2-upload.ksg-kumarshubhamgune.workers.dev/upload');
    });

    it('PATCHes /profiles with the cache-busted displayUrl (NOT the clean URL)', function() {
      // BUG FIX: the DB must store the cache-busted URL so refreshes see
      // the new bytes too. Storing cleanUrl was the "stale avatar after
      // refresh" bug.
      expect(src).toContain("apiFetch('/profiles?email=eq.'");
      expect(src).toContain('avatar_url: displayUrl');
      // Regression guard: must NOT revert to storing cleanUrl
      expect(src).not.toMatch(/avatar_url:\s*cleanUrl\b/);
    });

    it('builds displayUrl as cleanUrl + "?t=" + Date.now() timestamp', function() {
      expect(src).toMatch(/cleanUrl\s*=\s*['"]https:\/\/images\.srtd\.io\/['"]\s*\+\s*filename/);
      expect(src).toMatch(/stamp\s*=\s*Date\.now\(\)/);
      expect(src).toMatch(/displayUrl\s*=\s*cleanUrl\s*\+\s*['"]\?t=['"]\s*\+\s*stamp/);
    });

    it('still uses the profile-pictures/ R2 prefix', function() {
      expect(src).toContain("'profile-pictures/'");
    });

    it('still calls _compressAvatar before upload (extra safety net)', function() {
      expect(src).toContain('_compressAvatar(file)');
    });

    it('updates _profilesCache with the same cache-busted displayUrl', function() {
      // Items 4 + 5 in the bug report — the in-memory cache must mirror
      // what we just persisted, so the current session shows the new
      // image immediately AND the next fetchProfiles() does not blow it
      // away with a stale value.
      expect(src).toMatch(
        /window\._profilesCache\[cacheKey\]\.avatar_url\s*=\s*displayUrl/
      );
      expect(src).toMatch(/AppState\.user\.avatarUrl\s*=\s*displayUrl/);
    });
  });

  // ====================================================
  // 11. getAvatarUrl + renderAvatar — must not strip ?t=
  // ====================================================
  describe('avatar render path — does not strip ?t= cache buster', function() {
    it('getAvatarUrl returns cache.avatar_url verbatim (no .split, no .replace)', function() {
      var m = profilesSrc.match(/function getAvatarUrl\([\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      // Must just `return cache[...].avatar_url` without manipulating it
      expect(src).toMatch(/return\s+cache\[key\]\.avatar_url/);
      // Must NOT be calling .split('?') or .replace(/\?.*$/) on the URL
      expect(src).not.toMatch(/avatar_url\.split\(/);
      expect(src).not.toMatch(/avatar_url\.replace\(\s*\/\\\?/);
    });

    it('renderAvatar passes photoUrl into <img src> without stripping query', function() {
      var m = profilesSrc.match(/function renderAvatar\([\s\S]*?\n\}/);
      expect(m).toBeTruthy();
      var src = m[0];
      // Only escapes double-quotes for HTML safety — must NOT strip ?
      expect(src).toMatch(/photoUrl\.replace\(\/\"\/g,\s*['"]&quot;['"]\)/);
      expect(src).not.toMatch(/photoUrl\.split\(\s*['"]\?['"]/);
      expect(src).not.toMatch(/photoUrl\.replace\(\s*\/\\\?/);
    });
  });
});

// ====================================================
// 12. R2 worker — Cache-Control immutable on avatars
// ====================================================
describe('R2 upload worker — avatar cache-control', function() {
  var workerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'r2-upload-worker.js'),
    'utf8'
  );

  it('sets Cache-Control immutable on profile-pictures/ uploads', function() {
    expect(workerSrc).toContain("'public, max-age=31536000, immutable'");
  });

  it('only applies the immutable header to profile-pictures/ prefix', function() {
    // Other paths (post images) should not get the immutable header
    expect(workerSrc).toMatch(
      /filename\.indexOf\(['"]profile-pictures\/['"]\)\s*===\s*0/
    );
  });

  it('still passes contentType through R2 httpMetadata', function() {
    expect(workerSrc).toContain('contentType');
    expect(workerSrc).toContain('httpMetadata');
  });
});
