// src/utils/eventBus.js

/**
 * Simple event bus for cross-component communication
 * Used for:
 * - Notification updates
 * - User role changes
 * - Data refresh triggers
 * - Form submissions
 */
class EventBus {
    constructor() {
        this.events = {};
        this.debug = false;
    }

    /**
     * Enable debug logging
     */
    enableDebug() {
        this.debug = true;
        console.log('📡 EventBus debug mode enabled');
    }

    /**
     * Emit an event with data
     */
    emit(event, data) {
        if (this.debug) {
            console.log(`📡 EventBus emit: ${event}`, data);
        }

        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`❌ Error in event handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Register an event listener
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);

        if (this.debug) {
            console.log(`📡 EventBus registered listener for: ${event} (${this.events[event].length} total)`);
        }

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Register a one-time event listener
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
        return () => this.off(event, wrapper);
    }

    /**
     * Remove an event listener
     */
    off(event, callback) {
        if (this.events[event]) {
            if (callback) {
                this.events[event] = this.events[event].filter(cb => cb !== callback);
            } else {
                delete this.events[event];
            }

            if (this.debug) {
                console.log(`📡 EventBus removed listener for: ${event}`);
            }
        }
    }

    /**
     * Remove all event listeners
     */
    removeAllListeners() {
        this.events = {};
        if (this.debug) {
            console.log('📡 EventBus removed all listeners');
        }
    }

    /**
     * Get all registered events
     */
    getEvents() {
        return Object.keys(this.events);
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event) {
        return this.events[event]?.length || 0;
    }

    /**
     * Wait for an event (returns promise)
     */
    waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);

            const handler = (data) => {
                clearTimeout(timer);
                resolve(data);
            };

            this.once(event, handler);
        });
    }
}

// Create singleton instance
const eventBus = new EventBus();

// Export instance and class for flexibility
export default eventBus;
export { EventBus };