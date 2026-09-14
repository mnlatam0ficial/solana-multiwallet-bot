import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { WalletData } from "../../types";
import { keypairFromPrivateKey } from "../01-wallet-generator";

export class Signer {
  /**
   * Carga un Keypair desde WalletData
   */
  static loadKeypair(wallet: WalletData): Keypair {
    return keypairFromPrivateKey(wallet.privateKey);
  }

  /**
   * Firma una transacción con una sola wallet
   */
  static async signTransaction(
    tx: Transaction,
    wallet: WalletData
  ): Promise<Transaction> {
    const keypair = this.loadKeypair(wallet);
    tx.partialSign(keypair);
    return tx;
  }

  /**
   * Construye una transacción simple de transferencia de SOL (ejemplo)
   * Reemplaza esto con tu lógica real de compra/venta (Jupiter, Raydium, etc.)
   */
  static buildSolTransfer(
    from: PublicKey,
    to: PublicKey,
    amountSol: number,
    recentBlockhash: string
  ): Transaction {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      })
    );
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = from;
    return tx;
  }

  /**
   * Firma en paralelo un array de transacciones
   */
  static async signAll(
    transactions: Transaction[],
    wallets: WalletData[]
  ): Promise<Transaction[]> {
    if (transactions.length !== wallets.length) {
      throw new Error("Número de transacciones y wallets no coincide");
    }

    return Promise.all(
      transactions.map((tx, i) => this.signTransaction(tx, wallets[i]))
    );
  }
}
