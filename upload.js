const { google, drive_v3 } = require('googleapis');
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
    console.log(folderData);
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
    
    const fileData = await this.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    }).catch(console.error);

    return fileData;
  }

  /**
   * 
   * @param {string} fileId 
   * @param {string} localPath 
   * @param {object} customFileData Must include id,name,mimeType,modifiedTime
   * @returns File data
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
      return;
    }

    //file is exists 
    if (fs.existsSync(file.fullPath) && 
      fs.statSync(file.fullPath).mtimeMs > (new Date(file.modifiedTime)).getMilliseconds()) 
        return;
    
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
   * @param {string} [filesToNotCopy=[]] Names of files
   * @param {() => void} [callback=(()=>{})] Callback for every file
   */
  async copyFolderFromDrive(folderId, localFolderPath, filesToNotCopy=[], callback=(()=>{})) {
    const files = await this.getDriveFolderData(folderId);

    for (let file of files) {
      if (filesToNotCopy.includes(file.name)) continue;

      
      this.downloadFile(null, localFolderPath, file).catch(console.error);
    }
  }

  /**
   * 
   * @param {string} filePath Path to file
   * @param {string} folderId Parent folder id
   * @param {null} name File name 
   * @returns Uploaded file data
   */
  async uploadFileToDrive(filePath, folderId=this.mainFolderId, name=null) {  
    const fileMetadata = {
      name: name || filePath.split(/\/|\\/).pop(),
      parents: [folderId]
    };

    const media = {
      body: fs.createReadStream(filePath)
    };

    try {
      const response = await this.drive.files.create({ 
        resource: fileMetadata, 
        media: media, 
        fields: 'id' 
      });
      console.log('Файл загружен успешно. Идентификатор файла:', response.data.id);
      return response.data;

    } catch (error) {
      throw new Error(`Ошибка загрузки файла на Google Drive: ${error.message}`);
    }
  }
}






module.exports = DriveTools;