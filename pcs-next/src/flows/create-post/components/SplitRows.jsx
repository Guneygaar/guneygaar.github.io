import React from 'react';
import { Chip, Dropdown } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

const OWNERS = [
  { label: 'Admin', color: tokens.claude },
  { label: 'Servicing', color: tokens.ownerChitra },
  { label: 'Creative', color: tokens.ownerPranav },
  { label: 'Client', color: tokens.ownerClient }
];

const STAGES = [
  { label: 'In production', color: tokens.ownerChitra },
  { label: 'Awaiting brand input', color: tokens.warn },
  { label: 'Awaiting approval', color: tokens.danger },
  { label: 'Ready', color: tokens.good },
  { label: 'Scheduled', color: tokens.ownerPranav },
  { label: 'Published', color: tokens.textSoft },
  { label: 'Brief', color: tokens.textWhisper },
  { label: 'Brief done', color: tokens.textSoft },
  { label: 'Parked', color: tokens.textGhost },
  { label: 'Rejected', color: tokens.red }
];

const PILLARS = [
  { label: 'Leadership', color: tokens.good },
  { label: 'Product', color: tokens.claude },
  { label: 'Industry', color: tokens.warn },
  { label: 'Culture', color: '#8B9CC9' }
];

const FORMATS = [
  { label: 'Photo', color: tokens.good },
  { label: 'Carousel', color: tokens.claude },
  { label: 'Video', color: tokens.warn },
  { label: 'Creative', color: '#8B9CC9' }
];

const LOCATIONS = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Ahmedabad'];

function Cell({ isFirst, children }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 22px',
        borderRight: isFirst ? `1px solid ${tokens.lineSoft}` : 'none',
        background: hovered ? tokens.ink2 : 'transparent',
        transition: 'background 0.15s'
      }}>
      {children}
    </div>
  );
}

function SplitRow({ children }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      borderTop: `1px solid ${tokens.lineSoft}`
    }}>
      {children}
    </div>
  );
}

function Label({ num, name, required, optional }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8,
      fontFamily: tokens.mono, fontSize: 9.5, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: tokens.textWhisper
    }}>
      {num && <span style={{ color: tokens.claude, fontWeight: 500 }}>{num}</span>}
      <span style={{ color: tokens.textSoft }}>{name}</span>
      {required && <span style={{ color: tokens.red }}>*</span>}
      {optional && (
        <span style={{
          color: tokens.textGhost, marginLeft: 'auto',
          fontWeight: 400, letterSpacing: '0.14em'
        }}>
          {optional}
        </span>
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return 'Pick a date';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SplitRows() {
  const form = useFormState(s => s.form);
  const update = useFormState(s => s.update);
  const ownerOpen = useFormState(s => s.ownerOpen);
  const stageOpen = useFormState(s => s.stageOpen);
  const pillarOpen = useFormState(s => s.pillarOpen);
  const formatOpen = useFormState(s => s.formatOpen);
  const locationOpen = useFormState(s => s.locationOpen);
  const closeAllDropdowns = useFormState(s => s.closeAllDropdowns);
  const setUI = useFormState(s => s.setUI);

  return (
    <>
      {/* 02 OWNER | STAGE */}
      <SplitRow>
        <Cell isFirst>
          <Label num="02" name="Owner" required />
          <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown>
            <Chip
              label={form.owner}
              color={OWNERS.find(o => o.label === form.owner)?.color || tokens.claude}
              open={ownerOpen}
              onClick={() => { closeAllDropdowns(); setUI({ ownerOpen: true }); }}
            />
            {ownerOpen && (
              <Dropdown options={OWNERS} current={form.owner}
                onPick={v => update('owner', v)}
                onClose={() => setUI({ ownerOpen: false })} />
            )}
          </div>
        </Cell>
        <Cell>
          <Label name="Stage" />
          <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown>
            <Chip
              label={form.stage}
              color={STAGES.find(s => s.label === form.stage)?.color || tokens.good}
              open={stageOpen}
              onClick={() => { closeAllDropdowns(); setUI({ stageOpen: true }); }}
            />
            {stageOpen && (
              <Dropdown options={STAGES} current={form.stage}
                onPick={v => update('stage', v)}
                onClose={() => setUI({ stageOpen: false })} />
            )}
          </div>
        </Cell>
      </SplitRow>

      {/* 03 PILLAR | FORMAT */}
      <SplitRow>
        <Cell isFirst>
          <Label num="03" name="Pillar" optional="Optional" />
          <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setUI({ pillarOpen: true }); }}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: tokens.serif, fontSize: 17,
                fontWeight: form.pillar ? 500 : 400,
                fontStyle: form.pillar ? 'normal' : 'italic',
                color: form.pillar ? tokens.textLoud : tokens.textWhisper,
                letterSpacing: '-0.01em', lineHeight: 1.3, cursor: 'pointer',
                textAlign: 'left'
              }}>
              {form.pillar || 'Pick one'}
            </button>
            {pillarOpen && (
              <Dropdown options={PILLARS} current={form.pillar}
                onPick={v => update('pillar', v)}
                onClose={() => setUI({ pillarOpen: false })} />
            )}
          </div>
        </Cell>
        <Cell>
          <Label name="Format" />
          <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown>
            <Chip
              label={form.format}
              color={FORMATS.find(f => f.label === form.format)?.color || tokens.good}
              open={formatOpen}
              onClick={() => { closeAllDropdowns(); setUI({ formatOpen: true }); }}
            />
            {formatOpen && (
              <Dropdown options={FORMATS} current={form.format}
                onPick={v => update('format', v)}
                onClose={() => setUI({ formatOpen: false })} />
            )}
          </div>
        </Cell>
      </SplitRow>

      {/* 04 LOCATION | TARGET DATE */}
      <SplitRow>
        <Cell isFirst>
          <Label num="04" name="Location" optional="Optional" />
          <div style={{ position: 'relative', display: 'inline-block' }} data-dropdown>
            <button
              onClick={(e) => { e.stopPropagation(); closeAllDropdowns(); setUI({ locationOpen: true }); }}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                fontFamily: tokens.serif, fontSize: 17,
                fontWeight: form.location ? 500 : 400,
                fontStyle: form.location ? 'normal' : 'italic',
                color: form.location ? tokens.textLoud : tokens.textWhisper,
                letterSpacing: '-0.01em', lineHeight: 1.3, cursor: 'pointer',
                textAlign: 'left'
              }}>
              {form.location || 'Pick one'}
            </button>
            {locationOpen && (
              <Dropdown options={LOCATIONS} current={form.location}
                onPick={v => update('location', v)}
                onClose={() => setUI({ locationOpen: false })} />
            )}
          </div>
        </Cell>
        <Cell>
          <Label name="Target Date" />
          <label style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
            <input
              type="date"
              value={form.targetDate}
              onChange={e => update('targetDate', e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
            <span style={{
              fontFamily: tokens.serif, fontSize: 17, fontWeight: 500,
              color: tokens.textLoud, letterSpacing: '-0.01em', lineHeight: 1.3,
              display: 'inline-block'
            }}>
              {formatDate(form.targetDate)}
            </span>
          </label>
        </Cell>
      </SplitRow>
    </>
  );
}
