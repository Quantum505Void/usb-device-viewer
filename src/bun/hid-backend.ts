/**
 * hid-backend.ts — node-hid 跨平台 HID 枚举
 *
 * 使用 node-hid 3.x 预编译 .node addon。Bun 1.1+ 原生支持 .node addon。
 *
 * 平台：Linux / macOS / Windows (x64 / arm64)
 *
 * 总线类型检测策略：
 *   Linux  → 读 /sys/class/hidraw/<dev>/device/uevent 里的 HID_ID 字段（最准确）
 *   其他   → 序列号 MAC 地址格式 + 路径关键词 fallback
 */

import HID from "node-hid";
import { readFileSync, existsSync } from "fs";
import type { HIDDevice } from "../shared/types";

// ── 厂商名补充映射 ────────────────────────────────────────────────────────────

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",        0x045e: "Microsoft",      0x05ac: "Apple",
  0x04d9: "Holtek",          0x0483: "STMicro",         0x1532: "Razer",
  0x1b1c: "Corsair",         0x046a: "Cherry",          0x17ef: "Lenovo",
  0x0b05: "ASUS",            0x03f0: "HP",              0x04ca: "Lite-On",
  0x258a: "SinoWealth",      0x24ae: "Shenzhen H&C",    0x0c45: "Microdia",
  0x1a2c: "China Resource",  0x0e8f: "GreenAsia",       0x054c: "Sony",
  0x1d6b: "Linux Foundation",0x8087: "Intel",           0x2109: "VIA Labs",
  0x0951: "Kingston",        0x0781: "SanDisk",         0x18d1: "Google",
  0x2a37: "Das Keyboard",    0x3434: "Keychron",        0x1050: "Yubico",
  0x04f3: "ELAN",            0x06cb: "Synaptics",       0x056a: "Wacom",
  0x1038: "SteelSeries",     0x2516: "Cooler Master",   0x0d8c: "C-Media",
  0x1770: "Nuvoton",         0x1a86: "QinHeng",         0x10c4: "Silicon Labs",
};

// ── 总线类型常量（HID_ID b字段，与 hidapi bus_type 对齐）─────────────────────

const BUS_LABELS: Record<number, string> = {
  0x0000: "Unknown",
  0x0001: "USB",
  0x0002: "Bluetooth",   // BT Classic
  0x0003: "USB",         // USB HID (HID_BUS_USB in some kernels)
  0x0004: "Bluetooth",   // BT LE
  0x0005: "Bluetooth",   // Linux BUS_BLUETOOTH = 5
  0x0006: "Virtual",
  0x0018: "I2C",         // Linux BUS_I2C = 24 (0x18)
  0x001c: "SPI",         // Linux BUS_SPI = 28
};

const BT_BUS_IDS = new Set([0x0002, 0x0004, 0x0005]);

// ── Linux: 从 sysfs uevent 读准确总线类型 ─────────────────────────────────────

interface SysfsBusInfo {
  busId: number;
  label: string;
  isBluetooth: boolean;
}

function readLinuxBusInfo(devPath: string): SysfsBusInfo | null {
  // devPath 例如 /dev/hidraw2
  const devName = devPath.split("/").pop(); // "hidraw2"
  if (!devName) return null;

  const ueventPath = `/sys/class/hidraw/${devName}/device/uevent`;
  if (!existsSync(ueventPath)) return null;

  try {
    const content = readFileSync(ueventPath, "utf8");
    // HID_ID=0005:00000B05:00001AB2  → 第一段是 busId（16进制）
    const match = content.match(/^HID_ID=([0-9A-Fa-f]{4}):/m);
    if (!match) return null;

    const busId = parseInt(match[1], 16);
    const label = BUS_LABELS[busId] ?? `BusType(0x${busId.toString(16)})`;
    const isBluetooth = BT_BUS_IDS.has(busId);
    return { busId, label, isBluetooth };
  } catch {
    return null;
  }
}

// ── 跨平台 fallback：序列号 MAC 地址格式 + 路径关键词 ─────────────────────────
// macOS/Windows 的蓝牙设备序列号通常是 MAC 地址

const MAC_PATTERN = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

function getFallbackBusInfo(dev: HID.Device): { label: string; isBluetooth: boolean } {
  // 序列号是 MAC 格式 → 蓝牙
  const serial = dev.serialNumber?.trim() ?? "";
  if (MAC_PATTERN.test(serial)) {
    return { label: "Bluetooth", isBluetooth: true };
  }
  // 路径关键词
  const path = (dev.path ?? "").toLowerCase();
  if (
    path.includes("bluetooth") ||
    path.includes("bth") ||
    path.includes("rfcomm") ||
    path.includes("00001124")
  ) {
    return { label: "Bluetooth", isBluetooth: true };
  }
  return { label: "USB", isBluetooth: false };
}

// ── 获取总线信息（平台分支）───────────────────────────────────────────────────

function getBusInfo(dev: HID.Device): { label: string; isBluetooth: boolean } {
  if (process.platform === "linux" && dev.path) {
    const sysfsInfo = readLinuxBusInfo(dev.path);
    if (sysfsInfo) return sysfsInfo;
  }
  return getFallbackBusInfo(dev);
}

// ── 同一物理设备去重 ──────────────────────────────────────────────────────────
// 同一设备可能有多个 HID interface / usagePage，node-hid 每个都列一条
// 用 path 去重（同一 hidraw 节点 = 同一物理接口）

function getDedupeKey(dev: HID.Device): string {
  if (dev.path) return dev.path;
  const serial = dev.serialNumber?.trim() || "";
  return `${dev.vendorId}:${dev.productId}:${serial}`;
}

// ── 主枚举（async，不阻塞主线程）────────────────────────────────────────────

export async function enumerateDevices(): Promise<HIDDevice[]> {
  const rawDevices = await HID.devicesAsync();
  const result: HIDDevice[] = [];
  const seen = new Set<string>();

  for (const dev of rawDevices) {
    const vid = dev.vendorId;
    const pid = dev.productId;
    if (!vid && !pid) continue;

    const key = getDedupeKey(dev);
    if (seen.has(key)) continue;
    seen.add(key);

    const vidStr = vid.toString(16).padStart(4, "0").toUpperCase();
    const pidStr = pid.toString(16).padStart(4, "0").toUpperCase();
    const serial = dev.serialNumber?.trim() || "";
    const iface  = dev.interface ?? -1;

    const vendor  = dev.manufacturer?.trim() || VENDOR_NAMES[vid] || "未知厂商";
    const product = dev.product?.trim() || `HID ${vidStr}:${pidStr}`;

    const { label: busLabel, isBluetooth } = getBusInfo(dev);

    const rawInfo = [
      `供应商ID (VID)  : ${vidStr}`,
      `产品ID (PID)   : ${pidStr}`,
      `制造商         : ${vendor}`,
      `产品名称       : ${product}`,
      `序列号         : ${serial || "N/A"}`,
      `连接方式       : ${busLabel}`,
      `设备路径       : ${dev.path || "N/A"}`,
      iface >= 0
        ? `USB 接口号     : ${iface}`
        : `USB 接口号     : N/A`,
      `HID 使用页     : 0x${(dev.usagePage ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
      `HID 使用 ID    : 0x${(dev.usage ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
      `设备版本       : 0x${(dev.release ?? 0).toString(16).padStart(4, "0").toUpperCase()}`,
    ].join("\n");

    result.push({
      vid: vidStr,
      pid: pidStr,
      vendor,
      product,
      serial: serial || "N/A",
      isBluetooth,
      path: dev.path || "",
      rawInfo,
    });
  }

  // USB/I2C 优先，蓝牙排后；再按 VID+PID 字典序
  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

/** node-hid 不需要显式关闭库 */
export function closeLib(): void {}
