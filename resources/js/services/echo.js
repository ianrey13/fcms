// resources/js/services/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

// ============================================
// ✅ GET TOKENS
// ============================================

const getCsrfToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
};

const getXSRFToken = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'XSRF-TOKEN') {
            return decodeURIComponent(value);
        }
    }
    return '';
};

const getToken = () => {
    return localStorage.getItem('fcms_token');
};

// ============================================
// ✅ DETECT PLATFORM
// ============================================

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

const PC_IP = import.meta.env.VITE_PC_IP || '192.168.1.5';

let wsHost = import.meta.env.VITE_REVERB_HOST || 'localhost';

if (isProduction) {
    wsHost = window.location.hostname;
    console.log('🌐 Production detected - using host:', wsHost);
} else if (isMobile) {
    wsHost = PC_IP;
    console.log('📱 Mobile device detected - using IP:', wsHost);
} else {
    wsHost = 'localhost';
    console.log('💻 Desktop detected - using:', wsHost);
}

const wsPort = isProduction ? 8000 : (parseInt(import.meta.env.VITE_REVERB_PORT) || 8080);
const wsKey = import.meta.env.VITE_REVERB_APP_KEY || 'tvv4dolwfj6x4radqf76';
const wsScheme = isProduction ? 'https' : (import.meta.env.VITE_REVERB_SCHEME || 'http');

const apiUrl = isProduction 
    ? `https://${window.location.hostname}/api`
    : (isMobile 
        ? `http://${PC_IP}:8000/api`
        : import.meta.env.VITE_API_URL || 'http://localhost:8000/api');

console.log('🔊 ===== ECHO CONFIG =====');
console.log('📱 Platform:', isMobile ? 'Mobile' : 'Desktop');
console.log('🌐 Environment:', isProduction ? 'Production' : 'Local');
console.log('🏠 Host:', wsHost);
console.log('🔌 Port:', wsPort);
console.log('🔑 Key:', wsKey);
console.log('📡 Scheme:', wsScheme);
console.log('🔗 API:', apiUrl);
console.log('===========================');

// ============================================
// ✅ CREATE ECHO INSTANCE
// ============================================

const echo = new Echo({
    broadcaster: 'reverb',
    key: wsKey,
    wsHost: wsHost,
    wsPort: wsPort,
    wssPort: wsPort,
    forceTLS: wsScheme === 'https',
    enabledTransports: ['ws', 'wss'],
    timeout: 30000,
    authEndpoint: '/api/broadcasting/auth',
    auth: {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-XSRF-TOKEN': getXSRFToken(),
            Authorization: `Bearer ${getToken()}`,
        },
        withCredentials: true,
    },
});

console.log('🔊 Echo instance created');

window.echo = echo;

// ============================================
// ✅ CONNECTION MANAGEMENT
// ============================================

let retryCount = 0;
const maxRetries = 20;
let subscriptionAttempts = 0;
const maxSubscriptionAttempts = 5;
let isSubscribed = false;

const tryConnect = () => {
    try {
        if (echo.connector) {
            console.log('✅ Connector found');
            
            if (echo.connector.pusher) {
                const connection = echo.connector.pusher.connection;
                console.log('📊 Connection state:', connection.state);
                
                if (connection.state === 'connected') {
                    console.log('✅ Reverb WebSocket connected!');
                    console.log('🔗 Connected to:', wsHost, ':', wsPort);
                    
                    retryCount = 0;
                    
                    setTimeout(() => {
                        subscribeToNotifications();
                    }, 500);
                    return;
                } else if (connection.state === 'connecting') {
                    console.log('⏳ WebSocket connecting...');
                } else if (connection.state === 'disconnected' || connection.state === 'unavailable') {
                    console.log('🔄 Attempting to connect...');
                    connection.connect();
                }
            }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
            console.log(`🔄 Retry ${retryCount}/${maxRetries}...`);
            setTimeout(tryConnect, 1000);
        } else {
            console.error('❌ Failed to connect to Reverb');
            console.log('💡 Run: php artisan reverb:start');
        }
    } catch (error) {
        console.error('❌ Connection error:', error);
        retryCount++;
        if (retryCount < maxRetries) {
            setTimeout(tryConnect, 2000);
        }
    }
};

// ============================================
// ✅ SUBSCRIBE TO NOTIFICATIONS
// ============================================

function subscribeToNotifications() {
    if (isSubscribed) {
        console.log('✅ Already subscribed to notifications');
        return;
    }

    try {
        const token = getToken();
        if (!token) {
            console.log('⚠️ No token found, skipping notification subscription');
            return;
        }
        
        const userStr = localStorage.getItem('fcms_user');
        if (!userStr) {
            console.log('⚠️ No user found, skipping notification subscription');
            return;
        }
        
        const user = JSON.parse(userStr);
        const userId = user.user_id || user.id;
        
        if (!userId) {
            console.log('⚠️ No user ID found');
            return;
        }
        
        console.log('🔔 Subscribing to notifications for user:', userId);
        
        const channel = echo.private(`notifications.${userId}`);
        
        channel.listen('.notification.new', (data) => {
            console.log('📨 Real-time notification received:', data);
            
            window.dispatchEvent(new CustomEvent('new-notification', { 
                detail: data 
            }));
            
            updateNotificationBadge();
        });
        
        channel.subscribed(() => {
            console.log(`✅ Subscribed to notifications.${userId}`);
            isSubscribed = true;
            subscriptionAttempts = 0;
        });
        
        channel.error((error) => {
            console.error(`❌ Subscription error for notifications.${userId}:`, error);
            
            subscriptionAttempts++;
            if (subscriptionAttempts < maxSubscriptionAttempts) {
                console.log(`🔄 Retrying subscription (${subscriptionAttempts}/${maxSubscriptionAttempts})...`);
                setTimeout(() => {
                    isSubscribed = false;
                    subscribeToNotifications();
                }, 5000);
            } else {
                console.error('❌ Max subscription attempts reached');
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to subscribe to notifications:', error);
    }
}

// ============================================
// ✅ UPDATE NOTIFICATION BADGE
// ============================================

function updateNotificationBadge() {
    try {
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
    } catch (error) {
        console.error('❌ Failed to update notification badge:', error);
    }
}

// ============================================
// ✅ START CONNECTION
// ============================================

setTimeout(tryConnect, 1000);

const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    
    if (key === 'fcms_token' && value) {
        console.log('🔄 Token updated - reconnecting...');
        setTimeout(() => {
            isSubscribed = false;
            tryConnect();
        }, 1000);
    }
};

export default echo;

// ============================================
// ✅ CONSOLE HELPERS - UPDATED
// ============================================

// ✅ FIXED: testNotification now shows a toast directly
window.testNotification = () => {
    console.log('🔔 Testing notification...');
    
    // ✅ Show toast directly using react-hot-toast
    import('react-hot-toast').then((module) => {
        const toast = module.default || module;
        toast.success('🔔 Test toast from window.testNotification!', {
            duration: 5000,
            position: 'top-right',
        });
        console.log('✅ Toast displayed!');
    }).catch((err) => {
        console.warn('⚠️ Failed to import react-hot-toast:', err);
        // Fallback: try using window.toast
        if (window.toast) {
            window.toast.success('🔔 Test toast from window.testNotification!');
        }
    });
    
    // ✅ Also dispatch the custom event for NotificationBell
    window.dispatchEvent(new CustomEvent('new-notification', {
        detail: {
            message: '🔔 Test notification from browser!',
            notification_type: 'test',
            entity_type: 'test',
            entity_id: 1,
            created_at: new Date().toISOString(),
        }
    }));
};

window.checkEchoConnection = () => {
    if (echo.connector && echo.connector.pusher) {
        const state = echo.connector.pusher.connection.state;
        console.log('📊 Connection state:', state);
        console.log('📊 Is subscribed:', isSubscribed);
        return state;
    }
    console.log('❌ Echo not initialized');
    return null;
};

window.reconnectEcho = () => {
    console.log('🔄 Reconnecting...');
    isSubscribed = false;
    if (echo.connector && echo.connector.pusher) {
        echo.connector.pusher.connection.disconnect();
        setTimeout(() => {
            echo.connector.pusher.connection.connect();
        }, 1000);
    }
};

console.log('🔧 Available commands:');
console.log('  - window.testNotification()');
console.log('  - window.checkEchoConnection()');
console.log('  - window.reconnectEcho()');