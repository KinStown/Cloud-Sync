const DriveTools = require("./driveTools");
const { getDriveService, isOnline } = require('./service');


(async() => {
  if (!await isOnline()) {
    console.log("\x1b[31m%s\x1b[0m", "Нет подключения к интернету");
    return;
  }
  const drive = getDriveService();
  const foldersId = [
    "1Jcg7JNpGukdsdtylnOWktnFdB1rvj31S", //учебка
  ];

  const type = process.argv[2] || "All";
  const localFolder = process.argv[3] || "./test folder/";
  const folderId = process.argv[4] || foldersId[0];

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

process.once("beforeExit", (code) => {
  console.log(`\nКод завершения процесса: ${code}.\nНажмите любую клавишу для выхода.`);
  const stdin = process.stdin;
  stdin.setRawMode( true );
  stdin.resume();

  stdin.setEncoding( 'utf8' );

  stdin.on('data', function( key ){
    //process.stdout.write( key );
    process.exit();
  });
});