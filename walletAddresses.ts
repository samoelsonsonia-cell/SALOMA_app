import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SigningKey,
  decodeBase58,
  encodeBase58,
  getAddress,
  isAddress,
  keccak256
} from 'ethers';

/**
 * Known token contract / system / zero / placeholder addresses that MUST NEVER
 * be used as a user deposit or withdrawal wallet address.
 */
export const KNOWN_NON_WALLET_CONTRACT_ADDRESSES = new Set<string>([
  // EVM token & system contracts
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000001010', // Polygon POL system contract
  '0x55d398326f99059ff775485246999027b3197955', // BSC USDT token contract
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // ETH USDT token contract
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // ETH USDC token contract
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BSC USDC token contract
  '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BSC BUSD token contract
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC token contract
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // BSC ETH token contract
  '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe', // BSC XRP token contract
  '0xba2ae424d960c26247dd6c32edc70b295c744c43', // BSC DOGE token contract
  '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47', // BSC ADA token contract
  '0x76a797a59ba2c17726896976b7b3747bfd1d220f', // BSC TON token contract
  '0x6982508145454ce325ddbe47a25d4ec3d2311933', // ETH PEPE token contract
  '0x25d887ce7a35172c62febfd67a1856620daeb000', // BSC PEPE token contract
  '0x4338665cbb7b2485a8855a139b75d5e34ab0db94', // BSC LTC token contract
  '0xce7de646e7208a4ef112cb6ed5038fa6cc6b12e3', // BSC TRX token contract
  '0x514910771af9ca656af840dff83e8264ecf986ca', // ETH LINK token contract
  '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd', // BSC LINK token contract
  '0x53e0bca35ec356bd5dddfebd1fc0fd03fabad39'.toLowerCase(),
  '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39', // Polygon LINK token contract
  '0x7083609fce4d1d8dc0c979aab8c869ea2c873402', // BSC DOT token contract
  '0x8ff795a6f4d97e7887c79bea79aba5cc76444adf', // BSC BCH token contract
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // ETH SHIB token contract
  '0x2859e4544c4bb03966803b044a93563bd2d0dd4d', // BSC SHIB token contract
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // ETH UNI token contract
  '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0', // Arbitrum UNI token contract
  '0x912ce59144191c1204e64559fe8253a0e49e6548', // Arbitrum ARB token contract
  '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1', // ETH ARB token contract
  '0x4200000000000000000000000000000000000042', // Optimism OP token contract
  '0x0d8ce2a99bb6e3b7db580ed848240e4a0f9ae153', // BSC FIL token contract
  '0xe28b3b32b6c345a34ff64674606124d55ca0a778', // ETH INJ token contract
  '0xaea46a60368a7bd060eec7df8cba43b7ef41ad85', // ETH FET token contract
  '0xfb5b838b6cfeedc2873ab27866079ac55363d37e', // BSC FLOKI token contract
  '0xcf0c122c6b73ff809c693db761e7baebe62b6a2e', // ETH FLOKI token contract
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // ETH AAVE token contract
  '0xd6df932a45c0f255f85145f286ea0b292b21c90b', // Polygon AAVE token contract
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // ETH MKR token contract
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32', // ETH LDO token contract
  '0x9623063377ad1b27544c965ccd7342f7ea7e88c7', // Arbitrum GRT token contract
  '0xc944e90c64b2c07662a292be6244bdf05cda44a7', // ETH GRT token contract
  '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff', // ETH IMX token contract
  '0x3d6545b08693dae087e957cb1180ee38b9e3c25e', // BSC ETC token contract
  '0x455e53cbb86018ac2b8092fdcd39d8444affc3f6', // ETH POL token contract
  '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3', // ETH ONDO token contract
  // TRON & Solana token contracts / mints & legacy static strings
  'tr7nhqjekqxgtci8q8zy4pl8otszgjlJ6t'.toLowerCase(),
  'tehxiyth9x34d5v26u64y6q4z7y2p7k9w1',
  'epjfwdd5aufqssqeM2qn1xzybapc8g4weggkzwytdt1v'.toLowerCase(),
  'es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb',
  'dezxaz8z7pnrnrjjz3wxborGixca6xjnb7yab1ppb263'.toLowerCase(),
  'jupywryjfskupiha7hker8vutaefosybkedznsdvcn'.toLowerCase(),
  'jupyiwryjfskupiha7hker8vutaefosybkedznsdvcn',
  'ekpqgsjtjmfqkz9kqansqyxrcf8fbopzlhyxdm65zcjm',
  'rndrizkt3mk1iimdxrdwabcf7zg7ar5t4nud4ekhbof',
  'tjx9zk2b7ymnq9slo2481a2026salomatrc',
  'bc1q9h6x743j2y0z5v4km89x2026saloma',
  '0x992b28b3eb9229555c09f6ef83a8992026'
]);

const MASTER_SEED_FILE = (() => {
  const cwdFile = path.join(process.cwd(), '.saloma-wallet-master.key');
  const tmpFile = path.join(os.tmpdir(), '.saloma-wallet-master.key');
  if (fs.existsSync(cwdFile)) return cwdFile;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return tmpFile;
  return cwdFile;
})();

let cachedMasterSeed: string | null = null;

function getWalletMasterSeed(): string {
  if (cachedMasterSeed) return cachedMasterSeed;

  const envSeed =
    String(process.env.SALOMA_WALLET_MASTER_SEED || '').trim() ||
    String(process.env.WALLET_MASTER_KEY || '').trim();
  if (envSeed) {
    cachedMasterSeed = envSeed;
    return cachedMasterSeed;
  }

  const appwriteSecret = String(process.env.APPWRITE_API_KEY || '').trim();
  if (appwriteSecret) {
    const projectId = String(process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || 'saloma').trim();
    cachedMasterSeed = crypto
      .createHmac('sha256', appwriteSecret)
      .update(`SALOMA_WALLET_MASTER_V1:${projectId}`)
      .digest('hex');
    return cachedMasterSeed;
  }

  try {
    if (fs.existsSync(MASTER_SEED_FILE)) {
      const existing = fs.readFileSync(MASTER_SEED_FILE, 'utf8').trim();
      if (existing.length >= 32) {
        cachedMasterSeed = existing;
        return cachedMasterSeed;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(MASTER_SEED_FILE, generated, { mode: 0o600 });
    cachedMasterSeed = generated;
    return cachedMasterSeed;
  } catch {
    cachedMasterSeed = crypto
      .createHash('sha256')
      .update(`SALOMA_FALLBACK_SEED:${os.hostname()}:${process.cwd()}`)
      .digest('hex');
    return cachedMasterSeed;
  }
}

function deriveSeed32(userId: string, domain: string): Buffer {
  return crypto
    .createHmac('sha256', getWalletMasterSeed())
    .update(`saloma-wallet-v1:${userId}:${domain}`)
    .digest();
}

export function deriveSecp256k1Key(userId: string, domain: string) {
  for (let counter = 0; counter < 16; counter++) {
    const seed = deriveSeed32(userId, counter === 0 ? domain : `${domain}#${counter}`);
    const privHex = '0x' + seed.toString('hex');
    try {
      const sk = new SigningKey(privHex);
      const compressedPub = Buffer.from(sk.compressedPublicKey.slice(2), 'hex');
      const uncompressedPub = Buffer.from(sk.publicKey.slice(2), 'hex');
      return {
        privateKeyHex: privHex,
        signingKey: sk,
        compressedPub,
        uncompressedPub
      };
    } catch {
      // retry next counter if seed >= secp256k1.n
    }
  }
  throw new Error('Impossible de dériver une clé secp256k1 valide.');
}

export function deriveEd25519Key(userId: string, domain: string) {
  const seed32 = deriveSeed32(userId, domain);
  // RFC 8410 PKCS#8 DER prefix for Ed25519 private key (32-byte seed)
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privateKeyObj = crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, seed32]),
    format: 'der',
    type: 'pkcs8'
  });
  const spkiDer = crypto.createPublicKey(privateKeyObj).export({
    format: 'der',
    type: 'spki'
  }) as Buffer;
  const publicKey32 = spkiDer.subarray(-32);
  return {
    seed32,
    privateKeyObj,
    spkiDer,
    publicKey32
  };
}

function sha256(buf: Buffer): Buffer {
  return crypto.createHash('sha256').update(buf).digest();
}

function hash160(buf: Buffer): Buffer {
  return crypto.createHash('ripemd160').update(sha256(buf)).digest();
}

// --- RFC 7693 BLAKE2b (supports exact outlen 1..64) ---
const BLAKE2B_IV = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n
];

const BLAKE2B_SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3]
];

const MASK64 = 0xffffffffffffffffn;
function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function blake2bCompress(h: bigint[], block: Buffer, t: bigint, last: boolean): void {
  const v = new Array<bigint>(16);
  const m = new Array<bigint>(16);
  for (let i = 0; i < 8; i++) v[i] = h[i];
  for (let i = 0; i < 8; i++) v[i + 8] = BLAKE2B_IV[i];
  v[12] ^= t & MASK64;
  v[13] ^= (t >> 64n) & MASK64;
  if (last) v[14] ^= MASK64;

  for (let i = 0; i < 16; i++) {
    m[i] = block.readBigUInt64LE(i * 8);
  }

  const G = (a: number, b: number, c: number, d: number, x: bigint, y: bigint) => {
    v[a] = (v[a] + v[b] + x) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 32n);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 24n);
    v[a] = (v[a] + v[b] + y) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 16n);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 63n);
  };

  for (let r = 0; r < 12; r++) {
    const s = BLAKE2B_SIGMA[r];
    G(0, 4, 8, 12, m[s[0]], m[s[1]]);
    G(1, 5, 9, 13, m[s[2]], m[s[3]]);
    G(2, 6, 10, 14, m[s[4]], m[s[5]]);
    G(3, 7, 11, 15, m[s[6]], m[s[7]]);
    G(0, 5, 10, 15, m[s[8]], m[s[9]]);
    G(1, 6, 11, 12, m[s[10]], m[s[11]]);
    G(2, 7, 8, 13, m[s[12]], m[s[13]]);
    G(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }

  for (let i = 0; i < 8; i++) {
    h[i] ^= v[i] ^ v[i + 8];
  }
}

export function blake2b(input: Buffer, outlen: number): Buffer {
  const h = [...BLAKE2B_IV];
  h[0] ^= 0x01010000n ^ BigInt(outlen);
  let t = 0n;
  let offset = 0;
  while (input.length - offset > 128) {
    const block = input.subarray(offset, offset + 128);
    offset += 128;
    t += 128n;
    blake2bCompress(h, block, t, false);
  }
  const rem = input.length - offset;
  const lastBlock = Buffer.alloc(128, 0);
  if (rem > 0) input.subarray(offset).copy(lastBlock);
  t += BigInt(rem);
  blake2bCompress(h, lastBlock, t, true);

  const out = Buffer.alloc(64);
  for (let i = 0; i < 8; i++) {
    out.writeBigUInt64LE(h[i], i * 8);
  }
  return out.subarray(0, outlen);
}

// --- BASE58 / BASE58CHECK ---
const XRP_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
const STD_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58EncodeRaw(buf: Buffer, alphabet: string = STD_ALPHABET): string {
  if (alphabet === STD_ALPHABET) {
    return encodeBase58(buf);
  }
  let x = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (x > 0n) {
    const mod = Number(x % 58n);
    out = alphabet[mod] + out;
    x /= 58n;
  }
  for (let i = 0; i < buf.length && buf[i] === 0; i++) {
    out = alphabet[0] + out;
  }
  return out || alphabet[0];
}

function base58CheckEncode(payload: Buffer, alphabet: string = STD_ALPHABET): string {
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58EncodeRaw(Buffer.concat([payload, checksum]), alphabet);
}

export function isValidBase58Check(addr: string, expectedVersionByte?: number): boolean {
  try {
    const num = decodeBase58(addr);
    let hex = num.toString(16);
    if (hex.length % 2 === 1) hex = '0' + hex;
    let body = Buffer.from(hex, 'hex');
    let leadingZeros = 0;
    for (const ch of addr) {
      if (ch === '1') leadingZeros++;
      else break;
    }
    if (leadingZeros > 0) {
      body = Buffer.concat([Buffer.alloc(leadingZeros, 0), body]);
    }
    if (body.length < 5) return false;
    const payload = body.subarray(0, body.length - 4);
    const checksum = body.subarray(body.length - 4);
    const expected = sha256(sha256(payload)).subarray(0, 4);
    if (!checksum.equals(expected)) return false;
    if (expectedVersionByte !== undefined && payload[0] !== expectedVersionByte) return false;
    return true;
  } catch {
    return false;
  }
}

// --- BECH32 & BECH32M (BIP-173 / BIP-350) ---
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: Buffer, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv);
  }
  return ret;
}

function bech32EncodeWords(hrp: string, words: number[], specConst: number): string {
  const values = [...bech32HrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0];
  const polymod = bech32Polymod(values) ^ specConst;
  const checksum: number[] = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  return hrp + '1' + [...words, ...checksum].map(d => BECH32_CHARSET[d]).join('');
}

function segwitEncode(hrp: string, witnessVersion: number, program: Buffer): string {
  const words = [witnessVersion, ...convertBits(program, 8, 5, true)];
  return bech32EncodeWords(hrp, words, witnessVersion === 0 ? BECH32_CONST : BECH32M_CONST);
}

function bech32DataEncode(hrp: string, data: Buffer): string {
  const words = convertBits(data, 8, 5, true);
  return bech32EncodeWords(hrp, words, BECH32_CONST);
}

export function isValidBech32(addr: string, expectedHrp?: string): boolean {
  const lower = addr.toLowerCase();
  if (addr !== lower && addr !== addr.toUpperCase()) return false;
  const pos = lower.lastIndexOf('1');
  if (pos < 1 || pos + 7 > lower.length) return false;
  const hrp = lower.slice(0, pos);
  if (expectedHrp && hrp !== expectedHrp) return false;
  const dataPart = lower.slice(pos + 1);
  const words: number[] = [];
  for (const ch of dataPart) {
    const idx = BECH32_CHARSET.indexOf(ch);
    if (idx === -1) return false;
    words.push(idx);
  }
  const chk = bech32Polymod([...bech32HrpExpand(hrp), ...words]);
  return chk === BECH32_CONST || chk === BECH32M_CONST;
}

// --- CASHADDR (BITCOIN CASH) ---
function cashAddrPolymod(values: number[]): bigint {
  const GENERATORS = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    for (let i = 0; i < 5; i++) {
      if ((c0 >> BigInt(i)) & 1n) c ^= GENERATORS[i];
    }
  }
  return c ^ 1n;
}

function encodeCashAddr(hash20: Buffer): string {
  const prefix = 'bitcoincash';
  const prefixData = [...prefix].map(c => c.charCodeAt(0) & 0x1f);
  const payload = convertBits(Buffer.concat([Buffer.from([0x00]), hash20]), 8, 5, true);
  const checksumInput = [...prefixData, 0, ...payload, 0, 0, 0, 0, 0, 0, 0, 0];
  const poly = cashAddrPolymod(checksumInput);
  const checksum: number[] = [];
  for (let i = 0; i < 8; i++) {
    checksum.push(Number((poly >> BigInt(5 * (7 - i))) & 0x1fn));
  }
  return (
    prefix +
    ':' +
    [...payload, ...checksum].map(d => BECH32_CHARSET[d]).join('')
  );
}

// --- BASE32 / C32CHECK / CRC16 / CRC32 ---
const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf: Buffer, lowercase = false): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHA[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHA[(value << (5 - bits)) & 31];
  }
  return lowercase ? output.toLowerCase() : output;
}

function crc16XModem(buf: Buffer): number {
  let crc = 0x0000;
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function crc32Bytes(buf: Buffer): Buffer {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return out;
}

const C32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function c32CheckEncode(version: number, hash20: Buffer): string {
  const payload = Buffer.concat([Buffer.from([version]), hash20]);
  const ck = sha256(sha256(payload)).subarray(0, 4);
  const full = Buffer.concat([hash20, ck]);
  let num = BigInt('0x' + full.toString('hex'));
  let chars = '';
  while (num > 0n) {
    chars = C32_ALPHABET[Number(num % 32n)] + chars;
    num /= 32n;
  }
  let leadingZeros = 0;
  for (const b of full) {
    if (b === 0) leadingZeros++;
    else break;
  }
  return 'S' + C32_ALPHABET[version] + '0'.repeat(leadingZeros) + chars;
}

// --- CHAIN-SPECIFIC REAL WALLET GENERATION ---
export function getChainFamily(chain: string): string {
  const norm = chain.trim().toUpperCase();
  if (
    [
      'BEP20',
      'ERC20',
      'POLYGON',
      'ARBITRUM',
      'OPTIMISM',
      'BASE',
      'AVAX-C',
      'OPBNB',
      'VECHAIN',
      'ETC',
      'HEDERA'
    ].includes(norm)
  ) {
    return 'EVM';
  }
  if (norm === 'TRC20') return 'TRON';
  if (norm === 'BTC-NATIVE') return 'BTC_SEGWIT';
  if (norm === 'TAPROOT') return 'BTC_TAPROOT';
  if (norm === 'LIGHTNING') return 'BTC_LIGHTNING';
  if (norm === 'SOLANA') return 'SOLANA';
  if (norm === 'RIPPLE') return 'RIPPLE';
  if (norm === 'DOGECOIN') return 'DOGECOIN';
  if (norm === 'CARDANO') return 'CARDANO';
  if (norm === 'TON') return 'TON';
  if (norm === 'SUI') return 'SUI';
  if (norm === 'LITECOIN') return 'LITECOIN';
  if (norm === 'POLKADOT') return 'POLKADOT';
  if (norm === 'BCH') return 'BCH';
  if (norm === 'NEAR') return 'NEAR';
  if (norm === 'APTOS') return 'APTOS';
  if (norm === 'COSMOS') return 'COSMOS';
  if (norm === 'ICP') return 'ICP';
  if (norm === 'FILECOIN') return 'FILECOIN';
  if (norm === 'STELLAR') return 'STELLAR';
  if (norm === 'ALGORAND') return 'ALGORAND';
  if (norm === 'INJECTIVE') return 'INJECTIVE';
  if (norm === 'SEI') return 'SEI';
  if (norm === 'CELESTIA') return 'CELESTIA';
  if (norm === 'FETCH') return 'FETCH';
  if (norm === 'STACKS') return 'STACKS';
  if (norm === 'THORCHAIN') return 'THORCHAIN';
  if (norm === 'SALOMANET') return 'SALOMANET';
  return 'EVM';
}

export const ALL_SUPPORTED_CHAINS = [
  'BTC-Native',
  'Taproot',
  'Lightning',
  'BEP20',
  'ERC20',
  'Arbitrum',
  'Optimism',
  'Base',
  'Polygon',
  'TRC20',
  'Solana',
  'AVAX-C',
  'TON',
  'opBNB',
  'SalomaNet',
  'Ripple',
  'Dogecoin',
  'Cardano',
  'Sui',
  'Litecoin',
  'Polkadot',
  'BCH',
  'NEAR',
  'Aptos',
  'Cosmos',
  'ICP',
  'Filecoin',
  'Hedera',
  'Stellar',
  'VeChain',
  'Algorand',
  'Injective',
  'Sei',
  'Celestia',
  'Fetch',
  'Stacks',
  'THORChain',
  'ETC'
] as const;

function deriveAddressForFamily(userId: string, family: string, symbolTag?: string): string {
  const scope = symbolTag ? `${userId}:coin:${symbolTag}` : userId;
  switch (family) {
    case 'EVM': {
      for (let i = 0; i < 8; i++) {
        const { uncompressedPub } = deriveSecp256k1Key(scope, i === 0 ? 'evm' : `evm#${i}`);
        const hash = keccak256('0x' + uncompressedPub.subarray(1).toString('hex'));
        const eoa = getAddress('0x' + hash.slice(-40));
        if (!KNOWN_NON_WALLET_CONTRACT_ADDRESSES.has(eoa.toLowerCase())) {
          return eoa;
        }
      }
      throw new Error('EVM address collision with contract.');
    }
    case 'TRON': {
      for (let i = 0; i < 8; i++) {
        const { uncompressedPub } = deriveSecp256k1Key(scope, i === 0 ? 'tron' : `tron#${i}`);
        const hash = keccak256('0x' + uncompressedPub.subarray(1).toString('hex'));
        const addr20 = Buffer.from(hash.slice(-40), 'hex');
        const tronAddr = base58CheckEncode(Buffer.concat([Buffer.from([0x41]), addr20]));
        if (!KNOWN_NON_WALLET_CONTRACT_ADDRESSES.has(tronAddr.toLowerCase())) {
          return tronAddr;
        }
      }
      throw new Error('TRON address collision.');
    }
    case 'BTC_SEGWIT': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'btc-segwit');
      return segwitEncode('bc', 0, hash160(compressedPub));
    }
    case 'BTC_TAPROOT': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'btc-taproot');
      return segwitEncode('bc', 1, compressedPub.subarray(1, 33));
    }
    case 'BTC_LIGHTNING': {
      const tag = crypto.createHash('sha256').update(`ln:${scope}`).digest('hex').slice(0, 16);
      const lnurlUrl = Buffer.from(`https://saloma.exchange/.well-known/lnurlp/${tag}`, 'utf8');
      return bech32DataEncode('lnurl', lnurlUrl);
    }
    case 'SOLANA': {
      const { publicKey32 } = deriveEd25519Key(scope, 'solana');
      return encodeBase58(publicKey32);
    }
    case 'RIPPLE': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'ripple');
      return base58CheckEncode(Buffer.concat([Buffer.from([0x00]), hash160(compressedPub)]), XRP_ALPHABET);
    }
    case 'DOGECOIN': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'dogecoin');
      return base58CheckEncode(Buffer.concat([Buffer.from([0x1e]), hash160(compressedPub)]));
    }
    case 'LITECOIN': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'litecoin');
      return segwitEncode('ltc', 0, hash160(compressedPub));
    }
    case 'BCH': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'bch');
      return encodeCashAddr(hash160(compressedPub));
    }
    case 'CARDANO': {
      const { publicKey32 } = deriveEd25519Key(scope, 'cardano');
      const keyHash28 = blake2b(publicKey32, 28);
      const header = Buffer.from([0x61]); // Mainnet Shelley Enterprise Address
      return bech32DataEncode('addr', Buffer.concat([header, keyHash28]));
    }
    case 'TON': {
      const { publicKey32 } = deriveEd25519Key(scope, 'ton');
      const body = Buffer.concat([Buffer.from([0x51, 0x00]), publicKey32]);
      const crc = crc16XModem(body);
      const crcBuf = Buffer.alloc(2);
      crcBuf.writeUInt16BE(crc, 0);
      return Buffer.concat([body, crcBuf]).toString('base64url');
    }
    case 'SUI': {
      const { publicKey32 } = deriveEd25519Key(scope, 'sui');
      return '0x' + blake2b(Buffer.concat([Buffer.from([0x00]), publicKey32]), 32).toString('hex');
    }
    case 'APTOS': {
      const { publicKey32 } = deriveEd25519Key(scope, 'aptos');
      const digest = crypto
        .createHash('sha3-256')
        .update(Buffer.concat([publicKey32, Buffer.from([0x00])]))
        .digest('hex');
      return '0x' + digest;
    }
    case 'NEAR': {
      const { publicKey32 } = deriveEd25519Key(scope, 'near');
      return publicKey32.toString('hex');
    }
    case 'POLKADOT': {
      const { publicKey32 } = deriveEd25519Key(scope, 'polkadot');
      const payload = Buffer.concat([Buffer.from([0x00]), publicKey32]);
      const ck = blake2b(Buffer.concat([Buffer.from('SS58PRE', 'utf8'), payload]), 64).subarray(0, 2);
      return encodeBase58(Buffer.concat([payload, ck]));
    }
    case 'STELLAR': {
      const { publicKey32 } = deriveEd25519Key(scope, 'stellar');
      const payload = Buffer.concat([Buffer.from([0x30]), publicKey32]);
      const crc = crc16XModem(payload);
      const crcBuf = Buffer.alloc(2);
      crcBuf.writeUInt16LE(crc, 0);
      return base32Encode(Buffer.concat([payload, crcBuf]));
    }
    case 'ALGORAND': {
      const { publicKey32 } = deriveEd25519Key(scope, 'algorand');
      const ck = crypto.createHash('sha512-256').update(publicKey32).digest().subarray(-4);
      return base32Encode(Buffer.concat([publicKey32, ck]));
    }
    case 'COSMOS': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'cosmos');
      return bech32DataEncode('cosmos', hash160(compressedPub));
    }
    case 'INJECTIVE': {
      const { uncompressedPub } = deriveSecp256k1Key(scope, 'injective');
      const hash = keccak256('0x' + uncompressedPub.subarray(1).toString('hex'));
      return bech32DataEncode('inj', Buffer.from(hash.slice(-40), 'hex'));
    }
    case 'SEI': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'sei');
      return bech32DataEncode('sei', hash160(compressedPub));
    }
    case 'CELESTIA': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'celestia');
      return bech32DataEncode('celestia', hash160(compressedPub));
    }
    case 'FETCH': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'fetch');
      return bech32DataEncode('fetch', hash160(compressedPub));
    }
    case 'THORCHAIN': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'thorchain');
      return bech32DataEncode('thor', hash160(compressedPub));
    }
    case 'SALOMANET': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'salomanet');
      return bech32DataEncode('saloma', hash160(compressedPub));
    }
    case 'FILECOIN': {
      const { uncompressedPub } = deriveSecp256k1Key(scope, 'filecoin');
      const payload = blake2b(uncompressedPub, 20);
      const ck = blake2b(Buffer.concat([Buffer.from([0x01]), payload]), 4);
      return 'f1' + base32Encode(Buffer.concat([payload, ck]), true);
    }
    case 'STACKS': {
      const { compressedPub } = deriveSecp256k1Key(scope, 'stacks');
      return c32CheckEncode(22, hash160(compressedPub));
    }
    case 'ICP': {
      const { spkiDer } = deriveEd25519Key(scope, 'icp');
      const domainSep = Buffer.from('\x0aaccount-id', 'utf8');
      const subaccount = Buffer.alloc(32, 0);
      const accountHash = crypto
        .createHash('sha224')
        .update(Buffer.concat([domainSep, spkiDer, subaccount]))
        .digest();
      return Buffer.concat([crc32Bytes(accountHash), accountHash]).toString('hex');
    }
    default: {
      const { uncompressedPub } = deriveSecp256k1Key(scope, 'evm');
      const hash = keccak256('0x' + uncompressedPub.subarray(1).toString('hex'));
      return getAddress('0x' + hash.slice(-40));
    }
  }
}

export const SALOMA_COIN_CHAINS: Readonly<Record<string, readonly string[]>> = {
  BTC: ['BTC-Native', 'Taproot', 'Lightning', 'BEP20', 'ERC20'],
  ETH: ['ERC20', 'Arbitrum', 'Optimism', 'Base', 'BEP20', 'Polygon'],
  USDT: ['TRC20', 'BEP20', 'ERC20', 'Polygon', 'Solana', 'Arbitrum', 'Optimism', 'AVAX-C', 'TON'],
  SOL: ['Solana', 'BEP20'],
  BNB: ['BEP20', 'opBNB'],
  SALOMA: ['SalomaNet', 'BEP20', 'Polygon'],
  XRP: ['Ripple', 'BEP20'],
  DOGE: ['Dogecoin', 'BEP20'],
  ADA: ['Cardano', 'BEP20'],
  TON: ['TON', 'BEP20'],
  AVAX: ['AVAX-C', 'BEP20'],
  SUI: ['Sui'],
  PEPE: ['ERC20', 'BEP20'],
  LTC: ['Litecoin', 'BEP20'],
  TRX: ['TRC20', 'BEP20'],
  LINK: ['ERC20', 'BEP20', 'Polygon'],
  DOT: ['Polkadot', 'BEP20'],
  BCH: ['BCH', 'BEP20'],
  SHIB: ['ERC20', 'BEP20'],
  NEAR: ['NEAR', 'BEP20'],
  UNI: ['ERC20', 'Arbitrum'],
  APT: ['Aptos'],
  ARB: ['Arbitrum', 'ERC20'],
  OP: ['Optimism'],
  ATOM: ['Cosmos'],
  ICP: ['ICP'],
  FIL: ['Filecoin', 'BEP20'],
  HBAR: ['Hedera'],
  XLM: ['Stellar'],
  VET: ['VeChain'],
  ALGO: ['Algorand'],
  INJ: ['Injective', 'ERC20'],
  SEI: ['Sei'],
  TIA: ['Celestia'],
  RENDER: ['Solana'],
  FET: ['ERC20', 'Fetch'],
  JUP: ['Solana'],
  WIF: ['Solana'],
  BONK: ['Solana'],
  FLOKI: ['BEP20', 'ERC20'],
  AAVE: ['ERC20', 'Polygon'],
  MKR: ['ERC20'],
  LDO: ['ERC20'],
  GRT: ['Arbitrum', 'ERC20'],
  IMX: ['ERC20'],
  STX: ['Stacks'],
  RUNE: ['THORChain'],
  ETC: ['ETC', 'BEP20'],
  POL: ['Polygon', 'ERC20'],
  MATIC: ['Polygon', 'ERC20'],
  ONDO: ['ERC20']
};

function normalizeCoinSymbol(symbol?: string): string {
  const upper = String(symbol || '').toUpperCase().trim();
  if (!upper) return '';
  return upper === 'MATIC' ? 'POL' : upper;
}

const USER_WALLET_MAP_CACHE = new Map<string, Record<string, string>>();

export function getUserAddressForChain(userId: string, chain: string, symbol?: string): string {
  const cleanUser = String(userId || '').trim();
  if (!cleanUser) {
    throw new Error('Identifiant utilisateur requis pour générer une adresse wallet.');
  }
  const cleanSym = normalizeCoinSymbol(symbol);
  if (cleanSym) {
    const cached = USER_WALLET_MAP_CACHE.get(cleanUser);
    const key = `${cleanSym}:${chain}`;
    if (cached?.[key]) return cached[key];
  }
  const family = getChainFamily(chain);
  return deriveAddressForFamily(cleanUser, family, cleanSym || undefined);
}

export function getUserWalletAddresses(userId: string): Record<string, string> {
  const cleanUser = String(userId || '').trim();
  if (!cleanUser) return {};

  const cached = USER_WALLET_MAP_CACHE.get(cleanUser);
  if (cached) {
    return cached;
  }

  const familyCache = new Map<string, string>();
  const out: Record<string, string> = {};

  for (const chain of ALL_SUPPORTED_CHAINS) {
    const family = getChainFamily(chain);
    let addr = familyCache.get(family);
    if (!addr) {
      addr = deriveAddressForFamily(cleanUser, family);
      familyCache.set(family, addr);
    }
    out[chain] = addr;
  }

  for (const [symbol, chains] of Object.entries(SALOMA_COIN_CHAINS)) {
    const canonicalSym = normalizeCoinSymbol(symbol);
    for (const chain of chains) {
      const family = getChainFamily(chain);
      const cacheKey = `${canonicalSym}:${family}`;
      let addr = familyCache.get(cacheKey);
      if (!addr) {
        addr = deriveAddressForFamily(cleanUser, family, canonicalSym);
        familyCache.set(cacheKey, addr);
      }
      out[`${symbol}:${chain}`] = addr;
    }
  }

  if (USER_WALLET_MAP_CACHE.size >= 5000) {
    const oldestKey = USER_WALLET_MAP_CACHE.keys().next().value;
    if (oldestKey) USER_WALLET_MAP_CACHE.delete(oldestKey);
  }
  USER_WALLET_MAP_CACHE.set(cleanUser, out);

  return out;
}

export function validateWalletAddressForChain(
  rawAddress: string,
  chain: string
): { valid: boolean; normalized?: string; error?: string } {
  const trimmed = String(rawAddress || '').trim();
  if (!trimmed || trimmed.length < 6) {
    return { valid: false, error: 'Adresse de portefeuille invalide ou trop courte.' };
  }

  if (KNOWN_NON_WALLET_CONTRACT_ADDRESSES.has(trimmed.toLowerCase())) {
    return {
      valid: false,
      error:
        'Adresse refusée : ceci est une adresse de contrat token, pas une adresse de portefeuille (wallet).'
    };
  }

  const family = getChainFamily(chain);
  switch (family) {
    case 'EVM': {
      if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed) || !isAddress(trimmed)) {
        return {
          valid: false,
          error: `Adresse ${chain} invalide : doit être une adresse wallet EVM valide (0x... 42 caractères).`
        };
      }
      return { valid: true, normalized: getAddress(trimmed) };
    }
    case 'TRON': {
      if (!trimmed.startsWith('T') || trimmed.length !== 34 || !isValidBase58Check(trimmed, 0x41)) {
        return {
          valid: false,
          error: 'Adresse TRC20 invalide : doit être une vraie adresse TRON commençant par T (34 caractères Base58Check).'
        };
      }
      return { valid: true, normalized: trimmed };
    }
    case 'BTC_SEGWIT':
    case 'BTC_TAPROOT': {
      if (isValidBech32(trimmed, 'bc') || isValidBase58Check(trimmed, 0x00) || isValidBase58Check(trimmed, 0x05)) {
        return { valid: true, normalized: trimmed };
      }
      return {
        valid: false,
        error: 'Adresse Bitcoin invalide (format bc1q / bc1p / 1... / 3... requis).'
      };
    }
    case 'BTC_LIGHTNING': {
      if (
        isValidBech32(trimmed, 'lnurl') ||
        /^lnbc[0-9a-z]+$/i.test(trimmed) ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ) {
        return { valid: true, normalized: trimmed };
      }
      return { valid: false, error: 'Adresse Lightning invalide.' };
    }
    case 'SOLANA': {
      try {
        const num = decodeBase58(trimmed);
        let hex = num.toString(16);
        if (hex.length % 2 === 1) hex = '0' + hex;
        const len = Math.ceil(hex.length / 2);
        if (trimmed.length >= 32 && trimmed.length <= 44 && len <= 32) {
          return { valid: true, normalized: trimmed };
        }
      } catch {
        // invalid base58
      }
      return { valid: false, error: 'Adresse Solana (Base58) invalide.' };
    }
    case 'DOGECOIN': {
      if (!isValidBase58Check(trimmed, 0x1e) && !isValidBase58Check(trimmed, 0x16)) {
        return { valid: false, error: 'Adresse Dogecoin invalide (doit commencer par D).' };
      }
      return { valid: true, normalized: trimmed };
    }
    case 'LITECOIN': {
      if (
        !isValidBech32(trimmed, 'ltc') &&
        !isValidBase58Check(trimmed, 0x30) &&
        !isValidBase58Check(trimmed, 0x32)
      ) {
        return { valid: false, error: 'Adresse Litecoin invalide.' };
      }
      return { valid: true, normalized: trimmed };
    }
    case 'CARDANO': {
      if (!isValidBech32(trimmed, 'addr')) {
        return { valid: false, error: 'Adresse Cardano (addr1...) invalide.' };
      }
      return { valid: true, normalized: trimmed };
    }
    case 'SUI':
    case 'APTOS': {
      if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
        return { valid: false, error: `Adresse ${chain} invalide (0x + 64 caractères hex requis).` };
      }
      return { valid: true, normalized: trimmed.toLowerCase() };
    }
    case 'TON': {
      if (!/^[EU]Q[A-Za-z0-9_-]{46}$/.test(trimmed)) {
        return { valid: false, error: 'Adresse TON invalide (48 caractères EQ/UQ).' };
      }
      return { valid: true, normalized: trimmed };
    }
    default: {
      return { valid: true, normalized: trimmed };
    }
  }
}
