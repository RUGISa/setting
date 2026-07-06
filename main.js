const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#fbf5ec",
    title: "설정서랍",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createMenu() {
  const template = [
    {
      label: "파일",
      submenu: [
        {
          label: "저장",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu-save")
        },
        {
          label: "다른 이름으로 저장",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow?.webContents.send("menu-save-as")
        },
        {
          label: "열기",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu-open")
        },
        { type: "separator" },
        {
          label: "새로고침",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.reload()
        },
        {
          label: "개발자 도구",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow?.webContents.toggleDevTools()
        },
        { type: "separator" },
        {
          label: "종료",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Alt+F4",
          click: () => app.quit()
        }
      ]
    },
    {
      label: "보기",
      submenu: [
        { role: "zoomIn", label: "확대" },
        { role: "zoomOut", label: "축소" },
        { role: "resetZoom", label: "기본 크기" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체 화면" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getFileFilters() {
  return [
    { name: "설정서랍 파일", extensions: ["drawer"] },
    { name: "JSON 파일", extensions: ["json"] }
  ];
}

ipcMain.handle("file:save", async (_event, payload) => {
  try {
    const dataText = JSON.stringify(payload.data, null, 2);

    let targetPath = payload.filePath || currentFilePath;

    if (!targetPath || payload.forceSaveAs) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "설정서랍 저장",
        defaultPath: payload.suggestedName || "my-world.drawer",
        filters: getFileFilters()
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      targetPath = result.filePath;
    }

    fs.writeFileSync(targetPath, dataText, "utf-8");
    currentFilePath = targetPath;

    return {
      ok: true,
      filePath: targetPath,
      fileName: path.basename(targetPath)
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("file:open", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "설정서랍 파일 열기",
      properties: ["openFile"],
      filters: getFileFilters()
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(text);

    currentFilePath = filePath;

    return {
      ok: true,
      data,
      filePath,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("file:get-current", async () => {
  return {
    ok: true,
    filePath: currentFilePath,
    fileName: currentFilePath ? path.basename(currentFilePath) : ""
  };
});

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
