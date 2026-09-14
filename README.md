# Solana Multi-Wallet Telegram Bot + Pump.fun

Bot de Telegram para operar de forma coordinada con **50 wallets** en **Pump.fun**.

## Qué incluye

- Generador de wallets (BIP39 + path Solana)
- Almacén cifrado AES-256-GCM
- Cliente RPC
- Firmante + Coordinador (envío en paralelo)
- Bot de Telegram 100% interactivo con botones (pensado para celular)
- **Compra y venta real en Pump.fun** (bonding curve)
- Preparado para Railway (Volume en `/data`)

## Uso desde el celular

Una vez que el bot está corriendo:

1. Abres Telegram
2. Escribes `/start`
3. Usas solo los botones:
   - 📊 Ver saldos
   - 💸 Transferir SOL
   - 🛒 Comprar (Pump.fun)
   - 💰 Vender (Pump.fun)
   - 📖 Cómo configurar (solo 1 vez)

## Variables de entorno

```env
TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_ID=
RPC_URL=                 # Helius o QuickNode recomendado
MASTER_PASSWORD=         # mínimo 12 caracteres
DATA_DIR=/data           # en Railway (Volume)
```

## Railway

1. Crea un **nuevo servicio** (no reutilices el de Vigía).
2. Conecta el repo de este bot.
3. Añade las variables de entorno de arriba.
4. Crea un **Volume** con mount path `/data`.
5. Deploy.

El `Dockerfile` ya está incluido.

## Generar wallets (solo 1 vez)

En una máquina con Node:

```bash
npm install
npm run generate-wallets -- --count 50
npm run encrypt-store
# Guarda el mnemonic offline y borra data/wallets.raw.json
```

Luego sube el archivo `wallets.enc` al Volume de Railway (o genéralo localmente y cópialo).

## Notas importantes

- Pump.fun cambia sus instrucciones con frecuencia. El módulo usa `@pump-fun/pump-sdk`.
- Si la compra/venta falla, revisa la versión del SDK y los logs del servicio.
- Las private keys nunca se guardan en texto plano.
- Solo el `ADMIN_CHAT_ID` puede usar el bot.

## Seguridad

Usa este bot bajo tu propia responsabilidad.  
Manejar muchas private keys en la nube (Railway) tiene riesgos.  
Para cantidades grandes se recomienda un VPS propio.
