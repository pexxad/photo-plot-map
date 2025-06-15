import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data?: any) => {
      const validChannels = ['load-photos', 'rename-photos'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      const validChannels = ['photos-loaded', 'photos-renamed', 'error'];
      if (validChannels.includes(channel)) {
        const subscription = (_event: IpcRendererEvent, ...args: any[]) => func(...args);
        ipcRenderer.on(channel, subscription);
      }
    },
    invoke: (channel: string, data?: any) => {
      const validChannels = ['select-folder', 'load-image'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
    removeAllListeners: (channel: string) => {
      const validChannels = ['photos-loaded', 'photos-renamed', 'error'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },
  },
});