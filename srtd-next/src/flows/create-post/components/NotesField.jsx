import React from 'react';
import { Field } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

export function NotesField() {
  const notes = useFormState(s => s.form.internalNotes);
  const update = useFormState(s => s.update);

  return (
    <Field num="08" name="Internal Notes" optional="Brief · team-only">
      <textarea
        value={notes}
        onChange={e => update('internalNotes', e.target.value)}
        placeholder="Brief, context, reference - anything that helps the team understand this post..."
        style={{
          width: '100%', background: 'transparent', border: 'none',
          padding: '8px 0 0',
          fontFamily: tokens.serif, fontStyle: 'italic', fontSize: 14.5,
          lineHeight: 1.6, color: tokens.text,
          outline: 'none', resize: 'none', minHeight: 60
        }}
      />
      <div style={{
        fontFamily: tokens.mono, fontSize: 9, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: tokens.textGhost, marginTop: 6
      }}>
        ◆ Not shown to client
      </div>
    </Field>
  );
}
