export default async function handler(req: any, res: any) {
  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';

  // Build the Kakao API URL
  const url = new URL(`https://dapi.kakao.com/${pathString}`);

  // Forward query parameters
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'path' && value) {
      url.searchParams.set(key, Array.isArray(value) ? value[0] : value as string);
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: req.method || 'GET',
      headers: {
        'Authorization': req.headers.authorization as string || '',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Kakao API proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Kakao API' });
  }
}
