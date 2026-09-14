import "dotenv/config";
import chalk from "chalk";
import { RpcClient } from "./modules/03-rpc-client";
import { keyStore } from "./modules/02-key-store";
import { createBot } from "./modules/06-telegram-bot";

async function main() {
  console.log(chalk.cyan("🚀 Solana Multi-Wallet Bot"));

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const rpcUrl = process.env.RPC_URL;
  const masterPassword = process.env.MASTER_PASSWORD;
  const adminChatId = Number(process.env.ADMIN_CHAT_ID);

  if (!token || !rpcUrl || !masterPassword || !adminChatId) {
    console.error(chalk.red("❌ Faltan variables de entorno. Copia .env.example → .env y completa."));
    process.exit(1);
  }

  // 1. Cargar y desencriptar wallets
  try {
    keyStore.load(masterPassword);
  } catch (err: any) {
    console.error(chalk.red(`❌ Error cargando almacén: ${err.message}`));
    process.exit(1);
  }

  const wallets = keyStore.getWallets();
  console.log(chalk.green(`✅ ${wallets.length} wallets cargadas en memoria`));

  // 2. RPC
  const rpc = new RpcClient(rpcUrl);
  const slot = await rpc.getSlot();
  console.log(chalk.green(`✅ RPC conectado — slot actual: ${slot}`));

  // 3. Bot
  const bot = createBot(token, rpc, keyStore, adminChatId);

  console.log(chalk.cyan("🤖 Bot de Telegram iniciado..."));
  await bot.launch();

  // Graceful shutdown
  process.once("SIGINT", () => {
    keyStore.clear();
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    keyStore.clear();
    bot.stop("SIGTERM");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
