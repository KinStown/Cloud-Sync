const { drive_v3 } = require('@googleapis/drive');
const fs = require("fs");
const path = require("path");

class DriveTools {
  /**
   * 
   * @param {drive_v3.Drive} drive Авторизованный объект DriveService 
   * @param {string} mainFolderId Id корневой рабочей папки в облаке
   * @param {string} localFolder Путь до корневой папки синхронизации
   * @param {string[]} whitelist Массив полных путей файлов/папок, с которыми будут происходить операции, остальные файлы будут пропускаться
   */
  constructor(drive, mainFolderId, localFolder, whitelist=[]) {
    if (!mainFolderId) 
      throw new Error(`Invalid mainFolderId: ${mainFolderId}`);
    if (!drive) 
      throw new Error("Drive object is null");

    this.drive = drive;
    this.mainFolderId = mainFolderId;
    this.localFolder = path.resolve(localFolder);
    this.whitelist = whitelist;
    if (!fs.existsSync(this.localFolder))
      throw new Error("Local folder not exists");
  }
  
  /**
   * Получение данных о всех объектах в облачной папке
   * @param {string} folderID 
   * @returns Возвращает данные (name, id, parents, modifiedTime, mimeType, size) о всех объектах в папке
   */
  async getDriveFolderData(folderId = this.mainFolderId) {
    const folderData = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(name,id,parents,modifiedTime,mimeType,size)"
    });
    return folderData.data.files;
  }

  /**
   * Получение данных о файле в облаке
   * @param {string} fileId
   * @returns Возвращает данные о файле (id, name, mimeType, modifiedTime, size) и статус запроса
   */
  async getDriveFileData(fileId) {
    const response = await this.drive.files.get({
      fileId, 
      fields: "id,name,mimeType,modifiedTime,size",
    });
    response.data.status = response.status;
    return response.data;
  }

  /**
   * Создает папку в облаке в родительской папке parentFolderId
   * @param {string} name 
   * @param {string} parentFolderId 
   * @returns Возвращает Id и name созданной папки или -1 в случае ошибки
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
      return fileData.data;
    } catch (e) {
      return -1;
    }
  }

  /**
   * Проверяет условия и скачивает файл из облака
   * @param {string} fileId Id файла, который будет скачан
   * @param {string} localPath Путь к файлу, без названия самого файла
   * @param {object} customFileData Ранее полученные данные о файле (id,name,mimeType,modifiedTime). Используются вместо запроса к серверу
   * @returns Возвращает данные о созданном файле и файле из облака. В случае, если файл является папкой, или ошибки возвращает 0
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

    //Файл не находится в списке
    if ( this.whitelist.length && !this.whitelist.find(path => localFile.fullPath.includes(path)) )
      return;

    //Файл в облаке поврежден
    if (file.size == 0) {
      console.log(`Файл ${file.name}(${file.id}) весит 0Б`.warn);
      return 0;
    }

    //Файл скачан, не изменен и не поврежден
    if (fs.existsSync(localFile.fullPath)) 
      localFile.stats = fs.statSync(localFile.fullPath);

    if (localFile.stats &&
      (localFile.stats.mtimeMs + 1) >= (new Date(file.modifiedTime)).getTime() &&
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

  /**
   * Скачивает файл из облака без проверки. Использовать после всех проверок(!)
   * @param {string} fileId Id скачиваемого файла
   * @param {string} fullPath Полный путь к скачиваемому файлу
   * @param {() => {}} callback Функция, вызывающаяся после завершения загрузки
   */
  _downloadFile(fileId, fullPath, callback) {
    const fileStream = fs.createWriteStream(fullPath);
    fileStream.on("finish", () => {
      callback();
      console.log(`Файл скачан: ${this._formatPath(fullPath)}`.info);
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
   * Проверяет и скачивает файлы в папку pathSave из папки folderId
   * @param {string} folderId 
   * @param {string[]} pathSave Корневая папка для синхронизации
   */
  async copyFolderFromDrive(folderId, localFolderPath=this.localFolder) {
    const files = await this.getDriveFolderData(folderId);

    for (let file of files) {
      global.countOfD++;
      this.downloadFile(file.id, localFolderPath, file)
      .then(() => global.countOfD--)
      .catch(console.error);
    }
  }

  /**
   * Загружает файл filePath в папку folderId в облаке. Дополнительно проверяет поврежденность файла после завершения 
   * @param {string} filePath Путь к локальному файлу, включая название файла
   * @param {string} folderId Id папки в облаке, куда будет загружен файл
   * @param {object} options Дополнительные параметры, которые будут использованы в Metadata
   * @returns Вызывает ошибку, если не получилось создать файл. В случае удачи возвращает Id и name
   */
  async uploadFileToDrive(filePath, folderId=this.mainFolderId, options={}) {  
    const fileMetadata = {
      name: filePath.split(/\/|\\/).pop(),
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
      
      console.log(`Файл загружен: ${this._formatPath(filePath)} ID: ${response.data.id}`.info);

      return response.data;
    } catch (error) {
      throw new Error("Ошибка загрузки файла на Google Drive", {cause: error});
    }
  }

  /**
   * Перебирает, проверяет и загружает объекты из папки folderPath в облако в папку folderDriveId
   * @param {string} folderPath Путь к папке, которая будет перебираться
   * @param {string} folderDriveId Id папки, в которую будет происходить копирование
   */
  async uploadFolderToDrive(folderPath, folderDriveId=this.mainFolderId) {
    console.log(`Проверка папки: ${this._formatPath(folderPath)}`.debug);
    const filesOnDrive = await this.getDriveFolderData(folderDriveId);
    
    const files = fs.readdirSync(folderPath);
    let file = {};
    for (file.name of files) {
      file.fullPath = path.join(folderPath, file.name);
      file.stats = fs.statSync(file.fullPath);

      //Объект не включен в список
      if ( this.whitelist.length && !this.whitelist.find(path => file.fullPath.includes(path)) ) 
        continue;
      //Объект начинается с ! и не включен в список
      if ( !this.whitelist.length && file.name.startsWith("!") )
        continue;

      global.countOfCU++;

      if (!file.stats.isDirectory()) { // Обычный файл    
        //Файл поврежден
        if (file.stats.size == 0) {
          console.log("Файл поврежден: " + this._formatPath(file.fullPath).warn);
          global.countOfCU--;
          continue;
        }
        const driveFile = filesOnDrive.find((driveFile) => driveFile.name == file.name);
        if (driveFile) { //Файл есть в облаке
          //Локальный файл не изменился
          if (new Date(driveFile.modifiedTime).getTime() >= (file.stats.mtimeMs - 1) && Number(driveFile.size) > 0 ) { 
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
          console.log(`Файл обновлен: ${this._formatPath(file.fullPath)} ID: ${updatedFile.id}`.info);
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

      //Папка не создана
      if ( !folderData ) { 
        //Создаем папку
        folderData = (await this.createFolder(file.name, folderDriveId, { modifiedTime: file.stats.mtime }));
        
        //Ошибка при создании папки
        if (folderData == -1) {
          console.log(`Не удалось создать папку: ${file.fullPath}`.error);
          global.countOfCU--;
          continue;
        }
        console.log(`Создана папка: '${folderData.name}' Родительская папка: ${folderDriveId}`.info2);
      }
      
      //Пееребор дочерних папок через рекурсию
      const childFolderName = path.join(folderPath, folderData.name);
      this.uploadFolderToDrive(childFolderName, folderData.id)
      .then(() => global.countOfCU--)
      .catch(console.error);
    }
  }

  /**
   * Обновляет файл, используя fileMetadata и media
   * @param {string} fileId 
   * @param {object} fileMetadata 
   * @param {object} media 
   * @returns Возвращает (Id, name) обновленного файла
   */
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
   * Форматирует пути к более красивому виду: локальный путь, начиная с корневой папки синхронизации (localFolder)
   * @param {string} Path Абсолютный путь, включающий корневую папку localFolder
   * @returns Отформатированный путь или аргумент Path в случае ошибки
   */
  _formatPath(Path) {
    Path = path.resolve(Path);
    if (!path.isAbsolute(Path) || !Path.includes(this.localFolder)) return Path;

    let fPath = "." + (Path.split(this.localFolder)[1] || "\\");
    return fPath;
  }
}

module.exports = DriveTools;