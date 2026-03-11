import type { RPCSchema } from "electrobun/bun";

export type HIDDevice = {
  vid: string;
  pid: string;
  vendor: string;
  product: string;
  serial: string;
  isBluetooth: boolean;
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
      minimizeToTray: {
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
      };
    };
  }>;
};
