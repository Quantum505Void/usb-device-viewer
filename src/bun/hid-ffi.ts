/**
 * hid-ffi.ts — Bun FFI → libhidapi，跨平台 HID 枚举
 *
 * hidapi struct hid_device_info 布局（64-bit）：
 *
 *   hidapi ≤ 0.12 (next @ offset 56):
 *     0:path* 8:vid 10:pid 16:serial* 24:release 32:mfg* 40:prod* 48:usagepage 50:usage 52:iface 56:next*
 *
 *   hidapi ≥ 0.13 (bus_type 插入 @ 56，next 移到 64):
 *     0:path* 8:vid 10:pid 16:serial* 24:release 32:mfg* 40:prod* 48:usagepage 50:usage 52:iface 56:bus_type 64:next*
 *
 * bus_type: 0=Unknown 1=USB 2=Bluetooth 3=I2C 4=SPI 5=Virtual
 */

import { dlopen, FFIType, read, CString } from "bun:ffi";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { HIDDevice } from "../shared/types";

// ── 平台库路径 ────────────────────────────────────────────────────────────────

function resolveLibPath(): string {
  const p = process.platform;

  if (p === "linux") {
    const candidates = [
      ...(process.env.APPDIR
        ? [
            join(process.env.APPDIR, "usr/lib/libhidapi-hidraw.so.0"),
            join(process.env.APPDIR, "usr/lib/libhidapi-libusb.so.0"),
          ]
        : []),
      "/usr/lib/x86_64-linux-gnu/libhidapi-hidraw.so.0",
      "/usr/lib/x86_64-linux-gnu/libhidapi-libusb.so.0",
      "/usr/lib/aarch64-linux-gnu/libhidapi-hidraw.so.0",
      "/usr/lib/aarch64-linux-gnu/libhidapi-libusb.so.0",
      "/usr/local/lib/libhidapi-hidraw.so.0",
      "/usr/local/lib/libhidapi-libusb.so.0",
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "libhidapi-hidraw.so.0";
  }

  if (p === "darwin") {
    const execDir = dirname(process.execPath);
    const candidates = [
      join(execDir, "../lib/libhidapi.dylib"),
      join(execDir, "../lib/libhidapi.0.dylib"),
      join(execDir, "libhidapi.dylib"),
      "/opt/homebrew/lib/libhidapi.dylib",
      "/opt/homebrew/lib/libhidapi.0.dylib",
      "/usr/local/lib/libhidapi.dylib",
      "/usr/local/lib/libhidapi.0.dylib",
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "libhidapi.dylib";
  }

  if (p === "win32") {
    const execDir = dirname(process.execPath);
    const candidates = [
      join(execDir, "hidapi.dll"),
      join(execDir, "../lib/hidapi.dll"),
      join(process.cwd(), "hidapi-win/x64/hidapi.dll"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "hidapi.dll";
  }

  throw new Error(`Unsupported platform: ${p}`);
}

// ── struct 布局检测 ───────────────────────────────────────────────────────────
// hidapi 0.13+ 在 offset 56 加入 bus_type (i32)，next 指针从 56 移到 64
// 用 pkg-config / ldconfig 探测版本，不通过 FFI 读字符串（Bun 1.3.x cstring return bug）

interface Layout {
  nextOffset: number;
  hasBusType: boolean;
}

function detectHidapiMinor(): number {
  // 1. pkg-config（最准，Linux/macOS 均可）
  try {
    const r = Bun.spawnSync(["pkg-config", "--modversion", "hidapi"], {
      stdin: "ignore", stderr: "ignore",
    });
    if (r.exitCode === 0) {
      const ver = r.stdout.toString().trim(); // e.g. "0.14.0"
      const parts = ver.split(".").map(Number);
      console.log(`[hid-ffi] pkg-config hidapi=${ver}`);
      return parts[1] ?? 0;
    }
  } catch {}

  // 2. Linux: 直接找 so 文件名版本（libhidapi-hidraw.so.0.14.0 → minor=14）
  try {
    const r = Bun.spawnSync(
      ["sh", "-c", "ls /usr/lib/x86_64-linux-gnu/libhidapi-hidraw.so.*.*.* /usr/lib/aarch64-linux-gnu/libhidapi-hidraw.so.*.*.* 2>/dev/null | head -1"],
      { stdin: "ignore", stderr: "ignore" },
    );
    const line = r.stdout.toString().trim();
    // e.g. /usr/lib/.../libhidapi-hidraw.so.0.14.0  → so.SOABI.MAJOR.MINOR
    const m = line.match(/\.so\.\d+\.(\d+)\.\d+$/);
    if (m) {
      const minor = parseInt(m[1], 10);
      console.log(`[hid-ffi] so filename: hidapi minor=${minor}`);
      return minor;
    }
  } catch {}

  // 2b. ldconfig fallback
  try {
    const r = Bun.spawnSync(
      ["sh", "-c", "ldconfig -p 2>/dev/null | grep 'libhidapi' | head -1"],
      { stdin: "ignore", stderr: "ignore" },
    );
    const line = r.stdout.toString();
    const m = line.match(/\.so\.\d+\.(\d+)\.\d+/);
    if (m) {
      const minor = parseInt(m[1], 10);
      console.log(`[hid-ffi] ldconfig detected hidapi minor=${minor}`);
      return minor;
    }
  } catch {}

  // 3. macOS: check dylib path version tag
  try {
    const r = Bun.spawnSync(
      ["sh", "-c", "otool -L /opt/homebrew/lib/libhidapi.dylib 2>/dev/null | head -4"],
      { stdin: "ignore", stderr: "ignore" },
    );
    const out = r.stdout.toString();
    const m = out.match(/current version (\d+)\.(\d+)/);
    if (m) {
      const minor = parseInt(m[2], 10);
      console.log(`[hid-ffi] otool hidapi minor=${minor}`);
      return minor;
    }
  } catch {}

  console.warn("[hid-ffi] cannot detect hidapi version, assuming ≤0.12");
  return 12; // safe fallback
}

// hidapi 0.13+ 有 bus_type 字段
function detectLayout(): Layout {
  const minor = detectHidapiMinor();
  if (minor >= 13) {
    console.log(`[hid-ffi] layout: hidapi 0.${minor} → next@64 bus_type=true`);
    return { nextOffset: 64, hasBusType: true };
  }
  console.log(`[hid-ffi] layout: hidapi 0.${minor} → next@56 bus_type=false`);
  return { nextOffset: 56, hasBusType: false };
}

let _layout: Layout = detectLayout();

// ── dlopen 单例 ───────────────────────────────────────────────────────────────

type HidSymbols = {
  hid_init:             () => number;
  hid_exit:             () => void;
  hid_enumerate:        (vid: number, pid: number) => number | bigint;
  hid_free_enumeration: (ptr: number | bigint) => void;
};

let _lib: { symbols: HidSymbols } | null = null;

function getLib(): { symbols: HidSymbols } {
  if (_lib) return _lib;

  _lib = dlopen(resolveLibPath(), {
    hid_init:             { args: [],                         returns: FFIType.i32 },
    hid_exit:             { args: [],                         returns: FFIType.void },
    hid_enumerate:        { args: [FFIType.u16, FFIType.u16], returns: FFIType.pointer },
    hid_free_enumeration: { args: [FFIType.pointer],          returns: FFIType.void },
  }) as unknown as { symbols: HidSymbols };

  const rc = _lib.symbols.hid_init();
  if (rc !== 0) throw new Error(`hid_init() returned ${rc}`);

  return _lib;
}

// ── 指针工具 ──────────────────────────────────────────────────────────────────
// Bun FFI read.ptr 在不同版本可能返回 number 或 bigint

function ptrToNum(v: number | bigint | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "bigint") return Number(v);
  return v;
}

// ── wchar_t* 读取 ─────────────────────────────────────────────────────────────
// Linux/macOS: wchar_t = 4 bytes (UTF-32LE)
// Windows:     wchar_t = 2 bytes (UTF-16LE)

const WCHAR_SIZE = process.platform === "win32" ? 2 : 4;

function readWString(ptr: number, maxChars = 256): string {
  if (!ptr) return "";
  const buf: number[] = [];
  try {
    for (let i = 0; i < maxChars; i++) {
      const off  = i * WCHAR_SIZE;
      const code = WCHAR_SIZE === 2 ? read.u16(ptr, off) : read.u32(ptr, off);
      if (code === 0) break;
      buf.push(code);
    }
  } catch {
    // 读到无效内存，截断
  }
  if (WCHAR_SIZE === 2) return String.fromCharCode(...buf);
  return buf
    .map((cp) => { try { return String.fromCodePoint(cp); } catch { return "?"; } })
    .join("");
}

// ── 厂商名映射 ────────────────────────────────────────────────────────────────

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",       0x045e: "Microsoft",     0x05ac: "Apple",
  0x04d9: "Holtek",         0x0483: "STMicro",        0x1532: "Razer",
  0x1b1c: "Corsair",        0x046a: "Cherry",         0x17ef: "Lenovo",
  0x0b05: "ASUS",           0x03f0: "HP",             0x04ca: "Lite-On",
  0x258a: "SinoWealth",     0x24ae: "Shenzhen H&C",   0x0c45: "Microdia",
  0x1a2c: "China Resource", 0x0e8f: "GreenAsia",      0x054c: "Sony",
  0x1d6b: "Linux Foundation", 0x8087: "Intel",        0x2109: "VIA Labs",
  0x0951: "Kingston",       0x0781: "SanDisk",        0x18d1: "Google",
  0x2a37: "Das Keyboard",   0x3434: "Keychron",       0x1050: "Yubico",
};

const BUS_NAMES: Record<number, string> = {
  0: "Unknown", 1: "USB", 2: "Bluetooth", 3: "I2C", 4: "SPI", 5: "Virtual",
};

// ── 读取单个 struct ───────────────────────────────────────────────────────────

interface RawInfo {
  vid: number; pid: number;
  serial: string; vendor: string; product: string;
  release: number; usagePage: number; usage: number;
  interfaceNumber: number; busType: number;
  path: string; next: number;
}

function readDeviceStruct(ptr: number): RawInfo {
  const vid = read.u16(ptr, 8);
  const pid = read.u16(ptr, 10);

  const serialPtr = ptrToNum(read.ptr(ptr, 16));
  const serial    = serialPtr ? readWString(serialPtr) : "";
  const release   = read.u16(ptr, 24);
  const mfgPtr    = ptrToNum(read.ptr(ptr, 32));
  const prodPtr   = ptrToNum(read.ptr(ptr, 40));
  const usagePage = read.u16(ptr, 48);
  const usage     = read.u16(ptr, 50);
  const iface     = read.i32(ptr, 52);
  const busType   = _layout.hasBusType ? read.i32(ptr, 56) : 0;
  const pathPtr   = ptrToNum(read.ptr(ptr, 0));
  const path      = pathPtr ? new CString(pathPtr).toString() : "";
  const next      = ptrToNum(read.ptr(ptr, _layout.nextOffset));

  const mfg     = mfgPtr  ? readWString(mfgPtr)  : "";
  const prod    = prodPtr ? readWString(prodPtr)  : "";
  const vendor  = mfg  || VENDOR_NAMES[vid] || "未知厂商";
  const product = prod || `HID Device`;

  return { vid, pid, serial, vendor, product, release, usagePage, usage, interfaceNumber: iface, busType, path, next };
}

// ── 连接方式推断 ──────────────────────────────────────────────────────────────

function inferBus(raw: RawInfo): { label: string; isBluetooth: boolean } {
  if (raw.busType !== 0) {
    return {
      label: BUS_NAMES[raw.busType] ?? `BusType(${raw.busType})`,
      isBluetooth: raw.busType === 2,
    };
  }
  const lp = raw.path.toLowerCase();
  if (lp.includes("bluetooth") || lp.includes("bth") || lp.includes("rfcomm")) {
    return { label: "Bluetooth", isBluetooth: true };
  }
  return { label: "USB", isBluetooth: false };
}

// ── 枚举设备（主 API）────────────────────────────────────────────────────────

export function enumerateDevices(): HIDDevice[] {
  const lib = getLib();

  const head = ptrToNum(lib.symbols.hid_enumerate(0, 0));
  if (!head) return [];

  const result: HIDDevice[] = [];
  const seen   = new Set<string>();
  let   cur    = head;
  let   errCnt = 0;

  while (cur) {
    let next = 0;
    try {
      const raw = readDeviceStruct(cur);
      next = raw.next;

      if (raw.vid !== 0 || raw.pid !== 0) {
        const vidStr = raw.vid.toString(16).padStart(4, "0").toUpperCase();
        const pidStr = raw.pid.toString(16).padStart(4, "0").toUpperCase();

        // 去重 key：VID:PID:iface（同一物理设备可能有多个 interface）
        const key = `${vidStr}:${pidStr}:${raw.interfaceNumber}`;
        if (!seen.has(key)) {
          seen.add(key);

          const { label: busLabel, isBluetooth } = inferBus(raw);

          const rawInfo = [
            `供应商ID (VID)  : ${vidStr}`,
            `产品ID (PID)   : ${pidStr}`,
            `制造商         : ${raw.vendor}`,
            `产品名称       : ${raw.product}`,
            `序列号         : ${raw.serial || "N/A"}`,
            `连接方式       : ${busLabel}`,
            `设备路径       : ${raw.path || "N/A"}`,
            raw.interfaceNumber >= 0 ? `USB 接口号     : ${raw.interfaceNumber}` : `USB 接口号     : N/A`,
            `HID 使用页     : 0x${raw.usagePage.toString(16).padStart(4, "0").toUpperCase()}`,
            `HID 使用 ID    : 0x${raw.usage.toString(16).padStart(4, "0").toUpperCase()}`,
            `设备版本       : 0x${raw.release.toString(16).padStart(4, "0").toUpperCase()}`,
            raw.busType !== 0 ? `总线类型 (raw) : ${raw.busType} (${BUS_NAMES[raw.busType] ?? "?"})` : null,
          ]
            .filter(Boolean)
            .join("\n");

          result.push({
            vid: vidStr,
            pid: pidStr,
            vendor: raw.vendor,
            product: raw.product,
            serial: raw.serial || "N/A",
            isBluetooth,
            rawInfo,
          });
        }
      }
    } catch (e) {
      errCnt++;
      console.error(`[hid-ffi] struct read error @ 0x${cur.toString(16)} (${errCnt}):`, e);
      if (errCnt >= 5) {
        console.error("[hid-ffi] too many errors, aborting enumeration");
        break;
      }
    }
    cur = next;
  }

  // ✅ free 最初 head，而不是重新 enumerate
  try {
    lib.symbols.hid_free_enumeration(head);
  } catch (e) {
    console.warn("[hid-ffi] hid_free_enumeration failed:", e);
  }

  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

// ── 释放库 ────────────────────────────────────────────────────────────────────

export function closeLib(): void {
  try { _lib?.symbols.hid_exit(); } catch {}
  _lib = null;
  _layout = { nextOffset: 56, hasBusType: false };
}
