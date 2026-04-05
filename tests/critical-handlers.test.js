import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Source-regex analysis tests, same pattern as
// tests/error-handling.test.js and tests/client-comment.test.js.
// These protect the structural contract of three critical
// mutating handlers: submitApproval, deletePost, submitPcsComment.

var approvalSrc  = fs.readFileSync(path.join(__dirname, '..', '09-approval.js'), 'utf8');
var actionsSrc   = fs.readFileSync(path.join(__dirname, '..', '08-post-actions.js'), 'utf8');
var pcsSrc       = fs.readFileSync(path.join(__dirname, '..', 'actions', 'pcs.js'), 'utf8');

function extractFn(src, signaturePattern) {
  // Pull the function body from a regex-matched signature through
  // the closing brace that precedes a blank line — good enough for
  // these single-purpose async functions.
  var m = src.match(signaturePattern);
  return m ? m[0] : '';
}

describe('Critical handlers — source contract', function() {

  beforeEach(function() {
    window.logError  = vi.fn();
    window.showToast = vi.fn();
  });

  // ====================================================
  // 1. submitApproval in 09-approval.js
  // ====================================================
  describe('submitApproval (09-approval.js)', function() {
    var src = extractFn(approvalSrc,
      /async function submitApproval\(type, postId, btn\)[\s\S]*?\n\}\n/);

    it('1. function exists with signature (type, postId, btn)', function() {
      expect(src).toBeTruthy();
      expect(src).toContain('async function submitApproval(type, postId, btn)');
    });

    it("2. approved branch issues PATCH to /posts?post_id=eq.<id>", function() {
      // Match the approved branch block specifically.
      expect(src).toMatch(
        /if \(type === 'approved'\)[\s\S]*?apiFetch\(`\/posts\?post_id=eq\.\$\{encodeURIComponent\(postId\)\}`,\s*\{[\s\S]*?method: 'PATCH'/);
    });

    it("3. approved branch PATCH body sets stage: 'scheduled'", function() {
      expect(src).toMatch(
        /if \(type === 'approved'\)[\s\S]*?body: JSON\.stringify\(\{ stage: 'scheduled'/);
    });

    it("4. changes_submit branch issues PATCH with stage:'in_production'", function() {
      expect(src).toMatch(
        /if \(type === 'changes_submit'\)[\s\S]*?apiFetch\(`\/posts\?post_id=eq\.\$\{encodeURIComponent\(postId\)\}`[\s\S]*?body: JSON\.stringify\(\{ stage: 'in_production', client_feedback: text/);
    });

    it("5. changes_submit catch calls logError with action 'submit-approval-changes'", function() {
      expect(src).toMatch(/window\.logError\([^)]*'submit-approval-changes'\)/);
    });

    it("6. approved catch calls logError with action 'submit-approval-approved'", function() {
      expect(src).toMatch(/window\.logError\([^)]*'submit-approval-approved'\)/);
    });

    it("7. both catch branches call showToast('Failed  -  try again', 'error')", function() {
      var matches = src.match(/showToast\('Failed  -  try again', 'error'\)/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("8. body wrapped in guardAction('submit-approval-' + postId)", function() {
      expect(src).toContain("window.guardAction('submit-approval-' + postId");
    });
  });

  // ====================================================
  // 2. deletePost in 08-post-actions.js
  // ====================================================
  describe('deletePost (08-post-actions.js)', function() {
    var src = extractFn(actionsSrc,
      /async function deletePost\(postId\)[\s\S]*?\n\}\n/);

    it('9. function exists with signature (postId)', function() {
      expect(src).toBeTruthy();
      expect(src).toContain('async function deletePost(postId)');
    });

    it("10. guards non-Admin callers with showToast + early return", function() {
      expect(src).toMatch(/_delRole[\s\S]*?!== 'admin'[\s\S]*?showToast\('Only Admin can delete posts'[\s\S]*?return/);
    });

    it("11. issues DELETE to /posts?post_id=eq.<encodedPostId>", function() {
      expect(src).toMatch(
        /apiFetch\(`\/posts\?post_id=eq\.\$\{encodeURIComponent\(postId\)\}`,\s*\{\s*method: 'DELETE'\s*\}\)/);
    });

    it("12. catch block calls logError with action 'delete-post'", function() {
      expect(src).toMatch(/window\.logError\([^)]*'delete-post'\)/);
    });

    it("13. catch block calls showToast('Delete failed  -  try again', 'error')", function() {
      expect(src).toMatch(/showToast\('Delete failed  -  try again', 'error'\)/);
    });

    it("14. catch block re-enables the delete button", function() {
      expect(src).toMatch(/if \(btn\) btn\.disabled = false/);
    });
  });

  // ====================================================
  // 3. submitPcsComment in actions/pcs.js
  // ====================================================
  describe('submitPcsComment (actions/pcs.js)', function() {
    var src = extractFn(pcsSrc,
      /window\.submitPcsComment = async function[\s\S]*?^\};/m);

    it('15. function exists as window.submitPcsComment', function() {
      expect(src).toBeTruthy();
      expect(src).toContain('window.submitPcsComment = async function');
    });

    it("16. accepts (postId, message, visibility, isTask, isInternal)", function() {
      expect(src).toContain('function(postId, message, visibility, isTask, isInternal)');
    });

    it("17. wrapped in guardAction('submit-pcs-comment-' + postId)", function() {
      expect(src).toContain("window.guardAction('submit-pcs-comment-' + postId");
    });

    it("18. early-return guard on missing postId or empty message", function() {
      expect(src).toMatch(/if \(!postId \|\| !message \|\| !\(message = message\.trim\(\)\)\) return/);
    });

    it("19. delegates to window._doSubmitComment with normalized opts", function() {
      expect(src).toContain('window._doSubmitComment');
      expect(src).toMatch(/postId: _realPostId[\s\S]*?message: message[\s\S]*?visibility: visibility[\s\S]*?mentioned: _mentioned[\s\S]*?author: _author[\s\S]*?role: _role[\s\S]*?title: _title[\s\S]*?isTask: isTask[\s\S]*?images: _imgs/);
    });

    it("20. catch block calls logError with action 'submit-pcs-comment'", function() {
      expect(src).toMatch(/window\.logError[\s\S]*?'submit-pcs-comment'/);
    });

    it("21. catch block calls showToast('Failed to send. Try again.', 'error')", function() {
      expect(src).toMatch(/showToast\('Failed to send\. Try again\.', 'error'\)/);
    });

    it("22. _doSubmitComment disables pcs-send-btn-client with SENDING… label", function() {
      // verifies _doSubmitComment's button-disable contract (not
      // inside the submitPcsComment regex, but part of the send
      // pipeline — source checked in full file).
      expect(pcsSrc).toMatch(/_sendBtn\.textContent = 'SENDING\.\.\.'[\s\S]*?_sendBtn\.disabled = true/);
    });
  });
});
