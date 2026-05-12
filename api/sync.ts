import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const getRedisClient = () => {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error('SYNC_STORAGE_NOT_CONFIGURED');
    }

    return new Redis({ url, token });
};

// Key format: user:{userId}:data
const getUserKey = (userId: string) => `user:${userId}:data`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Dashboard-Sync-Api', '2026-05-12');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const redis = getRedisClient();
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
        if (error instanceof Error && error.message === 'SYNC_STORAGE_NOT_CONFIGURED') {
            return res.status(500).json({
                error: 'Sync storage is not configured. Add Upstash Redis REST env vars in Vercel.',
            });
        }

        return res.status(500).json({
            error: 'Sync storage connection failed. Check Upstash Redis REST env vars in Vercel.',
        });
    }
}
