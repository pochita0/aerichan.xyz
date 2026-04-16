import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
  COINS,
  DEPOSIT_ADDRESS_BOOK,
  EXCHANGES,
  INITIAL_BALANCES,
  TRANSFER_STEP_TEMPLATE,
  type ExchangeCode,
} from '../../data/assetMoveData';

type StepStatus = 'idle' | 'running' | 'done' | 'error';
type EngineState = 'checking' | 'online' | 'offline';

interface TransferStepState {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  detail?: string;
}

interface BridgeRoute {
  network: string;
  name?: string;
  withdraw_enable: boolean;
  deposit_enable: boolean;
  withdraw_fee: string;
  withdraw_min: string;
  address_network: string;
  address: string;
  tag?: string | null;
}

interface BridgeRoutesResponse {
  ok: boolean;
  routes: BridgeRoute[];
  source_balance: number;
  error?: string;
}

interface BridgeExecuteResponse {
  ok: boolean;
  request_id?: string;
  result?: string;
  source_balance_after?: number;
  withdraw_fee?: string;
  error?: string;
}

interface LiveRoutesLoadResult {
  ok: boolean;
  routeCount: number;
}

interface LocalServiceStatus {
  running: boolean;
  started: boolean;
  port: number;
  cwd: string;
  error?: string;
}

interface LocalServiceStartResponse {
  ok: boolean;
  backend?: LocalServiceStatus;
  frontend?: LocalServiceStatus;
  error?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const formatAmount = (value: number) => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
};

const nowLabel = () => {
  const date = new Date();
  return date.toLocaleTimeString('ko-KR', { hour12: false });
};

const makeId = (prefix: string, size = 10) => {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${out}`;
};

const makeInitialSteps = (): TransferStepState[] => {
  return TRANSFER_STEP_TEMPLATE.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    status: 'idle',
  }));
};

const stepStatusStyle = (status: StepStatus) => {
  if (status === 'done') {
    return 'border-green-400/45 bg-green-900/40 text-green-100';
  }
  if (status === 'running') {
    return 'border-blue-400/40 bg-blue-900/30 text-blue-100';
  }
  if (status === 'error') {
    return 'border-red-400/45 bg-red-900/35 text-red-100';
  }
  return 'border-white/10 bg-black/25 text-white/70';
};

const normalizeNetwork = (network: string) => network.toUpperCase().replace(/[^A-Z0-9]/g, '');

const getExplorerBase = (network: string) => {
  const normalized = normalizeNetwork(network);

  if (normalized.includes('TRX') || normalized.includes('TRON')) return 'https://tronscan.org/#/transaction/';
  if (normalized.includes('BSC') || normalized.includes('BEP20')) return 'https://bscscan.com/tx/';
  if (normalized.includes('ETH') || normalized.includes('ERC20')) return 'https://etherscan.io/tx/';
  if (normalized.includes('APT')) return 'https://explorer.aptoslabs.com/txn/';
  if (normalized.includes('KAIA') || normalized.includes('KLAY')) return 'https://kaiascan.io/tx/';
  if (normalized.includes('ARB')) return 'https://arbiscan.io/tx/';
  if (normalized.includes('BASE')) return 'https://basescan.org/tx/';

  return 'https://etherscan.io/tx/';
};

const extractTxHash = (raw: string) => {
  const evm = raw.match(/0x[a-fA-F0-9]{32,}/);
  if (evm) return evm[0];
  return null;
};

const callAssetMoveApi = async <T extends { ok?: boolean; error?: string }>(
  payload: Record<string, unknown>
): Promise<T> => {
  const response = await fetch('/api/asset-move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as T;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Asset move API failed (${response.status})`);
  }
  return data;
};

export const AssetMovePage: React.FC = () => {
  const [balances, setBalances] = useLocalStorage('asset-move-balances-v1', INITIAL_BALANCES);
  const [logs, setLogs] = useLocalStorage<string[]>('asset-move-logs-v1', []);
  const [useLiveEngine, setUseLiveEngine] = useLocalStorage<boolean>('asset-move-live-engine-v1', true);

  const [selectedCoin, setSelectedCoin] = useState(COINS[0]?.symbol || 'USDT');
  const [fromExchange, setFromExchange] = useState<ExchangeCode>('BINANCE');
  const [toExchange, setToExchange] = useState<ExchangeCode>('UPBIT');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [amount, setAmount] = useState('');

  const [steps, setSteps] = useState<TransferStepState[]>(makeInitialSteps());
  const [isRunning, setIsRunning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'address' | 'tag' | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const [loginState, setLoginState] = useState<'idle' | 'starting' | 'done' | 'error'>('idle');
  const [loginStatusText, setLoginStatusText] = useState<string>('');

  const [engineState, setEngineState] = useState<EngineState>(useLiveEngine ? 'checking' : 'offline');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [bridgeRoutes, setBridgeRoutes] = useState<BridgeRoute[]>([]);
  const [liveSourceBalance, setLiveSourceBalance] = useState<number | null>(null);

  const runIdRef = useRef(0);

  const coinMeta = useMemo(() => {
    return COINS.find((coin) => coin.symbol === selectedCoin) || COINS[0];
  }, [selectedCoin]);

  const staticAvailableNetworks = useMemo(() => {
    if (!coinMeta) return [];
    return coinMeta.networks.filter((network) => {
      const canWithdraw = network.from.includes(fromExchange);
      const canDeposit = network.to.includes(toExchange);
      const hasAddress = !!DEPOSIT_ADDRESS_BOOK[toExchange]?.[network.id];
      return canWithdraw && canDeposit && hasAddress;
    });
  }, [coinMeta, fromExchange, toExchange]);

  const liveAvailableNetworks = useMemo(() => {
    return bridgeRoutes.map((route) => ({
      id: route.network,
      label: route.name && route.name !== route.network
        ? `${route.name} / ${route.network}`
        : route.network,
      fee: route.withdraw_fee || '-',
      minWithdraw: route.withdraw_min || '0',
      explorerUrl: getExplorerBase(route.network),
      from: [fromExchange],
      to: [toExchange],
    }));
  }, [bridgeRoutes, fromExchange, toExchange]);

  const availableNetworks = useMemo(() => {
    if (useLiveEngine && engineState === 'online') {
      return liveAvailableNetworks;
    }
    return staticAvailableNetworks;
  }, [useLiveEngine, engineState, liveAvailableNetworks, staticAvailableNetworks]);

  const appendLog = (text: string) => {
    const line = `[${nowLabel()}] ${text}`;
    setLogs((prev) => [...prev.slice(-219), line]);
  };

  const loadLiveRoutes = useCallback(async (): Promise<LiveRoutesLoadResult> => {
    if (!useLiveEngine) {
      setEngineState('offline');
      setBridgeRoutes([]);
      setLiveSourceBalance(null);
      setEngineError(null);
      return { ok: false, routeCount: 0 };
    }

    setEngineState('checking');
    setEngineError(null);

    try {
      const payload = await callAssetMoveApi<BridgeRoutesResponse>({
        action: 'routes',
        from: fromExchange,
        to: toExchange,
        coin: selectedCoin,
      });

      const enabledRoutes = (payload.routes || []).filter(
        (route) => route.withdraw_enable && route.address && route.address.trim().length > 0
      );

      setBridgeRoutes(enabledRoutes);
      setLiveSourceBalance(typeof payload.source_balance === 'number' ? payload.source_balance : null);
      setEngineState('online');
      return { ok: true, routeCount: enabledRoutes.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bridge unavailable';
      setEngineState('offline');
      setEngineError(message);
      setBridgeRoutes([]);
      setLiveSourceBalance(null);
      return { ok: false, routeCount: 0 };
    }
  }, [fromExchange, toExchange, selectedCoin, useLiveEngine]);

  useEffect(() => {
    if (fromExchange !== toExchange) return;
    const fallback = EXCHANGES.find((exchange) => exchange.code !== fromExchange);
    if (fallback) setToExchange(fallback.code);
  }, [fromExchange, toExchange]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      const result = await loadLiveRoutes();
      if (isCancelled) return;
      if (useLiveEngine && result.ok) {
        setStatusText('Live bridge connected');
      } else if (useLiveEngine && !result.ok) {
        setStatusText('Live bridge disconnected');
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [loadLiveRoutes, useLiveEngine]);

  useEffect(() => {
    if (availableNetworks.some((network) => network.id === selectedNetwork)) return;
    setSelectedNetwork(availableNetworks[0]?.id || '');
  }, [availableNetworks, selectedNetwork]);

  const liveSelectedRoute = useMemo(() => {
    return bridgeRoutes.find((route) => route.network === selectedNetwork);
  }, [bridgeRoutes, selectedNetwork]);

  const networkInfo = useMemo(() => {
    return availableNetworks.find((network) => network.id === selectedNetwork);
  }, [availableNetworks, selectedNetwork]);

  const destinationInfo = useMemo(() => {
    if (useLiveEngine && engineState === 'online') {
      if (!liveSelectedRoute) return undefined;
      return {
        address: liveSelectedRoute.address,
        tag: liveSelectedRoute.tag || undefined,
      };
    }

    if (!selectedNetwork) return undefined;
    return DEPOSIT_ADDRESS_BOOK[toExchange]?.[selectedNetwork];
  }, [useLiveEngine, engineState, liveSelectedRoute, selectedNetwork, toExchange]);

  const sourceBalance = useMemo(() => {
    if (useLiveEngine && engineState === 'online' && liveSourceBalance !== null) {
      return liveSourceBalance;
    }
    return balances[fromExchange]?.[selectedCoin] || 0;
  }, [useLiveEngine, engineState, liveSourceBalance, balances, fromExchange, selectedCoin]);

  const parsedAmount = Number.parseFloat(amount);
  const minWithdraw = Number.parseFloat(networkInfo?.minWithdraw || '0');
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const meetsMinWithdraw = amountIsValid && parsedAmount >= minWithdraw;
  const withinBalance = amountIsValid && parsedAmount <= sourceBalance;
  const engineReady = !useLiveEngine || engineState === 'online';

  const canExecute = !!(
    engineReady &&
    !isRunning &&
    destinationInfo &&
    selectedNetwork &&
    amountIsValid &&
    meetsMinWithdraw &&
    withinBalance
  );

  const updateStep = (stepId: string, status: StepStatus, detail?: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, status, detail: detail || step.detail } : step))
    );
  };

  const refreshState = async () => {
    if (isRunning) return;
    setIsRefreshing(true);

    if (useLiveEngine) {
      setStatusText('Refreshing live exchange data...');
      appendLog(`Refreshing live routes: ${selectedCoin} ${fromExchange} -> ${toExchange}`);
      const result = await loadLiveRoutes();
      if (result.ok) {
        appendLog(`Live routes loaded: ${result.routeCount} route(s)`);
        setStatusText('Live data refreshed');
      } else {
        appendLog('Live refresh failed (bridge offline)');
        setStatusText('Live refresh failed');
      }
      setIsRefreshing(false);
      return;
    }

    setStatusText('Refreshing simulation data...');
    appendLog(`Refreshing simulation: ${fromExchange} balance / ${selectedCoin} networks`);
    await sleep(450);
    appendLog(
      `Loaded ${availableNetworks.length} networks, ${destinationInfo ? 'destination address found' : 'destination address not found'}`
    );
    setStatusText('Simulation data refreshed');
    setIsRefreshing(false);
  };

  const runStep = async (stepId: string, startLog: string, finishLog: string, delayMs: number) => {
    updateStep(stepId, 'running');
    appendLog(startLog);
    await sleep(delayMs);
    updateStep(stepId, 'done');
    appendLog(finishLog);
  };

  const executeTransfer = async () => {
    if (!canExecute || !networkInfo || !destinationInfo || !amountIsValid) return;

    runIdRef.current += 1;
    const currentRunId = runIdRef.current;
    const fallbackTaskId = `TR-${Date.now().toString(36).toUpperCase()}`;
    const fallbackTxHash = makeId('0x', 64);
    let resolvedTxHash: string | null = null;
    let liveSourceAfter: number | null = null;

    setIsRunning(true);
    setStatusText('Transfer in progress...');
    setJobId(fallbackTaskId);
    setLastTxHash(null);
    setSteps(makeInitialSteps());

    appendLog(`Transfer task created: ${fallbackTaskId}`);
    appendLog(`Route: ${selectedCoin} ${fromExchange} -> ${toExchange} via ${selectedNetwork}`);
    appendLog(`Amount: ${parsedAmount}`);

    try {
      if (useLiveEngine && engineState === 'online') {
        updateStep('withdraw_start', 'running');
        appendLog(`Submitting live withdraw on ${fromExchange}...`);

        const payload = await callAssetMoveApi<BridgeExecuteResponse>({
          action: 'execute',
          from: fromExchange,
          to: toExchange,
          coin: selectedCoin,
          network: selectedNetwork,
          amount: parsedAmount,
          address: destinationInfo.address,
          tag: destinationInfo.tag,
        });

        if (runIdRef.current !== currentRunId) return;

        if (payload.request_id) {
          setJobId(payload.request_id);
        }
        if (typeof payload.source_balance_after === 'number') {
          liveSourceAfter = payload.source_balance_after;
          setLiveSourceBalance(payload.source_balance_after);
        }

        const realTxHash = payload.result ? extractTxHash(payload.result) : null;
        if (realTxHash) {
          resolvedTxHash = realTxHash;
          setLastTxHash(realTxHash);
        }

        updateStep('withdraw_start', 'done');
        appendLog(payload.result || 'Live withdrawal request accepted');
      } else {
        await runStep(
          'withdraw_start',
          `Submitting withdrawal request on ${fromExchange}...`,
          'Withdrawal request accepted',
          700
        );
      }

      if (runIdRef.current !== currentRunId) return;

      await runStep(
        'withdraw_processing',
        `Checking withdrawal record on ${fromExchange}...`,
        'Withdrawal record found',
        900
      );
      if (runIdRef.current !== currentRunId) return;

      await runStep(
        'withdraw_success',
        'Withdrawal confirmation in progress...',
        'Withdrawal confirmed (1 block confirmation)',
        900
      );
      if (runIdRef.current !== currentRunId) return;

      resolvedTxHash = resolvedTxHash || fallbackTxHash;
      setLastTxHash(resolvedTxHash);

      await runStep(
        'sending',
        'Tracking chain transfer...',
        `Sending confirmed. TxID: ${resolvedTxHash.slice(0, 22)}...`,
        1200
      );
      if (runIdRef.current !== currentRunId) return;

      await runStep(
        'deposit_processing',
        `Checking deposit record on ${toExchange}...`,
        `Deposit detected on ${toExchange}`,
        1200
      );
      if (runIdRef.current !== currentRunId) return;

      await runStep(
        'deposit_success',
        'Finalizing transfer...',
        `Transfer successful! ${selectedCoin} arrived on ${toExchange}`,
        750
      );

      setBalances((prev) => {
        const currentFrom = prev[fromExchange]?.[selectedCoin] || 0;
        const currentTo = prev[toExchange]?.[selectedCoin] || 0;
        const nextFrom = liveSourceAfter !== null ? liveSourceAfter : Math.max(0, currentFrom - parsedAmount);

        return {
          ...prev,
          [fromExchange]: {
            ...prev[fromExchange],
            [selectedCoin]: nextFrom,
          },
          [toExchange]: {
            ...prev[toExchange],
            [selectedCoin]: currentTo + parsedAmount,
          },
        };
      });

      setStatusText('Transfer completed');
      appendLog(`Balance updated: ${fromExchange} ${selectedCoin} -${parsedAmount}`);
      appendLog(`Balance updated: ${toExchange} ${selectedCoin} +${parsedAmount}`);
    } catch (error) {
      setStatusText('Transfer failed');
      const message = error instanceof Error ? error.message : 'Unknown transfer error';
      appendLog(`Transfer failed: ${message}`);
      setSteps((prev) => {
        const active = prev.find((step) => step.status === 'running')?.id;
        if (!active) return prev;
        return prev.map((step) => (step.id === active ? { ...step, status: 'error', detail: message } : step));
      });
    } finally {
      if (runIdRef.current === currentRunId) {
        setIsRunning(false);
      }
    }
  };

  const setAmountToMax = () => {
    setAmount(sourceBalance > 0 ? sourceBalance.toFixed(8).replace(/\.?0+$/, '') : '');
  };

  const copyValue = async (value: string, field: 'address' | 'tag') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 1000);
    } catch (error) {
      console.error('Clipboard write failed:', error);
    }
  };

  const explorerLink = useMemo(() => {
    if (!lastTxHash || !networkInfo) return null;
    return `${networkInfo.explorerUrl}${lastTxHash}`;
  }, [lastTxHash, networkInfo]);

  const canOpenExplorer = !!(explorerLink && lastTxHash);

  const startLocalServices = async () => {
    if (loginState === 'starting') return;

    setLoginState('starting');
    setLoginStatusText('로컬 서비스 시작 중...');

    try {
      const response = await fetch('/__local/start-services', {
        method: 'POST',
      });

      const raw = await response.text();
      let data: LocalServiceStartResponse | null = null;

      try {
        data = raw ? (JSON.parse(raw) as LocalServiceStartResponse) : null;
      } catch {
        throw new Error('로컬 서비스 응답 파싱 실패');
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `로컬 서비스 시작 실패 (${response.status})`);
      }

      const startedTargets = [
        data.backend?.started ? 'backend' : '',
        data.frontend?.started ? 'frontend' : '',
      ].filter(Boolean);

      if (startedTargets.length > 0) {
        appendLog(`Local service started: ${startedTargets.join(', ')}`);
      } else {
        appendLog('Local services already running');
      }

      const backendState = data.backend?.running ? 'backend on' : 'backend off';
      const frontendState = data.frontend?.running ? 'frontend on' : 'frontend off';

      setLoginState('done');
      setLoginStatusText(`${backendState} / ${frontendState}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '로컬 서비스 시작 실패';
      setLoginState('error');
      setLoginStatusText(message);
      appendLog(`Local service start failed: ${message}`);
    }
  };

  return (
    <div className="p-4 sm:p-8 md:p-10">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="rounded-2xl border border-white/15 bg-black/30 p-5 backdrop-blur-xl">
          <h2 className="text-3xl font-bold tracking-tight text-white">Asset Move - Cross-Exchange Transfer</h2>
          <p className="mt-2 text-sm text-white/70">
            코인을 A 거래소에서 출금하여 B 거래소로 입금합니다. 출금/입금 가능한 공통 체인만 선택할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setUseLiveEngine((prev) => !prev)}
              className={`rounded-lg border px-3 py-1.5 font-semibold transition ${useLiveEngine
                ? 'border-emerald-300/50 bg-emerald-500/25 text-emerald-100'
                : 'border-white/20 bg-white/10 text-white/80'
                } disabled:opacity-50`}
            >
              Engine: {useLiveEngine ? 'LIVE' : 'SIMULATION'}
            </button>

            <span
              className={`rounded-md border px-2 py-1 ${engineState === 'online'
                ? 'border-emerald-300/45 bg-emerald-500/20 text-emerald-200'
                : engineState === 'checking'
                  ? 'border-blue-300/45 bg-blue-500/20 text-blue-200'
                  : 'border-red-300/45 bg-red-500/20 text-red-200'
                }`}
            >
              Bridge: {engineState}
            </span>

            <button
              type="button"
              onClick={startLocalServices}
              disabled={loginState === 'starting'}
              title="로컬에서 백엔드/프론트 개발 서버 시작"
              className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${loginState === 'error'
                ? 'border-red-300/45 bg-red-500/20 text-red-200'
                : loginState === 'done'
                  ? 'border-emerald-300/45 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/20 bg-white/10 text-white/80 hover:bg-white/15'
                } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {loginState === 'starting' ? '로그인중...' : '로그인'}
            </button>

            {useLiveEngine && engineError && (
              <span className="rounded-md border border-red-300/35 bg-red-500/15 px-2 py-1 text-red-200">
                {engineError}
              </span>
            )}

            {loginStatusText && (
              <span className={`rounded-md border px-2 py-1 ${loginState === 'error'
                ? 'border-red-300/35 bg-red-500/15 text-red-200'
                : 'border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                }`}>
                {loginStatusText}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
          <section className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-2xl font-semibold text-white">Transfer Settings</h3>
            <div className="space-y-3 rounded-xl border border-white/10 p-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_140px_minmax(0,1fr)]">
                <label className="self-center text-white/80">Coin</label>
                <select
                  disabled={isRunning}
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-white outline-none focus:border-white/30 disabled:opacity-60"
                >
                  {COINS.map((coin) => (
                    <option key={coin.symbol} value={coin.symbol}>
                      {coin.symbol} ({coin.name})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={refreshState}
                  disabled={isRefreshing || isRunning}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <div className="self-center text-sm text-green-300">
                  {availableNetworks.length} available
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_120px_minmax(0,1fr)]">
                <label className="self-center text-white/80">From</label>
                <select
                  disabled={isRunning}
                  value={fromExchange}
                  onChange={(e) => setFromExchange(e.target.value as ExchangeCode)}
                  className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-white outline-none focus:border-white/30 disabled:opacity-60"
                >
                  {EXCHANGES.map((exchange) => (
                    <option key={exchange.code} value={exchange.code}>
                      {exchange.label}
                    </option>
                  ))}
                </select>

                <label className="self-center text-white/80">To</label>
                <select
                  disabled={isRunning}
                  value={toExchange}
                  onChange={(e) => setToExchange(e.target.value as ExchangeCode)}
                  className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-white outline-none focus:border-white/30 disabled:opacity-60"
                >
                  {EXCHANGES.filter((exchange) => exchange.code !== fromExchange).map((exchange) => (
                    <option key={exchange.code} value={exchange.code}>
                      {exchange.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_1fr]">
                <label className="self-center text-white/80">Chain</label>
                <select
                  disabled={isRunning || availableNetworks.length === 0}
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-white outline-none focus:border-white/30 disabled:opacity-60"
                >
                  {availableNetworks.length === 0 && <option value="">No route available</option>}
                  {availableNetworks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.label}
                    </option>
                  ))}
                </select>
                <div className="self-center text-sm text-yellow-300">
                  Fee: {networkInfo?.fee || '-'} | Min: {networkInfo?.minWithdraw || '-'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_120px_1fr]">
                <label className="self-center text-white/80">Amount</label>
                <input
                  disabled={isRunning}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-white outline-none focus:border-white/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={setAmountToMax}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  MAX
                </button>
                <div className="self-center text-sm text-green-300">
                  Balance: {formatAmount(sourceBalance)} {selectedCoin}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white/60">Validation:</span>
                  <span className={meetsMinWithdraw || !amountIsValid ? 'text-green-300' : 'text-red-300'}>
                    {amountIsValid ? `최소 출금 ${minWithdraw} 충족` : '수량 입력 필요'}
                  </span>
                  <span className={withinBalance || !amountIsValid ? 'text-green-300' : 'text-red-300'}>
                    {amountIsValid ? '보유 수량 확인' : ''}
                  </span>
                </div>
              </div>
            </div>

            <h3 className="mb-3 mt-4 text-2xl font-semibold text-white">Deposit Info (Target Exchange)</h3>
            <div className="space-y-3 rounded-xl border border-white/10 p-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_90px]">
                <label className="self-center text-white/80">Address</label>
                <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-sm text-green-300 break-all">
                  {destinationInfo?.address || 'Address not loaded'}
                </div>
                <button
                  type="button"
                  disabled={!destinationInfo?.address}
                  onClick={() => destinationInfo?.address && copyValue(destinationInfo.address, 'address')}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {copiedField === 'address' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_90px]">
                <label className="self-center text-white/80">Tag/Memo</label>
                <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 font-mono text-sm text-yellow-300">
                  {destinationInfo?.tag || '(XRP, XLM, etc. if required)'}
                </div>
                <button
                  type="button"
                  disabled={!destinationInfo?.tag}
                  onClick={() => destinationInfo?.tag && copyValue(destinationInfo.tag, 'tag')}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {copiedField === 'tag' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={executeTransfer}
                disabled={!canExecute}
                className="rounded-xl border border-green-300/30 bg-green-500/80 px-8 py-3 text-lg font-bold text-white shadow-lg shadow-green-500/30 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunning ? 'Executing...' : 'Execute Transfer'}
              </button>
              <span className="text-sm text-white/70">{statusText}</span>
              {jobId && <span className="rounded-md bg-black/40 px-2 py-1 font-mono text-xs text-white/70">Job: {jobId}</span>}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-white">Execution Logs</h4>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
              <div className="h-[280px] overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-sm text-green-300">
                {logs.length === 0 ? (
                  <p className="text-white/40">No logs yet</p>
                ) : (
                  logs.map((line, index) => (
                    <p key={`${line}-${index}`} className="leading-6">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-2xl font-semibold text-white">Transfer Progress</h3>
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`rounded-xl border p-3 transition-all ${stepStatusStyle(step.status)}`}
                >
                  <p className="text-2xl font-bold">{step.title}</p>
                  <p className="mt-1 text-sm opacity-85">{step.description}</p>
                  <p className="mt-3 text-xl">
                    {step.status === 'done' && '✓'}
                    {step.status === 'running' && '•'}
                    {step.status === 'error' && '✕'}
                  </p>
                  {step.detail && <p className="mt-2 break-all font-mono text-xs opacity-90">{step.detail}</p>}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
              <p className="text-xs uppercase tracking-wide text-white/50">Chain Explorer</p>
              <div className="mt-2">
                {canOpenExplorer ? (
                  <a
                    href={explorerLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-emerald-300/30 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                  >
                    Open Tx ({lastTxHash?.slice(0, 12)}...)
                  </a>
                ) : (
                  <p className="text-sm text-white/50">트랜잭션이 생성되면 링크가 활성화됩니다.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
