/**
 * lib/register.js
 * Full ChatGPT account registration via direct HTTP fetch.
 * No browser required — pure API calls based on HAR analysis.
 *
 * Flow:
 *  1. GET  chatgpt.com/api/auth/csrf            → csrfToken
 *  2. POST chatgpt.com/api/auth/signin/openai    → OAuth authorize URL
 *  3. GET  authorize URL → 302 chain             → capture auth cookies
 *  4. POST auth.openai.com/.../user/register      → trigger OTP
 *  5. GET  auth.openai.com/.../email-otp/send     → send OTP email
 *  6. POST auth.openai.com/.../email-otp/validate → validate OTP
 *  7. POST auth.openai.com/.../create_account     → finalize + callback URL
 *  8. GET  chatgpt.com/api/auth/callback          → session cookies
 *  9. GET  chatgpt.com/api/auth/session           → access token
 */

import { randomUUID } from "crypto";
import { CookieJar, fetchCookie, fetchRedirect } from "./http-client.js";

export const TOTAL_STEPS = 7;

/**
 * Register a ChatGPT account via fetch (no browser).
 * @param {{ email: string, password: string, fullName: string }} account
 * @param {{ askOtpFn: (email:string)=>Promise<string>, onProgress?: (step:number,msg:string)=>void }} opts
 * @returns {Promise<Object>} account data with session info
 */
export async function registerAccount(account, opts = {}) {
  const { email, password, fullName } = account;
  const { askOtpFn, onProgress } = opts;
  const progress = (step, msg) => onProgress?.(step, msg);

  const jar = new CookieJar();
  const deviceId = randomUUID();
  const sessionLogId = randomUUID();

  const authHeaders = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Referer: "https://chatgpt.com/",
  };

  const apiHeaders = (referer) => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: "https://auth.openai.com",
    Referer: referer,
  });

  // ── Step 1: CSRF token ──────────────────────────────────────────────────
  progress(1, "Mengambil CSRF token...");

  const csrfRes = await fetchCookie(jar, "https://chatgpt.com/api/auth/csrf", {
    headers: { Accept: "*/*", Referer: "https://chatgpt.com/" },
  });
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("CSRF token tidak diperoleh");
  progress(1, "CSRF token OK ✓");

  // ── Step 2: OAuth signin → authorize URL ────────────────────────────────
  progress(2, "Memulai OAuth signin...");

  const signinParams = new URLSearchParams({
    prompt: "login",
    "ext-oai-did": deviceId,
    auth_session_logging_id: sessionLogId,
    "ext-passkey-client-capabilities": "0101",
    screen_hint: "login_or_signup",
    login_hint: email,
  });

  const signinRes = await fetchCookie(
    jar,
    `https://chatgpt.com/api/auth/signin/openai?${signinParams}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
        Origin: "https://chatgpt.com",
        Referer: "https://chatgpt.com/",
      },
      body: new URLSearchParams({
        callbackUrl: "https://chatgpt.com/",
        csrfToken,
        json: "true",
      }).toString(),
    },
  );

  const { url: authorizeUrl } = await signinRes.json();
  if (!authorizeUrl) throw new Error("URL OAuth tidak diperoleh");
  progress(2, "OAuth URL OK ✓");

  // ── Step 3: Follow authorize → password page (capture cookies) ──────────
  progress(3, "Membuka halaman registrasi...");

  const { response: pwPage } = await fetchRedirect(jar, authorizeUrl, {
    headers: authHeaders,
  });
  await pwPage.text();
  progress(3, "Halaman registrasi terbuka ✓");

  // ── Step 4: Register email + password ───────────────────────────────────
  progress(4, "Mendaftarkan email & password...");

  const regRes = await fetchCookie(
    jar,
    "https://auth.openai.com/api/accounts/user/register",
    {
      method: "POST",
      headers: apiHeaders("https://auth.openai.com/create-account/password"),
      body: JSON.stringify({ password, username: email }),
    },
  );

  const regData = await regRes.json();
  if (!regData.continue_url) {
    throw new Error(`Register gagal: ${JSON.stringify(regData)}`);
  }
  progress(4, "Email & password terdaftar ✓");

  // ── Step 5: Send OTP email + wait (with resend) ─────────────────────────
  progress(5, "Mengirim OTP ke email...");

  const { response: otpPage } = await fetchRedirect(jar, regData.continue_url, {
    headers: {
      ...authHeaders,
      Referer: "https://auth.openai.com/create-account/password",
    },
  });
  await otpPage.text();

  // Poll OTP with resend: try 10s → resend → 10s → resend → 10s → give up
  const OTP_POLL_MS = 10_000;
  const MAX_RESENDS = 2;
  let otpCode = null;

  for (let attempt = 0; attempt <= MAX_RESENDS; attempt++) {
    if (attempt > 0) {
      progress(5, `Resend OTP (${attempt}/${MAX_RESENDS})...`);
      await fetchCookie(
        jar,
        "https://auth.openai.com/api/accounts/email-otp/resend",
        {
          method: "POST",
          headers: {
            Accept: "*/*",
            Origin: "https://auth.openai.com",
            Referer: "https://auth.openai.com/email-verification",
          },
        },
      );
    }

    progress(5, attempt > 0
      ? `Menunggu OTP (resend ${attempt})...`
      : "Menunggu kode OTP dari email...");

    try {
      otpCode = await Promise.race([
        askOtpFn(email),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), OTP_POLL_MS),
        ),
      ]);
      if (otpCode) break;
    } catch {
      if (attempt === MAX_RESENDS) {
        throw new Error("OTP tidak diterima setelah 2x resend");
      }
    }
  }

  progress(5, "OTP diterima ✓");

  // ── Step 6: Validate OTP ────────────────────────────────────────────────
  progress(6, "Memvalidasi kode OTP...");

  const valRes = await fetchCookie(
    jar,
    "https://auth.openai.com/api/accounts/email-otp/validate",
    {
      method: "POST",
      headers: apiHeaders("https://auth.openai.com/email-verification"),
      body: JSON.stringify({ code: otpCode.trim() }),
    },
  );

  const valData = await valRes.json();
  if (!valData.continue_url) {
    throw new Error(`OTP validasi gagal: ${JSON.stringify(valData)}`);
  }
  progress(6, "OTP valid ✓");

  // Visit about-you page (capture cookies for next step)
  const { response: aboutPage } = await fetchRedirect(jar, valData.continue_url, {
    headers: {
      ...authHeaders,
      Referer: "https://auth.openai.com/email-verification",
    },
  });
  await aboutPage.text();

  // ── Step 7: Create account (name + birthdate) ───────────────────────────
  progress(7, "Membuat akun...");

  const year = 2000 + Math.floor(Math.random() * 6);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const birthdate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const createRes = await fetchCookie(
    jar,
    "https://auth.openai.com/api/accounts/create_account",
    {
      method: "POST",
      headers: apiHeaders("https://auth.openai.com/about-you"),
      body: JSON.stringify({ name: fullName, birthdate }),
    },
  );

  const createData = await createRes.json();
  if (!createData.continue_url) {
    throw new Error(`Create account gagal: ${JSON.stringify(createData)}`);
  }

  // ── Callback: Complete OAuth → session ──────────────────────────────────
  const callbackUrl =
    createData.page?.payload?.url || createData.continue_url;

  const { response: cbRes } = await fetchRedirect(jar, callbackUrl, {
    headers: { ...authHeaders, Referer: "https://auth.openai.com/" },
  });
  await cbRes.text();

  // Get session (access token)
  let sessionData = {};
  try {
    const sessRes = await fetchCookie(
      jar,
      "https://chatgpt.com/api/auth/session",
      { headers: { Accept: "application/json", Referer: "https://chatgpt.com/" } },
    );
    const session = await sessRes.json();
    if (session?.accessToken) {
      sessionData = {
        userId: session.user?.id,
        accessToken: session.accessToken,
        expires: session.expires,
      };
    }
  } catch {
    // Session retrieval optional
  }

  const birthdateDisplay = `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
  progress(7, `Berhasil ✅ (lahir: ${birthdateDisplay})`);

  return { ...account, birthdate, status: "verified", ...sessionData };
}
