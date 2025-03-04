const DriveTools = require("./driveTools");
const { getDriveService, isOnline } = require('./service');
require('dotenv').config();

if (!global.print) {
  require("./print");
  print("Импортирован print.js");
}

(async() => {
  if (!await isOnline()) {
    throw new Error("Нет подключения к интернету");
  }
  const drive = getDriveService();

  const type = process.argv[2] || "All";
  const localFolder = process.argv[3] || process.env.dLocalFolder;
  const folderId = process.argv[4] || process.env.defaultFolderId;

  const DTools = new DriveTools(drive, folderId, localFolder);

  if (type == "U") {
    print("Загрузка на диск включена");
    await DTools.uploadFolderToDrive(localFolder, folderId);
  }
  else if (type == "D") {
    print("Скачивание с диска включена");
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
  else if (type == "All") {
    print("Загрузка и скачивание включены");
    await DTools.uploadFolderToDrive(localFolder, folderId);
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
})().catch((err) =>  {
  print(err, colors.red);
  process.exitCode = 101;
});