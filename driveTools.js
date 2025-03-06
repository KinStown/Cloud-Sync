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
      throw new Error(`Invalid params: ${drive} ${mainFolderId}`);

    this.drive = drive;
    this.mainFolderId = mainFolderId;
    this.localFolder = path.resolve(localFolder);
    if (!fs.existsSync(this.localFolder))
      throw new Error("Local folder not exists");
    
  }
  
  /**
   * 
   * @param {string} folderID 
   * @returns All files data (name, id, parents, modifiedTime, mimeType)
   */
  async getDriveFolderData(folderId = this.mainFolderId) {
    const folderData = await this.drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(name,id,parents,modifiedTime,mimeType,size)"
    });
    return folderData.data.files;
  }

  /**
   * 
   * @param {string} fileId
   * @returns File data + response status
   */
  async getDriveFileData(fileId) {
    const response = await this.drive.files.get({
      fileId, 
      fields: "id,name,mimeType,modifiedTime,size",
    });
    return {
      ...response.data, 
      status: response.status,
    };
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
      print(`Создана папка: '${name}' Родительская папка: ${parentFolderId}`);
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
    let file = customFileData;
    if (!customFileData) {
      file = await this.getDriveFileData(fileId);
    } 
    const localFile = {
      fullPath: path.join(localFolderPath, file.name)
    };

    //Файл является папкой
    if (file.mimeType.endsWith("folder")) {
      if (!fs.existsSync(localFile.fullPath)) {
        fs.mkdirSync(localFile.fullPath);
        const creationDate = new Date(file.modifiedTime);
        fs.utimesSync(localFile.fullPath, creationDate, creationDate);
      }
      
      return this.copyFolderFromDrive(file.id, localFile.fullPath).catch(console.error);
    }

    //Файл в облаке поврежден
    if (file.size == 0) {
      print(`Файл ${file.name}(${file.id}) весит 0Б`, colors.yellow);
      return 0;
    }

    //Файл скачан, не изменен и не поврежден
    if (fs.existsSync(localFile.fullPath)) 
      localFile.stats = fs.statSync(localFile.fullPath);

    if (localFile.stats &&
      localFile.stats.mtimeMs >= (new Date(file.modifiedTime)).getTime() &&
      localFile.stats.size > 0 ) {
        return 0;
    }
    
    //Скачивание файла
    await new Promise((res) => {
      this._downloadFile(file.id, localFile.fullPath, () => { 
        const creationDate = new Date(file.modifiedTime);
        fs.utimesSync(localFile.fullPath, creationDate, creationDate);
        res();
      });
    });
    return {...file, ...localFile};
  }

  _downloadFile(fileId, fullPath, callback) {
    const fileStream = fs.createWriteStream(fullPath);
    fileStream.on("finish", () => {
      callback();
      print(`Файл скачан: ${this._formatPath(fullPath)}`, colors.blue);
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
      global.countOfD++;
      this.downloadFile(file.id, localFolderPath, file)
      .then(() => global.countOfD--)
      .catch(console.error);
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
      // Проверка на правильность загрузки файла на облако
      if (await this.getDriveFileData(response.data.id).id)
        print(`Файл загружен: ${this._formatPath(filePath)} ID: ${response.data.id}`, colors.blue);
      else 
        print(`Не получилось загрузить правильно файл: ${this._formatPath(filePath)}`);

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
    //print("Проверка папки: " + this._formatPath(folderPath), colors.gray);
    const filesOnDrive = await this.getDriveFolderData(folderDriveId);
    
    const files = fs.readdirSync(folderPath);
    let file = {};
    for (file.name of files) {
      if (file.name.startsWith("!")) continue;
      global.countOfCU++;

      file.fullPath = path.join(folderPath, file.name);
      file.stats = fs.statSync(file.fullPath);

      if (!file.stats.isDirectory()) { // Обычный файл    
        //Файл поврежден
        if (file.stats.size == 0) {
          print("Файл поврежден: " + this._formatPath(file.fullPath), colors.yellow);
          global.countOfCU--;
          continue;
        }
        const driveFile = filesOnDrive.find((driveFile) => driveFile.name == file.name);
        if (driveFile) { //Файл есть в облаке
          //Локальный файл не изменился
          if (new Date(driveFile.modifiedTime).getTime() >= Math.floor(file.stats.mtimeMs) && Number(driveFile.size) > 0 ) { 
            global.countOfCU--;
            continue;
          }
          //Обновляем файл
          const metadata = {
            modifiedTime: file.stats.mtime
          };
          const media = {
            body: fs.createReadStream(file.fullPath)
          };
          const updatedFile = await this.updateFile(driveFile.id, metadata, media);
          print(`Файл обновлен: ${this._formatPath(file.fullPath)} ID: ${updatedFile.id}`, colors.blue);
          global.countOfCU--;
          continue;
        }
        //Создаем файл
        global.countOfU++;
        this.uploadFileToDrive(file.fullPath, folderDriveId, {
          name: file.name, 
          modifiedTime: file.stats.mtime
        })
        .then(() => global.countOfU--)
        .catch(console.error);
        file = {};
        global.countOfCU--;
        continue;
      }
      //Объект является папкой
      let folderData = filesOnDrive.find((driveFile) => 
        driveFile.mimeType.endsWith("folder") && driveFile.name == file.name);

      if ( !folderData ) { //Создаем папку
        folderData = (await this.createFolder(file.name, folderDriveId, { modifiedTime: file.stats.mtime })).data;
        
        if (folderData == -1) {
          console.error("\x1b[31m%s\x1b[0m", "Не удалось создать папку: " + file.fullPath);
          global.countOfCU--;
          continue;
        }
      }
      
      const childFolderName = path.join(folderPath, folderData.name);
      this.uploadFolderToDrive(childFolderName, folderData.id)
      .then(() => global.countOfCU--)
      .catch(console.error);
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
        if (err)  {
          rej(err)
        } else {
          res(file.data);
        }
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