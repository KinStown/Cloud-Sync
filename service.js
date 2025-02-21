const { google } = require('googleapis');
const path = require('path');
const http2 = require('http2');

function isOnline() {
  return new Promise((resolve) => {
    const client = http2.connect('https://www.google.com');
    client.on('connect', () => {
      resolve(true);
      client.destroy();
    });
    client.on('error', () => {
      resolve(false);
      client.destroy();
    });
  });
}

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

module.exports = { getDriveService, isOnline };