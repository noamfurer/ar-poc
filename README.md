# Free WebAR POC

A zero-backend marker-based AR demo using A-Frame + AR.js.

## What it does
- Opens the phone camera in a web page.
- Tracks the standard Hiro marker.
- Anchors a simple 3D character and a floating video screen to the marker.
- Lets the user physically move closer, farther away, and around the marker.
- Plays a short browser-generated voice line and animates the character mouth/arm.
- Plays a local MP4 on the floating screen.

## Test
The site must be served over HTTPS for camera access on a phone.

1. Deploy this folder to Vercel, Netlify, GitHub Pages, or another HTTPS host.
2. Open `/marker.html` on another device or print it.
3. Open the main site on the phone and allow camera access.
4. Point the phone at the marker.
5. When the character appears, tap `Play demo`.

## Replace with a real character
Replace the primitive character inside `#character` with a local `.glb` file and load it with A-Frame `gltf-model`. If the GLB contains animations, add `aframe-extras` and use `animation-mixer`.

## Replace the video
Overwrite `assets/demo.mp4` with your own MP4. Keep it reasonably compressed for fast mobile loading.

## Production upgrade
For a branded marker instead of Hiro, move to a custom AR.js pattern marker or MindAR image tracking. For markerless surface placement, use WebXR hit-test on supported browsers with an iOS fallback.
