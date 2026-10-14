import test from 'node:test';
import assert from 'node:assert/strict';
import { detectXRMode, requestGameXR } from '../src/xr.js';

test('VR detection survives a rejected AR probe', async () => {
  assert.equal(await detectXRMode({ isSessionSupported: (mode) => mode === 'immersive-ar'
    ? Promise.reject(new Error('probe blocked')) : Promise.resolve(true) }), 'immersive-vr');
});

test('a stalled AR probe cannot prevent VR detection', async () => {
  assert.equal(await detectXRMode({ isSessionSupported: (mode) => mode === 'immersive-ar'
    ? new Promise(() => {}) : Promise.resolve(true) }, 10), 'immersive-vr');
});

test('passthrough remains preferred when both modes are supported', async () => {
  assert.equal(await detectXRMode({ isSessionSupported: async () => true }), 'immersive-ar');
});

test('failed or unsupported probes still allow an explicit VR request', async () => {
  let requested;
  const session = {};
  const xr = {
    isSessionSupported: () => { throw new Error('probe failed'); },
    requestSession: (mode, options) => { requested = { mode, options }; return Promise.resolve(session); },
  };
  const preferred = await detectXRMode(xr);
  assert.equal(preferred, null);
  const pending = requestGameXR(xr, preferred);
  // Synchronous request retains the click's user activation.
  assert.deepEqual(requested, { mode: 'immersive-vr', options: { requiredFeatures: ['local-floor'] } });
  assert.equal(await pending, session);
  assert.equal(await detectXRMode(null), null);
  assert.equal(await detectXRMode({ isSessionSupported: async () => false }), null);
});
