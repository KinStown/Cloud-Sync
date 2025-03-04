const Drive = require('@googleapis/drive');
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
  const scopes = ['https://www.googleapis.com/auth/drive'];

  const auth = new Drive.auth.GoogleAuth({
    keyFile: process.env.tokenPath,
    scopes
  });
  const driveService = Drive.drive({ version: 'v3', auth });

  print("auth");
  return driveService;
};

module.exports = { getDriveService, isOnline };