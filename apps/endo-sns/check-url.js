const https = require('https');
https.get('https://actions.google.com/sounds/v1/water/small_stream_flowing.ogg', (res) => {
  console.log('Google Actions Status:', res.statusCode);
});
https.get('https://actions.google.com/sounds/v1/water/river_with_birds.ogg', (res) => {
  console.log('Google Actions Status 2:', res.statusCode);
});
