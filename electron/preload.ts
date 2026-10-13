import { contextBridge, ipcRenderer } from 'electron';

// Контекстный мост для безопасной коммуникации между React и Electron
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on(channel: string, func: (...args: any[]) => void) {
      const validChannels = ['app-version'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    once(channel: string, func: (...args: any[]) => void) {
      const validChannels = ['app-version'];
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      }
    },
    send(channel: string, ...args: any[]) {
      const validChannels = ['app-version'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
  },
});
