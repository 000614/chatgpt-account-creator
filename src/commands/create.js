/**
 * commands/create.js
 * Command: npm run create
 * Buat N akun ChatGPT secara parallel dengan worker pool
 * (max BATCH_SIZE aktif sekaligus, slot langsung dipakai ulang).
 */

import chalk from "chalk";
import readline from "readline";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { BATCH_SIZE, RESULT_FILE } from "../config.js";
import { generateAccount } from "../lib/email-gen.js";
import { registerAccount, TOTAL_STEPS } from "../lib/register.js";
import { waitForOtp } from "../lib/otp.js";
import {
  saveAccount,
  clearAccounts,
  isEmailUsed,
  saveEmailToDb,
} from "../lib/storage.js";

// ─── Helper: Prompt input ─────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

// ─── Generate email unik (cek LocalDB + slot aktif) ──────────────────────────
function generateUniqueAccount(emailSuffix = "", reservedEmails = new Set()) {
  for (let attempts = 0; attempts < 100; attempts++) {
    const account = generateAccount(emailSuffix);
    if (!isEmailUsed(account.email) && !reservedEmails.has(account.email)) {
      reservedEmails.add(account.email);
      return account;
    }
  }

  throw new Error("Gagal generate email unik setelah 100 percobaan");
}

function releaseReservedEmail(email, reservedEmails) {
  if (email) reservedEmails.delete(email);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const BAR_WIDTH = 20;
const EMAIL_WIDTH = 30;
const STATUS_WIDTH = 40;

function renderBar(step, total) {
  const pct = Math.round((step / total) * 100);
  const filled = Math.round((step / total) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  if (pct === 100) return chalk.green(`${bar} ${String(pct).padStart(3)}%`);
  if (pct >= 50) return chalk.yellow(`${bar} ${String(pct).padStart(3)}%`);
  return chalk.cyan(`${bar} ${String(pct).padStart(3)}%`);
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str.padEnd(maxLen);
  return str.slice(0, maxLen - 1) + "…";
}

class LiveDisplay {
  constructor(totalCount) {
    this.totalCount = totalCount;
    this.numberWidth = Math.max(3, String(totalCount).length);
    // Pre-allocate ALL rows so cursor offset is always constant
    this.rows = Array.from({ length: totalCount }, () => ({
      email: "—",
      step: 0,
      status: "Menunggu...",
      done: false,
    }));
    this.rendered = false;
    this._pendingRender = false;
  }

  updateRow(rowIdx, data) {
    Object.assign(this.rows[rowIdx], data);
    // Debounce: batch concurrent updates into a single render pass
    if (!this._pendingRender) {
      this._pendingRender = true;
      queueMicrotask(() => {
        this._pendingRender = false;
        this._render();
      });
    }
  }

  _render() {
    // Move cursor up by FIXED total (never changes)
    if (this.rendered) {
      process.stdout.write(`\x1B[${this.totalCount}A`);
    }

    for (let i = 0; i < this.totalCount; i++) {
      const s = this.rows[i];
      const rowNumber = `${String(i + 1).padStart(this.numberWidth, "0")}.`;
      const emailStr = truncate(s.email, EMAIL_WIDTH);
      const bar = renderBar(s.step, TOTAL_STEPS);
      const statusStr = truncate(s.status, STATUS_WIDTH);

      let icon;
      if (s.done) icon = chalk.green("✅");
      else if (s.step > 0) icon = chalk.yellow("⏳");
      else icon = chalk.gray("⏸ ");

      process.stdout.write(
        `\x1B[2K  ${chalk.gray(rowNumber)} ${icon} ${chalk.white.bold(emailStr)} │ ${bar} │ ${s.done ? chalk.green(statusStr) : chalk.gray(statusStr)}\n`,
      );
    }

    this.rendered = true;
  }
}

// ─── OTP ──────────────────────────────────────────────────────────────────────
async function getOtp(email) {
  return await waitForOtp(email);
}

// ─── Auto-convert ─────────────────────────────────────────────────────────────
function autoConvert(allResults) {
  if (allResults.length === 0) return;
  const lines = allResults.map(
    (acc) => `${acc.email}\t${acc.fullName || acc.firstName || "-"}`,
  );
  writeFileSync(resolve(RESULT_FILE), lines.join("\n"), "utf-8");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function cmdCreate(args) {
  // ─── Prompt interaktif ─────────────────────────────────────────────────
  const countInput = await ask(chalk.white(`> Mau buat berapa akun? `));
  const count = Math.max(1, parseInt(countInput) || 1);

  const emailSuffix = await ask(
    chalk.white(`> Tambahan nama di belakang email? (kosongkan jika tidak): `),
  );

  if (emailSuffix) {
    console.log(
      chalk.green(
        `  ✓ Suffix email: "${emailSuffix}" → contoh: johndoe${emailSuffix}@domain.xyz`,
      ),
    );
  } else {
    console.log(
      chalk.gray(`  ✓ Email tanpa tambahan → contoh: johndoe@domain.xyz`),
    );
  }

  // ─── Hapus data lama ───────────────────────────────────────────────────
  await clearAccounts();
  const resultPath = resolve(RESULT_FILE);
  if (existsSync(resultPath)) unlinkSync(resultPath);
  console.log(
    chalk.gray(`\n> 🗑️  Data lama dihapus (accounts.json & result.txt)\n`),
  );

  const workerCount = Math.min(count, BATCH_SIZE);
  const reservedEmails = new Set();
  let nextAccountIndex = 0;
  let totalSuccess = 0;
  const allResults = new Array(count);

  const liveDisplay = new LiveDisplay(count);
  liveDisplay._render(); // Print initial grid before workers start

  const workers = Array.from({ length: workerCount }, () =>
    (async () => {
      while (true) {
        if (nextAccountIndex >= count) {
          return;
        }

        const accountIndex = nextAccountIndex++;

        while (true) {
          let account;

          try {
            account = generateUniqueAccount(emailSuffix, reservedEmails);
          } catch {
            liveDisplay.updateRow(accountIndex, {
              email: "—",
              step: 0,
              status: "Mencari email unik...",
              done: false,
            });
            await sleep(1000);
            continue;
          }

          liveDisplay.updateRow(accountIndex, {
            email: account.email,
            step: 0,
            status: "Memulai...",
            done: false,
          });

          try {
            const result = await registerAccount(account, {
              askOtpFn: getOtp,
              onProgress: (step, msg) => {
                liveDisplay.updateRow(accountIndex, {
                  step,
                  status: msg,
                });
              },
            });

            await saveAccount(result);
            await saveEmailToDb(account.email);
            releaseReservedEmail(account.email, reservedEmails);

            allResults[accountIndex] = result;
            totalSuccess++;

            liveDisplay.updateRow(accountIndex, {
              step: TOTAL_STEPS,
              status: "Berhasil",
              done: true,
            });
            break;
          } catch {
            releaseReservedEmail(account.email, reservedEmails);
            liveDisplay.updateRow(accountIndex, {
              step: 0,
              status: "Gagal, retry...",
              done: false,
            });
            await sleep(3000 + Math.random() * 2000);
          }
        }
      }
    })(),
  );

  await Promise.allSettled(workers);

  // ─── Auto-convert & simpan ─────────────────────────────────────────────
  autoConvert(allResults.filter(Boolean));

  console.log(
    chalk.green(`\n✅ Selesai! ${totalSuccess}/${count} akun berhasil dibuat.`),
  );
  console.log(
    chalk.gray(`💾 Tersimpan di: `) +
      chalk.cyan(`data/accounts.json`) +
      chalk.gray(` & `) +
      chalk.cyan(`data/result.txt\n`),
  );
}
