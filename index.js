const DriveTools = require("./driveTools");
const getDriveService = require('./service');

const drive = getDriveService();
const foldersId = [
  "1Jcg7JNpGukdsdtylnOWktnFdB1rvj31S", //учебка
  "1zhB7JuRxOlxQM4_BlSE6XFvK627PAmXe"  //testik
]
const localFolder = "./test folder/";

const DTools = new DriveTools(drive, foldersId[0], localFolder);

//DTools.getDriveFolderData().then(console.log);
//DTools.createFolder("testik").then(console.log);

//DTools.copyFolderFromDrive(foldersId[0], "C:\\Users\\callback\\Desktop\\test\\test folder");

//DTools.uploadFileToDrive("C:\\Users\\callback\\Desktop\\test\\test folder\\Логический элемент.docx").then(console.log);

if (process.argv.includes("upload")) {
  console.log("Upload files enabled");
  DTools.uploadFolderToDrive(localFolder, foldersId[0]);
}
if (process.argv.includes("downl")) {
  console.log("Download files enabled");
  DTools.copyFolderFromDrive(foldersId[0], localFolder);
}



process.once("beforeExit", (code) => {
  console.log(`\nКод завершения процесса: ${code}.\nНажмите Enter для выхода.`);
  process.stdin.read();
});