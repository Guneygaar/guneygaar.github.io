/* ═══════════════════════════════════════════════
   09-approval.js — Public approval view
═══════════════════════════════════════════════ */
console.log("LOADED:", "09-approval.js");

async function showApprovalView(postId) {
  document.getElementById('login-overlay')?.classList.add('hidden');
  document.getElementById('dashboard-view')?.classList.remove('active');
  document.getElementById('client-view')?.classList.remove('active');

  const view = document.getElementById('approval-view');
  if (!view) return;
  view.classList.add('active');
  view.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text3)">Loading post…</div>`;

  try {
    const rows = await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}&select=*&limit=1`);
    const post = normalise(rows)[0];
    if (!post) {
      view.innerHTML = `<div class="approval-wrap"><div style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">🔍</div><div style="font-weight:700;font-size:20px;margin-bottom:8px;color:var(--text1)">Post not found</div><div style="color:var(--text3);font-size:14px">The link may have expired or the post ID is incorrect.<br>Post ID: <code>${esc(postId)}</code></div></div></div>`;
      return;
    }

    const stage   = (post.stage||'').toLowerCase().trim();
    const title   = getTitle(post);
    const comments= post.comments || '';
    const postLink= post.postLink || '';
    const {hex, label: stageLabel} = stageStyle(post.stage);
    const relDate = getRelativeDate(post.targetDate);

    const alreadyApproved = stage === 'scheduled' || stage === 'published';

    const designBlock = postLink
      ? `<a href="${esc(postLink)}" target="_blank" rel="noopener" class="approval-design-link">✏ Open Post in Design Tool ↗</a>`
      : `<div class="approval-no-design">No design link attached yet.</div>`;

    const actionsBlock = alreadyApproved
      ? `<div class="approval-already-approved"><span>✓</span> This post has already been approved</div>`
      : `<div class="approval-actions">
           <button class="btn-approve-green" onclick="submitApproval('approved','${esc(postId)}',this)" style="font-size:16px;padding:14px 28px">✓ Approve This Post</button>
           <button class="btn-revise-outline" onclick="submitApproval('revision','${esc(postId)}',this)" style="font-size:16px;padding:14px 28px">↺ Request Changes</button>
         </div>
         <div class="revision-input-wrap" id="approval-revision-wrap">
           <textarea class="revision-textarea" id="approval-revision-text" placeholder="Describe what you'd like changed… be as specific as possible." rows="4"></textarea>
           <button class="btn-send-revision" onclick="submitApproval('revision_submit','${esc(postId)}',this)">Send Revision Request →</button>
         </div>
         <div id="approval-confirmation" style="display:none;text-align:center;padding:24px;color:var(--c-green);font-size:16px;font-weight:600"></div>`;

    view.innerHTML = `
      <div class="approval-wrap">
        <div class="approval-header">
          <div class="approval-logo">GBL Content</div>
          <div class="approval-subtitle">Post Review & Approval</div>
        </div>
        <div class="approval-card">
          <div class="approval-card-meta">
            <span class="tag tag-stage" style="background:${hex}22;color:${hex}">${esc(stageLabel)}</span>
            ${relDate ? `<span class="tag tag-date ${relDate.cls}">${relDate.text}</span>` : ''}
          </div>
          <div class="approval-card-title">${esc(title)}</div>
          ${comments ? `<div class="approval-card-comments">${esc(comments)}</div>` : ''}
          ${designBlock}
        </div>
        ${actionsBlock}
      </div>`;

  } catch (err) {
    view.innerHTML = `<div class="approval-wrap"><div style="text-align:center;padding:60px 20px;color:var(--c-red)">Failed to load post. Please try again.<br><small>${err.message}</small></div></div>`;
  }
}

async function submitApproval(type, postId, btn) {
  if (type === 'revision') {
    document.getElementById('approval-revision-wrap')?.classList.add('active');
    document.getElementById('approval-revision-text')?.focus();
    return;
  }

  if (type === 'revision_submit') {
    const text = (document.getElementById('approval-revision-text')?.value||'').trim();
    if (!text) { showToast('Please describe what you\'d like changed', 'error'); return; }
    if (btn) btn.disabled = true;
    try {
      await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'revisions needed', comments: text, updated_at: new Date().toISOString() }),
      });
      await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: `Revision: ${text.substring(0,80)}` });
      const c = document.getElementById('approval-confirmation');
      if (c) { c.style.display = ''; c.textContent = '↺ Revision request sent — the team will review it.'; }
      document.querySelector('.approval-actions')?.remove();
      document.getElementById('approval-revision-wrap')?.remove();
    } catch { showToast('Failed — try again', 'error'); if (btn) btn.disabled = false; }
    return;
  }

  if (type === 'approved') {
    if (btn) btn.disabled = true;
    try {
      await apiFetch(`/posts?post_id=eq.${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'scheduled', updated_at: new Date().toISOString() }),
      });
      await logActivity({ post_id: postId, actor_name: 'Client', actor_role: 'Client', action: 'Approved — moved to Scheduled' });
      const c = document.getElementById('approval-confirmation');
      if (c) { c.style.display = ''; c.textContent = '✓ Approved! The team has been notified.'; }
      document.querySelector('.approval-actions')?.remove();
      document.getElementById('approval-revision-wrap')?.remove();
    } catch { showToast('Failed — try again', 'error'); if (btn) btn.disabled = false; }
  }
}
