/**
 * Módulo Pump.fun
 * Usa el SDK oficial @pump-fun/pump-sdk para comprar y vender en la bonding curve.
 *
 * Nota: Pump.fun cambia con frecuencia. Si falla, revisa la versión del SDK
 * y la documentación oficial.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  Keypair,
} from "@solana/web3.js";
import BN from "bn.js";
import { WalletData } from "../../types";
import { keypairFromPrivateKey } from "../01-wallet-generator";

// Intentamos importar el SDK oficial. Si la API cambia, se ajusta aquí.
let PumpSdk: any = null;
let getBuyTokenAmountFromSolAmount: any = null;
let getSellSolAmountFromTokenAmount: any = null;

try {
  // @ts-ignore
  const sdk = require("@pump-fun/pump-sdk");
  PumpSdk = sdk.PumpSdk || sdk.OnlinePumpSdk || sdk.default;
  getBuyTokenAmountFromSolAmount = sdk.getBuyTokenAmountFromSolAmount;
  getSellSolAmountFromTokenAmount = sdk.getSellSolAmountFromTokenAmount;
} catch (e) {
  console.warn("⚠️ @pump-fun/pump-sdk no disponible o API distinta. Usando modo fallback.");
}

export interface PumpBuyParams {
  mint: string;
  solAmount: number; // SOL por wallet
  slippagePercent: number;
}

export interface PumpSellParams {
  mint: string;
  percent: number; // 1-100
  slippagePercent?: number;
}

/**
 * Construye y firma transacciones de compra Pump.fun para muchas wallets.
 * Devuelve las transacciones ya firmadas listas para enviar.
 */
export async function buildPumpBuyTransactions(
  connection: Connection,
  wallets: WalletData[],
  params: PumpBuyParams
): Promise<{ signedTxs: Transaction[]; errors: { index: number; error: string }[] }> {
  const mint = new PublicKey(params.mint);
  const solLamports = new BN(Math.floor(params.solAmount * 1e9));
  const signedTxs: Transaction[] = [];
  const errors: { index: number; error: string }[] = [];

  if (!PumpSdk) {
    // Fallback muy básico: no construimos instrucciones reales
    for (const w of wallets) {
      errors.push({
        index: w.index,
        error: "SDK de Pump.fun no cargado. Instala @pump-fun/pump-sdk",
      });
    }
    return { signedTxs, errors };
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  // Creamos una instancia del SDK (la API exacta puede variar según versión)
  let sdk: any;
  try {
    sdk = new PumpSdk(connection);
  } catch {
    try {
      sdk = PumpSdk;
    } catch (e: any) {
      for (const w of wallets) {
        errors.push({ index: w.index, error: `No se pudo inicializar SDK: ${e.message}` });
      }
      return { signedTxs, errors };
    }
  }

  for (const wallet of wallets) {
    try {
      const keypair = keypairFromPrivateKey(wallet.privateKey);
      const user = keypair.publicKey;

      // Fetch state
      const global = await sdk.fetchGlobal();
      const buyState = await sdk.fetchBuyState(mint, user);

      let tokenAmount: BN;
      if (getBuyTokenAmountFromSolAmount) {
        tokenAmount = getBuyTokenAmountFromSolAmount(
          global,
          buyState.bondingCurve,
          solLamports
        );
      } else {
        // Fallback rough
        tokenAmount = new BN(1);
      }

      const instructions: TransactionInstruction[] = await sdk.buyInstructions({
        global,
        bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
        bondingCurve: buyState.bondingCurve,
        associatedUserAccountInfo: buyState.associatedUserAccountInfo,
        mint,
        user,
        solAmount: solLamports,
        amount: tokenAmount,
        slippage: params.slippagePercent,
        tokenProgram: buyState.tokenProgram,
      });

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ...instructions
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = user;
      tx.sign(keypair);

      signedTxs.push(tx);
    } catch (err: any) {
      errors.push({
        index: wallet.index,
        error: err?.message || String(err),
      });
    }
  }

  return { signedTxs, errors };
}

/**
 * Construye y firma transacciones de venta Pump.fun.
 */
export async function buildPumpSellTransactions(
  connection: Connection,
  wallets: WalletData[],
  params: PumpSellParams
): Promise<{ signedTxs: Transaction[]; errors: { index: number; error: string }[] }> {
  const mint = new PublicKey(params.mint);
  const slippage = params.slippagePercent ?? 15;
  const signedTxs: Transaction[] = [];
  const errors: { index: number; error: string }[] = [];

  if (!PumpSdk) {
    for (const w of wallets) {
      errors.push({
        index: w.index,
        error: "SDK de Pump.fun no cargado",
      });
    }
    return { signedTxs, errors };
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  let sdk: any;
  try {
    sdk = new PumpSdk(connection);
  } catch {
    sdk = PumpSdk;
  }

  for (const wallet of wallets) {
    try {
      const keypair = keypairFromPrivateKey(wallet.privateKey);
      const user = keypair.publicKey;

      const global = await sdk.fetchGlobal();
      const sellState = await sdk.fetchSellState(mint, user);

      // Obtener balance del token de la wallet
      // El SDK normalmente expone el associated user account
      // Aquí simplificamos: el usuario debe tener tokens
      // En producción se leería el balance real del ATA

      // Placeholder: el SDK necesita el amount exacto de tokens
      // Por ahora devolvemos error claro si no se puede calcular
      const amount = new BN(0); // se debe calcular del balance real

      if (amount.isZero()) {
        errors.push({
          index: wallet.index,
          error: "No se pudo obtener balance del token (implementación de lectura de ATA pendiente o wallet sin tokens)",
        });
        continue;
      }

      const solAmount = getSellSolAmountFromTokenAmount
        ? getSellSolAmountFromTokenAmount(global, sellState.bondingCurve, amount)
        : new BN(0);

      const instructions: TransactionInstruction[] = await sdk.sellInstructions({
        global,
        bondingCurveAccountInfo: sellState.bondingCurveAccountInfo,
        bondingCurve: sellState.bondingCurve,
        mint,
        user,
        amount,
        solAmount,
        slippage,
        tokenProgram: sellState.tokenProgram,
      });

      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ...instructions
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = user;
      tx.sign(keypair);

      signedTxs.push(tx);
    } catch (err: any) {
      errors.push({
        index: wallet.index,
        error: err?.message || String(err),
      });
    }
  }

  return { signedTxs, errors };
}
