/**
 * Uso:
 *   npx ts-node scripts/generate-wallets.ts --count 50
 *
 * Genera 50 wallets y las guarda temporalmente en data/wallets.raw.json
 * (luego debes encriptarlas con encrypt-store)
 */

import * as fs from "fs";
import * as path from "path";
import { generateWallets } from "../src/modules/01-wallet-generator";

const args = process.argv.slice(2);
const countIdx = args.indexOf("--count");
const count = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 50;

if (isNaN(count) || count < 1) {
  console.error("Uso: --count <número>");
  process.exit(1);
}

console.log(`Generando ${count} wallets...`);

const { mnemonic, wallets } = generateWallets(count);

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const rawPath = path.join(dataDir, "wallets.raw.json");
fs.writeFileSync(
  rawPath,
  JSON.stringify({ mnemonic, wallets }, null, 2)
);

console.log(`✅ Generadas ${wallets.length} wallets`);
console.log(`📄 Guardado temporal en: ${rawPath}`);
console.log(`\n⚠️  IMPORTANTE:`);
console.log(`   1. Guarda el mnemonic en un lugar SEGURO (offline).`);
console.log(`   2. Ejecuta: npm run encrypt-store`);
console.log(`   3. BORRA wallets.raw.json después de encriptar.`);
console.log(`\nMnemonic (guárdalo offline):\n${mnemonic}`);
