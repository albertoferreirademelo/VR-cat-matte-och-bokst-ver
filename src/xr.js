// Capability probes are only a hint. A browser can reject or stall a probe;
// the explicit VR button must still be able to request a session on a tap.
export async function detectXRMode(xr, timeoutMs = 1500) {
  if (!xr) return null;
  const modes = ['immersive-ar', 'immersive-vr'];
  const supported = await Promise.all(modes.map(async (mode) => {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => xr.isSessionSupported(mode)),
        new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }));
  return modes.find((_mode, index) => supported[index]) ?? null;
}

export function requestGameXR(xr, preferredMode) {
  // This call must happen in the button's click handler, before any await.
  return xr.requestSession(preferredMode ?? 'immersive-vr', { requiredFeatures: ['local-floor'] });
}
