// Main application entry point
import { CanvasManager } from './canvas.js';
import { WebSocketManager } from './websocket.js';
import { UIManager } from './ui.js';

// Initialize managers
const canvasManager = new CanvasManager('canvas');
const wsManager = new WebSocketManager();
const uiManager = new UIManager();

// Expose canvasManager globally for theme changes
window.canvasManager = canvasManager;

// Determine room from URL (e.g., /?room=abc123)
const params = new URLSearchParams(window.location.search);
const ROOM_ID = params.get('room') || null;
let USER_NAME = params.get('name') || null;

// Username prompt function
function getUsername() {
    return new Promise((resolve) => {
        // Check localStorage first
        let username = localStorage.getItem('username');
        
        // If username exists, use it
        if (username && username.trim() !== '') {
            resolve(username.trim());
            return;
        }
        
        // Show modal to get username
        const modal = document.getElementById('nameModal');
        const nameInput = document.getElementById('nameInput');
        const joinBtn = document.getElementById('joinBtn');
        const skipBtn = document.getElementById('skipBtn');
        
        if (!modal || !nameInput || !joinBtn || !skipBtn) {
            // Fallback if modal elements don't exist
            username = prompt('Enter your name to join the collaborative canvas:');
            if (!username || username.trim() === '') {
                username = 'Guest_' + Math.floor(Math.random() * 10000);
            }
            // Validate and trim
            username = username.trim().slice(0, 20);
            localStorage.setItem('username', username);
            resolve(username);
            return;
        }
        
        // Show modal
        modal.classList.remove('hidden');
        nameInput.focus();
        
        // Handle Enter key
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                joinBtn.click();
            }
        };
        nameInput.addEventListener('keydown', handleEnter);
        
        // Join button handler
        joinBtn.addEventListener('click', () => {
            let inputUsername = nameInput.value.trim();
            
            // Validate username
            if (inputUsername.length > 20) {
                inputUsername = inputUsername.slice(0, 20);
            }
            
            if (inputUsername === '') {
                // If empty, generate guest name
                inputUsername = 'Guest_' + Math.floor(Math.random() * 10000);
            }
            
            // Save to localStorage
            localStorage.setItem('username', inputUsername);
            
            // Hide modal
            modal.classList.add('hidden');
            nameInput.removeEventListener('keydown', handleEnter);
            
            resolve(inputUsername);
        });
        
        // Skip button handler
        skipBtn.addEventListener('click', () => {
            // Generate guest name
            const guestName = 'Guest_' + Math.floor(Math.random() * 10000);
            
            // Save to localStorage
            localStorage.setItem('username', guestName);
            
            // Hide modal
            modal.classList.add('hidden');
            nameInput.removeEventListener('keydown', handleEnter);
            
            resolve(guestName);
        });
    });
}

// Initialize app with username
(async () => {
    // Get username (from URL param, localStorage, or modal)
    if (!USER_NAME) {
        USER_NAME = await getUsername();
    } else {
        // If username came from URL, save it to localStorage
        localStorage.setItem('username', USER_NAME);
    }
    
    // Connect to server with username
    wsManager.connect(ROOM_ID, USER_NAME);
})();

// Expose room in UI for copy/share
if (ROOM_ID && uiManager.setRoomId) {
    uiManager.setRoomId(ROOM_ID);
}

// Setup Help Sidebar Toggle
const helpToggle = document.getElementById('helpToggle');
const helpSidebar = document.getElementById('helpSidebar');
const helpClose = document.getElementById('helpClose');
const helpOverlay = document.getElementById('helpOverlay');

if (helpToggle && helpSidebar && helpClose && helpOverlay) {
    // Toggle sidebar
    helpToggle.addEventListener('click', () => {
        helpSidebar.classList.toggle('open');
        helpOverlay.classList.toggle('active');
    });
    
    // Close sidebar
    helpClose.addEventListener('click', () => {
        helpSidebar.classList.remove('open');
        helpOverlay.classList.remove('active');
    });
    
    // Close on overlay click
    helpOverlay.addEventListener('click', () => {
        helpSidebar.classList.remove('open');
        helpOverlay.classList.remove('active');
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && helpSidebar.classList.contains('open')) {
            helpSidebar.classList.remove('open');
            helpOverlay.classList.remove('active');
        }
    });
}

// Set initial connecting state
uiManager.setConnecting('Connecting...');

// Update connection status
wsManager.onConnect = () => {
    uiManager.setConnectionStatus(true, 'Connected');
    // Now that socket connection exists, set the canonical current user id
    uiManager.setCurrentUserId(wsManager.getUserId());
    // Request/update users list display (if server already sent usersList this will refresh)
    uiManager.updateUsersList(null, wsManager.getUserId(), wsManager.getUserColor());
};

wsManager.onDisconnect = () => {
    uiManager.setConnectionStatus(false, 'Disconnected');
};

wsManager.onConnectError = () => {
    uiManager.setConnectionStatus(false, 'Connection Error');
};

wsManager.onReconnecting = () => {
    uiManager.setConnecting('Reconnecting...');
};

// --- Performance metrics (FPS & latency)
let frames = 0;
let lastFpsUpdate = Date.now();
function fpsLoop() {
    frames++;
    const now = Date.now();
    if (now - lastFpsUpdate >= 1000) {
        const fps = Math.round((frames * 1000) / (now - lastFpsUpdate));
        frames = 0;
        lastFpsUpdate = now;
        if (uiManager.updateFPS) uiManager.updateFPS(fps);
    }
    requestAnimationFrame(fpsLoop);
}
requestAnimationFrame(fpsLoop);

// Periodic ping to measure latency
wsManager.onLatencyUpdated = (rtt) => {
    if (uiManager.updateLatency) uiManager.updateLatency(rtt);
};

setInterval(() => {
    wsManager.sendPing();
}, 2000);

// Setup UI controls
const brushBtn = uiManager.brushBtn;
const eraserBtn = uiManager.eraserBtn;
const colorPicker = uiManager.colorPicker;
const brushSize = uiManager.brushSize;
const clearBtn = uiManager.clearBtn;
const undoBtn = uiManager.undoBtn;
const redoBtn = uiManager.redoBtn;

// Brush/Eraser mode toggle
brushBtn.addEventListener('click', () => {
    canvasManager.setMode('brush');
    uiManager.setActiveTool('brush');
});

eraserBtn.addEventListener('click', () => {
    canvasManager.setMode('eraser');
    uiManager.setActiveTool('eraser');
});

// Color picker
colorPicker.addEventListener('change', (e) => {
    canvasManager.setColor(e.target.value);
});

// Brush size
brushSize.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    canvasManager.setLineWidth(size);
    uiManager.updateBrushSize(size);
});

// Clear button
clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
        wsManager.sendClear();
    }
});

// Undo button
undoBtn.addEventListener('click', () => {
    wsManager.sendUndo();
});

// Redo button
redoBtn.addEventListener('click', () => {
    wsManager.sendRedo();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent default browser behavior for undo/redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        wsManager.sendUndo();
    }
    // Ctrl+Y or Ctrl+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        wsManager.sendRedo();
    }
});

// Setup zoom controls
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        const container = canvasManager.canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            canvasManager.zoomIn(rect.width / 2, rect.height / 2);
        }
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        const container = canvasManager.canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            canvasManager.zoomOut(rect.width / 2, rect.height / 2);
        }
    });
}

// Setup zoom change callback
canvasManager.onZoomChange = (zoom) => {
    uiManager.updateZoom(zoom * 100);
};

// Setup save button
const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        canvasManager.exportAsPNG();
    });
}

// Handle drawing completion (for full stroke persistence)
// Note: Real-time segments are already being sent via onSegment callback
canvasManager.onStrokeComplete = (points) => {
    const isEraser = canvasManager.mode === 'eraser';
    // Send completed stroke for persistence and undo/redo support
    wsManager.sendDrawing(points, canvasManager.color, canvasManager.lineWidth, isEraser);
};

// Stream live segments while drawing - immediate emission, no batching
canvasManager.onSegment = (seg) => {
    // seg: { points, color, size, tool, userId, timestamp } or { x0,y0,x1,y1, ... }
    // Send immediately - no delay, no queuing
    // Support both point-based (new) and segment-based (legacy) formats
    if (seg.points && Array.isArray(seg.points)) {
        // New point-based format for smooth interpolation
        wsManager.sendSegment(null, null, null, null, seg.color, seg.size, seg.tool, seg.points);
    } else {
        // Legacy segment format
        wsManager.sendSegment(seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.size, seg.tool);
    }
};

// Render incoming segments immediately with timestamp ordering
wsManager.onDrawingSegmentReceived = (data) => {
    // Skip our own segments (already drawn via client prediction)
    if (data.userId === wsManager.getUserId()) {
        return;
    }
    
    // Ensure timestamp exists for ordering
    if (!data.timestamp) {
        data.timestamp = Date.now();
    }
    
    // Ensure userId is set
    if (!data.userId) {
        data.userId = 'unknown';
    }
    
    // Draw immediately to user's layer buffer (with timestamp ordering)
    // This provides real-time rendering without conflicts
    canvasManager.drawSegment(data);
};

// Handle cursor movement (throttled)
let cursorMoveTimeout = null;
canvasManager.canvas.addEventListener('mousemove', (e) => {
    const coords = canvasManager.getCoordinates(e);
    
    // Throttle cursor move events to optimize network usage
    if (cursorMoveTimeout) return;
    cursorMoveTimeout = setTimeout(() => {
        wsManager.sendCursorMove(coords.x, coords.y);
        cursorMoveTimeout = null;
    }, 50); // Send every 50ms max
});

// WebSocket event handlers
wsManager.onDrawingReceived = (data) => {
    // Enqueue incoming completed strokes (server provides timestamp and layer)
    try {
        // We still skip if malformed
        if (!data || !data.points) return;
        canvasManager.enqueueStroke(data);
    } catch (err) {
        console.error('Failed to enqueue incoming stroke:', err);
    }
};

wsManager.onStateReceived = (data) => {
    // Redraw canvas with updated state (called after undo/redo)
    canvasManager.redraw(data.strokes || []);
};

wsManager.onUndoReceived = (data) => {
    console.log(`Undo triggered by ${data.userId}, removed stroke by ${data.removedBy}`);
    // State will be updated via onStateReceived immediately after
};

wsManager.onRedoReceived = (data) => {
    console.log(`Redo triggered by ${data.userId}, restored stroke by ${data.restoredBy}`);
    // State will be updated via onStateReceived immediately after
};

wsManager.onUndoFailed = (data) => {
    console.log('Undo failed:', data.message);
    // Could show user feedback here
};

wsManager.onRedoFailed = (data) => {
    console.log('Redo failed:', data.message);
    // Could show user feedback here
};

wsManager.onClearReceived = (data) => {
    canvasManager.clear();
};

wsManager.onUserJoined = (data) => {
    console.log('User joined:', data);
    uiManager.addUser(data.userId, {
        id: data.userId,
        name: data.name || data.userId,
        color: data.color || '#000000'
    }, wsManager.getUserId());
};

wsManager.onUserLeft = (data) => {
    console.log('User left:', data);
    canvasManager.removeCursorIndicator(data.userId);
    uiManager.removeUser(data.userId, wsManager.getUserId());
};

wsManager.onCursorMove = (data) => {
    // Show cursor indicator for other users
    if (data.userId !== wsManager.getUserId()) {
        // Convert canvas coordinates to screen coordinates for cursor indicator
        const container = canvasManager.canvas.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            // Convert canvas coords to screen coords
            const screenX = centerX + canvasManager.panX + (data.x - canvasManager.canvasWidth / 2) * canvasManager.zoom;
            const screenY = centerY + canvasManager.panY + (data.y - canvasManager.canvasHeight / 2) * canvasManager.zoom;
            canvasManager.updateCursorIndicator(data.userId, screenX, screenY, data.name, data.color);
        }
    }
};

wsManager.onUsersListReceived = (users) => {
    uiManager.updateUsersList(users, wsManager.getUserId(), wsManager.getUserColor());
};

wsManager.onUserColorReceived = (data) => {
    console.log('Assigned color:', data.color);
    uiManager.updateCurrentUserColor(wsManager.getUserId(), data.color);
    uiManager.updateUsersList(null, wsManager.getUserId(), data.color);
    // Set accent color for the UI
    uiManager.setAccentColor(data.color);
};

// Do not set current user id until connected (socket id is assigned on connect)
