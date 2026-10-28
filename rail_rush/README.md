# Rail Rush

An endless subway runner you control with your body through the webcam.

- Step left / right: switch tracks
- Jump: hop over red barriers
- Duck: roll under yellow signs
- Raise both hands: start / play again

The first time you play with the camera, a 15-second move check (stand still, step left, step right, jump, duck)
learns the size of your moves. It is saved in the browser; "Redo my move check" runs it again.

How the body tracking works:
- MediaPipe Pose (full model, falls back to the lite model on slow computers) runs on your device.
- Tracks follow your hips; jumps follow your hips rising (early on upward speed) and your feet leaving the floor; ducks follow your head dropping.
- Everything is measured in torso lengths, so it works at any distance, and your standing position is re-learned whenever you hold still.

Power-ups: magnet, jetpack, super jump, 2× score, shield, turbo smash.
Bamboozles (mystery boxes and traps in coin trails): mirror controls, blackout, dizzy camera, hyper speed, moon gravity.

Open `index.html` from any https:// address (camera access needs https). It also plays with arrow keys or swipes.

## Pocket controller (phone)

Your phone can do jump and duck from your pocket, which is quicker and steadier than the camera. The camera keeps left / right
(or use the arrow keys).

1. On the game's start screen tap **Add pocket controller (phone)**. A QR code and a 5-letter code appear.
2. Scan the QR code with the iPhone camera (or open `controller.html` on the phone and type the code).
3. Tap **Start motion** and allow motion access, then **Ready: put the phone in my pocket**. Keep the screen on (don't lock it).
4. Optional: the 20-second **move check** on the phone (jump twice, duck twice, with spoken prompts) fits it to you.

How it works:
- `controller.html` reads the phone's motion sensors. `motion.js` finds which way is down (the phone's own gravity estimate,
  or a low-pass filter when the phone has no gyro), takes the up/down acceleration, and integrates it into up/down speed.
- Jump fires during push-off, about a tenth of a second before your feet leave the floor (free-fall is the backup).
- Duck fires when you sink at least ~15 cm and settle, or straight away when you drop fast or deep. A jump's dip turns
  around at once, so it doesn't count. Very shallow knee bends are ignored on purpose.
- Phone and game talk over WebRTC (PeerJS). The free PeerJS cloud server is only used to find each other.
  For testing or self-hosting a server, add `?peerhost=…&peerport=…&peersecure=0` to the game link; the QR code passes it on.
- Add `?debug` to the game link to show the link delay and the phone's live readings in the HUD.

Tests: `node tests/motion.test.js` (detector, synthetic motion data) and `tests/e2e.js` (game + phone in Chromium with a
local PeerJS server; see the header of that file).
