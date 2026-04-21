import React from 'react';
import { Avatar } from '../../../core/ui/index.js';
import { usePcsStore } from '../pcsStore.js';
import { renderActivity } from '../utils/activity.jsx';
import { timeSince } from '../utils/time.js';
import { displayNameFromEmail, roleFromEmail } from '../utils/users.js';
import { pcsFlow } from '../index.js';

export function ActivityFeed() {
  const activity = usePcsStore((s) => s.activity);
  const userRoles = usePcsStore((s) => s.userRoles);
  const error = usePcsStore((s) => s.activityError);

  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="font-sans text-base text-text-soft mb-3">
          Could not load activity.
        </div>
        <button
          onClick={() => pcsFlow.retryActivity && pcsFlow.retryActivity()}
          className="font-mono text-xs tracking-widest uppercase
                     text-terracotta border border-border-warm
                     px-3 py-1.5 rounded-sm2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <div className="px-4 py-6 font-sans text-base text-text-dim italic text-center">
        No activity yet.
      </div>
    );
  }

  return (
    <div>
      {activity.map((row) => {
        const name = displayNameFromEmail(row.actor, userRoles) || row.actor || 'Unknown';
        const role = roleFromEmail(row.actor, userRoles);
        const body = renderActivity(row);
        if (!body) return null;
        return (
          <div
            key={row.id}
            className="flex items-start gap-3 px-4 py-3 border-b border-divider-subtle"
          >
            <Avatar name={name} role={role} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-sans text-lg font-semibold text-text-loud">
                  {name}
                </span>
                <span
                  className="font-mono text-xs tracking-wide text-text-dim uppercase"
                  style={{ fontFeatureSettings: "'tnum' 1" }}
                >
                  {timeSince(row.created_at)}
                </span>
              </div>
              <div className="font-sans text-lg text-text-mid leading-normal">
                {body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
