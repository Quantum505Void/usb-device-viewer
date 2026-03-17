import type { RPCSchema } from "electrobun/bun";

export type HIDDevice = {
  vid: string;
  pid: string;
  vendor: string;
  product: string;
  serial: string;
  isBluetooth: boolean;
  /** 设备路径（hidraw/IOKit路径），作为热插拔唯一 ID 使用 */
  path: string;
  rawInfo: string;
};

export type AppRPCType = {
  bun: RPCSchema<{
    requests: {
      scanDevices: {
        params: Record<string, never>;
        response: HIDDevice[];
      };
      exportDevices: {
        params: { devices: HIDDevice[] };
        response: { success: boolean; path: string };
      };
      copyToClipboard: {
        params: { text: string };
        response: { success: boolean };
      };
      webviewReady: {
        params: Record<string, never>;
        response: { success: boolean };
      };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      devicesUpdated: {
        added: number;
        removed: number;
        addedIds: string[];
        removedIds: string[];
      };
    };
  }>;
};
