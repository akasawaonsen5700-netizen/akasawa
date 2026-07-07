const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav';
const dest = path.join(__dirname, 'public', 'bgm-river.wav');

console.log('Downloading BGM from Mixkit with browser User-Agent...');
const file = fs.createWriteStream(dest);

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'audio/wav,audio/*;q=0.9,*/*;q=0.8',
    'Referer': 'https://mixkit.co/'
  }
};

https.get(url, options, (response) => {
  if (response.statusCode !== 200) {
    console.error('Failed to download BGM. Status code:', response.statusCode);
    process.exit(1);
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Successfully downloaded to:', dest);
  });
}).on('error', (err) => {
  console.error('Error downloading BGM:', err);
  fs.unlink(dest, () => {});
});
