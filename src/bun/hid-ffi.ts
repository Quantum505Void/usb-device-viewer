/**
 * hid-ffi.ts — Bun FFI 直接调用 libhidapi，替代 node-hid
 *
 * struct hid_device_info 布局（Linux x64，hidapi 0.12/0.13，通过 offsetof 确认）：
 *   offset  0: char*          path
 *   offset  8: uint16         vendor_id
 *   offset 10: uint16         product_id
 *   offset 16: wchar_t*       serial_number
 *   offset 24: uint16         release_number
 *   offset 32: wchar_t*       manufacturer_string
 *   offset 40: wchar_t*       product_string
 *   offset 48: uint16         usage_page
 *   offset 50: uint16         usage
 *   offset 52: int32          interface_number
 *   offset 56: struct*        next
 *   sizeof = 72
 *
 * Windows/macOS 偏移相同（均为 64-bit 指针对齐）。
 */

import { dlopen, FFIType, read, CString } from "bun:ffi";
import { existsSync } from "fs";
import { join, dirname } from "path";
import type { HIDDevice } from "../shared/types";

// ── 库路径 ────────────────────────────────────────────────────────────────────

function resolveLibPath(): string {
  const p = process.platform;
  if (p === "linux") {
    const candidates = [
      // AppImage: APPDIR 环境变量指向 AppDir 根目录
      ...(process.env.APPDIR ? [
        join(process.env.APPDIR, "usr/lib/libhidapi-hidraw.so.0"),
        join(process.env.APPDIR, "usr/lib/libhidapi-libusb.so.0"),
      ] : []),
      // 系统路径
      "/usr/lib/x86_64-linux-gnu/libhidapi-hidraw.so.0",
      "/usr/lib/x86_64-linux-gnu/libhidapi-libusb.so.0",
      "/usr/lib/aarch64-linux-gnu/libhidapi-hidraw.so.0",
      "/usr/local/lib/libhidapi-hidraw.so.0",
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "libhidapi-hidraw.so.0"; // 由 LD_LIBRARY_PATH 解析
  }
  if (p === "darwin") {
    const candidates = [
      // app bundle 旁边的 lib 目录（打包时复制进来）
      join(dirname(process.execPath), "../lib/libhidapi.dylib"),
      join(dirname(process.execPath), "libhidapi.dylib"),
      // Homebrew
      "/opt/homebrew/lib/libhidapi.dylib",
      "/usr/local/lib/libhidapi.dylib",
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "libhidapi.dylib";
  }
  if (p === "win32") {
    const candidates = [
      // exe 同目录（打包时复制进来）
      join(dirname(process.execPath), "hidapi.dll"),
      join(dirname(process.execPath), "../lib/hidapi.dll"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    return "hidapi.dll";
  }
  throw new Error(`Unsupported platform: ${p}`);
}

// ── dlopen（单例） ────────────────────────────────────────────────────────────

let _lib: ReturnType<typeof dlopen> | null = null;

function getLib() {
  if (_lib) return _lib;
  _lib = dlopen(resolveLibPath(), {
    hid_init:             { args: [],                         returns: FFIType.i32 },
    hid_exit:             { args: [],                         returns: FFIType.void },
    hid_enumerate:        { args: [FFIType.u16, FFIType.u16], returns: FFIType.pointer },
    hid_free_enumeration: { args: [FFIType.pointer],           returns: FFIType.void },
  });
  _lib.symbols.hid_init();
  return _lib;
}

// ── wchar_t* 读取（Linux/macOS = 4 bytes，Windows = 2 bytes） ──────────────────

function readWString(ptr: number, maxChars = 128): string {
  if (!ptr) return "";
  const charSize = process.platform === "win32" ? 2 : 4;
  const chars: number[] = [];
  for (let i = 0; i < maxChars; i++) {
    const offset = i * charSize;
    const code = charSize === 2 ? read.u16(ptr, offset) : read.u32(ptr, offset);
    if (code === 0) break;
    chars.push(code);
  }
  return String.fromCodePoint(...chars);
}

// ── 厂商名映射 ────────────────────────────────────────────────────────────────

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",   0x045e: "Microsoft",  0x05ac: "Apple",
  0x04d9: "Holtek",     0x0483: "STMicro",     0x1532: "Razer",
  0x1b1c: "Corsair",    0x046a: "Cherry",      0x17ef: "Lenovo",
  0x0b05: "ASUS",       0x03f0: "HP",          0x04ca: "Lite-On",
  0x258a: "SinoWealth", 0x24ae: "Shenzhen",    0x0c45: "Microdia",
  0x1a2c: "China Resource", 0x0e8f: "GreenAsia",
};

// ── 枚举设备 ──────────────────────────────────────────────────────────────────

export function enumerateDevices(): HIDDevice[] {
  const lib = getLib();
  let cur: number = lib.symbols.hid_enumerate(0, 0) as number;
  if (!cur) return [];

  const result: HIDDevice[] = [];
  const seen = new Set<string>();

  while (cur) {
    try {
      const vid  = read.u16(cur, 8);
      const pid  = read.u16(cur, 10);

      if (vid !== 0 || pid !== 0) {
        const vidStr = vid.toString(16).padStart(4, "0").toUpperCase();
        const pidStr = pid.toString(16).padStart(4, "0").toUpperCase();

        const serialPtr   = read.ptr(cur, 16) as number;
        const serial      = serialPtr ? readWString(serialPtr) || "N/A" : "N/A";
        const mfgPtr      = read.ptr(cur, 32) as number;
        const prodPtr     = read.ptr(cur, 40) as number;
        const release     = read.u16(cur, 24);
        const usagePage   = read.u16(cur, 48);
        const usage       = read.u16(cur, 50);
        const iface       = read.i32(cur, 52);
        const pathPtr     = read.ptr(cur, 0) as number;
        const path        = pathPtr ? new CString(pathPtr).toString() : "N/A";

        // 蓝牙检测：路径包含 bluetooth/bth
        const isBluetooth = path.toLowerCase().includes("bluetooth") ||
          path.toLowerCase().includes("bth");

        const mfgRaw  = mfgPtr  ? readWString(mfgPtr)  : "";
        const prodRaw = prodPtr ? readWString(prodPtr)  : "";
        const vendorName  = (mfgRaw && mfgRaw !== "Unknown") ? mfgRaw : (VENDOR_NAMES[vid] ?? "未知厂商");
        const productName = prodRaw || `HID ${vidStr}:${pidStr}`;

        const key = `${vidStr}:${pidStr}:${serial}:${isBluetooth ? "bt" : "usb"}`;
        if (!seen.has(key)) {
          seen.add(key);
          const busNames: Record<number, string> = { 0:"Unknown",1:"USB",2:"Bluetooth",3:"I2C",4:"SPI",5:"Virtual" };
          const rawInfo = [
            `供应商ID (VID): ${vidStr}`,
            `产品ID (PID): ${pidStr}`,
            `制造商: ${vendorName}`,
            `产品名称: ${productName}`,
            `序列号: ${serial}`,
            `连接方式: ${isBluetooth ? "蓝牙HID设备" : "USB有线连接"}`,
            `设备路径: ${path}`,
            iface >= 0 ? `USB接口号: ${iface}` : `USB接口号: N/A`,
            `HID使用页: 0x${usagePage.toString(16).padStart(4,"0").toUpperCase()}`,
            `HID使用ID: 0x${usage.toString(16).padStart(4,"0").toUpperCase()}`,
            `设备版本: 0x${release.toString(16).padStart(4,"0").toUpperCase()}`,
          ].join("\n");

          result.push({ vid: vidStr, pid: pidStr, vendor: vendorName, product: productName, serial, isBluetooth, rawInfo });
        }
      }
    } catch (e) {
      console.error("[hid-ffi] struct read error:", e);
    }

    // 读 next 指针（offset 56）
    const next = read.ptr(cur, 56) as number;
    cur = next || 0;
  }

  lib.symbols.hid_free_enumeration(lib.symbols.hid_enumerate(0, 0) as number);

  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

export function closeLib() {
  try { _lib?.symbols.hid_exit(); } catch {}
  _lib = null;
}
