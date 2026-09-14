import { Transaction } from "@solana/web3.js";
import { RpcClient } from "../03-rpc-client";
import { Signer } from "../04-signer";
import { KeyStore } from "../02-key-store";
import { WalletData, CoordinatorResult } from "../../types";

export class Coordinator {
  constructor(
    private rpc: RpcClient,
    private keyStore: KeyStore
  ) {}

  /**
   * Ejecuta una operación coordinada con todas (o un subset) de las wallets.
   * Ejemplo: transferencias, o cualquier set de instrucciones que construyas.
   *
   * @param buildTxFn Función que recibe (wallet, blockhash) y devuelve la Transaction lista
   */
  async executeParallel(
    buildTxFn: (wallet: WalletData, blockhash: string) => Transaction,
    walletFilter?: (w: WalletData) => boolean
  ): Promise<CoordinatorResult> {
    const allWallets = this.keyStore.getWallets();
    const wallets = walletFilter ? allWallets.filter(walletFilter) : allWallets;

    if (wallets.length === 0) {
      return { success: false, signatures: [], failed: [{ index: -1, error: "No wallets" }] };
    }

    // 1. Obtener un blockhash fresco (compartido para maximizar chance de mismo slot)
    const { blockhash, lastValidBlockHeight } = await this.rpc.getLatestBlockhash("processed");

    // 2. Construir N transacciones
    const transactions = wallets.map((w) => buildTxFn(w, blockhash));

    // 3. Firmar en paralelo
    const signedTxs = await Signer.signAll(transactions, wallets);

    // 4. Enviar lo más rápido posible
    const signatures: string[] = [];
    const failed: { index: number; error: string }[] = [];

    const sendPromises = signedTxs.map(async (tx, i) => {
      try {
        const raw = tx.serialize();
        const sig = await this.rpc.sendRawTransaction(raw, {
          skipPreflight: true, // más rápido, menos seguro
          maxRetries: 2,
        });
        signatures.push(sig);
        return { index: wallets[i].index, sig };
      } catch (err: any) {
        failed.push({
          index: wallets[i].index,
          error: err?.message || String(err),
        });
        return null;
      }
    });

    await Promise.all(sendPromises);

    // 5. (Opcional) monitorear confirmaciones de las que sí salieron
    // Por simplicidad aquí solo devolvemos los resultados inmediatos

    return {
      success: failed.length === 0,
      signatures,
      failed,
    };
  }

  /**
   * Ejemplo de uso: transferir SOL desde todas las wallets a una dirección destino
   */
  async exampleTransferAll(toAddress: string, amountSol: number): Promise<CoordinatorResult> {
    const { PublicKey } = await import("@solana/web3.js");
    const to = new PublicKey(toAddress);

    return this.executeParallel((wallet, blockhash) => {
      const from = new PublicKey(wallet.publicKey);
      return Signer.buildSolTransfer(from, to, amountSol, blockhash);
    });
  }
}
