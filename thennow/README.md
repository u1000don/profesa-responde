# ThenNow

**See progress come to life.**

ThenNow is a mobile app for iPhone and Android that turns photos taken over time into a
smooth, perfectly aligned progress video. Pick **Face Progress** or **Full-Body Progress**,
capture or import photos from different dates, and ThenNow automatically centers, straightens,
scales and crops every photo so the person stays in exactly the same place — then exports the
sequence as a high-quality MP4.

Built with Expo (React Native + TypeScript), Google ML Kit, Skia and two small local native
modules. All photo analysis and video encoding happens **on the device**.

---

## Feature map

| Spec | Where |
| --- | --- |
| Create project (mode, name, 9:16 / 1:1 / 16:9) | `app/project/new.tsx` |
| Project list ("My ThenNow"), rename/delete | `app/index.tsx` |
| Guided capture with adjustable ghost overlay | `app/project/[id]/capture.tsx` |
| Live guidance ("Move closer", "Step left", …) | `src/lib/align/guidance.ts` |
| Front / side / back sequences | View switcher in `app/project/[id]/index.tsx` |
| Auto date + manual date editing | `src/components/DateSheet.tsx` |
| Landmark detection (face) | `src/lib/landmarks/face.ts` (`@react-native-ml-kit/face-detection`) |
| Landmark detection (body pose) | `modules/thennow-pose` (local ML Kit native module) |
| Automatic alignment + flagging | `src/lib/align/autoAlign.ts`, `src/lib/geometry/similarity.ts` |
| Manual adjust (drag / pinch / rotate, undo/redo, reset, back-to-auto, compare slider, snapping) | `app/project/[id]/adjust/[photoId].tsx` |
| Timeline (reorder, replace, duplicate, remove, move between views) | `app/project/[id]/index.tsx` |
| Real-time preview + speed / transitions / holds / dates / music | `app/project/[id]/preview.tsx` |
| MP4 export (cuts or crossfades, optional audio) | `src/lib/video/exporter.ts` + `modules/thennow-encoder` |
| Save to photos + native share sheet | `app/project/[id]/export.tsx` |
| Side-by-side before & after image | `src/lib/video/beforeAfter.ts` |
| Privacy principles | `app/privacy.tsx` |

## How alignment works

1. **Detect** — ML Kit finds face landmarks (eyes, nose, mouth) or body pose landmarks
   (nose, shoulders, hips, ankles) in each photo, entirely on-device.
2. **Solve** — `solveSimilarity` computes the least-squares similarity transform
   (uniform scale + rotation + translation, closed-form 2D Umeyama) mapping the detected
   landmarks onto canonical target positions for the chosen video format
   (`src/lib/align/canonical.ts`).
3. **Check** — the residual error and canvas coverage are scored; photos that can't be
   aligned reliably are **flagged** (never rejected) and fall back to a centered crop the
   user can fix manually.
4. **Render** — Skia draws each photo through its transform into the reference frame
   (1080×1920 / 1080×1080 / 1920×1080), both for on-screen previews (`AlignedPhoto`) and
   for export stills. Originals are never modified.

Every photo added to a project is re-encoded once (EXIF orientation baked in) so the
detector, renderer and editor all agree on pixel coordinates.

## Native modules (local, in `modules/`)

- **`thennow-pose`** — ML Kit Pose Detection (accurate, single-image mode).
  Kotlin + Swift, returns named landmarks with in-frame likelihoods.
- **`thennow-encoder`** — turns the timed sequence of rendered frames into an H.264 MP4.
  Android: MediaCodec input-surface + MediaMuxer, with AAC audio passthrough.
  iOS: AVAssetWriter + pixel-buffer adaptor, with audio re-encoded to AAC.
  Long holds are subdivided (~10 fps) for player compatibility; crossfade frames are
  pre-rendered by Skia at 30 fps.

Both are optional at runtime (`requireOptionalNativeModule`) so the JS app degrades
gracefully where native code isn't present.

## Development

```bash
cd thennow
npm install --legacy-peer-deps
npx expo prebuild            # generates ios/ and android/
npx expo run:ios             # or: npx expo run:android
```

Notes:

- **A development build is required** (camera, ML Kit, Skia and the local modules are
  native). Expo Go is not supported.
- iOS uses static frameworks and deployment target 16.4 (ML Kit requirement) — already
  configured via `expo-build-properties` in `app.json`.
- Typecheck with `npm run typecheck`.

## Privacy

- Projects are private by default and live only on the device.
- Face/body landmarks are processed on-device; detection is used **only** for positioning
  and alignment, never for identity recognition.
- Photos are never used to train AI models.
- Originals in the camera roll are never modified; the app works on private copies.
- Camera and photo library are only accessed after explicit permission.
- Content leaves the device only when the user shares it.

## Known MVP limitations

- **Music**: Android muxes AAC/M4A tracks only (other formats export silent with a
  warning); a bundled royalty-free library is stubbed by "add from device" until tracks
  with clear licensing are added.
- **Live guidance mirroring**: left/right hints assume the front-camera preview is
  mirrored; the ghost overlay has a manual Mirror toggle for edge cases.
- No accounts, no social features, no cloud — by design.
