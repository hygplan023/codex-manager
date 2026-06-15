#!/usr/bin/env node
// Creates dist-package.zip using only Node.js built-ins
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "../../");

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", ".pnpm-store", ".local",
  "coverage", "__pycache__", ".turbo",
]);
const SKIP_NAMES = new Set(["dist-package.zip"]);

function walkSync(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || SKIP_NAMES.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkSync(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const d = new Date();
const modDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
const modTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);

const allFiles = walkSync(ROOT);
const chunks = [];
const centralDirs = [];
let offset = 0;
let count = 0;

for (const full of allFiles) {
  let data;
  try { data = readFileSync(full); } catch { continue; }

  const rel = relative(ROOT, full).replace(/\\/g, "/");
  const nameBytes = Buffer.from(rel, "utf8");
  const compressed = deflateRawSync(data, { level: 6 });
  const useDeflate = compressed.length < data.length;
  const fileData = useDeflate ? compressed : data;
  const crc = crc32(data);

  const localHeader = Buffer.alloc(30 + nameBytes.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(useDeflate ? 8 : 0, 8);
  localHeader.writeUInt16LE(modTime, 10);
  localHeader.writeUInt16LE(modDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(fileData.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBytes.copy(localHeader, 30);

  centralDirs.push({ nameBytes, crc, compSize: fileData.length, uncompSize: data.length, offset, useDeflate });
  chunks.push(localHeader, fileData);
  offset += localHeader.length + fileData.length;
  count++;
}

const cdStart = offset;
for (const e of centralDirs) {
  const cd = Buffer.alloc(46 + e.nameBytes.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(e.useDeflate ? 8 : 0, 10);
  cd.writeUInt16LE(modTime, 12);
  cd.writeUInt16LE(modDate, 14);
  cd.writeUInt32LE(e.crc, 16);
  cd.writeUInt32LE(e.compSize, 20);
  cd.writeUInt32LE(e.uncompSize, 24);
  cd.writeUInt16LE(e.nameBytes.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(e.offset, 42);
  e.nameBytes.copy(cd, 46);
  chunks.push(cd);
  offset += cd.length;
}

const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(centralDirs.length, 8);
eocd.writeUInt16LE(centralDirs.length, 10);
eocd.writeUInt32LE(offset - cdStart, 12);
eocd.writeUInt32LE(cdStart, 16);
eocd.writeUInt16LE(0, 20);
chunks.push(eocd);

const outPath = join(ROOT, "dist-package.zip");
writeFileSync(outPath, Buffer.concat(chunks));
const sizeMB = (statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log(`✅ 打包完成: dist-package.zip  ${sizeMB} MB  (${count} 个文件)`);
