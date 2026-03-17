/**
 * hid-backend.ts — node-hid 跨平台 HID 枚举
 *
 * node-hid 3.x 预编译 .node addon 未暴露 hidapi 的 bus_type 字段。
 * 本文件用各平台官方 path 格式还原 bus_type，与 hidapi 源码逻辑严格对齐：
 *
 * Windows (windows/hid.c: hid_internal_detect_bus_type)
 *   - 父设备 CompatibleIds 含 "BTHENUM"  → HID_API_BUS_BLUETOOTH (Classic)
 *   - 父设备 CompatibleIds 含 "BTHLEDEVICE" → HID_API_BUS_BLUETOOTH (LE)
 *   - path 中体现：经典 BT path 含 "BTHENUM"，BLE path 含 BT HID Service UUID
 *
 * macOS (mac/hid.c: IOHIDTransportKey)
 *   - kIOHIDTransportKey 前缀含 "Bluetooth" → HID_API_BUS_BLUETOOTH
 *   - path 中体现：BT path 含 "Bluetooth" 字样
 *
 * Linux (linux/hid.c: parse_hid_vid_pid_from_uevent)
 *   - 读 /sys/class/hidraw/<dev>/device/uevent HID_ID 字段第一段
 *   - Linux BUS_BLUETOOTH = 0x0005，BUS_USB = 0x0003，BUS_I2C = 0x0018
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

// ── 总线类型（对齐 hidapi hid_bus_type 枚举）─────────────────────────────────

const enum BusType { Unknown = 0, USB = 1, Bluetooth = 2, I2C = 3, SPI = 4 }

// ── Linux: sysfs uevent（linux/hid.c: parse_hid_vid_pid_from_uevent）────────

const LINUX_BUS: Record<number, BusType> = {
  0x0001: BusType.USB,
  0x0002: BusType.Bluetooth,
  0x0003: BusType.USB,        // BUS_USB
  0x0004: BusType.Bluetooth,  // BUS_BT_LE (some kernels)
  0x0005: BusType.Bluetooth,  // BUS_BLUETOOTH
  0x0018: BusType.I2C,
  0x001c: BusType.SPI,
};

function getLinuxBusType(devPath: string): BusType | null {
  const name = devPath.split("/").pop();
  if (!name) return null;
  const uevent = `/sys/class/hidraw/${name}/device/uevent`;
  if (!existsSync(uevent)) return null;
  try {
    const m = readFileSync(uevent, "utf8").match(/^HID_ID=([0-9A-Fa-f]{4}):/m);
    if (!m) return null;
    const id = parseInt(m[1], 16);
    return LINUX_BUS[id] ?? BusType.Unknown;
  } catch { return null; }
}

// ── Windows: path 特征（windows/hid.c: hid_internal_detect_bus_type）────────
// CompatibleIds 含 BTHENUM → Classic BT
// CompatibleIds 含 BTHLEDEVICE → BLE（path 里是 BT HID Service UUID）
// Windows path 格式：\\?\HID#<transport>_...
//   USB:   HID#VID_xxxx&PID_xxxx
//   BT经典: HID#BTHENUM&...  或含 BTHENUM
//   BLE:   HID#{00001812-0000-1000-8000-00805f9b34fb}_Dev_...

function getWindowsBusType(path: string): BusType {
  const p = path.toUpperCase();
  // BLE: BT HID over GATT Service UUID 00001812
  if (p.includes("00001812-0000-1000-8000-00805F9B34FB")) return BusType.Bluetooth;
  // Classic BT
  if (p.includes("BTHENUM") || p.includes("BTHLEDEVICE")) return BusType.Bluetooth;
  // I2C / SPI
  if (p.includes("PNP0C50") || p.includes("I2CHID")) return BusType.I2C;
  if (p.includes("PNP0C51")) return BusType.SPI;
  return BusType.USB;
}

// ── macOS: path 特征（mac/hid.c: kIOHIDTransportKey）────────────────────────
// IOHIDTransportKey 前缀含 "Bluetooth" → BT
// USB path 含 "IOUSBInterface" 或 "USB"
// macOS path 例：IOService:/IOResources/IOHIDManager/.../Bluetooth...

function getMacBusType(path: string): BusType {
  const p = path.toLowerCase();
  if (p.includes("bluetooth")) return BusType.Bluetooth;
  if (p.includes("i2c")) return BusType.I2C;
  if (p.includes("spi")) return BusType.SPI;
  return BusType.USB;
}

// ── 统一入口 ──────────────────────────────────────────────────────────────────

function detectBusType(dev: HID.Device): BusType {
  const path = dev.path ?? "";
  if (process.platform === "linux") {
    if (path) {
      const bt = getLinuxBusType(path);
      if (bt !== null) return bt;
    }
  } else if (process.platform === "win32") {
    if (path) return getWindowsBusType(path);
  } else if (process.platform === "darwin") {
    if (path) return getMacBusType(path);
  }
  return BusType.Unknown;
}

// ── 同一物理设备去重 ──────────────────────────────────────────────────────────
// Linux: path = /dev/hidrawX，每个 hidraw 节点独立，直接用 path
// Windows/macOS: 多 interface 共享 VID:PID:serial

function getDedupeKey(dev: HID.Device): string {
  if (process.platform === "linux" && dev.path) return dev.path;
  const serial = dev.serialNumber?.trim() || "";
  return `${dev.vendorId}:${dev.productId}:${serial}`;
}

// ── 主枚举 ────────────────────────────────────────────────────────────────────

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

    const busType = detectBusType(dev);
    const isBluetooth = busType === BusType.Bluetooth;
    const busLabel = (
      busType === BusType.Bluetooth ? "Bluetooth" :
      busType === BusType.I2C       ? "I2C"       :
      busType === BusType.SPI       ? "SPI"       :
      busType === BusType.USB       ? "USB"       : "Unknown"
    );

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

  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

export function closeLib(): void {}
