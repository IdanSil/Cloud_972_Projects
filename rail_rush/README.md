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
