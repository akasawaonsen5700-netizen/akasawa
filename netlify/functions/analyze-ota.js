const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  // CORSプリフライト対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'GEMINI_API_KEY is not configured in server environment variables.' });
  }

  try {
    const { type, payload, imageData } = JSON.parse(event.body || '{}');

    if (!type || !payload) {
      return json(400, { error: 'type and payload are required.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let systemPrompt = '';

    // 赤沢温泉旅館の強み（RAG）を共有フォルダから読み込む
    const ryokanRagPath = path.join(__dirname, '_shared', 'ryokan_rag.md');
    let ryokanRag = '';
    try {
      ryokanRag = fs.readFileSync(ryokanRagPath, 'utf8');
    } catch (err) {
      console.warn('Failed to load ryokan_rag.md, using fallback.', err.message);
      ryokanRag = '赤沢温泉旅館（ぬる湯、猫、大自然、静養）の要素を取り入れてください。';
    }

    // タイプ別のプロンプト構築（Before/Afterとコピペ入稿・パラメータ指示を厳密に定義）
    if (type === 'rakuten' || type === 'jalan' || type === 'booking') {
      const otaName = type === 'rakuten' ? '楽天トラベル' : type === 'jalan' ? 'じゃらんnet' : 'Booking.com';
      systemPrompt = `
      あなたは「${otaName}」の集客・MEO・料金設定を専門とするホテルコンサルタントです。
      赤沢温泉旅館の現在の掲載情報を分析し、オーナーが管理画面を開いてそのままコピペ入稿できる「具体的かつ実務的な Before ➔ After 改善データ」と「クーポン設定値」を出力（JSON形式）してください。
      
      ■ 分析対象データ（現状）:
      ${JSON.stringify(payload)}

      ■ 赤沢温泉の強み知識（RAG）:
      ${ryokanRag}

      ■ 記述ガイドライン:
      - 抽象的なアドバイスは禁止します。
      - 「現在の掲載文（Before）」に対する「改善後のコピペ用テキスト（After）」を明確に作成してください。
      - 「コピペ入稿する管理画面の具体的なメニュー名・入力欄の名前」を「manual」に記述してください。
      - クーポンやプロモーションの具体的な設定パラメータ（割引率、対象、適用日、発行枚数など）を「promotionParams」に記述してください。

      ■ 期待するJSONフォーマット:
      {
        "issues": "【現状の課題】楽天・じゃらん・Bookingの各媒体特性と顧客層から見た、現在のキャッチコピーやプランの課題（150文字程度）",
        "beforeText": "【現状（Before）】現在の代表的な掲載テキストやキャッチコピー（入力されたデータから抜粋または要約）",
        "afterText": "【改善後（After）】AIが宿の強み（ぬる湯、猫、おもてなし）を反映してリライトした、コピペ用の新しいキャッチコピーや施設詳細文。",
        "manual": "【管理画面入稿マニュアル】${otaName}の管理画面のどこを開き、どの入力欄に上記テキストを貼り付けるべきかの手順指示（例: 楽天ITC管理画面 ＞ 施設紹介 ＞ キャッチコピー（必須）欄など）",
        "promotionParams": "【クーポン設定パラメータ】この媒体で設定すべきクーポンの種類、推奨割引額/率、対象期間（平日・週末）、対象客層、設定理由をまとめたパラメータ表（マークダウン形式のリストまたは表）",
        "actionPlan": [
          "1番目にするべき管理画面での設定アクション",
          "2番目の設定アクション",
          "3番目の設定アクション"
        ]
      }
      `;
    } else if (type === 'review') {
      systemPrompt = `
      あなたはホテルのカスタマーサクセスおよび品質管理のアナリストです。
      寄せられたクチコミを分析し、表面的な言葉ではなく「不満の真の要因（ボトルネック）」を特定し、現場でそのまま使える「朝礼・改善指示シート」およびOTAで不満を予防するための「事前告知用テキスト」を出力してください。
      
      ■ 分析対象のクチコミ:
      ${JSON.stringify(payload)}

      ■ 赤沢温泉の強み知識（RAG）:
      ${ryokanRag}

      ■ 期待するJSONフォーマット:
      {
        "issues": "【不満のボトルネック（真因分析）】クチコミに隠れたオペレーション上の根本的な問題点やホスピタリティのすれ違いの原因分析",
        "beforeText": "【現状のクチコミ抜粋（Before）】クチコミで指摘された具体的な不満箇所",
        "afterText": "【OTA事前防止用テキスト（After）】クチコミの不満（お湯がぬるい、猫の気まぐれなど）を未然に防ぎ、期待値をコントロールするためにOTAの施設紹介やFAQに掲載しておくべき説明テキスト（例: 『当館のお湯はあえて38〜40℃のぬる湯です...』など）",
        "manual": "【現場スタッフ向け朝礼・ミーティング用指示マニュアル】外国人スタッフを含めた現場メンバーにそのまま共有して指示できる、今日から実行する具体的な行動ルールやマニュアルの文章",
        "promotionParams": "【ハード・設備投資のアドバイス】クチコミの不満を解決するために必要なハード面での対策（Wi-Fi、スマートキー、清掃用資材など）と、費用対効果の高い物理的投資の推奨案",
        "actionPlan": [
          "今日の朝礼で共有すべき改善アクション",
          "現場オペレーションの即時変更タスク",
          "設備面での要検討タスク"
        ]
      }
      `;
    } else if (type === 'photo') {
      systemPrompt = `
      あなたはホテルのブランディングおよびWEB集客用のビジュアルディレクターです。
      アップロードされた画像（ある場合）または入力された掲載写真リストを視覚的・レイアウト的にスキャンし、予約率（CVR）を最大化するための「撮影Before ➔ Afterディレクション指示書」および「フォトギャラリー並べ順」を出力してください。
      
      ■ 入力データ（写真状況）:
      ${JSON.stringify(payload)}

      ■ 赤沢温泉の強み知識（RAG）:
      ${ryokanRag}

      ■ 期待するJSONフォーマット:
      {
        "issues": "【ビジュアル面での現状の課題】写真の印象、構図、ライティング、および宿の魅力（猫、温泉、静養）が伝わりにくい要因の視覚的分析",
        "beforeText": "【現状の写真（Before）】現在の掲載写真の構図、明るさ、写っているものの問題点",
        "afterText": "【撮影改善指示書（After）】同じ場所（ロビー、客室、温泉など）を撮り直す際の、具体的な『アングル（構図）』『ライティング（光の当て方）』『演出・猫の配置』をプロカメラマン向けに解説した撮影ディレクションマニュアル",
        "manual": "【推奨フォトギャラリー掲載順序】楽天やじゃらんのギャラリーの最初の10枚に、どの写真をどの順番で並べるべきかの具体的な並べ順リスト（ストーリー仕立ての構成案）",
        "promotionParams": "【画像生成AI用ビジュアルプロンプト（英語）】撮影前のシミュレーションやSNS配信用イメージを作成するために、MidjourneyやDALL-E3に貼り付けて使える美しい英語の高品質プロンプト（2パターン）",
        "actionPlan": [
          "既存の不要な写真の削除または並べ替え",
          "スマホまたはプロによる撮り直しが必要なカットの選定",
          "撮影時の演出準備（猫のおやつ、温かい料理のタイミングなど）"
        ]
      }
      `;
    } else if (type === 'plan') {
      systemPrompt = `
      あなたはホテルのプラン作成・マーケティングの専門家です。
      既存の宿泊プランを分析し、OTAでのクリック率（CTR）と予約転換率（CVR）を上げるためのリライト提案（JSONフォーマット）を出力してください。
      
      ■ 入力データ:
      ${JSON.stringify(payload)}

      ■ 期待するJSONフォーマット:
      {
        "issues": "現在のプランの課題（文字数、ターゲットの不明確さ、フックキーワードの欠如など）",
        "beforeText": "現在のプラン名および説明文の抜粋",
        "afterText": "【改善されたプラン設計】\\n・推奨プラン名（SEOフック・文字数制限に適合したタイトル）\\n・ストーリー仕立てのリライトプラン説明文\\n・追加すべき付加価値特典（チェックアウト延長など）",
        "manual": "【入稿箇所】楽天トラベル管理画面（プラン管理）またはじゃらんnet管理画面（宿泊プラン登録）に入力する際の手順と入力箇所の指示マニュアル",
        "promotionParams": "【推奨ターゲット層と価格設計】このプランが最も刺さるターゲット層、および基準販売価格設定の根拠と価格戦略（マークダウン形式）",
        "actionPlan": [
          "プラン名の差し替え",
          "プラン説明文の貼り付け",
          "付加価値特典の新規設定"
        ]
      }
      `;
    } else if (type === 'rank_ad') {
      systemPrompt = `
      あなたはホテルのデジタルマーケティングおよび広告運用・プロモーション設計の専門家です。
      現在の検索順位、有料広告の運用データ、および値引きクーポン予算をもとに、MEO/SEOの向上と広告投資対効果（ROAS）を最大化するための最適化提案を出力してください。
      
      ■ 入力データ:
      ${JSON.stringify(payload)}

      ■ 期待するJSONフォーマット:
      {
        "issues": "現在の検索露出、広告費、クーポン原資（ポイントアップ）の利用における無駄や配分の課題の要約",
        "beforeText": "【現状（Before）】現在の検索順位状況、広告支出、値引きクーポンの利用状況の要約",
        "afterText": "【改善策（After）】MEO/SEO順位向上のための具体的アクション、および強化すべきニッチな検索キーワード（タグ）のリスト（例: 『源泉かけ流し ぬる湯 静養』など）",
        "manual": "【広告管理画面での操作手順】楽天トラベルキーワード広告管理画面やじゃらん販促サポートツールでの具体的な予算設定・キーワード入札手順指示マニュアル",
        "promotionParams": "【予算 ＆ 値引きクーポン原資の最適配分シート】月間予算の中での「有料広告費」と「直前・平日クーポン値引き原資」の最も効果的な配分比率（例: 広告費35%、クーポン値引き原資65%など）と、その配分による獲得シミュレーション解説（マークダウン形式）",
        "actionPlan": [
          "露出を高めるべき主要検索タグの設定追加",
          "キーワード広告の予算調整・入札開始",
          "平日クーポン原資の登録設定"
        ]
      }
      `;
    }

    const contents = [];
    const parts = [];

    // マルチモーダル画像データの処理
    if (imageData && imageData.data) {
      parts.push({
        inlineData: {
          mimeType: imageData.mimeType || 'image/jpeg',
          data: imageData.data // プレフィックスを除去したBase64文字列
        }
      });
    }

    parts.push({ text: systemPrompt });
    contents.push({ role: 'user', parts });

    const result = await model.generateContent({
      contents,
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = result.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: responseText
    };

  } catch (error) {
    console.error('OTA Analysis failed:', error);
    return json(500, { error: error.message || 'OTAの分析中に内部エラーが発生しました。' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
