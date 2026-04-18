import React from 'react';

const ROLE_BG = {
  admin:     'tint-role-admin text-role-admin',
  creative:  'tint-role-creative text-role-creative',
  servicing: 'tint-role-servicing text-role-servicing',
  client:    'tint-role-client text-role-client',
  unknown:   'bg-bg-2 text-text-dim border border-dashed border-border-neutral',
};

const SIZE = {
  sm: 'w-[22px] h-[22px] text-sm',
  md: 'w-[24px] h-[24px] text-sm',
};

export function Avatar({ name, role = 'creative', size = 'md', className = '' }) {
  const safeName = (name || 'U').trim();
  const initials = safeName.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  const roleCls = ROLE_BG[role] || ROLE_BG.creative;
  const sizeCls = SIZE[size] || SIZE.md;
  return (
    <div className={`rounded-pill flex items-center justify-center font-serif font-medium flex-shrink-0 ${roleCls} ${sizeCls} ${className}`}>
      {initials || 'U'}
    </div>
  );
}
