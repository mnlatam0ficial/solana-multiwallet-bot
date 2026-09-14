/**
 * Uso:
 *   npx ts-node scripts/encrypt-store.ts
 *
 * Lee data/wallets.raw.json y crea data/wallets.enc (AES-256-GCM)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { keyStore } from "../src/modules/02-key-store";
import { WalletData } from "../src/types";

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const rawPath = path.join(process.cwd(), "data", "wallets.raw.json");
  if (!fs.existsSync(rawPath)) {
    console.error("❌ No existe data/wallets.raw.json. Ejecuta primero generate-wallets");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const wallets: WalletData[] = raw.wallets;

  console.log(`Se van a encriptar ${wallets.length} wallets.`);
  const password = await ask("Contraseña maestra (mínimo 12 caracteres): ");

  if (password.length < 12) {
    console.error("Contraseña demasiado corta");
    process.exit(1);
  }

  const confirm = await ask("Confirma la contraseña: ");
  if (password !== confirm) {
    console.error("No coinciden");
    process.exit(1);
  }

  keyStore.save(wallets, password);

  console.log("\n✅ Almacén encriptado creado en data/wallets.enc");
  console.log("⚠️  Ahora BORRA data/wallets.raw.json y el mnemonic de cualquier sitio inseguro.");
  console.log("   Guarda el mnemonic en un papel o gestor de contraseñas offline.");
}

main().catch(console.error);
