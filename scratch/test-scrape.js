const { handler } = require('../apps/akasawa-ota/netlify/functions/scrape-rakuten.js');

async function test() {
  const event = {
    queryStringParameters: {
      year: '2026',
      month: '07',
      day: '22'
    }
  };

  console.log('Testing scrape-rakuten function with event:', event);
  try {
    const result = await handler(event);
    console.log('Result status:', result.statusCode);
    console.log('Result headers:', result.headers);
    console.log('Result body:', JSON.parse(result.body));
  } catch (err) {
    console.error('Failed to run function:', err);
  }
}

test();
