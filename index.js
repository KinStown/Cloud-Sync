/**
 * Основной файл для запуска программы из консоли
 * Параметры запуска:
 * 1. type - тип работы программы (U - обновление файлов в облако, D - скачивание файлов, All - включает в себя все методы) (опционально)
 * 2. localFolder - корневая папка для синхронизации
 * 3. folderId - Id корневой папки для синхронизации
 * 4. tokenPath - путь к token.json
 * 5. whitelist - список путей к файлам (опционально)
 * 6. env - путь к файлу конфигурации, содержащий все вышеописанные параметры (опционально)
 */

const DriveTools = require("./driveTools");
const { getDriveService, isOnline } = require('./service');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
  default: {
    "env": "./.env",
    "type": "all",
  },
});

require('dotenv').config({ path: args.env });

if (!global.print) {
  require("./print").setGlobalPrint();
  print("Импортирован стандартный print");
}

(async() => {
  if (!await isOnline()) 
    throw "Нет подключения к интернету";
  
  const type = args.type.toLowerCase();
  const localFolder = args.localFolder || process.env.dLocalFolder;
  const tokenPath = args.tokenPath || process.env.tokenPath;
  const folderId = args.folderId || process.env.defaultFolderId;
  const whitelist = (args.whitelist || process.env.whitelist)?.split(";").map(path => {
    path = path.trim();
    if (path.startsWith(".\\"))
      path = localFolder + path.slice(1);
    return path;
  });

  const drive = getDriveService(tokenPath);
  const DTools = new DriveTools(drive, folderId, localFolder, whitelist);

  if (type == "u") {
    print("Загрузка на диск включена");
    await DTools.uploadFolderToDrive(localFolder, folderId);
  }
  else if (type == "d") {
    print("Скачивание с диска включена");
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
  else if (type == "all") {
    print("Загрузка и скачивание включены");
    await DTools.uploadFolderToDrive(localFolder, folderId);
    await DTools.copyFolderFromDrive(folderId, localFolder);
  }
})().catch((err) =>  {
  print.error(err);
  process.exitCode = 101;
});