const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingDrawerFile", {
  save: (data, options = {}) => ipcRenderer.invoke("file:save", { data, ...options }),
  open: () => ipcRenderer.invoke("file:open"),
  getCurrent: () => ipcRenderer.invoke("file:get-current"),
  onMenuSave: (callback) => ipcRenderer.on("menu-save", callback),
  onMenuSaveAs: (callback) => ipcRenderer.on("menu-save-as", callback),
  onMenuOpen: (callback) => ipcRenderer.on("menu-open", callback)
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.dataset.platform = navigator.platform;
});
