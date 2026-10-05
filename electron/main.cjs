const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// =========================================================================
// 🚀 LOW-END DEVICE & HARDWARE ACCELERATION OPTIMIZATIONS (Win 8/10/11)
// =========================================================================
// Reduce memory footprint, disable background throttling, and optimize rendering on older PCs
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256'); // Limit RAM overhead
app.commandLine.appendSwitch('enable-smooth-scrolling');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 650,
    title: 'SoliMedical-ERB - نظام إدارة مستودعات المجمع الطبي',
    icon: path.join(__dirname, '../public/favicon.ico'),
    backgroundColor: '#090d16',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });

  // Remove default menu for clean modern app look
  Menu.setApplicationMenu(null);

  // Check if running in development mode
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Load production built index.html from dist folder
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
