#!/usr/bin/env node
/**
 * index.js - CLI Entry Point
 *
 * Hanya berisi routing command ke handler yang sesuai.
 * Logika detail ada di src/commands/*.js
 *
 * Usage:
 *   npm run create    buat akun (interaktif)
 *   npm run convert   ekspor ke data/result.txt
 */

import chalk from "chalk";
import { cmdCreate } from "./src/commands/create.js";
import { cmdConvert } from "./src/commands/convert.js";

function banner() {
  console.log(
    chalk.cyan.bold(`
╔══════════════════════════════════════╗
║  🚀 ChatGPT Account Creator v4.0   ║
║     Fetch-based (no browser!)       ║
╚══════════════════════════════════════╝`),
  );
}

function showHelp() {
  banner();
  console.log(`\n${chalk.bold("Penggunaan:")}\n`);
  const cmds = [
    ["npm run create", "Buat akun baru (interaktif)"],
    ["npm run convert", "Ekspor akun ke data/result.txt"],
  ];
  cmds.forEach(([cmd, desc]) =>
    console.log(`  ${chalk.cyan(cmd.padEnd(42))} ${chalk.gray(desc)}`),
  );
  console.log();
}

// ─── Router ──────────────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case "create":
      await cmdCreate(args);
      break;
    case "convert":
      await cmdConvert();
      break;
    default:
      showHelp();
  }
} catch (err) {
  console.error(chalk.red(`\n💥 Error: ${err.message}`));
  process.exit(1);
}
