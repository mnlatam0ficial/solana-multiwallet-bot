import * as fs from "fs";
import * as path from "path";
import { encryptWallets, decryptWallets } from "./encryption";
import { WalletData, EncryptedStore } from "../../types";

// Railway Volume se monta normalmente en /data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "wallets.enc");

export class KeyStore {
  private wallets: WalletData[] | null = null;
  private password: string | null = null;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * Guarda las wallets encriptadas en disco
   */
  save(wallets: WalletData[], password: string): void {
    const encrypted = encryptWallets(wallets, password);
    fs.writeFileSync(STORE_FILE, JSON.stringify(encrypted, null, 2));
    this.wallets = wallets;
    this.password = password;
    console.log(`✅ Almacén guardado con ${wallets.length} wallets en ${STORE_FILE}`);
  }

  /**
   * Carga y desencripta el almacén en memoria
   */
  load(password: string): WalletData[] {
    if (!fs.existsSync(STORE_FILE)) {
      throw new Error(
        `No existe el almacén en ${STORE_FILE}. Ejecuta primero generate-wallets + encrypt-store`
      );
    }

    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const store: EncryptedStore = JSON.parse(raw);
    this.wallets = decryptWallets(store, password);
    this.password = password;
    console.log(`✅ Almacén cargado: ${this.wallets.length} wallets`);
    return this.wallets;
  }

  getWallets(): WalletData[] {
    if (!this.wallets) {
      throw new Error("KeyStore no está cargado. Llama a load() primero");
    }
    return this.wallets;
  }

  clear(): void {
    this.wallets = null;
    this.password = null;
  }

  exists(): boolean {
    return fs.existsSync(STORE_FILE);
  }

  getStorePath(): string {
    return STORE_FILE;
  }
}

export const keyStore = new KeyStore();
