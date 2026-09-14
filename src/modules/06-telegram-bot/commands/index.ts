import { Telegraf, Markup } from "telegraf";
import { RpcClient } from "../../03-rpc-client";
import { KeyStore } from "../../02-key-store";
import { Coordinator } from "../../05-coordinator";
import { PublicKey } from "@solana/web3.js";

// Estado simple en memoria por chat (suficiente para un solo admin)
const userState = new Map<number, { step: string; data: Record<string, any> }>();

function getState(chatId: number) {
  if (!userState.has(chatId)) {
    userState.set(chatId, { step: "idle", data: {} });
  }
  return userState.get(chatId)!;
}

function clearState(chatId: number) {
  userState.set(chatId, { step: "idle", data: {} });
}

export function registerCommands(
  bot: Telegraf,
  rpc: RpcClient,
  keyStore: KeyStore,
  coordinator: Coordinator
) {
  // ─────────────────────────────────────────────
  // /start — Menú principal con botones
  // ─────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    clearState(ctx.chat.id);

    const walletsLoaded = keyStore.getWallets().length > 0;

    await ctx.reply(
      `🤖 *Multi-Wallet Bot Solana*\n\n` +
        `Todo el uso diario se hace *desde tu celular* con estos botones.\n\n` +
        `*Estado actual:*\n` +
        `• Wallets cargadas: ${walletsLoaded ? `✅ ${keyStore.getWallets().length}` : "❌ Ninguna"}\n` +
        `• RPC: ${process.env.RPC_URL ? "✅ Configurado" : "❌ Falta"}\n\n` +
        `Elige una opción:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📖 Cómo configurar (solo 1 vez)", "help_setup")],
          [Markup.button.callback("📊 Ver saldos", "cmd_saldos")],
          [Markup.button.callback("💸 Transferir SOL", "cmd_transferir")],
          [Markup.button.callback("🛒 Comprar (interactivo)", "cmd_comprar")],
          [Markup.button.callback("💰 Vender (interactivo)", "cmd_vender")],
          [Markup.button.callback("❄️ Congelar cuenta", "cmd_congelar")],
          [Markup.button.callback("⚙️ Estado del bot", "cmd_status")],
        ]),
      }
    );
  });

  // ─────────────────────────────────────────────
  // Explicación completa de configuración
  // ─────────────────────────────────────────────
  bot.action("help_setup", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      `📖 *Configuración (solo se hace 1 vez)*\n\n` +
        `⚠️ *Importante:*\n` +
        `La instalación y generación de wallets se hace *una sola vez* en una computadora o VPS.\n` +
        `Después de eso, *todo el uso diario es solo desde tu celular* con los botones de este bot.\n\n` +
        `────────────────────\n` +
        `*Paso 1 — Crear el bot (desde el celular)*\n` +
        `• Abre Telegram → busca *@BotFather*\n` +
        `• Escribe /newbot y sigue los pasos\n` +
        `• Copia el token (ejemplo: 7123456789:AAH...)\n\n` +
        `*Paso 2 — Saber tu Chat ID (desde el celular)*\n` +
        `• Busca *@userinfobot* o *@getidsbot*\n` +
        `• Inicia el chat y te da tu número de ID\n\n` +
        `*Paso 3 — RPC de Solana*\n` +
        `• Entra a https://helius.dev (o quicknode.com) desde el navegador del celular o PC\n` +
        `• Crea cuenta gratis → genera endpoint Mainnet\n` +
        `• Copia la URL del RPC\n\n` +
        `*Paso 4 — Instalar y generar wallets (necesitas PC o VPS)*\n` +
        `En una computadora o servidor:\n` +
        `1. Descomprime el proyecto\n` +
        `2. npm install\n` +
        `3. Copia .env.example → .env y pega:\n` +
        `   - TELEGRAM_BOT_TOKEN\n` +
        `   - ADMIN_CHAT_ID\n` +
        `   - RPC_URL\n` +
        `   - MASTER_PASSWORD (contraseña fuerte)\n` +
        `4. Ejecuta:\n` +
        `\`\`\`\nnpm run generate-wallets -- --count 50\nnpm run encrypt-store\nrm data/wallets.raw.json\n\`\`\`\n` +
        `5. Guarda el mnemonic de 24 palabras en un papel\n` +
        `6. Arranca el bot: npm run dev\n\n` +
        `────────────────────\n` +
        `✅ *Una vez que el bot esté corriendo*\n` +
        `Ya no necesitas la computadora.\n` +
        `Abres Telegram en el celular → /start → usas solo los botones.\n\n` +
        `Todo (saldos, comprar, vender, transferir) se hace desde aquí.`,
      { parse_mode: "Markdown" }
    );
  });

  // ─────────────────────────────────────────────
  // /saldos y botón
  // ─────────────────────────────────────────────
  const handleSaldos = async (ctx: any) => {
    await ctx.reply("⏳ Consultando balances de las wallets...");
    try {
      const wallets = keyStore.getWallets();
      if (wallets.length === 0) {
        return ctx.reply("❌ No hay wallets cargadas. Revisa la configuración.");
      }

      const balances = await rpc.getBalances(wallets.map((w) => w.publicKey));
      let total = 0;
      let text = `📊 *Balances (${wallets.length} wallets)*\n\n`;

      wallets.forEach((w) => {
        const sol = balances.get(w.publicKey) ?? 0;
        if (sol > 0) total += sol;
        text += `\`${w.index.toString().padStart(2, "0")}\` \`${w.publicKey.slice(0, 4)}...${w.publicKey.slice(-4)}\` → *${sol.toFixed(4)} SOL*\n`;
      });

      text += `\n💰 *Total: ${total.toFixed(4)} SOL*`;

      if (text.length > 4000) {
        await ctx.reply(`💰 Total aproximado: *${total.toFixed(4)} SOL*\n(Hay demasiadas wallets para mostrar todas)`, {
          parse_mode: "Markdown",
        });
      } else {
        await ctx.reply(text, { parse_mode: "Markdown" });
      }
    } catch (err: any) {
      await ctx.reply(`❌ Error al consultar: ${err.message}`);
    }
  };

  bot.command("saldos", handleSaldos);
  bot.action("cmd_saldos", async (ctx) => {
    await ctx.answerCbQuery();
    await handleSaldos(ctx);
  });

  // ─────────────────────────────────────────────
  // /status
  // ─────────────────────────────────────────────
  bot.action("cmd_status", async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const wallets = keyStore.getWallets();
      const slot = await rpc.getSlot();
      await ctx.reply(
        `✅ *Bot activo*\n\n` +
          `• Wallets cargadas: ${wallets.length}\n` +
          `• Slot actual: \`${slot}\`\n` +
          `• RPC: configurado`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });

  // ─────────────────────────────────────────────
  // Transferir SOL — flujo interactivo con botones
  // ─────────────────────────────────────────────
  bot.action("cmd_transferir", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    state.step = "transfer_address";
    state.data = {};

    await ctx.reply(
      `💸 *Transferir SOL desde todas las wallets*\n\n` +
        `Paso 1/2: Envíame la *dirección de destino* (public key de Solana).\n\n` +
        `Ejemplo:\n\`7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\``,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
      }
    );
  });

  // ─────────────────────────────────────────────
  // Comprar — flujo interactivo
  // ─────────────────────────────────────────────
  bot.action("cmd_comprar", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    state.step = "buy_mint";
    state.data = {};

    await ctx.reply(
      `🛒 *Comprar token con todas las wallets*\n\n` +
        `Te voy a pedir los datos uno por uno.\n\n` +
        `*Paso 1/3:* Envíame la *dirección del mint* del token que quieres comprar.\n\n` +
        `¿Dónde consigo el mint?\n` +
        `• En Solscan, Birdeye o el propio Pump.fun / Raydium\n` +
        `• Se ve así: \`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\` (ejemplo USDC)\n\n` +
        `Pégalo ahora:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
      }
    );
  });

  // ─────────────────────────────────────────────
  // Vender — flujo interactivo
  // ─────────────────────────────────────────────
  bot.action("cmd_vender", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    state.step = "sell_mint";
    state.data = {};

    await ctx.reply(
      `💰 *Vender token desde todas las wallets*\n\n` +
        `*Paso 1/2:* Envíame la *dirección del mint* del token que quieres vender.\n\n` +
        `Luego te pediré si quieres vender el 100% o un porcentaje.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
      }
    );
  });

  // ─────────────────────────────────────────────
  // Congelar
  // ─────────────────────────────────────────────
  bot.action("cmd_congelar", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      `❄️ *Congelar cuenta (freezeAuthority)*\n\n` +
        `Esta función solo funciona si *una de tus wallets* es el \`freezeAuthority\` del mint.\n\n` +
        `*Cómo se usa normalmente:*\n` +
        `1. Creas un token SPL y te quedas con el freeze authority\n` +
        `2. Puedes congelar cuentas de usuarios que tengan ese token\n\n` +
        `Si quieres que lo implemente completo, dime y lo agrego (necesito que me confirmes que tienes el freeze authority).\n\n` +
        `Por ahora es solo informativo.`,
      { parse_mode: "Markdown" }
    );
  });

  // ─────────────────────────────────────────────
  // Cancelar cualquier flujo
  // ─────────────────────────────────────────────
  bot.action("cancel", async (ctx) => {
    await ctx.answerCbQuery();
    clearState(ctx.chat!.id);
    await ctx.reply("✅ Operación cancelada. Usa /start para volver al menú.");
  });

  // ─────────────────────────────────────────────
  // Handler de texto (para los flujos interactivos)
  // ─────────────────────────────────────────────
  bot.on("text", async (ctx) => {
    const chatId = ctx.chat.id;
    const state = getState(chatId);
    const text = ctx.message.text.trim();

    // Ignorar si es un comando
    if (text.startsWith("/")) return;

    // ——— Transferir ———
    if (state.step === "transfer_address") {
      try {
        new PublicKey(text);
        state.data.address = text;
        state.step = "transfer_amount";

        await ctx.reply(
          `✅ Dirección válida.\n\n*Paso 2/2:* ¿Cuántos SOL quieres enviar *desde cada wallet*?\n\n` +
            `Ejemplo: \`0.01\``,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
          }
        );
      } catch {
        await ctx.reply("❌ Dirección inválida. Envíame una public key de Solana correcta.");
      }
      return;
    }

    if (state.step === "transfer_amount") {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Monto inválido. Escribe un número mayor a 0 (ej: 0.01)");
      }

      state.data.amount = amount;
      state.step = "transfer_confirm";

      await ctx.reply(
        `⚠️ *Confirmación*\n\n` +
          `Vas a enviar *${amount} SOL* desde *cada una* de las wallets\n` +
          `hacia:\n\`${state.data.address}\`\n\n` +
          `¿Confirmas?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("✅ Sí, enviar", "confirm_transfer"),
              Markup.button.callback("❌ Cancelar", "cancel"),
            ],
          ]),
        }
      );
      return;
    }

    // ——— Comprar ———
    if (state.step === "buy_mint") {
      try {
        new PublicKey(text);
        state.data.mint = text;
        state.step = "buy_amount";

        await ctx.reply(
          `✅ Mint válido.\n\n*Paso 2/3:* ¿Cuántos SOL quieres gastar *por cada wallet*?\n\n` +
            `Ejemplo: \`0.05\``,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
          }
        );
      } catch {
        await ctx.reply("❌ Mint inválido. Debe ser una dirección de Solana válida.");
      }
      return;
    }

    if (state.step === "buy_amount") {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Monto inválido. Ejemplo: 0.05");
      }
      state.data.amount = amount;
      state.step = "buy_slippage";

      await ctx.reply(
        `*Paso 3/3:* ¿Qué slippage toleras? (en %)\n\n` +
          `Recomendado para tokens nuevos: 10-25\n` +
          `Ejemplo: \`15\``,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
        }
      );
      return;
    }

    if (state.step === "buy_slippage") {
      const slippage = parseFloat(text);
      if (isNaN(slippage) || slippage < 0 || slippage > 100) {
        return ctx.reply("❌ Slippage inválido. Pon un número entre 0 y 100.");
      }
      state.data.slippage = slippage;
      state.step = "buy_confirm";

      await ctx.reply(
        `⚠️ *Resumen de compra*\n\n` +
          `• Mint: \`${state.data.mint}\`\n` +
          `• SOL por wallet: *${state.data.amount}*\n` +
          `• Slippage: *${slippage}%*\n` +
          `• Wallets que participarán: ${keyStore.getWallets().length}\n\n` +
          `⚠️ *Importante:* La lógica real de swap (Jupiter/Raydium/Pump) todavía es un placeholder.\n` +
          `El bot recolectó todos los datos. Para que ejecute de verdad necesitas (o me pides) implementar el builder de la transacción.\n\n` +
          `¿Quieres que intente ejecutarlo de todas formas (modo prueba)?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("✅ Ejecutar (placeholder)", "confirm_buy"),
              Markup.button.callback("❌ Cancelar", "cancel"),
            ],
          ]),
        }
      );
      return;
    }

    // ——— Vender ———
    if (state.step === "sell_mint") {
      try {
        new PublicKey(text);
        state.data.mint = text;
        state.step = "sell_percent";

        await ctx.reply(
          `✅ Mint válido.\n\n*Paso 2/2:* ¿Qué porcentaje del balance del token quieres vender en cada wallet?\n\n` +
            `Ejemplo: \`100\` (todo) o \`50\` (mitad)`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel")]]),
          }
        );
      } catch {
        await ctx.reply("❌ Mint inválido.");
      }
      return;
    }

    if (state.step === "sell_percent") {
      const percent = parseFloat(text);
      if (isNaN(percent) || percent <= 0 || percent > 100) {
        return ctx.reply("❌ Porcentaje inválido (1-100).");
      }
      state.data.percent = percent;
      state.step = "sell_confirm";

      await ctx.reply(
        `⚠️ *Resumen de venta*\n\n` +
          `• Mint: \`${state.data.mint}\`\n` +
          `• Porcentaje: *${percent}%*\n` +
          `• Wallets: ${keyStore.getWallets().length}\n\n` +
          `La lógica de swap real aún es placeholder.\n¿Ejecutar en modo prueba?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("✅ Ejecutar (placeholder)", "confirm_sell"),
              Markup.button.callback("❌ Cancelar", "cancel"),
            ],
          ]),
        }
      );
      return;
    }
  });

  // ─────────────────────────────────────────────
  // Confirmaciones finales
  // ─────────────────────────────────────────────
  bot.action("confirm_transfer", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    if (state.step !== "transfer_confirm") {
      return ctx.reply("Sesión expirada. Usa /start otra vez.");
    }

    const { address, amount } = state.data;
    clearState(ctx.chat!.id);

    await ctx.reply(`⏳ Enviando ${amount} SOL desde todas las wallets...`);

    try {
      const result = await coordinator.exampleTransferAll(address, amount);
      let msg = result.success
        ? `✅ Éxito: ${result.signatures.length} transacciones enviadas`
        : `⚠️ Parcial: ${result.signatures.length} ok, ${result.failed.length} fallidas`;

      if (result.failed.length > 0 && result.failed.length <= 10) {
        msg += `\n\nFallos:\n` + result.failed.map((f) => `#${f.index}: ${f.error.slice(0, 80)}`).join("\n");
      }
      await ctx.reply(msg);
    } catch (err: any) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });

  bot.action("confirm_buy", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    if (state.step !== "buy_confirm") {
      return ctx.reply("Sesión expirada. Usa /start otra vez.");
    }
    const { mint, amount, slippage } = state.data;
    clearState(ctx.chat!.id);

    await ctx.reply(
      `⏳ Ejecutando compra en Pump.fun...\n` +
        `• Mint: \`${mint}\`\n` +
        `• SOL por wallet: *${amount}*\n` +
        `• Slippage: *${slippage}%*\n\n` +
        `Firmando y enviando con las wallets...`,
      { parse_mode: "Markdown" }
    );

    try {
      const { buildPumpBuyTransactions } = await import("../../07-pumpfun");
      const wallets = keyStore.getWallets();
      const { signedTxs, errors } = await buildPumpBuyTransactions(
        rpc.connection,
        wallets,
        { mint, solAmount: Number(amount), slippagePercent: Number(slippage) }
      );

      const signatures: string[] = [];
      for (const tx of signedTxs) {
        try {
          const sig = await rpc.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 2,
          });
          signatures.push(sig);
        } catch (e: any) {
          errors.push({ index: -1, error: e?.message || String(e) });
        }
      }

      let msg =
        `✅ Resultado compra Pump.fun\n` +
        `• Ok: ${signatures.length}\n` +
        `• Fallos: ${errors.length}`;

      if (signatures.length > 0) {
        msg += `\n\nFirmas:\n` + signatures.slice(0, 5).map((s) => `\`${s}\``).join("\n");
      }
      if (errors.length > 0) {
        msg += `\n\nErrores (máx 5):\n` + errors.slice(0, 5).map((e) => `#${e.index}: ${e.error.slice(0, 70)}`).join("\n");
      }
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.reply(`❌ Error compra: ${err.message}`);
    }
  });

  bot.action("confirm_sell", async (ctx) => {
    await ctx.answerCbQuery();
    const state = getState(ctx.chat!.id);
    if (state.step !== "sell_confirm") {
      return ctx.reply("Sesión expirada. Usa /start otra vez.");
    }
    const { mint, percent } = state.data;
    clearState(ctx.chat!.id);

    await ctx.reply(
      `⏳ Ejecutando venta en Pump.fun...\n` +
        `• Mint: \`${mint}\`\n` +
        `• Porcentaje: *${percent}%*\n\n` +
        `Firmando y enviando...`,
      { parse_mode: "Markdown" }
    );

    try {
      const { buildPumpSellTransactions } = await import("../../07-pumpfun");
      const wallets = keyStore.getWallets();
      const { signedTxs, errors } = await buildPumpSellTransactions(
        rpc.connection,
        wallets,
        { mint, percent: Number(percent), slippagePercent: 15 }
      );

      const signatures: string[] = [];
      for (const tx of signedTxs) {
        try {
          const sig = await rpc.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 2,
          });
          signatures.push(sig);
        } catch (e: any) {
          errors.push({ index: -1, error: e?.message || String(e) });
        }
      }

      let msg =
        `✅ Resultado venta Pump.fun\n` +
        `• Ok: ${signatures.length}\n` +
        `• Fallos: ${errors.length}`;

      if (signatures.length > 0) {
        msg += `\n\nFirmas:\n` + signatures.slice(0, 5).map((s) => `\`${s}\``).join("\n");
      }
      if (errors.length > 0) {
        msg += `\n\nErrores (máx 5):\n` + errors.slice(0, 5).map((e) => `#${e.index}: ${e.error.slice(0, 70)}`).join("\n");
      }
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.reply(`❌ Error venta: ${err.message}`);
    }
  });

  // Comando /help también muestra la guía
  bot.command("help", async (ctx) => {
    await ctx.reply("Usa /start y pulsa el botón *📖 Cómo configurar todo*", {
      parse_mode: "Markdown",
    });
  });
}
