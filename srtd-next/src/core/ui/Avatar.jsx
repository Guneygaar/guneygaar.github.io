import React, { useState } from 'react';

const ROLE_BG = {
  admin:     'tint-role-admin text-role-admin',
  creative:  'tint-role-creative text-role-creative',
  servicing: 'tint-role-servicing text-role-servicing',
  client:    'tint-role-client text-role-client',
  unknown:   'bg-bg-2 text-text-dim border border-dashed border-border-neutral',
};

const SIZE = {
  sm: 'w-[26px] h-[26px] text-sm',
  md: 'w-[36px] h-[36px] text-base',
  lg: 'w-[32px] h-[32px] text-base',
};

export function Avatar({ name, role = 'creative', size = 'md', avatarUrl = null, className = '' }) {
  const [failed, setFailed] = useState(false);
  const safeName = (name || 'U').trim();
  const initials = safeName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  const roleCls = ROLE_BG[role] || ROLE_BG.creative;
  const sizeCls = SIZE[size] || SIZE.md;
  const baseCls = `rounded-pill flex items-center justify-center font-serif font-medium flex-shrink-0 overflow-hidden ${sizeCls} ${className}`;

  if (avatarUrl && !failed) {
    return (
      <div className={baseCls}>
        <img src={avatarUrl} alt={safeName} loading="eager" decoding="async" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${baseCls} ${roleCls}`}>{initials || 'U'}</div>
  );
}
