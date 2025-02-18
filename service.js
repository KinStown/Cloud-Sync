// service.js
const { google } = require('googleapis');
const path = require('path');

function getDriveService() {
  const KEYFILEPATH = path.join(__dirname, 'cloud-saver.json');
  const SCOPES = ['https://www.googleapis.com/auth/drive'];

  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES
  });
  const driveService = google.drive({ version: 'v3', auth });

  console.log("auth");
  return driveService;
};

module.exports = getDriveService;