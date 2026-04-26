// PR-4 step 2 of CreatePlanWizard. Fetches "stuck posts" (parked /
// awaiting_brand_input / changes_requested with no plan_cell_id) and
// lets the user check which to carry over, picking a target date and
// channel for each. Tokens via CSS vars only; no border-radius, no
// rgba(). Sibling of CreatePlanWizard.jsx.

import React, { useEffect, useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { listStuckPosts } from '../api/planTablesApi.js';
import { inferDefaultChannel, suggestCarryoverDate } from './helpers.js';

const FONT_BODY = '"DM Sans", sans-serif';
const FONT_MONO = '"IBM Plex Mono", monospace';

function prettyStage(s) {
  return String(s || '').replace(/_/g, ' ');
}

export function CarryoverStep({ periodStart, periodEnd, workspaceChannels, selectedCarryovers, onChange }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listStuckPosts(periodStart)
      .then((rows) => {
        if (cancelled) return;
        setPosts(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError((e && e.message) || 'Could not load stuck posts.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [periodStart]);

  const inferredChannel = useMemo(() => inferDefaultChannel(workspaceChannels), [workspaceChannels]);
  const multiChannel = useMemo(() => (workspaceChannels || []).filter(c => c.is_active).length >= 2, [workspaceChannels]);
  const defaultDate = useMemo(() => suggestCarryoverDate(periodStart), [periodStart]);

  const selectedMap = useMemo(() => {
    const m = new Map();
    for (const c of selectedCarryovers) m.set(c.post_id, c);
    return m;
  }, [selectedCarryovers]);

  function toggle(post) {
    if (selectedMap.has(post.id)) {
      onChange(selectedCarryovers.filter(c => c.post_id !== post.id));
    } else {
      onChange([
        ...selectedCarryovers,
        { post_id: post.id, cell_date: defaultDate, channel: inferredChannel,
          content_pillar: post.content_pillar || null, format: post.format || null, source: 'stuck' }
      ]);
    }
  }

  function patchOne(postId, patch) {
    onChange(selectedCarryovers.map(c => c.post_id === postId ? { ...c, ...patch } : c));
  }

  const inputStyle = {
    background: 'var(--c-bg-2)',
    color: 'var(--c-text-loud)',
    border: '1px solid var(--c-divider-soft)',
    padding: '6px 8px',
    fontFamily: FONT_MONO,
    fontSize: '11px',
    borderRadius: 0
  };

  const activeChannels = (workspaceChannels || []).filter(c => c.is_active).map(c => c.channel);

  return (
    <div>
      <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-text-soft)', marginBottom: '8px' }}>
        Carry over from before
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: '13px', color: 'var(--c-text-mid)', marginBottom: '14px' }}>
        Pick stuck posts to slot into this plan. Each will be linked to a cell with the date and channel you choose.
      </div>

      {loading ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--c-text-dim)', padding: '24px 0', textAlign: 'center' }}>
          Loading stuck posts...
        </div>
      ) : loadError ? (
        <div style={{ color: 'var(--c-red)', padding: '16px 0', fontFamily: FONT_BODY, fontSize: '13px' }}>
          {loadError}
        </div>
      ) : posts.length === 0 ? (
        <div style={{ background: 'var(--c-bg-2)', border: '1px solid var(--c-divider-soft)', padding: '16px', fontFamily: FONT_BODY, fontSize: '13px', color: 'var(--c-text-mid)' }}>
          No stuck posts to carry over. You can still create the plan.
        </div>
      ) : (
        <div>
          {posts.map((p) => {
            const selected = selectedMap.get(p.id);
            const isSelected = !!selected;
            const outOfRange = isSelected && selected.cell_date && (selected.cell_date < periodStart || selected.cell_date > periodEnd);
            return (
              <div key={p.id}
                style={{ display: 'flex', padding: '10px 0', gap: '10px', alignItems: 'flex-start', borderBottom: '1px solid var(--c-divider-subtle)' }}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-label={isSelected ? 'Deselect' : 'Select'}
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '1.5px solid var(--c-divider-soft)',
                    background: isSelected ? 'var(--c-terracotta-1)' : 'transparent',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    borderRadius: 0
                  }}>
                  {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
                </button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ flex: 1, fontFamily: FONT_BODY, fontSize: '14px', color: 'var(--c-text-loud)' }}>
                      {p.title}
                    </span>
                    <span style={{
                      fontFamily: FONT_MONO,
                      fontSize: '8px',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      border: '1px solid var(--c-divider-soft)',
                      color: 'var(--c-text-mid)'
                    }}>
                      {prettyStage(p.stage)}
                    </span>
                  </div>

                  {isSelected ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <input
                          type="date"
                          value={selected.cell_date || ''}
                          min={periodStart}
                          max={periodEnd}
                          onChange={(ev) => patchOne(p.id, { cell_date: ev.target.value })}
                          style={inputStyle}
                        />
                        {multiChannel ? (
                          <select
                            value={selected.channel || ''}
                            onChange={(ev) => patchOne(p.id, { channel: ev.target.value })}
                            style={inputStyle}>
                            {activeChannels.map((ch) => (
                              <option key={ch} value={ch}>{ch}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontFamily: FONT_MONO, fontSize: '10px', textTransform: 'uppercase', color: 'var(--c-text-soft)' }}>
                            ({inferredChannel})
                          </span>
                        )}
                      </div>
                      {outOfRange ? (
                        <div style={{ fontFamily: FONT_BODY, fontSize: '11px', color: 'var(--c-amber)' }}>
                          Date is outside plan range
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid var(--c-divider-soft)',
        fontFamily: FONT_MONO,
        fontSize: '9px',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--c-text-soft)'
      }}>
        Selected: {selectedCarryovers.length} of {posts.length}
      </div>
    </div>
  );
}
