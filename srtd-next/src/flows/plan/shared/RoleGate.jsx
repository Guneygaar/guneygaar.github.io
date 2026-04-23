// Conditional render helper. Reads role from planStore only.

import React from 'react';
import { usePlanStore } from '../store/planStore.js';

export function RoleGate({ allow, deny, children }) {
  const role = usePlanStore((s) => s.role);
  if (Array.isArray(deny) && deny.indexOf(role) !== -1) return null;
  if (Array.isArray(allow) && allow.indexOf(role) === -1) return null;
  return <>{children}</>;
}
