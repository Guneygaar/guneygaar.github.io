import React from 'react';
import { Field } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

export function DriveLinkField() {
  const driveLink = useFormState(s => s.form.driveLink);
  const update = useFormState(s => s.update);

  return (
    <Field num="08" name="Drive Link" optional="Optional">
      <input
        type="text"
        value={driveLink}
        onChange={e => update('driveLink', e.target.value)}
        placeholder="drive.google.com/..."
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          fontFamily: driveLink ? tokens.mono : tokens.serif,
          fontSize: driveLink ? 13 : 17,
          fontStyle: driveLink ? 'normal' : 'italic',
          letterSpacing: driveLink ? '0.02em' : '-0.01em',
          color: driveLink ? tokens.text : tokens.textWhisper,
          padding: 0
        }}
      />
    </Field>
  );
}
