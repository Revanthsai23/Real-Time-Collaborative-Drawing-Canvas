# Real-Time Collaborative Drawing Canvas

A production-quality, client-ready real-time collaborative drawing application that allows multiple users to draw simultaneously on a shared HTML5 canvas. Built with vanilla JavaScript, Node.js, Express, and Socket.io — no frameworks required.

## ✨ Features

### 🎨 Drawing & Tools
- **Real-time synchronized drawing** - See other users' strokes appear instantly as they draw (not after mouse release)
- **Brush & Eraser tools** - Both tools work in real-time with smooth Bezier curve interpolation
- **Smooth stroke rendering** - Continuous stroke interpolation prevents gaps and broken lines
- **Customizable styling** - Color picker and adjustable brush size (1-50px)
- **Client-side prediction** - Zero-latency local drawing for instant feedback

### 🔄 Collaboration Features
- **Live cursor tracking** - See other users' cursors with color-coded indicators
- **User presence** - Real-time user list with circular avatars and color indicators
- **Username system** - Personalized usernames (supports emojis) stored in localStorage
- **User colors** - Each user gets a unique color for identification
- **Conflict-free drawing** - Per-user layer buffers ensure simultaneous drawing works perfectly

### 🎯 Canvas Controls
- **Zoom & Pan** - Zoom controls (Ctrl+Wheel) and pan (Shift+Drag or middle mouse)
- **Canvas utility bar** - Shows active tool, canvas size, FPS, zoom level
- **Save as PNG** - Export your canvas as an image file
- **Large canvas** - Virtual canvas size of 3000×2000 pixels

### 🎨 UI/UX Enhancements
- **Light/Dark mode** - Toggle between themes with persistent preference
- **Glass morphism effects** - Modern translucent UI with backdrop blur
- **Smooth animations** - Micro-interactions and transitions throughout
- **Help sidebar** - Collapsible tips and keyboard shortcuts guide
- **Professional design** - Rounded corners, hover effects, and polished styling

### ⚡ Performance & Monitoring
- **FPS indicator** - Real-time frame rate monitoring
- **Latency display** - Network round-trip time measurement
- **Connection status** - Visual indicator for connection state
- **Optimized rendering** - RequestAnimationFrame-based updates

### 🔧 Advanced Features
- **Global undo/redo** - Undo or redo any stroke from any user (Ctrl+Z, Ctrl+Y)
- **Timestamp-based ordering** - Prevents out-of-order rendering issues
- **Point-based rendering** - Smooth Bezier curve interpolation for continuous strokes
- **Layer compositing** - User-specific layers for conflict-free simultaneous drawing

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd collaborative-canvas
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

Open multiple browser tabs or windows to test real-time collaboration!

## 📖 Usage

### First Time Setup

When you first open the application, you'll be prompted to enter your name:
- Enter a custom name (supports emojis, max 20 characters)
- Click "Join Canvas" or "Skip" to use a generated guest name
- Your name is saved in localStorage for future visits

### Drawing Tools

- **Brush**: Default drawing tool. Click and drag to draw smooth, continuous strokes.
- **Eraser**: Removes drawn content. Works in real-time like the brush tool.

### Controls

- **Color Picker**: Click to select a brush color
- **Brush Size Slider**: Adjust the thickness of your strokes (1-50px)
- **Undo**: Remove the last stroke (keyboard shortcut: `Ctrl+Z` or `Cmd+Z` on Mac)
- **Redo**: Restore the last undone stroke (keyboard shortcuts: `Ctrl+Y`, `Ctrl+Shift+Z`)
- **Clear**: Remove all drawings from the canvas (requires confirmation)

### Canvas Navigation

- **Zoom In/Out**: Use the floating zoom controls (bottom-right) or `Ctrl+Wheel`
- **Pan**: Hold `Shift` and drag, or use middle mouse button
- **Reset View**: Zoom controls show current zoom percentage

### Keyboard Shortcuts

- `Ctrl+Z` (or `Cmd+Z` on Mac) - Undo last stroke
- `Ctrl+Y` (or `Cmd+Y` on Mac) - Redo last undone stroke
- `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac) - Redo (alternative)
- `Ctrl+Wheel` (or `Cmd+Wheel` on Mac) - Zoom in/out
- `Shift+Drag` - Pan canvas
- `Escape` - Close help sidebar

### User Panel

The right panel shows:
- List of all online users with circular avatars
- Each user's unique color indicator
- "You" badge for your own entry
- Tooltips on hover showing username
- Join/leave animations

### Help & Tips

Click the 💡 icon in the top-left to open the help sidebar:
- Keyboard shortcuts reference
- Canvas controls guide
- Collaboration tips

### Theme Toggle

Click the ☀️/🌙 button in the top-right to switch between light and dark modes:
- Preference is saved in localStorage
- Theme applies to all UI elements including canvas background

### Canvas Utility Bar

The bottom bar shows:
- Active tool indicator (✏️ Brush / 🧽 Eraser)
- Canvas size (3000×2000)
- Current FPS
- Zoom percentage
- Save as PNG button

## 🏗️ Project Structure

```
collaborative-canvas/
├── client/                 # Frontend files
│   ├── index.html         # Main HTML structure
│   ├── style.css          # Custom CSS with glass effects and themes
│   ├── main.js            # Application entry point
│   ├── canvas.js          # Canvas drawing logic with zoom/pan
│   ├── websocket.js       # WebSocket communication
│   ├── ui.js              # UI management (toolbar, users, status, theme)
│   └── buffer-canvas.js   # Buffer canvas utility (if used)
├── server/                # Backend files
│   ├── server.js          # Express server and Socket.io setup
│   ├── drawing-state.js   # Drawing state management (undo/redo)
│   └── rooms.js           # Room and user management
├── data/                  # Persistent data (if enabled)
│   └── rooms/             # Room state files
├── package.json           # Dependencies and scripts
├── README.md              # This file
└── ARCHITECTURE.md        # Detailed architecture documentation
```

## 🧰 Technical Stack

### Frontend
- **Language:** Vanilla JavaScript (ES6 modules, no frameworks)
- **Rendering:** HTML5 Canvas API with raw DOM manipulation
- **Styling:** Pure CSS with CSS variables for theming
- **Event Handling:** Native mouse, touch, and pointer events
- **Drawing Tools:** Custom implementation with Bezier curve smoothing
- **UI Framework:** None - pure HTML/CSS/JS

### Backend
- **Runtime:** Node.js
- **Server Framework:** Express.js (for serving static assets)
- **Real-Time Communication:** WebSockets using Socket.io
- **State Management:** In-memory storage for strokes and users
- **Data Format:** JSON-based event serialization with timestamps

### Infrastructure
- **Protocol:** WebSocket (low-latency bi-directional communication)
- **No Frontend Frameworks or Libraries** (except Socket.io client)
- **No Drawing Libraries** — all Canvas logic built manually from scratch

## 🌐 Browser Compatibility

Tested and working on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Requires modern browser with ES6 module support and Canvas API.

## 🔧 Configuration

### Port Configuration

The server runs on port 3000 by default. To change it, set the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Room Management

By default, all users join the "main" room. To join a specific room, add `?room=<roomId>` to the URL:

```
http://localhost:3000/?room=my-room
```

### Username

Usernames are stored in localStorage. To change your username, clear localStorage or modify it in browser DevTools.

## 🎨 Design Features

### Visual Enhancements
- **Glass morphism**: Translucent UI elements with backdrop blur
- **Rounded corners**: 12px border-radius throughout
- **Hover effects**: Scale and glow animations
- **Smooth transitions**: 0.25s ease-in-out for all interactions
- **Dark mode**: Complete theme with CSS variables

### Micro-Animations
- Button scale on hover/click
- Undo/Redo icon rotation
- User avatar slide-in animations
- Toolbar button hover glows
- Help sidebar slide animations

## ⚡ Performance Features

- **Real-time sync**: 12ms throttling (~80 FPS) for smooth updates
- **Client prediction**: Zero-latency local drawing
- **Layer system**: Per-user canvas buffers for conflict-free rendering
- **Timestamp ordering**: Prevents out-of-order packet issues
- **Bezier smoothing**: Continuous stroke interpolation
- **RequestAnimationFrame**: Frame-synced rendering

## 📝 Known Limitations

1. **No persistence**: Drawing state is stored in memory and lost on server restart
2. **Single server**: Not designed for horizontal scaling (would need Redis for shared state)
3. **No authentication**: Anyone can join any room
4. **No rate limiting**: Drawing events are not rate-limited (could be added)
5. **Canvas export**: PNG export captures visible area only (not full virtual canvas)

## 🚧 Potential Improvements

- Database persistence (MongoDB, PostgreSQL)
- Redis for shared state across multiple servers
- User authentication and authorization
- Full canvas export (entire 3000×2000 area)
- Stroke compression for large drawings
- Rate limiting for drawing events
- Drawing history timeline
- Multi-room UI with room creation
- Mobile touch optimization improvements
- Stroke pressure sensitivity (for tablets)

## 📄 License

MIT

## 🤝 Contributing

This is a demonstration project. Feel free to fork and modify for your needs!
