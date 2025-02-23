const { drive_v3 } = require('@googleapis/drive');
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
    this.localFolder = path.resolve(localFolder);
    if (!fs.existsSync(this.localFolder)) {
      throw new Error("Local folder not exists");
    }
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
  async createFolder(name, parentFolderId = this.mainFolderId, metadata={} ) {
    const fileMetadata = {
      name,
      'mimeType': 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
      ...metadata
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
      if (!fs.existsSync(file.fullPath)) {
        fs.mkdirSync(file.fullPath);
        const creationDate = new Date(file.modifiedTime);
        fs.utimesSync(file.fullPath, creationDate, creationDate);
      }
      
      return this.copyFolderFromDrive(file.id, file.fullPath).catch(console.error);
    }

    //file is exists 
    if ( fs.existsSync(file.fullPath) && 
      fs.statSync(file.fullPath).mtimeMs >= (new Date(file.modifiedTime)).getTime() ) 
        return 0;
    
    //download file
    await new Promise((res, rej) => {
      this._downloadFile(file.id, file.fullPath, () => { 
        const creationDate = new Date(file.modifiedTime);
        fs.utimesSync(file.fullPath, creationDate, creationDate);
        res();
      });
      
    });
    return file;
  }

  _downloadFile(fileId, fullPath, callback) {
    const fileStream = fs.createWriteStream(fullPath);
    fileStream.on("finish", () => {
      callback();
      console.log("\x1b[34m%s\x1b[0m", `Файл скачан: ${this._formatPath(fullPath)}`);
    });

    this.drive.files.get({
        fileId,
        fields: "id,name,modifiedTime",
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
  async uploadFileToDrive(filePath, folderId=this.mainFolderId, options={}) {  
    const fileMetadata = {
      name: options.name || filePath.split(/\/|\\/).pop(),
      parents: [folderId],
      ...options
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
      console.log("\x1b[34m%s\x1b[0m",`Файл загружен: ${this._formatPath(filePath)} ID: ${response.data.id}`);
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
    console.log("\x1b[90m%s\x1b[0m", "Проверка папки: " + this._formatPath(folderPath));
    const filesOnDrive = await this.getDriveFolderData(folderDriveId);
    
    const files = fs.readdirSync(folderPath);
    let file = {};
    for (file.name of files) {
      if (file.name.startsWith("!")) continue;

      file.fullPath = path.join(folderPath, file.name);
      file.stats = fs.statSync(file.fullPath);

      if (!file.stats.isDirectory()) { // Обычный файл    
        const driveFile = filesOnDrive.find((driveFile) => driveFile.name == file.name);
        if (driveFile) { //Файл есть в облаке
          if (new Date(driveFile.modifiedTime).getTime() <= file.stats.mtimeMs)  //Файл не обновился
            continue;

          //Обновляем файл
          const metadata = {
            modifiedTime: file.stats.mtime
          };
          const media = {
            body: fs.createReadStream(file.fullPath)
          };
          const updatedFile = await this.updateFile(driveFile.id, metadata, media);
          console.log("\x1b[34m%s\x1b[0m", `Файл обновлен: ${updatedFile.name} ID: ${updatedFile.id}`);
          continue;
        }
        //Создаем файл
        this.uploadFileToDrive(file.fullPath, folderDriveId, {
          name: file.name, 
          modifiedTime: file.stats.mtime
        }).catch(console.error);
        file = {};
        continue;
      }

      let folderData = filesOnDrive.find((driveFile) => 
        driveFile.mimeType.endsWith("folder") && driveFile.name == file.name);

      if ( !folderData ) { //Создаем папку
        folderData = (await this.createFolder(file.name, folderDriveId, { modifiedTime: file.stats.mtime })).data;
        
        if (folderData == -1) {
          console.error("\x1b[31m%s\x1b[0m", "Не удалось создать папку: " + file.fullPath);
          continue;
        }
      }
      
      const childFolderName = path.join(folderPath, folderData.name);
      this.uploadFolderToDrive(childFolderName, folderData.id).catch(console.error);
    }
  }

  updateFile(fileId, fileMetadata, media) {
    return new Promise((res, rej) => {
      this.drive.files.update({
        fileId,
        resource: fileMetadata,
        media,
        fields: "name,id"
      }, (err, file) => {
        if (err) 
          rej(err)
        else 
          res(file);
      });
    });
  }

  /**
   * 
   * @param {string} Path Absolute path to folder in local folder
   * @returns Formated path
   */
  _formatPath(Path) {
    Path = path.resolve(Path);
    if (!path.isAbsolute(Path) || !Path.includes(this.localFolder)) return Path;

    let fPath = "." + (Path.split(this.localFolder)[1] || "\\");
    return fPath;
  }
}

module.exports = DriveTools;