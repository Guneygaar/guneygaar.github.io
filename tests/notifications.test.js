import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Notification routing logic — pure logic, no API calls.
function getNotifTargets(actorRole) {
  var r = (actorRole || '').toLowerCase();
  if (r === 'client')                          return ['Servicing', 'Admin'];
  if (r === 'creative' || r === 'pranav')      return ['Servicing', 'Admin'];
  if (r === 'servicing' || r === 'chitra')     return ['Admin', 'Client'];
  if (r === 'admin')                           return ['Client', 'Servicing'];
  return [];
}

// Extract _stageLabel from 08-post-actions.js
const actionsSrc = readFileSync(resolve(__dirname, '..', '08-post-actions.js'), 'utf8');

function loadStageLabel() {
  const match = actionsSrc.match(/function _stageLabel\(stage\)\s*\{[\s\S]*?\n\}/);
  if (!match) throw new Error('Could not find _stageLabel function');
  const fn = new Function(match[0] + '\n return _stageLabel;');
  return fn();
}

const _stageLabel = loadStageLabel();

// Notification routing
describe('getNotifTargets', () => {
  it("'Client' actor -> targets include 'Servicing'", () => {
    expect(getNotifTargets('Client')).toContain('Servicing');
  });

  it("'Client' actor -> targets include 'Admin'", () => {
    expect(getNotifTargets('Client')).toContain('Admin');
  });

  it("'Client' actor -> targets NOT include 'Client'", () => {
    expect(getNotifTargets('Client')).not.toContain('Client');
  });

  it("'Creative' actor -> targets include 'Servicing'", () => {
    expect(getNotifTargets('Creative')).toContain('Servicing');
  });

  it("'Creative' actor -> targets include 'Admin'", () => {
    expect(getNotifTargets('Creative')).toContain('Admin');
  });

  it("'Pranav' actor -> same as Creative", () => {
    expect(getNotifTargets('Pranav')).toEqual(getNotifTargets('Creative'));
  });

  it("'Servicing' actor -> targets include 'Admin'", () => {
    expect(getNotifTargets('Servicing')).toContain('Admin');
  });

  it("'Servicing' actor -> targets include 'Client'", () => {
    expect(getNotifTargets('Servicing')).toContain('Client');
  });

  it("'Chitra' actor -> same as Servicing", () => {
    expect(getNotifTargets('Chitra')).toEqual(getNotifTargets('Servicing'));
  });

  it("'Admin' actor -> targets include 'Client'", () => {
    expect(getNotifTargets('Admin')).toContain('Client');
  });

  it("'Admin' actor -> targets include 'Servicing'", () => {
    expect(getNotifTargets('Admin')).toContain('Servicing');
  });

  it("'Admin' actor -> targets NOT include 'Admin'", () => {
    expect(getNotifTargets('Admin')).not.toContain('Admin');
  });

  it('no role doubles up (actor never notifies themselves)', () => {
    const roles = ['Admin', 'Servicing', 'Creative', 'Pranav', 'Chitra', 'Client'];
    for (const role of roles) {
      const targets = getNotifTargets(role);
      expect(targets).not.toContain(role);
    }
  });
});

// _stageLabel
describe('_stageLabel', () => {
  it("'brief' -> 'Brief'", () => {
    expect(_stageLabel('brief')).toBe('Brief');
  });

  it("'brief_done' -> 'Closed Brief'", () => {
    expect(_stageLabel('brief_done')).toBe('Closed Brief');
  });

  it("'in_production' -> 'In Production'", () => {
    expect(_stageLabel('in_production')).toBe('In Production');
  });

  it("'awaiting_approval' -> 'Awaiting Approval'", () => {
    expect(_stageLabel('awaiting_approval')).toBe('Awaiting Approval');
  });

  it("'awaiting_brand_input' -> 'Awaiting Input'", () => {
    expect(_stageLabel('awaiting_brand_input')).toBe('Awaiting Input');
  });

  it("'published' -> 'Published'", () => {
    expect(_stageLabel('published')).toBe('Published');
  });

  it("'unknown_stage' -> 'unknown_stage' (passthrough)", () => {
    expect(_stageLabel('unknown_stage')).toBe('unknown_stage');
  });

  it('null/undefined -> safe empty-ish return', () => {
    expect(_stageLabel(null)).toBeFalsy();
    expect(_stageLabel(undefined)).toBeFalsy();
  });
});
