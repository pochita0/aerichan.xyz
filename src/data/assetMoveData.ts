export type ExchangeCode = 'BINANCE' | 'BITHUMB' | 'UPBIT' | 'GATE' | 'OKX' | 'BYBIT';

export interface ExchangeOption {
  code: ExchangeCode;
  label: string;
}

export interface AddressEntry {
  address: string;
  tag?: string;
}

export interface NetworkOption {
  id: string;
  label: string;
  fee: string;
  minWithdraw: string;
  explorerUrl: string;
  from: ExchangeCode[];
  to: ExchangeCode[];
}

export interface CoinMeta {
  symbol: string;
  name: string;
  networks: NetworkOption[];
}

export const EXCHANGES: ExchangeOption[] = [
  { code: 'BINANCE', label: 'Binance' },
  { code: 'BITHUMB', label: 'Bithumb' },
  { code: 'UPBIT', label: 'Upbit' },
  { code: 'GATE', label: 'Gate' },
  { code: 'OKX', label: 'OKX' },
  { code: 'BYBIT', label: 'Bybit' },
];

export const DEPOSIT_ADDRESS_BOOK: Record<ExchangeCode, Record<string, AddressEntry>> = {
  BINANCE: {
    BSC: { address: '0x414349c13c165454decec1a8c901c41d62fe66c0' },
    TRON: { address: 'TDCBWWAaHHkFsdWnzSx13jDieDLJ1YFwwn' },
    APTOS: { address: '0x887a181e54acff58e0bae9ea9a9fb9aaae23af21dd9b371c9122025f3f5c8500' },
    KAIA: { address: '0x414349c13c165454decec1a8c901c41d62fe66c0' },
  },
  BITHUMB: {
    TRON: { address: 'TUFj3rEksz7JcAYnxVVaDg7S5y4FaVC3ED' },
    KAIA: { address: '0xd2e750f57f477c0944db40b6dfb460083be43924' },
    APTOS: { address: '0x649f5fd5cf7d662f298c9f297ec9b61cbe32f405517e2990f8140444c5e583b3' },
  },
  UPBIT: {
    APTOS: { address: '0xa2c9be79ee95e4d34a5827de781f370f2e6c2f6fb529f511d207a7795ba80846' },
    KAIA: { address: '0x1fe5a41f983bbf41f8b6a53af07ec98c34a767ea' },
    ETH: { address: '0x1fe5a41f983bbf41f8b6a53af07ec98c34a767ea' },
    TRON: { address: 'TFx22vUvrDsrJBMmsPpba25ktMnwsEHGYr' },
  },
  GATE: {
    BSC: { address: '0x0D1DAf9D6D7F502584c7251DAb595A321b19a00c' },
    TRON: { address: 'TBAZMAvhHGZL1khhckYer81Fc5phS8vvXX' },
    APTOS: { address: '0x8c24bc2e93051d9ef69ef3c905db6eef91747bd0ed5b3102789e0a3044d02c92' },
  },
  OKX: {
    TRON: { address: 'TLWk6qXHptQqXF1gUJTh8EwdzGC9Y4nRi2' },
    APTOS: { address: '0x95fcd8030d321ed10d65dfb9632e7d67fa7f635d5e8ebcb852a3a791b8954424' },
  },
  BYBIT: {
    TRON: { address: 'TLRPtPM7UYp8MszAiUh4sSRbuMVRdnkxN8' },
    APTOS: { address: '0x76bb20f88d2e7e2c5028d8e9b71ab2a7c44c4a6a8713ddd724aed4a3f8fc2969' },
    BSC: { address: '0x8e1703b42c662cdf8460af3735351ab2a3711e67' },
  },
};

const allFromExchanges: ExchangeCode[] = EXCHANGES.map((exchange) => exchange.code);

const addressToExchanges = (chain: string): ExchangeCode[] => {
  return EXCHANGES
    .map((exchange) => exchange.code)
    .filter((exchangeCode) => !!DEPOSIT_ADDRESS_BOOK[exchangeCode][chain]);
};

export const COINS: CoinMeta[] = [
  {
    symbol: 'USDT',
    name: 'Tether',
    networks: [
      {
        id: 'TRON',
        label: 'Tron / TRC20',
        fee: '1.0 USDT',
        minWithdraw: '10',
        explorerUrl: 'https://tronscan.org/#/transaction/',
        from: allFromExchanges,
        to: addressToExchanges('TRON'),
      },
      {
        id: 'BSC',
        label: 'BNB Smart Chain / BEP20',
        fee: '0.20 USDT',
        minWithdraw: '10',
        explorerUrl: 'https://bscscan.com/tx/',
        from: allFromExchanges,
        to: addressToExchanges('BSC'),
      },
      {
        id: 'APTOS',
        label: 'Aptos',
        fee: '0.10 USDT',
        minWithdraw: '5',
        explorerUrl: 'https://explorer.aptoslabs.com/txn/',
        from: allFromExchanges,
        to: addressToExchanges('APTOS'),
      },
      {
        id: 'KAIA',
        label: 'Kaia',
        fee: '0.01 USDT',
        minWithdraw: '3',
        explorerUrl: 'https://kaiascan.io/tx/',
        from: allFromExchanges,
        to: addressToExchanges('KAIA'),
      },
      {
        id: 'ETH',
        label: 'Ethereum / ERC20',
        fee: '2.5 USDT',
        minWithdraw: '10',
        explorerUrl: 'https://etherscan.io/tx/',
        from: allFromExchanges,
        to: addressToExchanges('ETH'),
      },
    ],
  },
];

export const INITIAL_BALANCES: Record<ExchangeCode, Record<string, number>> = {
  BINANCE: { USDT: 1524.8838 },
  BITHUMB: { USDT: 763.1145 },
  UPBIT: { USDT: 238.9012 },
  GATE: { USDT: 996.2157 },
  OKX: { USDT: 341.4431 },
  BYBIT: { USDT: 521.911 },
};

export const TRANSFER_STEP_TEMPLATE = [
  { id: 'withdraw_start', title: '1. Withdrawal Start', description: '출금 요청' },
  { id: 'withdraw_processing', title: '2. Withdrawal Processing', description: '출금 기록 조회 중' },
  { id: 'withdraw_success', title: '3. Withdrawal Success', description: '출금 기록 확인' },
  { id: 'sending', title: '4. Sending', description: '블록체인 전송 중' },
  { id: 'deposit_processing', title: '5. Deposit Processing', description: '입금 확인 중' },
  { id: 'deposit_success', title: '6. Deposit Success', description: '입금 완료' },
] as const;
