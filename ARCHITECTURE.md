# Architecture Documentation

## Overview

Collaborative Canvas is a real-time drawing application that allows multiple users to draw simultaneously on a shared HTML5 canvas. The application uses WebSockets (Socket.io) for real-time communication and maintains drawing state in memory on the server. It features a modern, professional UI with glass morphism effects, light/dark mode, and smooth animations.

## System Architecture

### Client-Server Communication

```
Client (Browser)          Server (Node.js)
     |                           |
     |---- WebSocket ------>     |
     |                           |
     |<--- Events ---------|     |
     |                           |
```

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   UI     │  │ Canvas  │  │ WebSocket│  │  Theme   │  │
│  │ Manager  │  │ Manager │  │ Manager  │  │ Manager  │  │
│  └────┬─────┘  └────┬────┘  └────┬────┘  └────┬────┘  │
│       │              │             │            │        │
│       └──────────────┴─────────────┴────────────┘        │
│                          │                                │
│                    ┌─────▼─────┐                         │
│                    │  main.js   │                         │
│                    │ (Orchestrator)                       │
│                    └─────┬─────┘                         │
└─────────────────────────┼─────────────────────────────────┘
                          │
                    WebSocket
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                  Server (Node.js)                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Server  │  │  Rooms   │  │ Drawing  │              │
│  │   (IO)   │  │ Manager  │  │  State   │              │
│  └────┬─────┘  └────┬────┘  └────┬────┘              │
│       │              │             │                    │
│       └──────────────┴─────────────┘                    │
└──────────────────────────────────────────────────────────┘
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
- **State Management:** In-memory storage for strokes and users (`drawingState.js`, `rooms.js`)
- **Data Format:** JSON-based event serialization with timestamps

### Infrastructure
- **Protocol:** WebSocket (low-latency bi-directional communication)
- **No Frontend Frameworks or Libraries** (except Socket.io client)
- **No Drawing Libraries** — all Canvas logic built manually from scratch

## Components

### Frontend (Client)

#### 1. **index.html** - Main HTML Structure
- Responsive layout with flexbox
- Toolbar with drawing tools and controls
- Help sidebar (collapsible)
- Username modal
- Zoom controls panel
- Canvas utility bar
- Collaborator sidebar
- Theme toggle button

#### 2. **style.css** - Styling System
- **CSS Variables**: Theme system with `--bg-color`, `--text-color`, etc.
- **Glass Morphism**: `backdrop-filter: blur()` for translucent effects
- **Dark Mode**: `[data-theme="dark"]` selector with color overrides
- **Animations**: Keyframe animations for slide, fade, and pulse effects
- **Responsive Design**: Media queries for mobile devices
- **Micro-interactions**: Hover effects, transitions, and transforms

#### 3. **main.js** - Application Entry Point
- Initializes CanvasManager, WebSocketManager, and UIManager
- Username prompt modal handling
- Wires up UI controls and event handlers
- Handles keyboard shortcuts
- Coordinates between components
- Sets up zoom controls and save functionality
- Manages help sidebar toggle

#### 4. **canvas.js** - Canvas Drawing Logic
- **Drawing System**:
  - Point collection and buffering for smooth interpolation
  - Bezier curve smoothing using `quadraticCurveTo`
  - Client-side prediction for zero-latency local drawing
  - Real-time segment streaming (12ms throttling, ~80 FPS)
  
- **Layer System**:
  - Per-user canvas buffers for conflict-free rendering
  - Layer compositing with requestAnimationFrame
  - Timestamp-based ordering to prevent out-of-order rendering
  
- **Zoom & Pan**:
  - Virtual canvas (3000×2000) with viewport transformation
  - Zoom controls (Ctrl+Wheel, +/- buttons)
  - Pan with Shift+Drag or middle mouse button
  - Transform synchronization across all layers
  
- **Event Handling**:
  - Pointer events (unified mouse/touch/pen)
  - Touch event support for mobile
  - Coordinate transformation for zoom/pan
  
- **Cursor Indicators**:
  - Real-time cursor tracking for other users
  - Color-coded indicators with user names
  - Auto-hide after inactivity

#### 5. **websocket.js** - WebSocket Communication Layer
- Manages Socket.io connection
- Handles sending/receiving drawing events
- **Real-time segment streaming**: Sends point arrays for smooth interpolation
- **Timestamp management**: Adds timestamps for ordering
- Manages user presence and connection status
- Throttles cursor movement events (50ms)
- Latency measurement via ping/pong

#### 6. **ui.js** - UI Management
- **Toolbar Management**:
  - Active tool state (brush/eraser)
  - Brush size display updates
  - Tool icon and text updates
  
- **User List**:
  - Circular avatars with user colors
  - "You" badge with accent color
  - Join/leave animations
  - Tooltips on hover
  
- **Theme Management**:
  - Light/dark mode toggle
  - localStorage persistence
  - CSS variable updates
  
- **Status Indicators**:
  - Connection status (connecting/connected/disconnected)
  - FPS display
  - Latency display
  - Zoom percentage display

### Backend (Server)

#### 1. **server.js** - Main Express Server
- Serves static files from client folder
- Handles Socket.io connections
- **Real-time Broadcasting**:
  - Immediate pass-through of drawing segments
  - Server timestamp addition for ordering
  - Tool type preservation (brush/eraser)
  
- **User Management**:
  - Assigns unique colors to users
  - Tracks user names from handshake
  - Manages user layers for drawing order
  
- **Event Routing**:
  - Drawing events → room broadcast
  - Cursor movement → room broadcast
  - Undo/redo → state management
  - Clear → state management

#### 2. **rooms.js** - Room Management
- Manages multiple drawing rooms
- Tracks users per room
- Associates drawing state with rooms
- Creates rooms on-demand
- Handles user join/leave events

#### 3. **drawingState.js** - Drawing State Management
- Stores array of strokes in order
- Handles global undo/redo functionality
- Maintains undo stack for redo
- Provides state getters/setters
- Timestamp and layer tracking

## Data Flow

### Real-Time Drawing Flow

1. **User starts drawing**:
   - `canvas.js` captures mouse/touch events
   - Points collected in buffer (max 5 points)
   - Local drawing happens immediately (client prediction)
   - Bezier curve smoothing applied locally

2. **Segment emission** (every 12ms):
   - Last 3 points sent via `onSegment` callback
   - `websocket.js` sends `drawingSegment` event with point array
   - Timestamp added for ordering

3. **Server processing**:
   - Server receives `drawingSegment` event
   - Adds server timestamp
   - Broadcasts immediately to other users in room (no queuing)

4. **Remote rendering**:
   - Other clients receive `drawingSegment` event
   - Timestamp checked for ordering (skip out-of-order packets)
   - Points rendered to user's layer with Bezier smoothing
   - Layer is already visible (separate canvas element)

5. **Stroke completion**:
   - On mouse up, complete stroke sent via `drawing` event
   - Server stores in room state
   - Broadcasts to all users for persistence

### State Synchronization

1. **New user connects**:
   - Server sends current `state` (all strokes)
   - Client receives `state` → `canvas.js` redraws all strokes
   - Ensures new users see existing drawing immediately

2. **Username assignment**:
   - Client checks localStorage for saved username
   - If not found, shows modal prompt
   - Username sent in Socket.io handshake query
   - Server assigns to user and broadcasts to others

### Undo/Redo Flow

1. User clicks Undo or presses Ctrl+Z → `websocket.js` sends `undo` event
2. Server removes last stroke from room state (via `drawingState.js`)
3. Server broadcasts `undo` + updated `state` to all users
4. All clients redraw canvas with updated state via `onStateReceived`

### Cursor Tracking Flow

1. User moves mouse → `canvas.js` captures position (throttled to 50ms)
2. `websocket.js` sends `cursorMove` event
3. Server broadcasts to other users with user info (name, color)
4. Other clients receive event → `canvas.js` updates cursor indicator
5. Cursor indicators auto-hide after 3 seconds of inactivity

### User Presence Flow

1. User connects → server assigns unique color and adds to room
2. Server broadcasts `userJoined` to existing users
3. Server sends `usersList` to new user
4. `ui.js` updates user list panel with animations
5. User disconnects → server broadcasts `userLeft` → `ui.js` removes user

## Event Types

### Client → Server

- `drawing`: Sends completed stroke data (points, color, lineWidth, isEraser, timestamp)
- `drawingSegment`: Sends real-time drawing segments (points array or x0/y0/x1/y1, tool, timestamp)
- `cursorMove`: Sends cursor position (throttled to 50ms)
- `undo`: Request to undo last stroke
- `redo`: Request to redo last undone stroke
- `clear`: Request to clear canvas
- `pingTime`: Latency measurement ping

### Server → Client

- `drawing`: Receive completed stroke from another user
- `drawingSegment`: Receive real-time drawing segment (with points array for smoothing)
- `state`: Receive complete drawing state (on join or after undo/redo)
- `undo`: Notify that a stroke was undone
- `redo`: Notify that a stroke was redone
- `clear`: Notify that canvas was cleared
- `userJoined`: Notify that a user joined the room
- `userLeft`: Notify that a user left the room
- `cursorMove`: Receive cursor position from another user
- `usersList`: Receive list of all users in room
- `userColor`: Receive assigned color for current user
- `undoFailed`: Notify that undo failed (no strokes to undo)
- `redoFailed`: Notify that redo failed (no strokes to redo)
- `pongTime`: Latency measurement response

## Drawing Data Structures

### Drawing Segment (Real-Time)
```javascript
{
  userId: string,           // Socket ID of user
  points: Array<{x, y}>,    // Array of points for smooth interpolation (new format)
  // OR (legacy format):
  x0: number, y0: number,   // Start point
  x1: number, y1: number,   // End point
  color: string,            // Stroke color (hex)
  size: number,             // Brush size
  tool: string,             // 'brush' or 'eraser'
  timestamp: number,        // Client timestamp
  serverTimestamp: number   // Server timestamp (added by server)
}
```

### Completed Stroke
```javascript
{
  id: string,               // Unique identifier (timestamp + random)
  userId: string,           // User who drew it (socket.id)
  color: string,            // Stroke color (hex)
  lineWidth: number,        // Brush thickness
  points: Array<{x, y}>,   // Array of coordinate points
  isEraser: boolean,        // Whether this is an eraser stroke
  timestamp: number,        // When the stroke was created
  layer: number             // Layer index for ordering
}
```

## User Management

Each user object:
```javascript
{
  id: string,    // Socket ID
  name: string,  // Display name (from username prompt or generated)
  color: string, // Unique color assigned by server
  layer: number  // Layer index for drawing order
}
```

## Room Management

- Rooms are identified by `roomId` (default: "main", can be set via URL query param)
- Each room maintains:
  - Map of connected users (socketId → user info)
  - DrawingState instance (array of strokes + undo stack)
  - User layer assignments
- Rooms are created on-demand when first user joins
- Rooms persist even when empty (can be cleaned up optionally)

## Real-Time Synchronization Architecture

### Client-Side Prediction
- **Immediate local rendering**: Draws happen instantly on local canvas
- **No delay**: User sees their drawing immediately (zero latency)
- **Segment streaming**: Sends segments every 12ms (~80 FPS) while drawing
- **Point buffering**: Collects points for smooth Bezier interpolation

### Layer System for Conflict Resolution
- **Per-user layers**: Each user has a separate off-screen canvas buffer
- **Conflict-free**: Simultaneous strokes don't interfere with each other
- **Visual compositing**: Layers are separate canvas elements (CSS z-index stacking)
- **Periodic merging**: Layers merged to main canvas every 200ms for persistence

### Timestamp-Based Ordering
- **Client timestamps**: Each segment includes client-generated timestamp
- **Server timestamps**: Server adds its own timestamp for additional ordering
- **Out-of-order prevention**: Remote clients skip packets older than last processed
- **Chronological rendering**: Ensures strokes render in correct order

### Bezier Curve Smoothing
- **Point interpolation**: Multiple points connected with quadratic Bezier curves
- **Continuous strokes**: Prevents gaps and broken lines during high-speed drawing
- **Unified system**: Both brush and eraser use same smoothing algorithm
- **Local and remote**: Smoothing applied to both local and remote strokes

## Network Optimization

1. **Segment Throttling**: Drawing segments sent every 12ms (~80 FPS)
2. **Cursor Movement Throttling**: Cursor positions sent at most every 50ms
3. **Point-Based Format**: Sends point arrays instead of individual segments for efficiency
4. **State Updates**: Full state only sent on connect or after undo/redo
5. **Efficient Broadcasting**: Uses Socket.io rooms to broadcast only to relevant clients
6. **No Batching**: Immediate pass-through for ultra-low latency

## UI State Management

### Theme System
- **CSS Variables**: `--bg-color`, `--text-color`, `--toolbar-bg`, etc.
- **Theme Toggle**: Light/dark mode with localStorage persistence
- **Dynamic Updates**: All UI elements respond to theme changes
- **Canvas Background**: Canvas background color changes with theme

### Toolbar State
- Active tool (brush/eraser) tracked in `canvas.js`
- Visual state updated via `ui.js` with accent color borders
- Color picker disabled in eraser mode
- Tool icons and text update in utility bar

### Connection Status
- Tracked in `websocket.js` via Socket.io events
- Displayed via `ui.js` with color-coded indicator:
  - 🟡 Yellow: Connecting
  - 🟢 Green: Connected
  - 🔴 Red: Disconnected

### User List
- Maintained in `ui.js` as a Map
- Updated on user join/leave events with animations
- Displays circular avatars with color indicators
- Shows "You" badge with user's accent color

## Keyboard Shortcuts

- `Ctrl+Z` / `Cmd+Z`: Undo last stroke
- `Ctrl+Y` / `Cmd+Y`: Redo last undone stroke
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo (alternative)
- `Ctrl+Wheel` / `Cmd+Wheel`: Zoom in/out
- `Shift+Drag`: Pan canvas
- `Escape`: Close help sidebar
- `Enter`: Submit username modal

Shortcuts are handled in `main.js` and prevent default browser behavior.

## Technical Challenges Addressed

### 1. Real-Time Synchronization

#### Client-Side Prediction
- Immediate local rendering with zero latency
- Unique `clientId` tracking for each stroke
- Server confirmation with authoritative timestamps
- Pending stroke reconciliation if needed

#### Continuous Stroke Interpolation
- Point collection and buffering (max 5 points)
- Bezier curve smoothing using `quadraticCurveTo`
- Prevents gaps during high-speed drawing
- Works for both brush and eraser tools

#### Timestamp-Based Ordering
- Each segment carries client and server timestamps
- Out-of-order packet detection and skipping
- Per-user timestamp tracking in layer system
- Ensures chronological rendering across all clients

### 2. Conflict-Free Simultaneous Drawing

#### Per-User Layer Buffers
- Each user has separate off-screen canvas layer
- Strokes rendered to user's layer, not main canvas
- Layers composited visually via CSS z-index
- Periodic merging to main canvas for persistence

#### Layer Compositing
- Real-time compositing with requestAnimationFrame
- Transform synchronization across all layers
- Efficient rendering without full redraws
- Eraser operations applied to both layer and main canvas

### 3. Smooth Stroke Rendering

#### Bezier Curve Interpolation
- Quadratic Bezier curves connect points smoothly
- Prevents gaps and broken lines
- Applied to both local and remote strokes
- Handles high-speed drawing gracefully

#### Point-Based Rendering
- New format sends point arrays instead of segments
- Backward compatible with legacy segment format
- Enables smooth interpolation on remote clients
- Reduces network overhead

### 4. Performance Optimization

#### RequestAnimationFrame Usage
- Frame-synced layer compositing
- Smooth 60 FPS updates
- Efficient rendering pipeline
- Reduced CPU usage

#### Throttling Strategy
- 12ms segment throttling (~80 FPS)
- 50ms cursor movement throttling
- 200ms layer merging interval
- Balanced performance and responsiveness

## Scalability Considerations

### Current Implementation

- In-memory state (lost on server restart)
- Single server instance
- No persistence
- No authentication
- Room-based isolation (via URL query params)

### Potential Improvements

- **Database persistence**: MongoDB or PostgreSQL for stroke storage
- **Redis**: Shared state across multiple server instances
- **Image export**: Full canvas export (entire 3000×2000 area)
- **Stroke compression**: Compress large drawings
- **Rate limiting**: Prevent abuse with rate limiting middleware
- **User authentication**: Add login/registration system
- **Room-based UI**: UI for creating/joining specific rooms
- **Drawing history**: Timeline view of all strokes
- **Mobile optimization**: Better touch event handling

## Security Considerations

- **No authentication**: Anyone can join any room (add authentication for production)
- **No input validation**: Drawing data is not validated (add validation)
- **No rate limiting**: Drawing events are not rate-limited (add rate limiting)
- **CORS is open**: Should be restricted in production
- **No XSS protection**: User-provided names not sanitized (sanitize user input)

## Performance Optimizations

1. **Canvas Resizing**: Uses requestAnimationFrame-like timing for resize
2. **Event Throttling**: Cursor movements throttled to reduce network traffic
3. **Efficient Rendering**: Strokes rendered directly to canvas/layers
4. **Memory Management**: Cursor indicators and layers cleaned up on user disconnect
5. **Layer System**: Prevents unnecessary redraws during simultaneous drawing
6. **Bezier Smoothing**: Reduces number of segments needed for smooth strokes

## Browser Compatibility

- Uses standard HTML5 Canvas API
- ES6 modules (modern browsers)
- Socket.io client library (all major browsers)
- CSS backdrop-filter (modern browsers, graceful degradation)
- Pointer Events API (with mouse/touch fallback)

## Testing Recommendations

1. **Multiple clients**: Test with 2-10 simultaneous users
2. **Network conditions**: Test with slow connections
3. **Browser compatibility**: Test on Chrome, Firefox, Safari, Edge
4. **Mobile devices**: Test touch interactions on mobile browsers
5. **Stress testing**: Test with many simultaneous strokes
6. **Connection recovery**: Test reconnection after disconnect
7. **High-speed drawing**: Test rapid mouse movements
8. **Simultaneous drawing**: Test multiple users drawing in same area
9. **Theme switching**: Test light/dark mode transitions
10. **Zoom/pan**: Test canvas navigation at various zoom levels
