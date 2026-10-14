# Quest VR start investigation, 2026-10-14

Reported on the published GitHub Pages game: maths entered immersive VR;
letters played in the browser window and offered only "Spela på skärmen".

The published build served `assets/index-BCwjGf_i.js`. Its code uses the same
VR support flag and start handler for both subjects. That flag starts false and
is only set true after a one-time, sequential AR/VR support probe succeeds.
Probe errors were ignored and no explicit VR attempt was available afterwards.

Reproducing the published letters menu with the support flag true showed both
start buttons at 1280 × 720. This did not establish a layout cause. No Quest was
listed by `adb devices -l`, so the reason the device's probe failed is unconfirmed.

The local fix treats support probing as a hint: probes run independently with a
timeout, and a secure browser exposing WebXR retains an explicit VR start button.
If no mode was detected, the user's click requests `immersive-vr` directly.
Successful passthrough detection still selects `immersive-ar`. Failed requests
show an explanatory message and can be retried with another click.

Verification:
- Node tests cover rejected and stalled AR probes, preference for passthrough,
  both-negative probes, and a synchronous direct VR request after failed detection.
- `/tests/browser.html?xr` simulates WebXR availability with a failed probe. Clicking
  the letters VR button reported `bokstaver: VR requested (letters-1)`; maths reported
  `matte: VR requested (add-1-2)`. This checks menu handoff, not an actual XR session.
- `screenshots/letters-vr-recovery.jpg` shows the simulated letters handoff.
- Physical Quest verification remains pending. Deployment is checked separately
  after publishing.
