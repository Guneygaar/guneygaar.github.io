import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load 01-config.js — execute as plain script
const configSrc = readFileSync(resolve(__dirname, '..', '01-config.js'), 'utf8');

function loadConfig() {
  // Provide window stub for the initialization guards
  const window = { _modalOpen: undefined, _deferredRender: undefined };
  const fn = new Function('window', configSrc + `
    return {
      STAGE_META, STAGES_DB, PIPELINE_ORDER, STAGE_DISPLAY, STAGE_COLORS,
      PILLARS_DB, PILLAR_DISPLAY, PILLAR_SHORT,
      ROLE_STAGES, ROLE_BUCKETS, STRIP_STAGES,
      stageStyle, formatPillarDisplay, getPillarShort,
    };
  `);
  return fn(window);
}

const config = loadConfig();

// ─── stageStyle ─────────────────────────────────
describe('stageStyle', () => {
  it('returns correct hex and label for known stage', () => {
    const s = config.stageStyle('in production');
    expect(s.hex).toBe('#f59e0b');
    expect(s.label).toBe('In Production');
  });

  it('is case-insensitive', () => {
    expect(config.stageStyle('IN PRODUCTION').label).toBe('In Production');
  });

  it('trims whitespace', () => {
    expect(config.stageStyle('  ready  ').label).toBe('Ready');
  });

  it('returns fallback for unknown stage', () => {
    const s = config.stageStyle('nonexistent');
    expect(s.hex).toBe('#64748b');
    expect(s.label).toBe('nonexistent');
  });

  it('returns "Unknown" for null/empty', () => {
    expect(config.stageStyle(null).label).toBe('Unknown');
    expect(config.stageStyle('').label).toBe('Unknown');
  });
});

// ─── Config integrity ───────────────────────────
describe('config integrity', () => {
  it('STAGE_META keys match STAGES_DB entries (plus archive)', () => {
    const metaKeys = Object.keys(config.STAGE_META);
    const dbPlusArchive = [...config.STAGES_DB, 'archive'];
    expect(metaKeys.sort()).toEqual(dbPlusArchive.sort());
  });

  it('STAGE_DISPLAY is auto-generated from STAGE_META', () => {
    for (const [key, meta] of Object.entries(config.STAGE_META)) {
      expect(config.STAGE_DISPLAY[key]).toBe(meta.label);
    }
  });

  it('STAGE_COLORS is the same object as STAGE_META', () => {
    expect(config.STAGE_COLORS).toBe(config.STAGE_META);
  });

  it('PIPELINE_ORDER contains all STAGES_DB values plus archive', () => {
    for (const stage of config.STAGES_DB) {
      expect(config.PIPELINE_ORDER).toContain(stage);
    }
    expect(config.PIPELINE_ORDER).toContain('archive');
  });

  it('ROLE_STAGES values reference valid stage keys', () => {
    for (const [role, stages] of Object.entries(config.ROLE_STAGES)) {
      if (stages === null) continue; // Admin has null (all stages)
      for (const s of stages) {
        expect(config.STAGES_DB).toContain(s);
      }
    }
  });

  it('ROLE_BUCKETS stage arrays reference valid STAGES_DB values', () => {
    for (const [role, buckets] of Object.entries(config.ROLE_BUCKETS)) {
      for (const bucket of buckets) {
        for (const s of bucket.stages) {
          expect(config.STAGES_DB).toContain(s);
        }
      }
    }
  });

  it('STRIP_STAGES colors match STAGE_META hex values', () => {
    for (const strip of config.STRIP_STAGES) {
      for (const s of strip.stages) {
        expect(strip.color).toBe(config.STAGE_META[s].hex);
      }
    }
  });

  it('PILLARS_DB entries all have PILLAR_DISPLAY labels', () => {
    for (const p of config.PILLARS_DB) {
      expect(config.PILLAR_DISPLAY[p]).toBeDefined();
    }
  });

  it('PILLARS_DB entries all have PILLAR_SHORT labels', () => {
    for (const p of config.PILLARS_DB) {
      expect(config.PILLAR_SHORT[p]).toBeDefined();
    }
  });

  it('PILLARS_DB includes growth pillar', () => {
    expect(config.PILLARS_DB).toContain('growth');
  });

  it('PILLARS_DB values are all lowercase', () => {
    for (const p of config.PILLARS_DB) {
      expect(p).toBe(p.toLowerCase());
    }
  });
});

// ─── Pillar helpers ─────────────────────────────
describe('formatPillarDisplay', () => {
  it('returns Capital Case for known pillar', () => {
    expect(config.formatPillarDisplay('leadership')).toBe('Leadership');
    expect(config.formatPillarDisplay('sustainability')).toBe('Sustainability');
    expect(config.formatPillarDisplay('growth')).toBe('Growth');
  });

  it('returns empty string for falsy input', () => {
    expect(config.formatPillarDisplay('')).toBe('');
    expect(config.formatPillarDisplay(null)).toBe('');
    expect(config.formatPillarDisplay(undefined)).toBe('');
  });

  it('capitalizes unknown pillar gracefully', () => {
    expect(config.formatPillarDisplay('custom')).toBe('Custom');
  });
});

describe('getPillarShort', () => {
  it('returns short label for known pillar', () => {
    expect(config.getPillarShort('leadership')).toBe('Lead');
    expect(config.getPillarShort('innovation')).toBe('Innov');
    expect(config.getPillarShort('sustainability')).toBe('Sustain');
  });

  it('returns empty string for falsy input', () => {
    expect(config.getPillarShort('')).toBe('');
    expect(config.getPillarShort(null)).toBe('');
  });

  it('falls back to raw value for unknown pillar', () => {
    expect(config.getPillarShort('custom')).toBe('custom');
  });
});
