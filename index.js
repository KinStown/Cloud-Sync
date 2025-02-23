const DriveTools = require("./driveTools");
const { getDriveService, isOnline } = require('./service');
require('dotenv').config();

(async() => {
  if (!await isOnline()) {
    console.log("\x1b[31m%s\x1b[0m", "Нет подключения к интернету");
    return;
  }
  const drive = getDriveService();

  const type = process.argv[2] || "All";
  const localFolder = process.argv[3] || process.env.dLocalFolder;
  const folderId = process.argv[4] || process.env.defaultFolderId;

  const DTools = new DriveTools(drive, folderId, localFolder);

  if (type == "U") {
    console.log("Загрузка на диск включена");
    await DTools.uploadFolderToDrive(localFolder, folderId);
  }
  else if (type == "D") {
    console.log("Скачивание с диска включена");
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
  else if (type == "All") {
    console.log("Загрузка и скачивание включены");
    await DTools.uploadFolderToDrive(localFolder, folderId);
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
})().catch(console.error);