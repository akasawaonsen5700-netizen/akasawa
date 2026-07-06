const https = require('https');

https.get('https://remotionlambda-apnortheast1-fosh8403e4.s3.ap-northeast-1.amazonaws.com/sites/aamr4dbngm/index.html', (res) => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
    if (data.length > 2000) {
      console.log(data.substring(0, 2000));
      process.exit(0);
    }
  });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error(err);
});
