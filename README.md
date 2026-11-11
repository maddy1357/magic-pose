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

## 🚀 Quick start

```bash
git clone https://github.com/maddy1357/magic-pose.git
cd magic-pose
npm install
npm start
```

Open **http://localhost:3000** and allow camera access.

### Turn on AI templates

Template mode works without any setup: you get an **instant on-device preview** of the style. For the full AI edit, add an image-model key:

```bash
cp .env.example .env
# then edit .env and set OPENAI_API_KEY=sk-...
npm start
```

The server logs `AI templates: openai (gpt-image-1)` when AI is on. You can also see the status in the app under **Settings → AI templates**.

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
- **Pose coach** (optional): [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) runs **on the device**. It draws your skeleton and shows a live **match %**. The outline glows green when you match, and **auto-capture** takes the photo while you hold the pose. The library and model are only downloaded when you switch the coach on.

### 🪄 Template: instant AI restyle
1. Choose a template. Its pose outline appears on the camera.
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

Photos stay on your device. Only photos taken in **Template** mode are sent, through your own server, to the AI provider you configure. The pose coach runs entirely in the browser.

## 📄 License

[MIT](LICENSE) © 2026 maddy1357
