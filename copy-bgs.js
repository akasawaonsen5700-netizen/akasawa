const fs = require('fs');
const path = require('path');

const src2 = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\f82dd262-a1a9-4100-9085-79de01bf94cf\\bg_premium2_1783143891502.png';
const dest2 = path.join(__dirname, 'apps', 'endo-sns', 'public', 'bg-premium2.png');
const src3 = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\f82dd262-a1a9-4100-9085-79de01bf94cf\\bg_premium3_1783143902834.png';
const dest3 = path.join(__dirname, 'apps', 'endo-sns', 'public', 'bg-premium3.png');

try {
  if (fs.existsSync(src2)) {
    fs.copyFileSync(src2, dest2);
    console.log('Copied bg-premium2.png successfully!');
  } else {
    console.error('Source 2 not found at:', src2);
  }
  
  if (fs.existsSync(src3)) {
    fs.copyFileSync(src3, dest3);
    console.log('Copied bg-premium3.png successfully!');
  } else {
    console.error('Source 3 not found at:', src3);
  }
} catch (e) {
  console.error('Failed to copy:', e);
}
