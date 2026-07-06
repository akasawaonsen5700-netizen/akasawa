const fs = require('fs');
const path = require('path');

const filesToDelete = [
  'apps/akasawa-ml/netlify.toml',
  'apps/akasawa-sns/netlify.toml',
  'apps/endo-sns/netlify.toml'
];

filesToDelete.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`Temporarily deleted: ${file}`);
  }
});
