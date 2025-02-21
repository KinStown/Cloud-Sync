const { drive_v3 } = require('googleapis');
const fs = require("fs");
const path = require("path");

class DriveTools {
  /**
   * 
   * @param {drive_v3.Drive} drive 
   * @param {string} mainFolderId 
   * @param {string} localFolder Path to local folder
   */
  constructor(drive, mainFolderId, localFolder) {
    if (!drive || !mainFolderId) 
      throw new Error("Invalid params");

    this.drive = drive;
    this.mainFolderId = mainFolderId;
    this.localFolder = localFolder;
  }
  
  /**
   * 
   * @param {string} folderID 
   * @returns All files data (name, id, parents, modifiedTime, mimeType)
   */
  async getDriveFolderData(folderId = this.mainFolderId) {
    const folderData = await this.drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(name,id,parents,modifiedTime,mimeType)"
    });
    return folderData.data.files;
  }

  /**
   * 
   * @param {string} name 
   * @param {string} parentFolderId 
   * @returns Folder data from drive
   */
  async createFolder(name, parentFolderId = this.mainFolderId ) {
    const fileMetadata = {
      name,
      'mimeType': 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };
    try {
      const fileData = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name',
      });
      console.log(`Создана папка: '${name}' Родительская папка: ${parentFolderId}`);
      return fileData;
    } catch (e) {
      return -1;
    }
  }

  /**
   * 
   * @param {string} fileId 
   * @param {string} localPath 
   * @param {object} customFileData Must include id,name,mimeType,modifiedTime
   * @returns File data if file has been downloaded
   */
  async downloadFile(fileId, localFolderPath, customFileData=null) {
    let file;
    if (!customFileData) {
      file = await this.drive.files.get({
        fileId, 
        fields: "id,name,mimeType,modifiedTime",
      });
    } else {
      file = customFileData;
    }

    file.fullPath = path.join(localFolderPath, file.name);

    //file is folder
    if (file.mimeType.endsWith("folder")) {
      fs.mkdir(file.fullPath, ()=>{});
      return this.copyFolderFromDrive(file.id, file.fullPath).catch(console.error);
    }

    //file is exists 
    if (fs.existsSync(file.fullPath)) 
        return 0;
    
    //download file
    await new Promise((res, rej) => {
      this._downloadFile(file.id, file.fullPath, () => { res() });
    });
    return file;
  }

  _downloadFile(fileId, fullPath, callback) {
    const fileStream = fs.createWriteStream(fullPath);
    fileStream.on("finish", function () {
      callback();
      console.log("\x1b[34m%s\x1b[0m", `Файл скачан: ${fullPath}`);
    });

    this.drive.files.get({
        fileId,
        fields: "id,name",
        alt: "media",
      }, {
        responseType: "stream",
      }, function (err, response) {
        if (err) return "";

        response.data
          .on("error", (err) => {})
          .on("end", () => {})
          .pipe(fileStream);
      }
    );
  }

  /**
   * 
   * @param {string} folderId 
   * @param {string[]} pathSave
   * @param {string} [ignore=[]] Names of files
   */
  async copyFolderFromDrive(folderId, localFolderPath=this.localFolder, ignore=[]) {
    const files = await this.getDriveFolderData(folderId);

    for (let file of files) {
      if (ignore.includes(file.name)) continue;

      this.downloadFile(file.id, localFolderPath, file).catch(console.error);
    }
  }

  /**
   * 
   * @param {string} filePath Path to file
   * @param {string} folderId Parent folder id
   * @param {null} name File name 
   * @returns Uploaded file data
   */
  async uploadFileToDrive(filePath, folderId=this.mainFolderId, name=null, mimeType="") {  
    const fileMetadata = {
      name: name || filePath.split(/\/|\\/).pop(),
      parents: [folderId],
      mimeType,
    };

    const media = {
      body: fs.createReadStream(filePath)
    };

    try {
      const response = await this.drive.files.create({ 
        resource: fileMetadata,
        media: media, 
        fields: 'id, name' 
      });
      console.log("\x1b[36m%s\x1b[0m",`Файл загружен: ${filePath} ID: ${response.data.id}`);
      return response.data;

    } catch (error) {
      throw new Error(`Ошибка загрузки файла на Google Drive: ${error.message}`);
    }
  }

  /**
   * 
   * @param {string} folderPath 
   * @param {string} folderDriveId 
   */
  async uploadFolderToDrive(folderPath, folderDriveId=this.mainFolderId) {
    console.log("\x1b[90m%s\x1b[0m", "Проверка папки: " + folderPath);
    const filesOnDrive = await this.getDriveFolderData(folderDriveId);
    
    const files = fs.readdirSync(folderPath);
    let file = {};
    for (file.name of files) {
      if (file.name.startsWith("!")) continue;

      file.fullPath = path.join(folderPath, file.name);
      file.stats = fs.statSync(file.fullPath);

      if (!file.stats.isDirectory()) { // Обычный файл    
        if ( filesOnDrive.find((driveFile) => driveFile.name == file.name) )
          continue;
        
        this.uploadFileToDrive(file.fullPath, folderDriveId, file.name).catch(console.error);
        file = {};
        continue;
      }

      let folderData = filesOnDrive.find((driveFile) => 
        driveFile.mimeType.endsWith("folder") && driveFile.name == file.name);

      if ( !folderData ) {
        folderData = (await this.createFolder(file.name, folderDriveId)).data;
        
        if (folderData == -1) {
          console.error("Не удалось создать папку: " + file.fullPath);
          continue;
        }
      }
      
      
      const childFolderName = path.join(folderPath, folderData.name);
      this.uploadFolderToDrive(childFolderName, folderData.id).catch(console.error);
    
      file = {};
    }
  }
}

module.exports = DriveTools;