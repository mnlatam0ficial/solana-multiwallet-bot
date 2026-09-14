import {
  Connection,
  PublicKey,
  Transaction,
  SendOptions,
  Commitment,
} from "@solana/web3.js";

export class RpcClient {
  public connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60_000,
    });
  }

  async getBalance(publicKey: string): Promise<number> {
    const lamports = await this.connection.getBalance(new PublicKey(publicKey));
    return lamports / 1e9;
  }

  async getBalances(publicKeys: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    // Batch en chunks de 100 para no saturar
    const chunkSize = 100;
    for (let i = 0; i < publicKeys.length; i += chunkSize) {
      const chunk = publicKeys.slice(i, i + chunkSize);
      const balances = await Promise.all(
        chunk.map(async (pk) => {
          try {
            const bal = await this.getBalance(pk);
            return { pk, bal };
          } catch {
            return { pk, bal: -1 };
          }
        })
      );
      balances.forEach(({ pk, bal }) => results.set(pk, bal));
    }
    return results;
  }

  async getLatestBlockhash(commitment: Commitment = "confirmed") {
    return this.connection.getLatestBlockhash(commitment);
  }

  async sendRawTransaction(
    rawTx: Buffer | Uint8Array,
    options?: SendOptions
  ): Promise<string> {
    return this.connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
      ...options,
    });
  }

  async confirmTransaction(signature: string, commitment: Commitment = "confirmed") {
    return this.connection.confirmTransaction(signature, commitment);
  }

  async getSlot(): Promise<number> {
    return this.connection.getSlot();
  }
}
