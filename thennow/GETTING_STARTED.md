# Getting started — open ThenNow on your computer

A plain-language guide. No prior experience assumed.

## Where the app lives

All the code is saved on GitHub (the website that stores your project) in the
repository `u1000don/profesa-responde`, on a branch (a parallel version of the
project) called:

```
claude/thennow-progress-video-app-5nsg3u
```

The app itself is inside the `thennow/` folder. Nothing lives only on a
temporary machine — as long as GitHub has it, it's safe.

## 1. Install the tools (one time only)

1. **Git** — the program that downloads and tracks code. Get it at
   https://git-scm.com/downloads
2. **Node.js** — the program that runs JavaScript tools. Get the "LTS
   (Long-Term Support)" version at https://nodejs.org
3. For running the app on a phone:
   - **Android**: install **Android Studio** (https://developer.android.com/studio),
     which includes the Android SDK (Software Development Kit) and a phone
     emulator (a fake phone on your screen).
   - **iPhone**: you need a Mac with **Xcode** (free, from the Mac App Store).
     No Mac? See "Building in the cloud" below.

## 2. Download the project

Open a terminal (on Windows: "Git Bash", installed with Git; on Mac:
"Terminal") and run these lines one at a time:

```bash
git clone https://github.com/u1000don/profesa-responde
cd profesa-responde
git checkout claude/thennow-progress-video-app-5nsg3u
cd thennow
npm install --legacy-peer-deps
```

That downloads the code, switches to the app's branch, enters the app folder,
and installs its building blocks (this last step takes a few minutes).

## 3. Run the app

With an Android phone plugged in via USB (with "USB debugging" enabled in the
phone's developer settings) or an emulator open in Android Studio:

```bash
npm run android
```

On a Mac with Xcode, for the iPhone simulator or a plugged-in iPhone:

```bash
npm run ios
```

The first build takes a while (10–20 minutes); after that it's fast.

> **Why not the "Expo Go" preview app?** ThenNow uses the camera, on-device
> face/body detection and a video encoder — real native code that the generic
> Expo Go app doesn't contain. It needs its own build, which is what the
> commands above create.

## Building in the cloud (iPhone without a Mac)

EAS (Expo Application Services) can build the iPhone app on Expo's computers:

```bash
npx eas-cli login          # free account at https://expo.dev
npx eas build --profile development --platform ios
```

It gives you a link/QR code to install the result on your iPhone (Apple
requires a free or paid Apple Developer account for device installs).

## Everyday commands cheat-sheet

| You want to… | Run |
| --- | --- |
| Get the latest saved code | `git pull` |
| Save your changes | `git add -A && git commit -m "describe change"` |
| Upload them to GitHub | `git push` |
| Check the code for mistakes | `npm run typecheck` |
| Start the app again | `npm run android` or `npm run ios` |
