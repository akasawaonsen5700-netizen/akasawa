const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
let start = -1;
let end = -1;
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('<section class="benefit-section">')) start = i;
  if (start !== -1 && lines[i].includes('</section>')) {
    end = i;
    break;
  }
}
console.log('start:', start, 'end:', end);
if (end === -1) {
  for(let i=start; i<lines.length; i++) {
    if (lines[i].includes('</main>')) {
      end = i - 1;
      break;
    }
  }
  console.log('adjusted end to main:', end);
}
