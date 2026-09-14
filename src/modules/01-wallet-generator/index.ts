import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { WalletData } from "../../types";

/**
 * Genera N wallets usando BIP39 + BIP44 path de Solana.
 * Path estándar Solana: m/44'/501'/index'/0'
 */
export function generateWallets(count: number, mnemonic?: string): {
  mnemonic: string;
  wallets: WalletData[];
} {
  if (count < 1 || count > 500) {
    throw new Error("Count must be between 1 and 500");
  }

  const seedPhrase = mnemonic || bip39.generateMnemonic(256); // 24 words
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error("Invalid mnemonic");
  }

  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const wallets: WalletData[] = [];

  for (let i = 0; i < count; i++) {
    const path = `m/44'/501'/${i}'/0'`;
    const derived = derivePath(path, seed.toString("hex"));
    const keypair = Keypair.fromSeed(derived.key);

    wallets.push({
      index: i,
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
      path,
    });
  }

  return { mnemonic: seedPhrase, wallets };
}

/**
 * Restaura una sola wallet desde private key base58
 */
export function keypairFromPrivateKey(privateKeyBase58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
}
