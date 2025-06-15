import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { promises as fs, constants } from 'node:fs';
import started from 'electron-squirrel-startup';
import exifr from 'exifr';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

interface PhotoData {
  path: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: Date;
}

async function getPhotosWithLocation(folderPath: string): Promise<PhotoData[]> {
  const photos: PhotoData[] = [];

  try {
    console.log('Reading directory:', folderPath);

    // Check if directory exists and is readable
    try {
      await fs.access(folderPath, constants.R_OK);
    } catch (error) {
      console.error('Directory is not accessible:', folderPath);
      throw new Error(`Cannot access directory: ${folderPath}`);
    }

    const files = await fs.readdir(folderPath);
    console.log(`Total files in directory: ${files.length}`);

    const jpegFiles = files.filter(file =>
      /\.(jpg|jpeg|heic|heif)$/i.test(file)
    );
    console.log(`Found ${jpegFiles.length} JPEG files`);

    for (const file of jpegFiles) {
      const filePath = path.join(folderPath, file);

      try {
        // Parse all EXIF data first to debug
        const fullExifData = await exifr.parse(filePath);
        console.log(`Full EXIF data for ${file}:`, fullExifData);
        
        // Try to get GPS data with multiple approaches
        const exifData = await exifr.gps(filePath);
        
        if (exifData && typeof exifData.latitude === 'number' && typeof exifData.longitude === 'number') {
          console.log(`Photo ${file} has GPS data: ${exifData.latitude}, ${exifData.longitude}`);
          
          // Get timestamp from full EXIF data
          const timestamp = fullExifData?.DateTimeOriginal || fullExifData?.CreateDate || fullExifData?.ModifyDate || new Date();
          
          photos.push({
            path: filePath,
            name: file,
            lat: exifData.latitude,
            lng: exifData.longitude,
            timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp)
          });
        } else {
          console.log(`Photo ${file} has no GPS data`);
          console.log('GPS attempt result:', exifData);
        }
      } catch (error) {
        console.error(`Error parsing EXIF data for ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }

  console.log(`Returning ${photos.length} photos with location data`);
  // Sort photos by timestamp descending
  photos.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return photos;
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.on('load-photos', async (event, folderPath: string) => {
  console.log('Received load-photos request for folder:', folderPath);
  try {
    const photos = await getPhotosWithLocation(folderPath);
    console.log(`Found ${photos.length} photos with location data`);
    event.reply('photos-loaded', photos);
  } catch (error) {
    console.error('Error in load-photos handler:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    event.reply('error', `Failed to load photos: ${errorMessage}`);
  }
});

// Handler to load image data
ipcMain.handle('load-image', async (event, imagePath: string) => {
  try {
    const data = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.heic' || ext === '.heif') mimeType = 'image/heif';
    
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
});

ipcMain.on('rename-photos', async (event, { paths, prefix }: { paths: string[], prefix: string }) => {
  let renamedCount = 0;

  try {
    for (const photoPath of paths) {
      try {
        const dir = path.dirname(photoPath);
        const ext = path.extname(photoPath);

        const exifData = await exifr.parse(photoPath, {
          pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTime']
        });

        const timestamp = exifData?.DateTimeOriginal || exifData?.CreateDate || new Date();
        const dateTimeStr = formatDateTime(new Date(timestamp));
        const newName = `${prefix}_${dateTimeStr}${ext}`;
        const newPath = path.join(dir, newName);

        await fs.rename(photoPath, newPath);
        renamedCount++;
      } catch (error) {
        console.error(`Error renaming ${photoPath}:`, error);
      }
    }

    event.reply('photos-renamed', renamedCount);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    event.reply('error', `Failed to rename photos: ${errorMessage}`);
  }
});
