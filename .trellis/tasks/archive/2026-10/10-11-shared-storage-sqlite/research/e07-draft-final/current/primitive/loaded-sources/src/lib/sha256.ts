// Byte hash shared with transaction-safe production revisions. It does not
// require WebCrypto or a secure browser context. Not an authorization token.
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

/** Incremental byte hash. Only one partial block and the compression state are retained. */
export class Sha256 {
    private readonly hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    private readonly words = new Uint32Array(64);
    private readonly pending = new Uint8Array(64);
    private pendingLength = 0;
    private byteLength = 0;
    private result: string | undefined;

    update(input: Uint8Array): this {
        if (this.result !== undefined) throw new Error("SHA-256 digest is already finalized");
        const length = this.byteLength + input.byteLength;
        if (!Number.isSafeInteger(length)) throw new Error("SHA-256 byte length is invalid");
        this.byteLength = length;
        let offset = 0;
        if (this.pendingLength) {
            const copied = Math.min(64 - this.pendingLength, input.byteLength);
            this.pending.set(input.subarray(0, copied), this.pendingLength);
            this.pendingLength += copied;
            offset = copied;
            if (this.pendingLength === 64) {
                this.compress(new DataView(this.pending.buffer), 0);
                this.pendingLength = 0;
            }
        }
        const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
        while (offset + 64 <= input.byteLength) {
            this.compress(view, offset);
            offset += 64;
        }
        if (offset < input.byteLength) {
            this.pending.set(input.subarray(offset), this.pendingLength);
            this.pendingLength += input.byteLength - offset;
        }
        return this;
    }

    /** Repeated reads are stable; updates after finalization are rejected. */
    digest(): string {
        if (this.result !== undefined) return this.result;
        const padding = new Uint8Array(this.pendingLength < 56 ? 64 : 128);
        padding.set(this.pending.subarray(0, this.pendingLength));
        padding[this.pendingLength] = 0x80;
        const view = new DataView(padding.buffer);
        view.setUint32(padding.length - 8, Math.floor(this.byteLength / 0x20000000));
        view.setUint32(padding.length - 4, this.byteLength * 8);
        for (let offset = 0; offset < padding.length; offset += 64) this.compress(view, offset);
        this.result = this.hash.map(word => word.toString(16).padStart(8, "0")).join("");
        return this.result;
    }

    private compress(view: DataView, offset: number): void {
        const words = this.words;
        for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
        for (let i = 16; i < 64; i++) {
            const x = words[i - 15];
            const y = words[i - 2];
            words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
        }
        let [a, b, c, d, e, f, g, h] = this.hash as [number, number, number, number, number, number, number, number];
        for (let i = 0; i < 64; i++) {
            const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + words[i]) | 0;
            const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        this.hash[0] = (this.hash[0] + a) >>> 0;
        this.hash[1] = (this.hash[1] + b) >>> 0;
        this.hash[2] = (this.hash[2] + c) >>> 0;
        this.hash[3] = (this.hash[3] + d) >>> 0;
        this.hash[4] = (this.hash[4] + e) >>> 0;
        this.hash[5] = (this.hash[5] + f) >>> 0;
        this.hash[6] = (this.hash[6] + g) >>> 0;
        this.hash[7] = (this.hash[7] + h) >>> 0;
    }
}

/** Synchronous wrapper for small transaction-safe production revision inputs. */
export function sha256Bytes(input: Uint8Array): string {
    return new Sha256().update(input).digest();
}
