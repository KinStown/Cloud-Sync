const Drive = require('@googleapis/drive');
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

function getDriveService(keyFile) {
  const scopes = ['https://www.googleapis.com/auth/drive'];

  const auth = new Drive.auth.GoogleAuth({
    keyFile,
    scopes
  });
  const driveService = Drive.drive({ version: 'v3', auth });

  console.log("auth".head);
  return driveService;
};

module.exports = { getDriveService, isOnline };