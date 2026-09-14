import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { RpcClient } from "../03-rpc-client";
import { KeyStore } from "../02-key-store";
import { Coordinator } from "../05-coordinator";
import { registerCommands } from "./commands";

export function createBot(
  token: string,
  rpc: RpcClient,
  keyStore: KeyStore,
  adminChatId: number
) {
  const bot = new Telegraf(token);
  const coordinator = new Coordinator(rpc, keyStore);

  // Middleware: solo el admin puede usar comandos
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id !== adminChatId) {
      await ctx.reply("⛔ No autorizado");
      return;
    }
    return next();
  });

  registerCommands(bot, rpc, keyStore, coordinator);

  bot.catch((err, ctx) => {
    console.error(`Error en update ${ctx.updateType}:`, err);
    ctx.reply("❌ Ocurrió un error interno").catch(() => {});
  });

  return bot;
}
