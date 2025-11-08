// Main server file
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { roomManager } from './rooms.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Generate a random color for users
function generateUserColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#E74C3C',
        '#3498DB', '#2ECC71', '#9B59B6', '#E67E22', '#1ABC9C',
        '#F39C12', '#E91E63', '#00BCD4', '#FF9800', '#8BC34A'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Simple route to create a new room and redirect client to it
app.get('/create', (req, res) => {
    const roomId = crypto.randomBytes(4).toString('hex');
    // Redirect to root with room query param (client will pick this up)
    res.redirect('/?room=' + roomId);
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    const roomId = socket.handshake.query.roomId || 'main';
    const userName = socket.handshake.query.userName || `User_${socket.id.substring(0, 6)}`;
    
    // Assign a random color to the user
    const userColor = generateUserColor();
    
    // Join room
    socket.join(roomId);
    // Assign a deterministic layer index for this user based on current room users
    const roomObj = roomManager.getOrCreateRoom(roomId);
    const layerIndex = roomObj.users.size; // 0-based

    const userObj = {
        id: socket.id,
        name: userName,
        color: userColor,
        layer: layerIndex
    };

    roomManager.addUser(roomId, socket.id, userObj);
    // Broadcast updated users list to all clients in the room so they know layers
    const usersForRoom = roomManager.getUsers(roomId);
    io.in(roomId).emit('usersList', Array.from(usersForRoom.values()));
    
    // Send current state to new user
    const drawingState = roomManager.getDrawingState(roomId);
    socket.emit('state', { strokes: drawingState.getState() });
    
    // Notify others in room (include layer)
    socket.to(roomId).emit('userJoined', {
        userId: socket.id,
        name: userName,
        color: userColor,
        layer: userObj.layer
    });
    
    // Send user's own color to the new user
    socket.emit('userColor', { color: userColor });
    
    // Send list of current users to the new user (redundant with broadcast above but keeps client logic simple)
    const users = roomManager.getUsers(roomId);
    socket.emit('usersList', Array.from(users.values()));
    
    // Handle drawing events - stores stroke in global state for undo/redo
    socket.on('drawing', (data) => {
        const drawingState = roomManager.getDrawingState(roomId);

        // Build a canonical stroke object (include layer and timestamp)
        const user = roomManager.getUsers(roomId).get(socket.id);
        const stroke = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            userId: socket.id,
            color: data.color,
            lineWidth: data.lineWidth,
            points: data.points,
            isEraser: data.isEraser || false,
            timestamp: data.timestamp || Date.now(),
            layer: user && user.layer !== undefined ? user.layer : 0
        };

        // Store completed stroke in room state
        drawingState.addStroke(stroke);

        // Persist state for this room (best-effort)
        if (roomManager.saveRoomState) {
            roomManager.saveRoomState(roomId).catch(err => console.error('Save room state error:', err));
        }

        // Broadcast the canonical stroke to all clients in the room (including sender)
        io.in(roomId).emit('drawing', stroke);

        // Also send the authoritative full state so clients can redraw deterministically
        io.in(roomId).emit('state', { 
            strokes: drawingState.getState(),
            timestamp: Date.now()
        });
    });

    // Live drawing segments - broadcast immediately to room with timestamp
    // Handles both brush and eraser operations in real-time
    // Ultra-low latency pass-through for instant synchronization
    socket.on('drawingSegment', (data) => {
        try {
            // Attach layer info and user info if available
            const user = roomManager.getUsers(roomId).get(socket.id);
            if (user && user.layer !== undefined) data.layer = user.layer;
            
            // Add server timestamp for additional ordering guarantee
            const serverTimestamp = Date.now();
            if (!data.timestamp) {
                data.timestamp = serverTimestamp;
            }
            data.serverTimestamp = serverTimestamp;
            
            // Add userId for layer management and conflict resolution
            data.userId = socket.id;
            
            // Ensure tool type is preserved (brush or eraser)
            if (!data.tool) {
                data.tool = 'brush'; // Default to brush if not specified
            }
            
            // Real-time broadcast: pass-through immediately to all other clients
            // No batching, no queuing - instant relay for ultra-low latency
            socket.to(roomId).emit('drawingSegment', data);
        } catch (err) {
            console.error('Error broadcasting drawing segment:', err);
        }
    });
    
    // Handle cursor movement
    socket.on('cursorMove', (data) => {
        // Get user info to include their color
        const users = roomManager.getUsers(roomId);
        const user = users.get(socket.id);
        const userColor = user ? user.color : '#000000';
        
        socket.to(roomId).emit('cursorMove', {
            ...data,
            userId: socket.id,
            color: userColor,
            name: user ? user.name : socket.id
        });
    });
    
    // Handle undo - global undo removes latest stroke regardless of who drew it
    socket.on('undo', (data) => {
        const drawingState = roomManager.getDrawingState(roomId);
        const removedStroke = drawingState.undoLastStroke();
        
        if (removedStroke) {
            console.log(`User ${socket.id} triggered undo, removed stroke ${removedStroke.id} by ${removedStroke.userId}`);
            
            // Broadcast undo event to all clients in room (including sender)
            io.in(roomId).emit('undo', {
                userId: socket.id,
                strokeId: removedStroke.id,
                removedBy: removedStroke.userId
            });
            
            // Send updated state to ALL clients in room (including sender)
            io.in(roomId).emit('state', { 
                strokes: drawingState.getState(),
                timestamp: Date.now()
            });
            if (roomManager.saveRoomState) {
                roomManager.saveRoomState(roomId).catch(err => console.error('Save room state error:', err));
            }
        } else {
            // No stroke to undo - notify sender only
            socket.emit('undoFailed', { message: 'No strokes to undo' });
        }
    });
    
    // Handle redo - restores previously undone stroke
    socket.on('redo', (data) => {
        const drawingState = roomManager.getDrawingState(roomId);
        const restoredStroke = drawingState.redoLastStroke();
        
        if (restoredStroke) {
            console.log(`User ${socket.id} triggered redo, restored stroke ${restoredStroke.id} by ${restoredStroke.userId}`);
            
            // Broadcast redo event to all clients in room (including sender)
            io.in(roomId).emit('redo', {
                userId: socket.id,
                stroke: restoredStroke,
                restoredBy: restoredStroke.userId
            });
            
            // Send updated state to ALL clients in room (including sender)
            io.in(roomId).emit('state', { 
                strokes: drawingState.getState(),
                timestamp: Date.now()
            });
            if (roomManager.saveRoomState) {
                roomManager.saveRoomState(roomId).catch(err => console.error('Save room state error:', err));
            }
        } else {
            // No stroke to redo - notify sender only
            socket.emit('redoFailed', { message: 'No strokes to redo' });
        }
    });
    
    // Handle clear
    socket.on('clear', (data) => {
        const drawingState = roomManager.getDrawingState(roomId);
        drawingState.clear();
        
        // Persist cleared state
        if (roomManager.saveRoomState) {
            roomManager.saveRoomState(roomId).catch(err => console.error('Save room state error:', err));
        }

        // Broadcast clear to all in room (including sender)
        io.in(roomId).emit('clear', {
            userId: socket.id
        });
    });

    // Simple ping/pong for latency measurement
    socket.on('pingTime', (data) => {
        try {
            socket.emit('pongTime', { ts: data && data.ts ? data.ts : Date.now() });
        } catch (err) {
            // ignore
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const removedUser = roomManager.removeUser(roomId, socket.id);
        
        if (removedUser) {
            socket.to(roomId).emit('userLeft', {
                userId: socket.id,
                name: removedUser.name,
                color: removedUser.color
            });
        }
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

