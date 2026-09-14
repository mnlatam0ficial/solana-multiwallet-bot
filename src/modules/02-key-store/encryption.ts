import * as crypto from "crypto";
import { EncryptedStore, WalletData } from "../../types";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const ITERATIONS = 310000; // OWASP recommendation

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Encripta el array de wallets con AES-256-GCM + PBKDF2
 */
export function encryptWallets(
  wallets: WalletData[],
  password: string
): EncryptedStore {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(wallets);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag: tag.toString("hex"),
    version: 1,
    count: wallets.length,
  };
}

/**
 * Desencripta el almacén. Lanza error si la contraseña es incorrecta.
 */
export function decryptWallets(
  store: EncryptedStore,
  password: string
): WalletData[] {
  const salt = Buffer.from(store.salt, "hex");
  const iv = Buffer.from(store.iv, "hex");
  const ciphertext = Buffer.from(store.ciphertext, "hex");
  const tag = Buffer.from(store.tag, "hex");
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as WalletData[];
  } catch {
    throw new Error("Contraseña incorrecta o archivo corrupto");
  }
}
