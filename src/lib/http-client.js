/**
 * lib/http-client.js
 * Cookie-aware HTTP client for cross-domain request chains.
 * Handles cookie persistence across chatgpt.com ↔ auth.openai.com.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0";

// ─── CookieJar ────────────────────────────────────────────────────────────────

export class CookieJar {
  constructor() {
    /** @type {Record<string, Record<string, {name:string,value:string,expires?:string}>>} */
    this.store = {};
  }

  /** Parse Set-Cookie headers from response and store them. */
  parseResponse(requestUrl, response) {
    const url = new URL(requestUrl);
    const headers =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    for (const h of headers) this._parseAndStore(h, url);
  }

  /** Build Cookie header string for a given request URL. */
  getCookieString(requestUrl) {
    const hostname = new URL(requestUrl).hostname;
    const pairs = [];

    for (const [dom, cookies] of Object.entries(this.store)) {
      if (!this._domainMatch(dom, hostname)) continue;
      for (const c of Object.values(cookies)) {
        if (c.expires && new Date(c.expires) < new Date()) continue;
        pairs.push(`${c.name}=${c.value}`);
      }
    }

    return pairs.join("; ");
  }

  _domainMatch(cookieDomain, hostname) {
    if (cookieDomain === hostname) return true;
    if (cookieDomain.startsWith(".")) {
      return (
        hostname === cookieDomain.slice(1) ||
        hostname.endsWith(cookieDomain)
      );
    }
    return false;
  }

  _parseAndStore(header, url) {
    const parts = header.split(";").map((s) => s.trim());
    const eqIdx = parts[0].indexOf("=");
    if (eqIdx < 0) return;

    const name = parts[0].substring(0, eqIdx).trim();
    const value = parts[0].substring(eqIdx + 1).trim();
    const cookie = { name, value };
    let domain = url.hostname;

    for (let i = 1; i < parts.length; i++) {
      const [k, ...v] = parts[i].split("=");
      const key = k.trim().toLowerCase();
      const val = v.join("=").trim();

      if (key === "domain") {
        domain = val.startsWith(".") ? val : "." + val;
      } else if (key === "expires") {
        cookie.expires = val;
      } else if (key === "max-age") {
        const ma = parseInt(val);
        cookie.expires =
          ma <= 0
            ? new Date(0).toUTCString()
            : new Date(Date.now() + ma * 1000).toUTCString();
      }
    }

    // Delete expired / null cookies
    if (
      value === "null" ||
      value === "" ||
      (cookie.expires && new Date(cookie.expires) < new Date())
    ) {
      if (this.store[domain]) delete this.store[domain][name];
      return;
    }

    if (!this.store[domain]) this.store[domain] = {};
    this.store[domain][name] = cookie;
  }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Single fetch with cookie jar (no auto-redirect). */
export async function fetchCookie(jar, url, opts = {}) {
  const cookies = jar.getCookieString(url);
  const headers = {
    "User-Agent": UA,
    "Accept-Language": "id,en-US;q=0.9,en;q=0.8",
    ...opts.headers,
  };
  if (cookies) headers["Cookie"] = cookies;

  const res = await fetch(url, { ...opts, headers, redirect: "manual" });
  jar.parseResponse(url, res);
  return res;
}

/** Fetch following redirects, capturing cookies at each hop. */
export async function fetchRedirect(jar, url, opts = {}, max = 15) {
  let res = await fetchCookie(jar, url, opts);
  let cur = url;
  let n = 0;

  while ([301, 302, 303, 307, 308].includes(res.status) && n++ < max) {
    const loc = res.headers.get("location");
    if (!loc) break;
    // Consume body to prevent leak
    await res.text().catch(() => {});
    cur = new URL(loc, cur).href;
    const method =
      res.status === 307 || res.status === 308
        ? opts.method || "GET"
        : "GET";
    res = await fetchCookie(jar, cur, { headers: opts.headers, method });
  }

  return { response: res, url: cur };
}
