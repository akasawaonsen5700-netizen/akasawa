exports.handler = async function (event, context) {
  const { year, month, day } = event.queryStringParameters || {};

  if (!year || !month || !day) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing date parameters" }),
    };
  }

  const targetUrl = `https://search.travel.rakuten.co.jp/ds/vacant/searchVacant?f_dai=japan&f_chu=tochigi&f_sho=nasu&f_sai=shiobara&f_otona_su=2&f_heya_su=1&f_nen1=${year}&f_tuki1=${month}&f_hi1=${day}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`Rakuten returned ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/"totalResults":\[(\d+)\]/);

    let totalResults = -1;
    if (match && match[1]) {
      totalResults = parseInt(match[1], 10);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ totalResults }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
