<div align="center">

<img src="logo.png" alt="ChatGPT Account Creator" width="120" />

# ChatGPT Account Creator

**Alat CLI untuk otomatisasi pembuatan akun ChatGPT secara massal via HTTP fetch (tanpa browser).**

![Version](https://img.shields.io/badge/Version-4.0.0-blueviolet)
![Node](https://img.shields.io/badge/Node.js-v18+-green)
![Runtime](https://img.shields.io/badge/Runtime-Fetch_API-blue)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

[Fitur](#fitur-utama) - [Instalasi](#instalasi) - [Penggunaan](#penggunaan) - [Struktur](#struktur-project) - [Lisensi](#lisensi)

**Bahasa Indonesia** | [English](README.en.md)

</div>

---

> **Disclaimer:** Project ini dibuat semata-mata untuk tujuan **pembelajaran dan riset otomatisasi**. Penggunaan alat ini untuk tindakan yang melanggar Ketentuan Layanan OpenAI, penyalahgunaan platform, atau aktivitas ilegal lainnya sepenuhnya menjadi tanggung jawab pengguna. Penulis tidak bertanggung jawab atas segala bentuk penyalahgunaan.

---

## Fitur Utama

- Pembuatan akun ChatGPT secara otomatis via **direct HTTP fetch** (tanpa browser)
- **Jauh lebih cepat** dibanding versi browser — murni API call
- Pemrosesan paralel hingga 5 akun secara bersamaan dengan worker pool
- **Live progress bar** per-akun dengan tampilan ANSI real-time
- Verifikasi OTP otomatis dari inbox email via API
- **Auto-resend OTP** — jika OTP tidak masuk dalam 10 detik, otomatis resend hingga 2 kali
- **Nama random realistis** menggunakan faker.js (huruf/spasi saja, tanpa simbol)
- **Email unik** — LocalDB memastikan tidak ada email duplikat antar sesi
- **Email berbasis nama** — username email memakai kombinasi nama depan + nama belakang hasil faker.js
- **Suffix email opsional** — tambahkan nama di belakang email (contoh: `johndoewahid@domain.xyz`)
- Auto-retry jika gagal (buat akun baru otomatis)
- Penyimpanan hasil ke `data/accounts.json` dan auto-ekspor ke `data/result.txt`
- Konfigurasi terpusat via `config.json` (password, domain, OTP, dll)

## Persyaratan

- Node.js v18 atau lebih baru
- Akun email domain kustom yang mendukung API inbox (default: `plexai.xyz`)

## Instalasi

```bash
git clone https://github.com/alhifnywahid/chatgpt-account-creator.git
cd chatgpt-account-creator
npm install
```

## Konfigurasi

Edit file `config.json` di root project:

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

| Opsi | Deskripsi |
|------|-----------|
| `password` | Password untuk semua akun yang dibuat |
| `domains` | Daftar domain email (array) |
| `batchSize` | Maksimal akun diproses bersamaan |
| `otp.timeout` | Timeout polling OTP dalam milidetik |
| `otp.pollInterval` | Interval polling inbox dalam milidetik |
| `otp.apiUrl` | URL API email server |
| `otp.apiKey` | API key untuk email server |

## Penggunaan

### Membuat Akun

```bash
npm run create
```

Sistem akan bertanya secara interaktif:

```
> Mau buat berapa akun? 5
> Tambahan nama di belakang email? (kosongkan jika tidak): wahid
```

Kemudian tampil live progress bar:

```
  ✅ johndoewahid@plexai.xyz       │ ████████████████████ 100% │ Berhasil
  ⏳ emmastonewahid@plexai.xyz     │ ██████████░░░░░░░░░░  57% │ Menunggu kode OTP...
  ⏸  —                             │ ░░░░░░░░░░░░░░░░░░░░   0% │ Menunggu...
```

### Ekspor Manual

```bash
# Ekspor ulang ke data/result.txt (FORMAT: email[TAB]nama)
npm run convert
```

> **Note:** Ekspor ke `result.txt` sudah otomatis dilakukan setiap selesai `npm run create`.

## Struktur Project

```
chatgpt-account-creator/
├── index.js              # CLI entry point (router)
├── config.json           # Semua konfigurasi terpusat
├── package.json
├── data/
│   ├── accounts.json     # Hasil akun (direset setiap create baru)
│   ├── result.txt        # Output ekspor (direset setiap create baru)
│   └── email-db.json     # LocalDB email unik (persistent)
└── src/
    ├── config.js         # Wrapper baca config.json
    ├── commands/
    │   ├── create.js     # Logika pembuatan akun (worker pool + progress bar)
    │   └── convert.js    # Ekspor ke result.txt
    └── lib/
        ├── http-client.js # Cookie jar & fetch wrapper untuk cross-domain
        ├── register.js   # 7-step flow registrasi ChatGPT via fetch
        ├── otp.js        # Polling OTP dari inbox email
        ├── email-gen.js  # Generate email & nama (faker.js)
        └── storage.js    # Read/write accounts + LocalDB email
```

## Alur Kerja Registrasi

Setiap akun diproses melalui 7 langkah via direct HTTP fetch:

1. **CSRF Token** — ambil token dari `chatgpt.com/api/auth/csrf`
2. **OAuth Signin** — POST ke `api/auth/signin/openai` → dapatkan authorize URL
3. **Authorize** — follow redirect chain → capture auth cookies
4. **Register** — POST email + password ke `auth.openai.com`
5. **OTP** — kirim & tunggu kode OTP (auto-resend hingga 2x jika tidak masuk)
6. **Validasi OTP** — verifikasi kode 6 digit
7. **Buat Akun** — isi nama + tanggal lahir → callback → ambil session token

## Format Output

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

## Catatan

- **Tidak memerlukan browser** — semua proses via HTTP fetch langsung
- Jika ada kegagalan di step manapun, sistem otomatis membuat akun baru
- OTP otomatis di-resend jika tidak masuk dalam 10 detik (maksimal 2x resend)
- File `data/email-db.json` menyimpan semua email yang pernah digunakan (tidak pernah dihapus)
- Hanya akun free yang dibuat — tidak ada proses pembayaran atau kartu kredit
- Pastikan domain email yang digunakan mendukung catchall/API inbox

## Dukungan

Jika project ini bermanfaat, kamu bisa mendukung pengembangan lebih lanjut:

<a href="https://trakteer.id/alhifnywahid" target="_blank"><img src="https://cdn.trakteer.id/images/embed/trbtn-red-1.png" height="40" alt="Trakteer" /></a>&nbsp;<a href="https://saweria.co/alhifnywahid" target="_blank"><img src="https://img.shields.io/badge/-Dukung%20di%20Saweria-FF6600?style=for-the-badge" height="40" alt="Saweria" /></a>

## Komunitas

Gabung dan diskusi bersama pengguna lain:

<a href="https://t.me/gopretstudio" target="_blank"><img src="https://img.shields.io/badge/-@gopretstudio-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" height="40" alt="Telegram" /></a>

## Lisensi

[MIT](LICENSE) - bebas digunakan dan dimodifikasi dengan menyertakan atribusi.
