# LiftLog (Firebase Auth + Firestore permissions)

LiftLog is a simple **Workout Log** web app built with **React + Vite** and **Firebase Authentication (email/password)**.

It includes two types of content:
- **Public** (works while logged out): workout templates in Firestore collection `publicWorkouts`
- **Private** (requires login): per-user workout entries in `users/{uid}/workoutLogs`

## Features
- Browse **public workout templates** (logged out or logged in)
- Create an account / log in (email + password)
- Private **My Log** page: add workout entries + view your history (only visible to you)

## Setup (Firebase)
1. Firebase Console → **Authentication** → enable **Email/Password**
2. Firebase Console → **Firestore Database** → create a database (if you haven’t)
3. Deploy Firestore rules from `firestore.rules` (so permissions work)

### Seed public templates
Create a Firestore collection named **`publicWorkouts`** and add documents with fields like:
- `title` (string)
- `description` (string)
- `exercises` (array of strings)
- `steps` (array of strings)
- `tags` (optional array of strings)

You can also open the app and use the “Need sample data?” panel to see example JSON.

## Run locally
```bash
npm run dev
```

## Build + deploy
This project outputs production builds to `dist-web/` (see `vite.config.js`). Firebase Hosting is configured to serve that folder (see `firebase.json`).

```bash
npm run build
firebase deploy
```

## Notes (permissions errors)
If `node_modules/` or `dist/` is owned by `root` (from an older `sudo npm install`), installs/builds may fail. This repo builds to `dist-web/` to avoid that, but you may still want to delete and reinstall deps:

```bash
rm -rf node_modules
npm install
```
