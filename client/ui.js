// UI management for toolbar, user list, and status updates
export class UIManager {
    constructor() {
        this.users = new Map();
        this.currentUserId = null;
        this.initializeElements();
    }
    
    initializeElements() {
        // Toolbar elements
        this.brushBtn = document.getElementById('brushBtn');
        this.eraserBtn = document.getElementById('eraserBtn');
        this.colorPicker = document.getElementById('colorPicker');
        this.brushSize = document.getElementById('brushSize');
        this.brushSizeDisplay = document.getElementById('brushSizeDisplay');
        this.undoBtn = document.getElementById('undoBtn');
        this.redoBtn = document.getElementById('redoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // Status elements
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');

        // Metrics elements (FPS / Latency)
        this.fpsDisplay = document.getElementById('fpsDisplay');
        this.latencyDisplay = document.getElementById('latencyDisplay');
        
        // User list
        this.usersList = document.getElementById('usersList');
        this.userCount = document.getElementById('userCount');
        
        // Theme toggle
        this.themeToggle = document.getElementById('themeToggle');
        this.initTheme();
        
        // Utility bar elements
        this.activeToolIcon = document.getElementById('activeToolIcon');
        this.activeToolText = document.getElementById('activeToolText');
        this.fpsUtility = document.getElementById('fpsUtility');
        this.zoomUtility = document.getElementById('zoomUtility');
    }
    
    initTheme() {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        
        // Setup toggle button
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                this.setTheme(newTheme);
            });
        }
    }
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (this.themeToggle) {
            this.themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
        }
    }
    
    setAccentColor(color) {
        document.documentElement.style.setProperty('--accent-color', color);
    }

    // Update FPS display
    updateFPS(fps) {
        if (this.fpsDisplay) {
            this.fpsDisplay.textContent = fps + ' FPS';
        }
        if (this.fpsUtility) {
            this.fpsUtility.textContent = fps + ' FPS';
        }
    }

    // Update latency (round-trip ms)
    updateLatency(ms) {
        if (this.latencyDisplay) {
            this.latencyDisplay.textContent = ms + ' ms';
        }
    }

    // Show room id / shareable link in header (creates element if needed)
    setRoomId(roomId) {
        if (!roomId) return;
        if (!this.roomLabel) {
            const header = document.querySelector('header .px-4');
            if (!header) return;
            this.roomLabel = document.createElement('div');
            this.roomLabel.className = 'ml-3 text-xs text-gray-500';
            header.querySelector('.flex.items-center')?.appendChild(this.roomLabel);
        }
        this.roomLabel.textContent = 'Room: ' + roomId + ' (share link available)';
    }
    
    // Update connection status
    setConnectionStatus(connected, message = null) {
        const statusBadge = document.getElementById('connectionStatus');
        
        if (connected) {
            // Connected state - green badge
            this.statusDot.className = 'w-2 h-2 rounded-full bg-green-500';
            this.statusText.textContent = message || 'Connected';
            this.statusText.className = 'text-xs font-medium text-green-700';
            
            if (statusBadge) {
                statusBadge.className = 'connection-badge flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-200 bg-green-50 transition-all duration-300 shadow-sm';
                statusBadge.classList.remove('border-gray-300', 'bg-gray-50', 'border-red-200', 'bg-red-50', 'border-yellow-200', 'bg-yellow-50');
                statusBadge.classList.add('border-green-200', 'bg-green-50');
            }
        } else {
            // Disconnected state - red badge
            this.statusDot.className = 'w-2 h-2 rounded-full bg-red-500 animate-pulse';
            this.statusText.textContent = message || 'Disconnected';
            this.statusText.className = 'text-xs font-medium text-red-700';
            
            if (statusBadge) {
                statusBadge.className = 'connection-badge flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 transition-all duration-300 shadow-sm';
                statusBadge.classList.remove('border-gray-300', 'bg-gray-50', 'border-green-200', 'bg-green-50', 'border-yellow-200', 'bg-yellow-50');
                statusBadge.classList.add('border-red-200', 'bg-red-50');
            }
        }
    }
    
    // Set connecting state
    setConnecting(message = 'Connecting...') {
        const statusBadge = document.getElementById('connectionStatus');
        
        this.statusDot.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
        this.statusText.textContent = message;
        this.statusText.className = 'text-xs font-medium text-yellow-700';
        
        if (statusBadge) {
            statusBadge.className = 'connection-badge flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-200 bg-yellow-50 transition-all duration-300 shadow-sm';
            statusBadge.classList.remove('border-gray-300', 'bg-gray-50', 'border-green-200', 'bg-green-50', 'border-red-200', 'bg-red-50');
            statusBadge.classList.add('border-yellow-200', 'bg-yellow-50');
        }
    }
    
    // Update tool button states
    setActiveTool(tool) {
        if (tool === 'brush') {
            this.brushBtn.className = 'toolbar-btn toolbar-btn-active flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md';
            this.eraserBtn.className = 'toolbar-btn flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-gray-300';
            this.colorPicker.disabled = false;
            if (this.activeToolIcon) this.activeToolIcon.textContent = '✏️';
            if (this.activeToolText) this.activeToolText.textContent = 'Brush';
        } else if (tool === 'eraser') {
            this.brushBtn.className = 'toolbar-btn flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-all duration-200 font-medium shadow-sm hover:shadow-md border border-gray-300';
            this.eraserBtn.className = 'toolbar-btn toolbar-btn-active flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 font-medium shadow-sm hover:shadow-md';
            this.colorPicker.disabled = true;
            if (this.activeToolIcon) this.activeToolIcon.textContent = '🧽';
            if (this.activeToolText) this.activeToolText.textContent = 'Eraser';
        }
    }
    
    // Update brush size display
    updateBrushSize(size) {
        this.brushSizeDisplay.textContent = size + 'px';
    }
    
    // Get user initials from name
    getUserInitials(name) {
        if (!name || name === 'You') return 'Y';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    // Update users list
    updateUsersList(usersArray = null, currentUserId = null, currentUserColor = null) {
        // Clear existing list
        this.usersList.innerHTML = '';
        
        // Use provided currentUserId or fall back to stored one
        const effectiveCurrentUserId = currentUserId || this.currentUserId;
        
        // If usersArray is provided, use it; otherwise use internal map
        if (usersArray) {
            this.users.clear();
            // Deduplicate users by id in case server or other logic sent duplicates
            const seen = new Set();
            usersArray.forEach(user => {
                if (!user || !user.id) return;
                if (seen.has(user.id)) return;
                seen.add(user.id);
                this.users.set(user.id, user);
            });
            // Add current user if not present
            if (effectiveCurrentUserId && !this.users.has(effectiveCurrentUserId)) {
                this.users.set(effectiveCurrentUserId, {
                    id: effectiveCurrentUserId,
                    name: 'You',
                    color: currentUserColor || '#000000'
                });
            }
        }
        
        // Update user count
        const totalUsers = this.users.size;
        if (this.userCount) {
            this.userCount.textContent = totalUsers;
        }
        
        // Display users
        if (this.users.size === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'flex flex-col items-center justify-center py-8 px-4 text-center';
            
            const emptyIcon = document.createElement('div');
            emptyIcon.className = 'w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3';
            emptyIcon.innerHTML = `
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
            `;
            
            const emptyText = document.createElement('p');
            emptyText.className = 'text-sm text-gray-500';
            emptyText.textContent = 'No collaborators yet';
            
            emptyState.appendChild(emptyIcon);
            emptyState.appendChild(emptyText);
            this.usersList.appendChild(emptyState);
        } else {
            // Sort users: current user first, then alphabetically
            const sortedUsers = Array.from(this.users.entries()).sort(([idA, userA], [idB, userB]) => {
                if (idA === effectiveCurrentUserId) return -1;
                if (idB === effectiveCurrentUserId) return 1;
                return (userA.name || idA).localeCompare(userB.name || idB);
            });
            
            sortedUsers.forEach(([userId, user]) => {
                const isCurrentUser = userId === effectiveCurrentUserId;
                const userItem = document.createElement('div');
                userItem.className = 'user-item flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-default';
                userItem.setAttribute('data-user-id', userId);
                
                // Add tooltip
                const userNameForTooltip = isCurrentUser ? 'You' : (user.name || user.id || 'Unknown');
                userItem.title = `User: ${userNameForTooltip}`;
                
                // User avatar with initials and colored background
                const avatar = document.createElement('div');
                avatar.className = 'relative flex-shrink-0';
                
                const avatarCircle = document.createElement('div');
                avatarCircle.className = 'user-avatar w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm';
                const userColor = user.color || '#000000';
                avatarCircle.style.backgroundColor = userColor;
                
                // Add user initials
                const initials = this.getUserInitials(user.name || user.id || 'Unknown');
                avatarCircle.textContent = initials;
                
                // Online indicator ring (green dot on bottom-right)
                const onlineIndicator = document.createElement('div');
                onlineIndicator.className = 'absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm';
                
                avatar.appendChild(avatarCircle);
                avatar.appendChild(onlineIndicator);
                
                // User info
                const userInfo = document.createElement('div');
                userInfo.className = 'flex-1 min-w-0';
                
                const userName = document.createElement('div');
                userName.className = 'text-sm font-medium text-gray-900 truncate';
                // Display 'You' for the current user, otherwise show their actual name
                userName.textContent = isCurrentUser ? 'You' : (user.name || user.id || 'Unknown');
                
                const userStatus = document.createElement('div');
                userStatus.className = 'text-xs text-gray-500';
                userStatus.textContent = isCurrentUser ? 'You' : 'Online';
                
                userInfo.appendChild(userName);
                userInfo.appendChild(userStatus);
                
                // Assemble user item
                userItem.appendChild(avatar);
                userItem.appendChild(userInfo);
                
                // Add "You" badge if current user with accent color
                if (isCurrentUser) {
                    const youBadge = document.createElement('div');
                    youBadge.className = 'you-badge text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded';
                    youBadge.textContent = 'You';
                    // Use user's color as accent for the badge border
                    youBadge.style.borderColor = userColor;
                    youBadge.style.color = userColor;
                    userItem.appendChild(youBadge);
                }
                
                this.usersList.appendChild(userItem);
            });
        }
    }
    
    // Add or update a user
    addUser(userId, userData, currentUserId = null) {
        this.users.set(userId, userData);
        this.updateUsersList(null, currentUserId || this.currentUserId);
    }
    
    // Remove a user
    removeUser(userId, currentUserId = null) {
        this.users.delete(userId);
        this.updateUsersList(null, currentUserId || this.currentUserId);
    }
    
    // Update current user's color
    updateCurrentUserColor(userId, color) {
        if (this.users.has(userId)) {
            this.users.get(userId).color = color;
            this.updateUsersList(null, userId);
            // Update accent color for the UI
            this.setAccentColor(color);
        }
    }
    
    // Update zoom display
    updateZoom(zoomPercent) {
        const zoomDisplay = document.getElementById('zoomDisplay');
        const zoomUtility = document.getElementById('zoomUtility');
        if (zoomDisplay) zoomDisplay.textContent = Math.round(zoomPercent) + '%';
        if (zoomUtility) zoomUtility.textContent = Math.round(zoomPercent) + '%';
    }
    
    // Set current user ID for reference
    setCurrentUserId(userId) {
        this.currentUserId = userId;
    }
    
    // Get current user ID
    getCurrentUserId() {
        return this.currentUserId;
    }
}

