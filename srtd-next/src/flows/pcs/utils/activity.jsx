import React from 'react';
import { STAGE_LABELS, STAGE_TOKEN } from './stage.js';

function Pill({ children, stageToken = null }) {
  const bgStyle = stageToken
    ? { backgroundColor: `var(--c-${stageToken})`, color: 'white' }
    : {};
  return (
    <span
      className="inline-block font-mono text-xs px-1.5 py-px
                 mx-0.5 rounded-pill bg-bg-2 text-text-loud
                 align-middle whitespace-nowrap"
      style={{
        letterSpacing: '0.06em',
        fontFeatureSettings: "'tnum' 1",
        ...bgStyle,
      }}
    >
      {children}
    </span>
  );
}

function fmtValue(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + '…' : s;
}

export function renderActivity(row) {
  if (!row || !row.field) return null;
  const field = String(row.field);
  const oldV = fmtValue(row.old_value);
  const newV = fmtValue(row.new_value);

  if (field === 'stage') {
    const oldToken = STAGE_TOKEN[row.old_value] || null;
    const newToken = STAGE_TOKEN[row.new_value] || null;
    const oldLabel = (STAGE_LABELS[row.old_value] || row.old_value || '').toUpperCase();
    const newLabel = (STAGE_LABELS[row.new_value] || row.new_value || '').toUpperCase();
    if (!oldLabel) {
      return <>Set stage to <Pill stageToken={newToken}>{newLabel}</Pill></>;
    }
    return (
      <>
        Moved stage{' '}
        <Pill stageToken={oldToken}>{oldLabel}</Pill>
        {' → '}
        <Pill stageToken={newToken}>{newLabel}</Pill>
      </>
    );
  }

  if (field === 'owner') {
    if (!oldV) return <>Set owner to <strong>{newV}</strong></>;
    if (!newV) return <>Cleared owner</>;
    return <>Changed owner <Pill>{oldV.toUpperCase()}</Pill> {'→'} <Pill>{newV.toUpperCase()}</Pill></>;
  }

  if (field === 'content_pillar' || field === 'pillar') {
    if (!oldV) return <>Set pillar to <Pill>{newV.toUpperCase()}</Pill></>;
    if (!newV) return <>Cleared pillar</>;
    return <>Changed pillar <Pill>{oldV.toUpperCase()}</Pill> {'→'} <Pill>{newV.toUpperCase()}</Pill></>;
  }

  if (field === 'format') {
    if (!oldV) return <>Set format to <Pill>{newV.toUpperCase()}</Pill></>;
    if (!newV) return <>Cleared format</>;
    return <>Changed format <Pill>{oldV.toUpperCase()}</Pill> {'→'} <Pill>{newV.toUpperCase()}</Pill></>;
  }

  if (field === 'location') {
    if (!oldV) return <>Set location to <strong>{newV}</strong></>;
    if (!newV) return <>Cleared location</>;
    return <>Changed location <strong>{oldV}</strong> {'→'} <strong>{newV}</strong></>;
  }

  if (field === 'target_date' || field === 'date') {
    if (!oldV) return <>Set target date to <strong>{newV}</strong></>;
    if (!newV) return <>Cleared target date</>;
    return <>Changed target date <strong>{oldV}</strong> {'→'} <strong>{newV}</strong></>;
  }

  if (field === 'canva_link' || field === 'canva') {
    if (!oldV) return <>Linked Canva <Pill>{newV}</Pill></>;
    if (!newV) return <>Removed Canva link</>;
    return <>Updated Canva link</>;
  }

  if (field === 'drive_link' || field === 'drive') {
    if (!oldV) return <>Linked Drive <Pill>{newV}</Pill></>;
    if (!newV) return <>Removed Drive link</>;
    return <>Updated Drive link</>;
  }

  if (field === 'linkedin_link' || field === 'linkedin') {
    if (!oldV) return <>Set LinkedIn URL</>;
    if (!newV) return <>Removed LinkedIn URL</>;
    return <>Updated LinkedIn URL</>;
  }

  if (field === 'title') {
    return <>Edited title</>;
  }

  if (field === 'caption') {
    return <>Edited caption</>;
  }

  if (field === 'images' || field === 'photos') {
    return <>Updated photos</>;
  }

  if (field === 'post_created' || field === 'created') {
    return <>Created post</>;
  }

  if (oldV && newV) {
    return <>Changed {field} <Pill>{oldV}</Pill> {'→'} <Pill>{newV}</Pill></>;
  }
  if (newV) return <>Set {field} to <strong>{newV}</strong></>;
  if (oldV) return <>Cleared {field}</>;
  return <>Updated {field}</>;
}
