# ✨ Magic Pose

**Magic Pose** is a camera app that helps you strike the perfect pose. It uses your device camera with the usual camera settings, and adds three extra modes:

| Mode | What it does |
|---|---|
| 🧭 **Explore** | Browse a library of **36 poses** in 8 categories (standing, fashion, sitting, selfie, fun, fitness, couple, group), each with tips and a difficulty level. |
| 💡 **Idea** | Pick a pose and its **outline is drawn over the live camera**. Line yourself up with it and take the shot. An optional **pose coach** scores how well you match and can take the photo for you. |
| 🪄 **Template** | Pick a style template (Neon Nights, Superhero, Anime, Royal Portrait…). Its pose outline appears on the camera; when you take the picture, **AI edits your photo into that style straight away**. |

It runs in the browser on phones and desktops, and you can add it to your home screen like an app.

It is a full-stack app:

- **Frontend:** plain HTML, CSS and JavaScript modules, with no build step. It handles the camera, pose outlines, on-device pose detection, instant previews and the gallery.
- **Backend:** a [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) API that serves the pose library and templates and sends Template photos to an AI image model.

> Sister projects: **[mahimj-maps](https://github.com/maddy1357/mahimj-maps)** and **[mahimj-earth](https://github.com/maddy1357/mahimj-earth)**.

---

## 💡 Why Magic Pose?

Most people know the feeling: the camera is ready, but **you don't know how to stand**. Photos come out stiff, every shot uses the same pose, and turning a good photo into something special means editing apps and a lot of time.

Magic Pose fixes those three problems:

1. **"I don't know what pose to do"**: **Explore** has 36 ready-made poses with step-by-step tips, and **Auto pose** suggests one that fits your background and the number of people in the frame.
2. **"I can't tell if I'm doing it right"**: **Idea** draws the pose outline on the camera, so you or the person holding the phone can line it up. The **pose coach** gives a live match score and can take the photo for you.
3. **"Editing takes too long"**: **Template** restyles the photo with AI the moment you take it (neon city, golden hour, anime, royal portrait…), with no editing app needed.

It is built as a **web app**: there is nothing to install from an app store, it works on phones and computers, and your photos stay on your device. Only Template photos are sent for AI editing.

---

## 🚀 How to run

### 1. What you need
| Tool | Version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18.17 or newer (20 LTS recommended) | `node -v` |
| npm | comes with Node.js | `npm -v` |
| [Git](https://git-scm.com/) | any | `git --version` |
| A browser with camera support | Chrome, Edge, Safari or Firefox | |

### 2. Download and install
```bash
git clone https://github.com/maddy1357/magic-pose.git
cd magic-pose
npm install
```

### 3. Start the app
```bash
npm start
```
You should see:
```
Magic Pose v1.0.0 running at http://localhost:3000
AI templates: off - set OPENAI_API_KEY in .env to enable (the instant preview still works)
```
Open **http://localhost:3000** and click **Allow** when the browser asks to use the camera.

> For development, `npm run dev` restarts the server automatically when you change a backend file. Frontend files are served as they are, so just refresh the page.

### 4. (Optional) Turn on AI templates
Template mode works without any setup: you get an **instant on-device preview** of the style. For the full AI edit, add an image-model key:

```bash
# macOS / Linux / Git Bash
cp .env.example .env
# Windows PowerShell
Copy-Item .env.example .env
```
Edit `.env`, set `OPENAI_API_KEY=sk-...`, then restart with `npm start`. The server logs `AI templates: openai (gpt-image-1)`, and the app shows the status under **Settings → AI templates**.

### 5. (Optional) Use a different port
```bash
PORT=8080 npm start             # macOS / Linux / Git Bash
$env:PORT=8080; npm start       # Windows PowerShell
```
Or set `PORT=8080` in `.env`.

### 6. Stop the app
Press <kbd>Ctrl</kbd> + <kbd>C</kbd> in the terminal.

### Troubleshooting
| Problem | Fix |
|---|---|
| "Camera permission blocked" | Click the camera icon in the address bar, allow the camera, then press **Try again** |
| "Camera is busy" | Close other apps that use the camera (Zoom, Teams, the Camera app) and press **Try again** |
| The camera won't open on a phone | Phones need **HTTPS**. See [Use it on your phone](#-use-it-on-your-phone) |
| `EADDRINUSE: address already in use :::3000` | Another app is using port 3000. Stop it, or start with a different `PORT` |
| Auto pose or the pose coach says "unavailable" | They download their models from the internet the first time. Check your connection and reload |
| "Could not load poses" | The server is not running. Start it with `npm start` |

---

## ✨ Features

### Camera
| | |
|---|---|
| 📷 **Device camera** | Front and back cameras, with a switch button when the device has more than one |
| ⚡ **Flash** | Uses the real torch where supported, and a white screen flash for selfies |
| ⏱️ **Self-timer** | Off, 3, 5 or 10 seconds, with a countdown and beeps (tap the shutter again to cancel) |
| 🔍 **Zoom** | Hardware zoom (0.5×–10×) when the camera supports it, otherwise digital zoom |
| 📐 **Aspect ratio** | 3:4, 9:16, 1:1 or full screen. The photo is cropped exactly like the preview |
| 🎨 **Filters** | Normal, Vivid, Warm, Cool, Mono, Fade and Drama, shown live and applied to the photo |
| #️⃣ **Grid** | Rule-of-thirds guides |
| ⚙️ **Settings** | Resolution (720p, 1080p or 4K), mirror selfies, shutter sound, JPEG quality |
| 🖼️ **Gallery** | Photos are saved on the device (IndexedDB). You can view, compare, download, share and delete them |
| ⌨️ **Desktop** | <kbd>Space</kbd> takes a photo, <kbd>Esc</kbd> closes panels, and you can swipe the viewfinder to change mode |

### 🧭 Explore
- Search, category chips and a **Favourites** list.
- Each pose card shows the pose outline, its difficulty and whether it is full body, half body or for more than one person.
- Open a pose for its description and tips, then tap **Try this pose** to go straight to Idea mode.

### 💡 Idea: pose outline overlay
- The chosen pose is drawn as a clean **outline over the camera**. You can change its colour, opacity and size.
- A pose strip above the shutter lets you switch ideas quickly, with favourites first.
- **Auto pose** (on by default): the app reads the **background** and switches to a pose that suits it, all on your device. It recognises beaches, waterside, mountains, snow, nature, landmarks, city streets, walls and doors, sofas and seats, gyms, stages and parties, indoor rooms, night scenes and open sky. It also counts the people in the frame, so two people get couple poses and three or more get group poses. Suggested poses are tagged **AUTO**. If you pick a pose yourself, the app keeps it until the scene changes, and the **Auto** chip turns the feature off.
- **Pose coach** (optional): [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) runs **on the device**. It draws your skeleton and shows a live **match %**. The outline glows green when you match, and **auto-capture** takes the photo while you hold the pose. The library and model are only downloaded when you switch the coach on.

### 🪄 Template: instant AI restyle
1. Choose a template, or let **Auto** pick one that suits your background (beach → Golden Hour, city → Neon Nights, snow → Winter Wonderland, two people → Sunset Love…). Its pose outline appears on the camera.
2. Strike the pose and take the picture.
3. An **instant preview** of the style appears at once, made on your device.
4. The photo goes to the AI, which **restyles it while keeping your face and pose**. The preview is replaced when the edit is ready, usually within a few seconds. If you close the viewer, the result still lands in your gallery.
5. **Hold to compare** with the original, **Download** or **Share** it, or tap another template to **restyle the same photo**.

There are 14 templates: Neon Nights, Golden Hour, Studio Editorial, Superhero, Anime, Retro Film, Watercolor, Royal Portrait, Cover Star, Space Walk, Winter Wonderland, 3D Cartoon, Pencil Sketch and Sunset Love (a couple pose).

> No camera? Use **Use a photo instead** to restyle an image from your device.

---

## 📱 Use it on your phone

Browsers only allow camera access on **HTTPS** pages or `localhost`. To use the app on a phone over your Wi-Fi, use one of these options:

- **HTTPS with a local certificate.** Create one with [mkcert](https://github.com/FiloSottile/mkcert):
  ```bash
  mkcert -install
  mkdir certs && mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 192.168.x.x
  ```
  Then set `HTTPS_KEY=certs/key.pem` and `HTTPS_CERT=certs/cert.pem` in `.env`. The server prints its network addresses when it starts.
- **A tunnel.** Run `npx localtunnel --port 3000` or `cloudflared tunnel --url http://localhost:3000` and open the HTTPS link on your phone.

Then use **Add to Home Screen** to get a full-screen app.

---

## 🔧 Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Web server port |
| `OPENAI_API_KEY` | – | Turns on AI templates |
| `AI_PROVIDER` | `openai` if a key is set, else `none` | `openai`, `mock` (returns the photo unchanged, for testing) or `none` |
| `AI_IMAGE_MODEL` | `gpt-image-1` | Image model used for edits |
| `AI_IMAGE_QUALITY` | `medium` | `low`, `medium` or `high`. The app's setting overrides this for each photo |
| `AI_INPUT_FIDELITY` | `high` | Keeps faces closer to the original. Leave it empty to omit it |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible images endpoint |
| `AI_TIMEOUT_MS` | `120000` | How long to wait for an edit |
| `HTTPS_KEY`, `HTTPS_CERT` | – | Serve over HTTPS (see above) |

---

## 🧩 API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | App version and AI status `{ enabled, provider, model }` |
| `GET` | `/api/categories` | Pose categories with counts |
| `GET` | `/api/poses?category=&q=&people=` | Poses, with joint coordinates ready to draw |
| `GET` | `/api/poses/:id` | One pose |
| `GET` | `/api/templates` | Templates: pose, colours and the on-device preview recipe |
| `POST` | `/api/edit` | `{ image: dataURL, templateId, width, height, quality }` → `{ image, provider, ms }` |

`/api/edit` errors use a `code`: `BAD_IMAGE`, `BAD_TEMPLATE`, `TOO_LARGE`, `AI_NOT_CONFIGURED` (503), `AI_TIMEOUT`, `AI_REJECTED` or `AI_ERROR`.

### How the poses work
Poses are not drawings. Each one is a set of **bone angles** for a simple body model (`backend/src/lib/skeleton.js`). The model turns the angles into joint positions with natural proportions, and the frontend draws them as a merged outline using SVG masks (`frontend/js/figure.js`). The pose coach compares the same bone angles with the angles detected on you, so it does not matter how far you are from the camera.

To add a pose, add an entry to `backend/src/data/poses.js`. To add a template, add one to `backend/src/data/templates.js`.

---

## 🗂️ Project structure

```
magic-pose/
├── backend/
│   ├── server.js              # HTTP/HTTPS server
│   ├── src/
│   │   ├── app.js             # Express app & routes
│   │   ├── config.js          # settings from .env
│   │   ├── data/              # pose library & templates
│   │   ├── lib/               # skeleton model, .env loader
│   │   ├── routes/            # /api/poses, /api/templates, /api/edit
│   │   └── services/          # catalogue, AI editor
│   └── test/                  # node:test suites
└── frontend/
    ├── index.html, styles.css, manifest.webmanifest
    └── js/
        ├── app.js             # UI & modes
        ├── camera.js          # camera, torch, zoom, capture
        ├── figure.js          # pose outline SVG renderer
        ├── coach.js           # MediaPipe pose matching
        ├── scene.js           # Auto pose: background + people → suggestions
        ├── vision.js          # shared MediaPipe loader
        ├── stylize.js         # filters & instant template previews
        ├── gallery.js         # IndexedDB photo storage
        └── settings.js, api.js
```

## 🧪 Tests

```bash
npm test
```

The tests cover the API, the input checks, the edit flow (using the `mock` provider) and the skeleton model. They need no internet access.

## 🔒 Privacy

Photos stay on your device. Only photos taken in **Template** mode are sent, through your own server, to the AI provider you configure. The pose coach and Auto pose run entirely in the browser.

## 📄 License

Magic Pose is a **MahimJ** project, released under the [MIT License](LICENSE).

Copyright © 2026 MahimJ (maddy1357). You are free to use, copy, change and share it, including commercially, as long as the copyright notice and licence text are included. The software is provided "as is", without warranty.
