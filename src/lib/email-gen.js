/**
 * lib/email-gen.js
 * Generate email, nama, dan password untuk akun baru.
 *
 * - Nama dari faker.js, hanya huruf/spasi
 * - Email memakai firstName + lastName dari hasil generate nama
 * - emailSuffix ditambahkan ke username email
 */

import { faker } from "@faker-js/faker";
import { PASSWORD, DOMAINS } from "../config.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function isPlainName(name) {
  return /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name);
}

function sanitizeName(name) {
  return normalizeSpaces(name.replace(/[^A-Za-z\s]/g, " "));
}

function generateSafeNamePart(generator) {
  let name = "";
  do {
    name = normalizeSpaces(generator());
  } while (!isPlainName(name));
  return name;
}

function toEmailPart(name) {
  return sanitizeName(name).toLowerCase().replace(/\s+/g, "");
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function generateEmail(firstName, lastName, emailSuffix = "") {
  const domain = faker.helpers.arrayElement(DOMAINS);
  const username = `${toEmailPart(firstName)}${toEmailPart(lastName)}${emailSuffix}`;
  return `${username}@${domain}`;
}

export function generateName() {
  const first = generateSafeNamePart(() => faker.person.firstName());
  const last = generateSafeNamePart(() => faker.person.lastName());

  return { firstName: first, lastName: last, fullName: `${first} ${last}` };
}

/** Buat 1 akun (email + password + nama) */
export function generateAccount(emailSuffix = "") {
  const { firstName, lastName, fullName } = generateName();
  return {
    email: generateEmail(firstName, lastName, emailSuffix),
    password: PASSWORD,
    firstName,
    lastName,
    fullName,
  };
}
