<div align="center">

<img src="logo.png" alt="ChatGPT Account Creator" width="120" />

# ChatGPT Account Creator

**A CLI tool for bulk automation of ChatGPT account creation via direct HTTP fetch (no browser needed).**

![Version](https://img.shields.io/badge/Version-4.0.0-blueviolet)
![Node](https://img.shields.io/badge/Node.js-v18+-green)
![Runtime](https://img.shields.io/badge/Runtime-Fetch_API-blue)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

[Features](#features) - [Installation](#installation) - [Usage](#usage) - [Structure](#project-structure) - [License](#license)

[Bahasa Indonesia](README.md) | **English**

</div>

---

> **Disclaimer:** This project is created solely for **educational purposes and automation research**. Using this tool to violate OpenAI's Terms of Service, abuse the platform, or engage in any illegal activity is entirely the responsibility of the user. The author assumes no liability for any misuse.

---

## Features

- Automated ChatGPT account creation via **direct HTTP fetch** (no browser required)
- **Much faster** than browser-based approach — pure API calls
- Parallel processing of up to 5 accounts simultaneously with a worker pool
- **Live progress bar** per-account with real-time ANSI terminal display
- Automatic OTP verification from email inbox via API polling
- **Auto-resend OTP** — if OTP doesn't arrive within 10 seconds, auto-resend up to 2 times
- **Realistic random names** using faker.js (letters/spaces only, no symbols)
- **Unique emails** — LocalDB ensures no duplicate emails across sessions
- **Name-based emails** — email usernames reuse the generated faker.js first + last name
- **Optional email suffix** — append a name to the email (e.g. `johndoewahid@domain.xyz`)
- Auto-retry on failure (automatically creates a new account)
- Results saved to `data/accounts.json` and auto-exported to `data/result.txt`
- Centralized configuration via `config.json` (password, domain, OTP, etc.)

## Requirements

- Node.js v18 or newer
- Custom email domain with inbox API support (default: `plexai.xyz`)

## Installation

```bash
git clone https://github.com/alhifnywahid/chatgpt-account-creator.git
cd chatgpt-account-creator
npm install
```

## Configuration

Edit `config.json` in the project root:

```json
{
  "password": "@Gopretstudio88",
  "domains": ["plexai.xyz"],
  "batchSize": 5,
  "otp": {
    "timeout": 90000,
    "pollInterval": 4000,
    "apiUrl": "https://mail.gopretstudio.com",
    "apiKey": "GOMAIL-xxxxx"
  },
  "paths": {
    "accounts": "./data/accounts.json",
    "result": "./data/result.txt",
    "emailDb": "./data/email-db.json"
  }
}
```

| Option | Description |
|--------|-------------|
| `password` | Password used for all created accounts |
| `domains` | List of email domains (array) |
| `batchSize` | Max accounts processed in parallel |
| `otp.timeout` | OTP polling timeout in milliseconds |
| `otp.pollInterval` | Inbox polling interval in milliseconds |
| `otp.apiUrl` | Email server API URL |
| `otp.apiKey` | Email server API key |

## Usage

### Creating Accounts

```bash
npm run create
```

The system will ask interactively:

```
> Mau buat berapa akun? 5
> Tambahan nama di belakang email? (kosongkan jika tidak): wahid
```

Then displays a live progress bar:

```
  ✅ johndoewahid@plexai.xyz       │ ████████████████████ 100% │ Berhasil
  ⏳ emmastonewahid@plexai.xyz     │ ██████████░░░░░░░░░░  57% │ Menunggu kode OTP...
  ⏸  —                             │ ░░░░░░░░░░░░░░░░░░░░   0% │ Menunggu...
```

### Manual Export

```bash
# Re-export to data/result.txt (FORMAT: email[TAB]name)
npm run convert
```

> **Note:** Export to `result.txt` is already done automatically after every `npm run create`.

## Project Structure

```
chatgpt-account-creator/
├── index.js              # CLI entry point (command router)
├── config.json           # All configuration centralized
├── package.json
├── data/
│   ├── accounts.json     # Account results (reset on each create)
│   ├── result.txt        # Export output (reset on each create)
│   └── email-db.json     # LocalDB unique emails (persistent)
└── src/
    ├── config.js         # Wrapper for reading config.json
    ├── commands/
    │   ├── create.js     # Account creation logic (worker pool + progress bar)
    │   └── convert.js    # Export to result.txt
    └── lib/
        ├── http-client.js # Cookie jar & fetch wrapper for cross-domain requests
        ├── register.js   # 7-step ChatGPT registration flow via fetch
        ├── otp.js        # OTP polling from email inbox
        ├── email-gen.js  # Email & name generator (faker.js)
        └── storage.js    # Read/write accounts + LocalDB email
```

## Registration Flow

Each account is processed through 7 steps via direct HTTP fetch:

1. **CSRF Token** — fetch token from `chatgpt.com/api/auth/csrf`
2. **OAuth Signin** — POST to `api/auth/signin/openai` → get authorize URL
3. **Authorize** — follow redirect chain → capture auth cookies
4. **Register** — POST email + password to `auth.openai.com`
5. **OTP** — send & wait for OTP code (auto-resend up to 2x if not received)
6. **Validate OTP** — verify the 6-digit code
7. **Create Account** — fill name + birthdate → callback → get session token

## Output Format

### `data/accounts.json`

```json
[
  {
    "email": "isabellathompsonwahid@plexai.xyz",
    "password": "@Gopretstudio88",
    "fullName": "Isabella Thompson",
    "birthdate": "2002-05-14",
    "status": "verified",
    "userId": "...",
    "accessToken": "...",
    "createdAt": "2026-04-08T00:00:00.000Z"
  }
]
```

### `data/result.txt`

```
isabellathompsonwahid@plexai.xyz    Isabella Thompson
marcuschenwahid@plexai.xyz          Marcus Chen
```

## Notes

- **No browser required** — all processing via direct HTTP fetch
- On any failure, the system automatically creates a new account
- OTP is automatically resent if not received within 10 seconds (max 2 resends)
- `data/email-db.json` stores all previously used emails (never deleted)
- Only free accounts are created — no payment or credit card information is used
- Ensure your email domain supports catchall addresses or an inbox API

## Support

If this project has been useful, you can support further development:

<a href="https://trakteer.id/alhifnywahid" target="_blank"><img src="https://cdn.trakteer.id/images/embed/trbtn-red-1.png" height="40" alt="Trakteer" /></a>&nbsp;<a href="https://saweria.co/alhifnywahid" target="_blank"><img src="https://img.shields.io/badge/-Support%20on%20Saweria-FF6600?style=for-the-badge" height="40" alt="Saweria" /></a>

## Community

Join and discuss with other users:

<a href="https://t.me/gopretstudio" target="_blank"><img src="https://img.shields.io/badge/-@gopretstudio-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" height="40" alt="Telegram" /></a>

## License

[MIT](LICENSE) - free to use and modify with attribution.
