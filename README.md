# מר יסודות - WebAR

Open https://noamfurer.github.io/ar-poc/ on a phone and tap the camera button.
Print marker.html, lay the logo flat on the table, and aim from above at a slight angle.
Keep the entire logo visible at roughly half the screen width for initial recognition.

The exact uploaded logo is compiled in assets/logo_target.mind. The supplied GLB
is reconstructed by the Pages workflow, with its SHA-256 verified.
Its embedded sign image is preserved byte for byte. mascot.js fixes the sign's
inward winding/UV display at runtime and groups the supplied meshes into pivots
for a wave, head motion, stepping and sign movement.

The model is Z-up. MindAR's XY plane becomes the tabletop; positive Z points
out of the printed surface. A depth-only plane hides the model below the table
during entrance. The lowest sole is aligned to that plane. Reacquisition restarts
the entrance. preview.html displays the same model and motion without a camera.

Runtime libraries are hosted locally: A-Frame 1.5.0 and MindAR 1.2.5.
Validation: browser model/camera startup, zero page errors, animation transforms,
unchanged GLB SHA-256, and synthetic target matching. Physical phone tracking
still depends on lighting, print quality, camera angle and distance.

## Recorded speech

The camera button unlocks Web Audio and loads the supplied 14-second recording.
Speech begins five seconds after the 1.35-second emergence finishes. A 50 Hz
amplitude envelope from the same decoded recording drives the upper/lower lips
using the audio clock. No subtitles or generated speech are used. Losing the logo
or hiding the tab pauses speech; reacquisition restarts the entrance and wait,
then resumes the same recording position. A completed recording does not replay
on tracking flicker. The preview has an explicit sound-start button as well.
