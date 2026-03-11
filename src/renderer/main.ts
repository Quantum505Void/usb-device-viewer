import { mount } from "svelte";
import App from "./App.svelte";
import { Electroview } from "electrobun/view";
import type { AppRPCType } from "../shared/types";

// 设备变化事件的简单回调注册
type DeviceChangedCallback = (payload: { added: number; removed: number; addedIds: string[]; removedIds: string[] }) => void;
let _onDeviceChanged: DeviceChangedCallback | null = null;

export function onDeviceChanged(cb: DeviceChangedCallback) {
  _onDeviceChanged = cb;
}

export const rpcInstance = Electroview.defineRPC<AppRPCType>({
  handlers: {
    requests: {},
    messages: {
      devicesUpdated: (payload) => {
        _onDeviceChanged?.(payload);
      },
    },
  },
});

export const electroview = new Electroview({ rpc: rpcInstance });

mount(App, { target: document.body });
