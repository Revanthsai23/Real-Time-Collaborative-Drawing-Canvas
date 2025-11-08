// Room management with simple on-disk persistence per room
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DrawingState } from './drawing-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data/rooms');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> { users: Map, drawingState: DrawingState }
    }
    
    getOrCreateRoom(roomId) {
        if (!this.rooms.has(roomId)) {
            const room = {
                users: new Map(),
                drawingState: new DrawingState()
            };
            this.rooms.set(roomId, room);

            // Try to load persisted state in background (non-blocking)
            const filePath = path.join(DATA_DIR, `${roomId}.json`);
            fs.readFile(filePath, 'utf8')
                .then((content) => {
                    try {
                        const obj = JSON.parse(content);
                        room.drawingState = DrawingState.fromJSON(obj);
                        console.log(`Loaded persisted state for room ${roomId} (${room.drawingState.getStrokeCount()} strokes)`);
                    } catch (err) {
                        console.warn(`Failed to parse persisted state for room ${roomId}:`, err.message);
                    }
                })
                .catch(() => {
                    // No persisted file - that's fine
                });
        }
        return this.rooms.get(roomId);
    }
    
    addUser(roomId, socketId, user) {
        const room = this.getOrCreateRoom(roomId);
        room.users.set(socketId, user);
        return user;
    }
    
    removeUser(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        const user = room.users.get(socketId);
        if (user) {
            room.users.delete(socketId);
            
            // Clean up empty rooms (optional - you might want to keep them)
            if (room.users.size === 0) {
                // this.rooms.delete(roomId);
            }
        }
        return user;
    }
    
    getUsers(roomId) {
        const room = this.rooms.get(roomId);
        return room ? room.users : new Map();
    }
    
    getDrawingState(roomId) {
        const room = this.getOrCreateRoom(roomId);
        return room.drawingState;
    }
    
    getRoomCount() {
        return this.rooms.size;
    }
    async saveRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const filePath = path.join(DATA_DIR, `${roomId}.json`);
            const content = JSON.stringify(room.drawingState.toJSON());
            await fs.writeFile(filePath, content, 'utf8');
            // console.log(`Saved room state for ${roomId} (${room.drawingState.getStrokeCount()} strokes)`);
        } catch (err) {
            console.error('Failed to save room state:', err);
        }
    }
}

export const roomManager = new RoomManager();

