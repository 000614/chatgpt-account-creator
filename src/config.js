/**
 * config.js
 * Thin wrapper yang membaca config.json dan mengekspor semua konstanta.
 * Untuk mengubah konfigurasi, edit file config.json di root project.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(__dirname, "../config.json"), "utf-8");
const config = JSON.parse(raw);

// ─── Akun ─────────────────────────────────────────────────────────────────────
export const PASSWORD = config.password;
export const DOMAINS = config.domains;

// ─── Proses ───────────────────────────────────────────────────────────────────
export const BATCH_SIZE = config.batchSize;

// ─── OTP ──────────────────────────────────────────────────────────────────────
export const OTP_TIMEOUT = config.otp.timeout;
export const OTP_POLL = config.otp.pollInterval;
export const OTP_API_URL = config.otp.apiUrl;
export const OTP_API_KEY = config.otp.apiKey;

// ─── File Path ────────────────────────────────────────────────────────────────
export const ACCOUNTS_FILE = config.paths.accounts;
export const RESULT_FILE = config.paths.result;
export const EMAIL_DB_FILE = config.paths.emailDb;
