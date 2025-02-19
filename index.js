const DriveTools = require("./driveTools");
const getDriveService = require('./service');

const drive = getDriveService();
const foldersId = [
  "1Jcg7JNpGukdsdtylnOWktnFdB1rvj31S", //учебка
  "1zhB7JuRxOlxQM4_BlSE6XFvK627PAmXe"  //testik
];

const type = process.argv[2];
const localFolder = process.argv[3] || "./test folder/";
const folderId = process.argv[4] || foldersId[0];

const DTools = new DriveTools(drive, folderId, localFolder);

if (type == "U" || !type) {
  console.log("Upload files enabled");
  DTools.uploadFolderToDrive(localFolder, folderId);
}
if (type == "D" || !type) {
  console.log("Download files enabled");
  DTools.copyFolderFromDrive(folderId, localFolder);
}

process.once("beforeExit", (code) => {
  console.log(`\nКод завершения процесса: ${code}.\nНажмите любую клавишу для выхода.`);
  const stdin = process.stdin;
  stdin.setRawMode( true );
  stdin.resume();

  stdin.setEncoding( 'utf8' );

  stdin.on('data', function( key ){
    process.stdout.write( key );
    process.exit();
  });
});