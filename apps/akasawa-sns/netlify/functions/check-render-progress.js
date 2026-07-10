const { getRenderProgress } = require('@remotion/lambda-client');
const { ok, badRequest, methodNotAllowed, parseBody, json } = require('./_lib/helpers');

/**
 * AWS Lambdaで実行中のRemotion動画生成進捗を取得して返します。
 * クエリパラメータ:
 *   - renderId: AWS LambdaのレンダーID
 *   - bucketName: AWS S3バケット名
 *   - region: AWSリージョン
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true });
  if (event.httpMethod !== 'GET') return methodNotAllowed();

  try {
    const q = event.queryStringParameters || {};
    const renderId = q.renderId;
    const bucketName = q.bucketName;
    const region = q.region || 'ap-northeast-1';

    if (!renderId || !bucketName) {
      return badRequest('renderId and bucketName are required');
    }

    const awsAccessKey = process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const functionName = process.env.REMOTION_AWS_FUNCTION_NAME;

    if (!awsAccessKey || !awsSecretKey || !functionName) {
      return json(500, { error: 'AWS environment variables are not configured' });
    }

    // AWS SDKが参照する環境変数を一時設定
    process.env.AWS_ACCESS_KEY_ID = awsAccessKey;
    process.env.AWS_SECRET_ACCESS_KEY = awsSecretKey;

    console.log(`[CheckProgress] Fetching progress from AWS for RenderID: ${renderId}`);
    const progress = await getRenderProgress({
      region,
      bucketName,
      renderId,
      functionName
    });

    return ok({
      done: progress.done,
      overallProgress: progress.overallProgress || 0,
      outputFile: progress.outputFile || null,
      fatalErrorEncountered: progress.fatalErrorEncountered || false,
      errors: progress.errors || []
    });
  } catch (error) {
    console.error('[CheckProgress Error]:', error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
