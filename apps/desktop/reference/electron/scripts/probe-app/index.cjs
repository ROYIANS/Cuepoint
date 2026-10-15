console.log('entered cjs Electron main');
const {app} = require('electron');
console.log('app ready?', app.isReady());
app.whenReady().then(() => {console.log('native ready', process.versions); app.exit(0);});
