import React from 'react';
import { Field } from '../../../core/ui/index.js';
import { tokens } from '../../../core/tokens.js';
import { useFormState } from '../formStore.js';

export function TitleField() {
  const title = useFormState(s => s.form.title);
  const update = useFormState(s => s.update);

  return (
    <Field num="01" name="Title" required>
      <input
        type="text"
        value={title}
        onChange={e => update('title', e.target.value)}
        placeholder="What's this post about?"
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          fontFamily: tokens.serif, fontSize: 17, fontWeight: 500,
          color: title ? tokens.textLoud : tokens.textWhisper,
          fontStyle: title ? 'normal' : 'italic',
          letterSpacing: '-0.01em', padding: 0, lineHeight: 1.3
        }}
      />
    </Field>
  );
}
