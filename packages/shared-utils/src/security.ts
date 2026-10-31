/**
 * PIN & Password Security Utilities
 * Platform-independent pure TypeScript SHA-256 hashing and verification.
 * Works seamlessly across Web, Desktop (Electron/Vite), Node.js, and Mobile (React Native/Expo).
 */

function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      bytes.push(charcode);
    } else if (charcode < 0x800) {
      bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      // surrogate pair
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }
  return bytes;
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Hex(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  // Initial hash value: first 32 bits of the fractional parts of the square roots of the first 8 primes
  let hash: number[] = [];
  // Round constants: first 32 bits of the fractional parts of the cube roots of the first 64 primes
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  const rawBytes = utf8Encode(ascii);
  const rawBytesLength = rawBytes.length;
  for (i = 0; i < rawBytesLength; i++) {
    words[i >> 2] |= rawBytes[i] << ((3 - (i % 4)) * 8);
  }

  words[rawBytesLength >> 2] |= 0x80 << ((3 - (rawBytesLength % 4)) * 8);
  words[(((rawBytesLength + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (let chunk = 0; chunk < words.length; chunk += 16) {
    const w = words.slice(chunk, chunk + 16);
    const oldHash = [...hash];

    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = ((w[i - 16] + gamma0 + w[i - 7] + gamma1) & 0xffffffff) >>> 0;
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[i] + w[i]) & 0xffffffff;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) & 0xffffffff;

      hash = [
        (temp1 + temp2) & 0xffffffff,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) & 0xffffffff,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) & 0xffffffff;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

const PIN_SALT_PREFIX = 'bazaar_pos_salt_v1_';

/**
 * Hash a user PIN with standard application salt.
 */
export function hashPin(pin: string, customSalt?: string): string {
  const salt = customSalt || PIN_SALT_PREFIX;
  const hashed = sha256Hex(`${salt}:${pin.trim()}`);
  return `sha256:${hashed}`;
}

/**
 * Verifies an entered PIN against a stored PIN (supports both hashed and legacy plaintext).
 */
export function verifyPin(inputPin: string, storedValue: string | undefined): boolean {
  if (!storedValue || !inputPin) return false;
  const cleanInput = inputPin.trim();
  const cleanStored = storedValue.trim();

  // If already stored as hashed
  if (cleanStored.startsWith('sha256:')) {
    const computed = hashPin(cleanInput);
    return computed === cleanStored;
  }

  // If stored as 64-char raw hex SHA-256
  if (cleanStored.length === 64 && /^[0-9a-f]+$/i.test(cleanStored)) {
    const computedRaw = sha256Hex(`${PIN_SALT_PREFIX}:${cleanInput}`);
    return computedRaw.toLowerCase() === cleanStored.toLowerCase();
  }

  // Backwards compatibility with legacy plaintext PINs
  return cleanInput === cleanStored;
}
