/**
 * hid-backend.ts — node-hid 跨平台 HID 枚举
 *
 * 使用 node-hid 替代手撸 Bun FFI + struct 偏移方案。
 * node-hid 提供所有平台预编译 .node addon，Bun 1.1+ 原生支持。
 *
 * 平台支持：Linux / macOS / Windows (x64 / arm64)
 */

import HID from "node-hid";
import type { HIDDevice } from "../shared/types";

// ── 厂商名补充映射（node-hid 返回空 manufacturer 时使用）────────────────────

const VENDOR_NAMES: Record<number, string> = {
  0x046d: "Logitech",       0x045e: "Microsoft",     0x05ac: "Apple",
  0x04d9: "Holtek",         0x0483: "STMicro",        0x1532: "Razer",
  0x1b1c: "Corsair",        0x046a: "Cherry",         0x17ef: "Lenovo",
  0x0b05: "ASUS",           0x03f0: "HP",             0x04ca: "Lite-On",
  0x258a: "SinoWealth",     0x24ae: "Shenzhen H&C",   0x0c45: "Microdia",
  0x1a2c: "China Resource", 0x0e8f: "GreenAsia",      0x054c: "Sony",
  0x1d6b: "Linux Foundation",0x8087: "Intel",         0x2109: "VIA Labs",
  0x0951: "Kingston",       0x0781: "SanDisk",        0x18d1: "Google",
  0x2a37: "Das Keyboard",   0x3434: "Keychron",       0x1050: "Yubico",
  0x04f3: "ELAN",           0x06cb: "Synaptics",      0x056a: "Wacom",
  0x1038: "SteelSeries",    0x2516: "Cooler Master",  0x0d8c: "C-Media",
};

// ── 连接方式判断 ──────────────────────────────────────────────────────────────
// node-hid >= 3.0 在 DeviceInfo 上有 busType 字段（部分平台）
// 旧版或不支持的平台回落到路径特征检测

function getBusInfo(dev: HID.Device): { label: string; isBluetooth: boolean } {
  // node-hid 3.x 提供 busType（Linux/macOS/Windows 均有）
  const busType = (dev as any).busType as number | undefined;
  if (busType !== undefined) {
    const labels: Record<number, string> = {
      0: "USB", 1: "Bluetooth", 2: "I2C", 3: "SPI",
    };
    const label = labels[busType] ?? `BusType(${busType})`;
    return { label, isBluetooth: busType === 1 };
  }

  // fallback: 路径特征
  const path = (dev.path ?? "").toLowerCase();
  if (path.includes("bluetooth") || path.includes("bth") || path.includes("rfcomm")) {
    return { label: "Bluetooth", isBluetooth: true };
  }
  return { label: "USB", isBluetooth: false };
}

// ── 枚举 ──────────────────────────────────────────────────────────────────────

export function enumerateDevices(): HIDDevice[] {
  const rawDevices = HID.devices();
  const result: HIDDevice[] = [];
  const seen = new Set<string>();

  for (const dev of rawDevices) {
    const vid = dev.vendorId;
    const pid = dev.productId;
    if (!vid && !pid) continue;

    const vidStr = vid.toString(16).padStart(4, "0").toUpperCase();
    const pidStr = pid.toString(16).padStart(4, "0").toUpperCase();
    const serial = dev.serialNumber || "";
    const iface  = dev.interface ?? -1;

    // 按 VID:PID:serial:interface 去重
    const key = `${vidStr}:${pidStr}:${serial}:${iface}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const vendor  = (dev.manufacturer && dev.manufacturer.trim())
      ? dev.manufacturer.trim()
      : (VENDOR_NAMES[vid] ?? "未知厂商");
    const product = (dev.product && dev.product.trim())
      ? dev.product.trim()
      : `HID ${vidStr}:${pidStr}`;

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

    result.push({ vid: vidStr, pid: pidStr, vendor, product, serial: serial || "N/A", isBluetooth, rawInfo });
  }

  // USB 优先，再按 VID+PID
  result.sort((a, b) => {
    if (a.isBluetooth !== b.isBluetooth) return a.isBluetooth ? 1 : -1;
    return `${a.vid}${a.pid}`.localeCompare(`${b.vid}${b.pid}`);
  });

  return result;
}

/** 兼容旧接口：node-hid 不需要显式关闭 */
export function closeLib(): void {}
