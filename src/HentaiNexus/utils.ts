/* SPDX-License-Identifier: GPL-3.0-or-later */

// Port of HentaiNexus' reader payload decryption.
//
// The `initReader("...")` argument is a base64 blob: the first 15 bytes are
// XOR-masked with the hostname, the next 64 bytes are an RC4 key stream and the
// remainder is ciphertext decrypted with a prime-stepped RC4 variant.

const HOSTNAME = "hentainexus.com";
const PRIME_IDX_XOR_MASK = 12;
const PRIME_NUMBERS = [2, 3, 5, 7, 11, 13, 17, 19];

export function decryptReaderData(encoded: string): string {
  const decoded = Application.base64Decode(encoded);
  const bytes =
    typeof decoded === "string" ? utf8ToBytes(decoded) : new Uint8Array(decoded as ArrayBuffer);

  const data = Uint8Array.from(bytes);

  for (let i = 0; i < HOSTNAME.length; i++) {
    data[i] = (data[i]! ^ HOSTNAME.charCodeAt(i)) & 0xff;
  }

  const keyStream: number[] = [];
  for (let i = 0; i < 64; i++) {
    keyStream.push(data[i]!);
  }
  const ciphertext: number[] = [];
  for (let i = 64; i < data.length; i++) {
    ciphertext.push(data[i]!);
  }

  const digest: number[] = [];
  for (let i = 0; i < 256; i++) {
    digest.push(i);
  }

  let primeIdx = 0;
  for (let i = 0; i < 64; i++) {
    primeIdx = primeIdx ^ keyStream[i]!;
    for (let j = 0; j < 8; j++) {
      primeIdx = (primeIdx & 1) !== 0 ? (primeIdx >>> 1) ^ PRIME_IDX_XOR_MASK : primeIdx >>> 1;
    }
  }
  primeIdx = primeIdx & 7;

  let temp: number;
  let key = 0;
  for (let i = 0; i < 256; i++) {
    key = (key + digest[i]! + keyStream[i % 64]!) % 256;
    temp = digest[i]!;
    digest[i] = digest[key]!;
    digest[key] = temp;
  }

  const q = PRIME_NUMBERS[primeIdx]!;
  let k = 0;
  let n = 0;
  let p = 0;
  let xorKey = 0;
  let out = "";
  for (let i = 0; i < ciphertext.length; i++) {
    k = (k + q) % 256;
    n = (p + digest[(n + digest[k]!) % 256]!) % 256;
    p = (p + k + digest[k]!) % 256;
    temp = digest[k]!;
    digest[k] = digest[n]!;
    digest[n] = temp;
    xorKey = digest[(n + digest[(k + digest[(xorKey + p) % 256]!) % 256]!) % 256]!;
    out += String.fromCharCode(ciphertext[i]! ^ xorKey);
  }
  return out;
}

// Fallback when base64Decode returns a (latin1) string rather than a buffer.
function utf8ToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}
