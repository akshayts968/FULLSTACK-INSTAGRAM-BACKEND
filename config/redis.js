const { Redis } = require('@upstash/redis');
require('dotenv').config();

// Create the Upstash Redis client (HTTP based)
const redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// For HTTP client, we don't need a persistent connection, 
// but we include this to keep the server.js interface consistent.
const connectRedis = async () => {
    try {
        // Simple ping to verify credentials
        await redisClient.get('test_ping');
        console.log('Connected to Upstash Redis (HTTP)');
    } catch (err) {
        console.error('Failed to verify Upstash Redis connection:', err.message);
    }
};

// We add a mock 'isOpen' property to match the expected interface in the controller
// since the Upstash HTTP client is always "open" conceptually.
redisClient.isOpen = true;

module.exports = { redisClient, connectRedis };
