import React from 'react';
import { tokens } from '../tokens.js';

// Classic React error boundary. When an error bubbles into a
// wrapped subtree, render a fallback UI instead of letting the
// error propagate to the host page. Critical for isolation: a
// React crash must not break vanilla Sorted.

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[sorted-react] subtree error:', error, info);
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      try { window.showToast('Something broke in the new form — falling back', 'error'); }
      catch (e) { /* ignore */ }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          background: tokens.ink1,
          color: tokens.text,
          fontFamily: tokens.serif,
          fontSize: 14,
          border: `1px solid ${tokens.line}`,
          maxWidth: 420,
          margin: '20px auto'
        }}>
          <div style={{
            fontFamily: tokens.mono,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: tokens.danger,
            marginBottom: 12
          }}>
            Error
          </div>
          <div style={{ marginBottom: 8 }}>
            Something went wrong in this view.
          </div>
          <div style={{ fontSize: 12, color: tokens.textWhisper }}>
            {this.state.error.message || String(this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
