// Data store for the hosted Ready4AI platform: the same methods as local.js, each sent as one
// POST to /api/rpc. The server works out who is asking from the sign-in cookie.
// The platform does not answer these methods yet. docs/READY4AI.md lists what it needs.

async function send(method, args) {
  let out;
  try {
    const res = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ course: 'packet-express', method, args }) });
    out = await res.json();
  } catch (_) {
    throw new Error('Could not reach the server. Check your connection.');
  }
  if (out.ok) return out.data;
  if (out.error === 'SIGNED_OUT') window.dispatchEvent(new CustomEvent('signed-out'));
  throw new Error(out.error);
}

export const METHODS = [
  'session', 'studentJoin', 'teacherEnter', 'signOut', 'previewStart', 'previewReset', 'previewEnd', 'saveProgress', 'updateProfile', 'flagStep', 'rateLesson',
  'askHelp', 'cancelHelp', 'myHelp', 'helpRequests', 'markHelped', 'listClasses', 'createClass', 'deleteClass', 'setOpenAll', 'getClass', 'classBoard', 'removeStudent',
  'feedback', 'reportBug', 'bugReports', 'closeBug', 'exportData', 'importData', 'dataInfo',
];

export function createHostedStore() {
  const store = {
    mode: 'hosted',
    FLAG_REASONS: ['Instructions unclear', 'It did not work', 'Too hard', 'Too easy', 'Other'],
    BUG_KINDS: ['Something did not work', 'Words are wrong or confusing', 'I cannot find something', 'Something else'],
  };
  for (const m of METHODS) store[m] = (...args) => send(m, args);
  return store;
}
