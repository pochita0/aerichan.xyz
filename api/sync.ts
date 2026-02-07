import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Key format: user:{userId}:data
const getUserKey = (userId: string) => `user:${userId}:data`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const key = getUserKey(userId);

        // GET: Load encrypted data
        if (req.method === 'GET') {
            const data = await redis.get(key);

            if (!data) {
                return res.status(404).json({ error: 'No data found', data: null });
            }

            return res.status(200).json({ success: true, data });
        }

        // POST: Save user data
        if (req.method === 'POST') {
            const data = req.body;

            if (!data || typeof data !== 'object') {
                return res.status(400).json({ error: 'Data object is required' });
            }

            // Store data (Upstash auto-serializes)
            await redis.set(key, data);

            return res.status(200).json({ success: true, message: 'Data saved successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Sync API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
