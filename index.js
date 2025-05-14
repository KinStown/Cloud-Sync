/**
 * Основной файл для запуска программы из консоли
 * Параметры запуска:
 * 1. type - тип работы программы (опционально)
 *    U - обновление файлов в облако, 
 *    D - скачивание файлов, 
 *    All - включает в себя все методы) (опционально)
 *    SU - удаление всей рабочей папки и загрузка файлов на диск
 *    SD - удаление всей локальной рабочей папки и скачивание
 * 2. localFolder - корневая папка для синхронизации
 * 3. folderId - Id корневой папки для синхронизации
 * 4. tokenPath - путь к token.json
 * 5. whitelist - список путей к файлам (опционально)
 * 6. env - путь к файлу конфигурации, содержащий все вышеописанные параметры (опционально)
 */

const DriveTools = require("./driveTools");
const fs = require("fs");
const { getDriveService, isOnline } = require('./service');
const minimist = require('minimist');
var colors = require('colors');

colors.setTheme({
  head: 'white', //Тип запуска и auth
  info: 'blue', //Загрузка и скачивание файлов
  info2: 'white', //Папка создана
  warn: 'yellow',
  debug: 'grey', //Проверка папок
  error: 'red',
  log: 'white' //Вывод счетчиков
});

const args = minimist(process.argv.slice(2), {
  default: {
    "env": "./.env",
    "type": "all",
  },
});

require('dotenv').config({ path: args.env });

(async() => {
  if (!await isOnline()) 
    throw "Нет подключения к интернету".error;
  
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

  switch (type) {
    case "u": 
      console.log("Загрузка на диск включена".head);
      await DTools.uploadFolderToDrive(localFolder, folderId);
      break;

    case "d": 
      console.log("Скачивание с диска включена".head);
      await DTools.copyFolderFromDrive(folderId, localFolder);
      break;
    
    case "su":
      console.log("Перезапись диска включена".head);
      await DTools.drive.files.delete({ fileId: folderId });
      await DTools.uploadFolderToDrive(localFolder, folderId);
      break;
    
    case "sd":
      console.log("Перезапись локальной папки включена".head);
      fs.rm(localFolder, {
          recursive: true,
          force: true
      }, async(err) => {
          if (err) {
              return console.error('Ошибка при удалении директории:', err);
          }
          await DTools.uploadFolderToDrive(localFolder, folderId);
      });
      break;
    
    case "all":
      console.log("Загрузка и скачивание включены".head);
      await DTools.uploadFolderToDrive(localFolder, folderId);
      await DTools.copyFolderFromDrive(folderId, localFolder);
      break;
  }
})().catch((err) =>  {
  console.error(err);
  process.exitCode = 101;
});