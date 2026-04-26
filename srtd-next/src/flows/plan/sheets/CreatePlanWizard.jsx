import React, { useState, useMemo } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { usePlanStore } from '../store/planStore.js';
import { PeriodStep } from './PeriodStep.jsx';
import { CarryoverStep } from './CarryoverStep.jsx';
import { validatePeriod, formatPeriodTitle } from './helpers.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDay(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function lastDayOfMonth(isoMonthStart) {
  const [y, m] = isoMonthStart.split('-').map(Number);
  const d = new Date(y, m, 0);
  return isoDay(d);
}
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: isoDay(start), end: isoDay(end) };
}

const TERRACOTTA_BG = 'linear-gradient(180deg, var(--c-terracotta-1), var(--c-terracotta-2))';

const btnTerracotta = {
  background: TERRACOTTA_BG,
  color: '#FFFFFF',
  border: 'none',
  padding: '12px 18px',
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: '10px',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  cursor: 'pointer'
};
const btnBorder = {
  background: 'transparent',
  color: 'var(--c-text-loud)',
  border: '1px solid var(--c-divider-warm)',
  padding: '12px 18px',
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: '10px',
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  cursor: 'pointer'
};

export function CreatePlanWizard() {
  const wizardPresetMonth = usePlanStore((s) => s.wizardPresetMonth);
  const creatingPlan = usePlanStore((s) => s.creatingPlan);
  const workspaceChannels = usePlanStore((s) => s.workspaceChannels) || [];
  const closeWizard = usePlanStore((s) => s.closeWizard);
  const createPlan = usePlanStore((s) => s.createPlan);

  const initialRange = useMemo(() => {
    if (wizardPresetMonth) {
      return { start: wizardPresetMonth, end: lastDayOfMonth(wizardPresetMonth) };
    }
    return currentMonthRange();
  }, [wizardPresetMonth]);

  const [step, setStep] = useState(1);
  const [periodType, setPeriodType] = useState('monthly');
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [title, setTitle] = useState(() => formatPeriodTitle('monthly', initialRange.start, initialRange.end));
  const [titleDirty, setTitleDirty] = useState(false);
  const [selectedCarryovers, setSelectedCarryovers] = useState([]);
  const [submitError, setSubmitError] = useState(null);

  const periodValid = validatePeriod(periodType, periodStart, periodEnd).valid;
  const titleTrim = (title || '').trim();
  const step1NextDisabled = !periodValid || titleTrim.length === 0;

  function handlePeriodChange(patch) {
    const nextType = patch.periodType !== undefined ? patch.periodType : periodType;
    const nextStart = patch.periodStart !== undefined ? patch.periodStart : periodStart;
    const nextEnd = patch.periodEnd !== undefined ? patch.periodEnd : periodEnd;
    if (patch.periodType !== undefined) setPeriodType(nextType);
    if (patch.periodStart !== undefined) setPeriodStart(nextStart);
    if (patch.periodEnd !== undefined) setPeriodEnd(nextEnd);
    if (!titleDirty) {
      setTitle(formatPeriodTitle(nextType, nextStart, nextEnd));
    }
  }
  function handleTitleChange(newTitle) {
    setTitleDirty(true);
    setTitle(newTitle);
  }

  async function handleCreate() {
    setSubmitError(null);
    const carryovers = selectedCarryovers.map(({ source, ...rest }) => rest);
    try {
      await createPlan({
        title: titleTrim,
        period_start: periodStart,
        period_end: periodEnd,
        carryovers
      });
    } catch (err) {
      setSubmitError((err && err.message) || 'Could not create plan');
    }
  }

  return (
    <>
      <div
        onClick={closeWizard}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--backdrop-tint, #00000066)',
          zIndex: 2700
        }}
      />
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2800,
        background: 'var(--c-bg)',
        borderTop: '1px solid var(--c-divider-soft)',
        borderTopLeftRadius: '14px',
        borderTopRightRadius: '14px',
        maxWidth: '480px',
        margin: '0 auto',
        maxHeight: 'calc(100dvh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)'
      }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          borderBottom: '1px solid var(--c-divider-soft)'
        }}>
          {step === 2 ? (
            <button type="button" aria-label="Back" onClick={() => setStep(1)}
              style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
              <ChevronLeft size={18} />
            </button>
          ) : (
            <button type="button" aria-label="Close" onClick={closeWizard}
              style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--c-text-mid)' }}>
              <X size={18} />
            </button>
          )}
          <span style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: '"Fraunces", serif',
            fontSize: '18px',
            color: 'var(--c-text-loud)'
          }}>New plan</span>
          <span style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--c-text-soft)'
          }}>{`Step ${step} of 2`}</span>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {step === 1 ? (
            <PeriodStep
              periodType={periodType}
              periodStart={periodStart}
              periodEnd={periodEnd}
              title={title}
              onPeriodChange={handlePeriodChange}
              onTitleChange={handleTitleChange}
            />
          ) : (
            <CarryoverStep
              periodStart={periodStart}
              periodEnd={periodEnd}
              workspaceChannels={workspaceChannels}
              selectedCarryovers={selectedCarryovers}
              onChange={setSelectedCarryovers}
            />
          )}
        </div>
        {submitError ? (
          <div style={{
            padding: '10px 16px',
            color: 'var(--c-red)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '13px'
          }}>{submitError}</div>
        ) : null}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--c-divider-soft)',
          display: 'flex',
          justifyContent: step === 1 ? 'flex-end' : 'space-between',
          gap: '10px'
        }}>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={step1NextDisabled}
              style={{
                ...btnTerracotta,
                opacity: step1NextDisabled ? 0.5 : 1,
                cursor: step1NextDisabled ? 'not-allowed' : 'pointer'
              }}
            >Next</button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={creatingPlan}
                style={{
                  ...btnBorder,
                  opacity: creatingPlan ? 0.5 : 1,
                  cursor: creatingPlan ? 'not-allowed' : 'pointer'
                }}
              >Back</button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creatingPlan}
                style={{
                  ...btnTerracotta,
                  opacity: creatingPlan ? 0.5 : 1,
                  cursor: creatingPlan ? 'not-allowed' : 'pointer'
                }}
              >{creatingPlan ? 'Creating...' : 'Create plan'}</button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default CreatePlanWizard;
