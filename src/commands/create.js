/**
 * commands/create.js (网页邮箱手动交互版)
 */

import chalk from "chalk";
import readline from "readline";
import { writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve } from "path";
import { RESULT_FILE, PASSWORD } from "../config.js";
import { generateName } from "../lib/email-gen.js";
import { registerAccount, TOTAL_STEPS } from "../lib/register.js";
import { saveAccount, clearAccounts, saveEmailToDb } from "../lib/storage.js";

// 在终端中请求用户输入的辅助函数
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

export async function cmdCreate(args) {
  console.log(chalk.cyan.bold(`\n=== 半自动模式 (手动输入网页邮箱) ===\n`));
  
  const countInput = await ask(chalk.white(`> 你想创建多少个账号？ `));
  const count = Math.max(1, parseInt(countInput) || 1);

  // 清除旧数据
  await clearAccounts();
  const resultPath = resolve(RESULT_FILE);
  if (existsSync(resultPath)) unlinkSync(resultPath);
  console.log(chalk.gray(`\n> 🗑️  旧数据已清除 (accounts.json & result.txt)`));

  const allResults = [];
  let totalSuccess = 0;

  // 逐个创建账号（取消并行，防止输入验证码时发生冲突）
  for (let i = 0; i < count; i++) {
    console.log(chalk.cyan(`\n===========================================`));
    console.log(chalk.cyan(`         正在创建账号 ${i + 1} / ${count}`));
    console.log(chalk.cyan(`===========================================`));
    
    const email = await ask(chalk.yellow(`\n[1] 请打开提供临时邮箱的网站（例如：mail.tm）\n> 请输入你获取到的邮箱地址： `));
    
    if (!email) {
        console.log(chalk.red(`邮箱为空，跳过此账号...`));
        continue;
    }

    // 随机生成姓名，并与你输入的邮箱和配置的密码绑定
    const nameInfo = generateName();
    const account = { 
      email, 
      password: PASSWORD, 
      ...nameInfo 
    };

    try {
      const result = await registerAccount(account, {
        // 重写获取 OTP 的函数，改为请求你手动输入
        askOtpFn: async (sentEmail) => {
          console.log(chalk.magenta.bold(`\n[!] OpenAI 已将 6 位数验证码发送至：${sentEmail}`));
          return await ask(chalk.yellow(`[2] 请去你的网页邮箱查收邮件。\n> 请在此输入你收到的 OTP 验证码： `));
        },
        // 使用简单的日志输出进度，不使用容易冲突的 UI 渲染
        onProgress: (step, msg) => {
          console.log(chalk.gray(`   [步骤 ${step}/${TOTAL_STEPS}] ${msg}`));
        },
      });

      // 注册成功后保存数据
      await saveAccount(result);
      await saveEmailToDb(account.email);
      allResults.push(result);
      totalSuccess++;
      console.log(chalk.green(`\n✅ 成功！账号已准备就绪：${email}`));
      
    } catch (err) {
      console.error(chalk.red(`\n❌ 失败：${err.message}`));
    }
  }

  // 导出到 txt 文件
  if (allResults.length > 0) {
    const lines = allResults.map(
      (acc) => `${acc.email}\t${acc.fullName || acc.firstName || "-"}`
    );
    writeFileSync(resolve(RESULT_FILE), lines.join("\n"), "utf-8");
  }

  console.log(chalk.green.bold(`\n🎉 任务结束！成功创建了 ${totalSuccess}/${count} 个账号。`));
  console.log(chalk.gray(`💾 数据已保存至 data/accounts.json 和 data/result.txt\n`));
}