# Multiplayer Party & Puzzle Games 🎭🔢

A sleek, serverless web game suite built for mobile and desktop play with zero backend requirements. Ready to host on **GitHub Pages** for free!

---

## 🎮 Included Game Modes

### 1. 🔢 Multiplayer Sudoku Race (NEW!)
A fast-paced multiplayer competitive Sudoku speed challenge.
- **Admin Puzzle Upload**: Only the admin/host can upload or configure the puzzle.
  - Paste any standard 81-character puzzle string (digits 1-9, `0` or `.`).
  - Upload puzzle files (`.txt` or `.json`).
  - Or choose 1-click presets: **Easy**, **Medium**, **Hard**, **Expert**.
  - Built-in backtracking engine automatically validates that the puzzle has a valid solution before starting.
- **Single Share Link & QR Code**: Host generates a room; players join instantly by scanning the QR code or clicking the link.
- **Live Opponent Progress**: Real-time progress tracking of all players via WebRTC PeerJS.
- **Race Finish & Continuation**:
  - The first player to finish all 81 cells correctly is declared the **1st Place Winner** 🏆 with fanfare audio and celebration modal.
  - All other players receive an immediate live announcement: **"You lost the race, but keep going to complete your puzzle!"**
  - The board remains completely unlocked so non-winners can still finish their puzzle at their own pace and view their final completion time.
- **Modern Sudoku UX**:
  - Notes / Pencil mode for pencil marks.
  - Row, column, 3x3 block, and matching number highlighting.
  - Conflict detection toggle.
  - On-screen keypad + full desktop keyboard navigation (numbers 1-9, Arrow keys, N for notes, Backspace/Delete, Ctrl+Z undo).

### 2. 🎭 The Traitor — Secret Role Party Game
A mystery party game for 3+ players where players secretly discover if they are the **Traitor** or an **Innocent**.
- **Configurable Game Setup**: Choose any number of players (3+) and any number of traitors.
- **Single Share Link & QR Code**: The host creates a room; all players open the exact same link or scan the QR code.
- **Dramatic 3D Card Reveal**: Tap & hold 3D flip card animation with synthesized atmospheric sound effects, custom role art, and auto-hide countdown to prevent screen peeking.

---

## 🚀 How to Host on GitHub Pages (Step-by-Step)

1. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com) and click **New repository** (e.g. `party-games` or `traitor-game`).
2. **Push the Project Files**:
   - Commit and push `index.html`, `style.css`, `app.js`, `sudoku.js`, `audio.js`, `README.md` to the `main` branch.
   ```bash
   git init
   git add .
   git commit -m "Initial commit with The Traitor and Multiplayer Sudoku"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. **Enable GitHub Pages**:
   - In your repository, go to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and folder `/ (root)`, then click **Save**.
4. **Play!**
   - In 1–2 minutes, your game is live at:
     `https://<your-username>.github.io/<repo-name>/`
   - Open on your mobile phone, tablet, or laptop!

---

## 💻 Running Locally

You can run the game locally using any static HTTP server or simply opening `index.html` in your browser:

```bash
# Using Python
python3 -m http.server 8000

# Or using Node / npx
npx serve .
```
Then navigate to `http://localhost:8000`.
