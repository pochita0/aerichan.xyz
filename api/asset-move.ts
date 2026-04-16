import type { VercelRequest, VercelResponse } from '@vercel/node';
import { spawn } from 'child_process';

type AssetMoveAction = 'ping' | 'balances' | 'routes' | 'execute';

interface AssetMoveRequestBody {
  action?: AssetMoveAction;
  exchange?: string;
  from?: string;
  to?: string;
  coin?: string;
  network?: string;
  amount?: number | string;
  address?: string;
  tag?: string;
}

const DEFAULT_WORKDIR = '/Users/jong-geon/Desktop/binance_withdraw_desktop_v2';
const DEFAULT_TIMEOUT_MS = 120_000;

const extractJsonLine = (stdout: string) => {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : '';
};

const buildBridgeArgs = (body: AssetMoveRequestBody): string[] => {
  const action = body.action || 'ping';

  if (action === 'ping') {
    return ['ping'];
  }

  if (action === 'balances') {
    if (!body.exchange) throw new Error('exchange is required for balances');
    return ['balances', '--exchange', body.exchange];
  }

  if (action === 'routes') {
    if (!body.from || !body.to || !body.coin) {
      throw new Error('from, to, coin are required for routes');
    }
    return ['routes', '--from', body.from, '--to', body.to, '--coin', body.coin];
  }

  if (action === 'execute') {
    if (!body.from || !body.to || !body.coin || !body.network || body.amount === undefined) {
      throw new Error('from, to, coin, network, amount are required for execute');
    }

    const args = [
      'execute',
      '--from', body.from,
      '--to', body.to,
      '--coin', body.coin,
      '--network', body.network,
      '--amount', String(body.amount),
    ];

    if (body.address) {
      args.push('--address', body.address);
    }
    if (body.tag) {
      args.push('--tag', body.tag);
    }

    return args;
  }

  throw new Error(`Unsupported action: ${String(action)}`);
};

const runBridge = (bridgeArgs: string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> => {
  const workdir = process.env.ASSET_MOVE_BRIDGE_WORKDIR || DEFAULT_WORKDIR;
  const binary = process.env.ASSET_MOVE_BRIDGE_BINARY?.trim();

  const cmd = binary && binary.length > 0 ? binary : 'cargo';
  const cmdArgs = binary && binary.length > 0
    ? ['bridge', ...bridgeArgs]
    : ['run', '--quiet', '--', 'bridge', ...bridgeArgs];

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: workdir,
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Bridge command timeout after ${DEFAULT_TIMEOUT_MS}ms`));
    }, Number(process.env.ASSET_MOVE_BRIDGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as AssetMoveRequestBody;
    const bridgeArgs = buildBridgeArgs(body);
    const { code, stdout, stderr } = await runBridge(bridgeArgs);

    const jsonLine = extractJsonLine(stdout);
    if (!jsonLine) {
      throw new Error(`Bridge returned empty output (stderr: ${stderr || 'none'})`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonLine);
    } catch {
      throw new Error(`Bridge output is not valid JSON: ${jsonLine}`);
    }

    const payload = parsed as { ok?: boolean; error?: string };
    if (code !== 0 || payload.ok === false) {
      return res.status(400).json({
        ok: false,
        error: payload.error || `Bridge command failed (code: ${code})`,
        stderr,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown bridge error';
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
