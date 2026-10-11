/** The bridge between the page and the desktop app: a native folder dialog for choosing the GB Studio project. */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("gbc", {
  platform: process.platform,
  /** Opens the folder dialog; resolves to the chosen project folder (already set on the server), or null. */
  chooseProject: (): Promise<string | null> => ipcRenderer.invoke("gbc-choose-project"),
  /** Closes the window once Unsaved changes is done (the window's own close asks the page first). */
  closeWindow: (): void => ipcRenderer.send("gbc-close-window"),
  /** Unsaved changes was cancelled: a quit that was waiting on it stops. */
  cancelClose: (): void => ipcRenderer.send("gbc-cancel-close"),
});
