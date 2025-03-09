/**
 * Основной файл для запуска программы из консоли
 * Параметры запуска:
 * 1. type - тип работы программы (U - обновление файлов в облако, D - скачивание файлов, All - включает в себя все методы)
 * 2. localFolder - корневая папка для синхронизации
 * 3. folderId - Id корневой папки для синхронизации
 */

const DriveTools = require("./driveTools");
const { getDriveService, isOnline } = require('./service');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  default: {"env": "./.env"},
});

require('dotenv').config({ path: args.env });


if (!global.print) {
  require("./print").setGlobalPrint();
  print("Импортирован стандартный print");
}

(async() => {
  if (!await isOnline()) {
    throw "Нет подключения к интернету";
  }
  const drive = getDriveService();

  const type = args.type || "All";
  const localFolder = args.localFolder || process.env.dLocalFolder;
  const folderId = args.folderId || process.env.defaultFolderId;

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
  print.error(err);
  process.exitCode = 101;
});