const fs = require('fs');
const content = fs.readFileSync('apps/akasawa.dp/apps/admin/src/components/MarketResearchTab.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('基本10帖')) {
    console.log('line ' + (i + 1) + ': ' + line.trim());
  }
});
