export const STAMPS_PER_REWARD = Number(process.env.NEXT_PUBLIC_REWARD_THRESHOLD || 8);
export const QR_PREFIX = 'stampcard:address:';
export const NATIVE_SYMBOL = process.env.NEXT_PUBLIC_NATIVE_TOKEN_SYMBOL || 'ETH';
export const STAMP_TOKEN_SYMBOL = 'STAMP';
export const BREW_TOKEN_SYMBOL = 'BWT';
export const MERCHANT_API_ROUTE_KEY = 'Authorization';
export const MERCHANT_WALLET_ADDRESS = (process.env.NEXT_PUBLIC_MERCHANT_WALLET || '').toLowerCase();
export const LOYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LOYALTY_ADDRESS || '';

