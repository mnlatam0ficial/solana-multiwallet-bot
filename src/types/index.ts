export interface WalletData {
  index: number;
  publicKey: string;
  privateKey: string; // base58
  path: string;
}

export interface EncryptedStore {
  salt: string;
  iv: string;
  ciphertext: string;
  tag: string;
  version: number;
  count: number;
}

export interface BalanceInfo {
  publicKey: string;
  sol: number;
  index: number;
}

export type OperationType = "buy" | "sell" | "transfer" | "freeze";

export interface CoordinatorResult {
  success: boolean;
  signatures: string[];
  failed: { index: number; error: string }[];
  slot?: number;
}
