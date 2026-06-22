# YouTube チャンネルの SNS 自動運用 — Claude Code プロンプト集

> YouTube チャンネルの動画を元に、各 SNS へ自動投稿する仕組みを Claude Code で構築するためのプロンプト集です。
> 各 SNS ごとに「最初に送る1つのプロンプト」をまとめています。

## 前提条件（全 SNS 共通）

- **Claude Code** がインストール済み
- YouTube チャンネルを運営しており、毎日（or 定期的に）動画を投稿している
- 動画の台本を Google Docs で管理している（任意だが推奨）
- 動画の管理情報を Google スプレッドシートで管理している（投稿日・タイトル・台本リンク等）

### 必要なツール
| ツール | 用途 | インストール |
|---|---|---|
| Node.js 18+ | bot 実行 | `brew install node` |
| Python 3.9+ | 補助スクリプト | `brew install python3` |
| yt-dlp | YouTube 動画/字幕取得 | `pip3 install yt-dlp` |
| ffmpeg | 動画加工 | `brew install ffmpeg` |
| Playwright | ブラウザ自動操作 | `npm install playwright` |

---

## 全体マップ

```
YouTube 動画（前日公開）
    │
    ├─→ 11:00  note 記事投稿
    ├─→ 11:30  切り抜き動画生成 → YouTube Shorts（非公開）
    ├─→ 12:00  YouTube Shorts 公開変更
    ├─→ 12:00  YouTube コミュニティ投稿
    ├─→ 13:00  X (Twitter) 投稿
    ├─→ 14:00  Threads 投稿
    └─→ 15:00  Instagram Reels + TikTok 投稿
```

---

## 1. note 記事投稿

### 概要
前日の YouTube 動画から、台本＋文字起こしを元に note 記事を自動生成・投稿する。

### 必要なアカウント/API
- note.com のアカウント（メールアドレス＋パスワードでログイン）

### プロンプト

```
YouTube チャンネルの前日の動画を元に、note 記事を自動投稿する Node.js bot を作ってほしい。

■ 目的
前日にアップロードした YouTube 動画の内容を、note.com の記事として自動で毎日投稿する。

■ データソース
- YouTube チャンネル RSS: https://www.youtube.com/feeds/videos.xml?channel_id=（チャンネルID）
- 動画管理スプレッドシート: https://docs.google.com/spreadsheets/d/（スプレッドシートID）/
  - C列: 投稿日（YYYY/MM/DD形式）
  - G列: 台本の Google Docs リンク
- 台本: Google Docs（スプレッドシートのG列からリンク取得）
- 文字起こし: yt-dlp で YouTube の自動字幕を取得

■ 処理フロー
1. RSS から前日の動画を特定（タイトル・videoId）
2. スプレッドシートから台本リンクを取得 → Google Docs で台本全文取得
3. yt-dlp で YouTube 自動字幕を取得してクリーンテキスト化
4. YouTubeサムネイルをダウンロード（アイキャッチ用）
5. 動画フレームのスクリーンショットを ffmpeg で取得（記事中の画像用）
6. Claude API で記事を生成（台本のコピペではなく、要約・再構成した記事）
7. Playwright で note.com にログイン → サムネをアイキャッチに設定 → 記事本文を入力（見出し・区切り線・太字・画像挿入を使う）→ ハッシュタグ付きで公開

■ 記事のスタイル
- 冒頭: 挨拶なし。短くて刺さるフック（2〜3行）
- 本文: 台本を要約して再構成。数字やデータは具体的に残す
- 箇条書き: 「・」で項目、「→」で補足
- 見出し: noteの「大見出し」機能（H2）。見出しの前に区切り線を入れる
- 太字: Cmd+B で適用
- 末尾: 動画リンク（noteが自動で埋め込みカード化）+ チャンネル登録CTA

■ CLIオプション
- 引数なし → 本番投稿
- --draft → 下書き保存
- --dry-run → ブラウザ操作なし、記事テキストのみ出力
- --date YYYY-MM-DD → 特定日付で実行

■ 品質ルール
- タイトルは動画のメインテーマと一致させる（AIで台本から正確に把握）
- markdown の「*」は note の太字機能に変換する。プレーンテキストとして表示させない
- プレゼント/特典の Web サイト URL は本文に載せない（LINE登録者限定のため）

■ スキル定義
~/.claude/commands/note-post.md としてスキル定義ファイルも作成してほしい。
/note-post で実行できるようにする。

■ 定期タスク
毎日11時に自動実行する scheduled task も作成してほしい。
タスクID: note-post-daily
```

---

## 2. YouTube コミュニティ投稿

### 概要
前日の YouTube 動画を紹介する投稿文を生成し、YouTube Studio のコミュニティタブに自動投稿する。

### 必要なアカウント/API
- YouTube Studio へのアクセス（Google アカウント）
- ※ YouTube Data API では Brand Account にコミュニティ投稿できないため、Playwright でブラウザ操作する

### プロンプト

```
YouTube チャンネルの前日の動画を紹介するコミュニティ投稿を、YouTube Studio 経由で自動投稿する Node.js bot を作ってほしい。

■ 目的
前日にアップした動画の紹介文＋サムネイル付きで、YouTube Studio のコミュニティタブに毎日投稿する。

■ データソース
- YouTube チャンネル RSS: https://www.youtube.com/feeds/videos.xml?channel_id=（チャンネルID）
- 動画管理スプレッドシート: https://docs.google.com/spreadsheets/d/（スプレッドシートID）/
  - C列: 投稿日、G列: 台本リンク
- 台本: Google Docs

■ 処理フロー
1. RSS から前日の動画を特定
2. スプレッドシート → 台本取得（Google Docs）
3. サムネイルを RSS フィードから取得
4. Claude API で投稿文を生成:
   - フック（具体的な数字入り）
   - 動画の要約（3〜4行）
   - プレゼント情報（台本に記載がある場合のみ）
   - 動画リンク
5. Playwright で YouTube Studio（studio.youtube.com）にログイン
   → コミュニティタブを開く
   → テキスト入力
   → 動画を添付（Google Picker iframe 経由）
   → 投稿

■ 技術的な注意点
- YouTube Studio のコミュニティ投稿は公開ページではなく studio.youtube.com を使う
- 動画追加ダイアログは Google Picker iframe（クロスオリジン）のため、通常の querySelector が効かない。絶対座標方式で操作する
- 動画の添付に失敗したら投稿しない（動画なし投稿は禁止）

■ CLIオプション
- 引数なし → 本番投稿
- --dry-run → 投稿しない（投稿文だけ出力）
- --date YYYY-MM-DD → 特定日付でテスト

■ スキル定義
~/.claude/commands/community-post.md としてスキル定義を作成。
/community-post で実行できるようにする。

■ 定期タスク
毎日12時に自動実行。タスクID: youtube-community-post
```

---

## 3. 切り抜き動画（YouTube Shorts / Instagram Reels / TikTok）

### 概要
前日の YouTube 動画からハイライト区間を切り抜き、縦型ショート動画（2倍速）を生成して 3 プラットフォームに投稿する。

### 必要なアカウント/API
- YouTube アカウント（Shorts アップロード用）
- Instagram アカウント
- TikTok アカウント
- Claude API キー（ハイライト区間選定・テロップ生成用）

### プロンプト

```
YouTube チャンネルの前日の動画からハイライトを切り抜き、縦型ショート動画を自動生成して YouTube Shorts / Instagram Reels / TikTok の3つに投稿する Node.js bot を作ってほしい。

■ 目的
毎日の長尺動画から60〜115秒のハイライトを自動選定し、テロップ付き2倍速のショート動画を3プラットフォームに投稿する。

■ データソース
- YouTube チャンネル RSS: https://www.youtube.com/feeds/videos.xml?channel_id=（チャンネルID）
- 動画管理スプレッドシート: https://docs.google.com/spreadsheets/d/（スプレッドシートID）/
- 台本: Google Docs

■ 動画生成パイプライン
1. yt-dlp で動画ダウンロード（720p）
2. ffmpeg で音声抽出 → faster-whisper (medium) で文字起こし
3. 台本を Google Docs から取得（章立て理解・CM区間除外用）
4. Claude API でハイライト区間を選定:
   - 冒頭3秒でフックになるインパクトのある場面
   - 完了率70%以上を目標とした構成
   - CM・CTA・プレゼント訴求区間は自動除外
   - 過去の切り抜き履歴と重複しない区間を選ぶ
5. Claude API でテロップ（上下2段）＋キャプションを生成
6. Pillow でテロップ PNG 生成 → FFmpeg で縦型動画に合成
   - 2倍速（元尺60〜115秒 → 出力30〜57秒）
   - 解像度: 1080×1920（9:16）
   - Instagram版とTikTok/YT版で動画内の映像サイズを分ける
7. 各プラットフォームに Playwright で投稿

■ テロップ仕様
- フォント: 太めのゴシック体（LINESeedJP等）
- 1行あたり全角8文字以内
- 色: white（通常）/ yellow（数字・金額）/ red（注目ワード）
- ストローク: 8px 黒縁取り

■ 3ジョブ構成（重要）
YouTube Studio の著作権チェックが即時完了しないため、3つのジョブに分離する:

| ジョブ | 時刻 | 役割 |
|---|---|---|
| Job1 | 11:30 | 切り抜き生成 + YouTube Shorts **非公開**アップロード |
| Job2 | 12:00 | YouTube Shorts を非公開→公開に変更 |
| Job3 | 15:00 | Instagram Reels + TikTok 投稿（Job1で生成した動画を再利用） |

■ キャプション仕様
- Instagram: 2〜3行説明 + ハッシュタグ5個 + 本編URL
- TikTok: 1行 + ハッシュタグ5個 + 本編URL
- YouTube Shorts: 2〜3行説明 + ハッシュタグ5個 + #Shorts + 本編URL
- 全プラットフォーム必ず #（チャンネル名） を含む

■ CLIオプション
- 引数なし → 3プラットフォーム全て投稿
- --skip-youtube / --skip-instagram / --skip-tiktok → 特定プラットフォームをスキップ
- --dry-run → 動画生成まで（投稿しない）
- --date YYYY-MM-DD → 特定日付で実行

■ スキル定義
~/.claude/commands/short-clip.md としてスキル定義を作成。
引数で投稿先を指定できるようにする:
- /short-clip → 全プラットフォーム
- /short-clip youtube → YouTube Shorts のみ
- /short-clip ig tt → Instagram + TikTok のみ

YouTube Shorts の公開変更用に ~/.claude/commands/youtube-publish.md も別途作成。

■ 定期タスク（3つ）
- short-clip-daily: 毎日11:30（/short-clip youtube）
- short-clip-publish-daily: 毎日12:00（/youtube-publish）
- short-clip-post-daily: 毎日15:00（/short-clip ig tt）
```

---

## 4. X (Twitter) 投稿

### 概要
前日の YouTube 動画を紹介するロングツイートを自動生成して X に投稿する。
※ X API の MCP サーバー（[x-mcp](https://github.com/INFATOSHI/x-mcp)）を使用。

### 必要なアカウント/API
- X Developer Portal のアカウント（API Key / Secret / Bearer Token / Access Token / Secret の5つ）
- X Premium（ロングツイートを使う場合）

### セットアップ（x-mcp の導入）
```bash
git clone https://github.com/INFATOSHI/x-mcp.git
cd x-mcp
npm install && npm run build
cp .env.example .env
# .env に5つのクレデンシャルを記入
claude mcp add --scope user x-twitter -- node /path/to/x-mcp/dist/index.js
```

### プロンプト

```
YouTube チャンネルの前日の動画を紹介する X (Twitter) 投稿を自動作成・投稿する定期タスクを作ってほしい。
x-mcp（X API の MCP サーバー）は既にセットアップ済み。

■ 目的
前日の YouTube 動画の内容を、X のロングツイート（本投稿＋リプライ）として毎日自動投稿する。

■ データソース
- YouTube チャンネル RSS: https://www.youtube.com/feeds/videos.xml?channel_id=（チャンネルID）
- 動画管理スプレッドシート: https://docs.google.com/spreadsheets/d/（スプレッドシートID）/
  - C列: 投稿日、G列: 台本リンク
- 台本: Google Docs（Google Drive MCP で取得）
- 文字起こし: yt-dlp で YouTube の自動字幕を取得

■ 処理フロー（Node.js bot ではなく、Claude Code の SKILL.md として直接実行）
1. YouTube RSS から前日の動画を特定
2. 重複投稿チェック（同じ動画を2回投稿しない）
3. スプレッドシートから台本リンク取得 → Google Drive MCP で台本全文取得
4. yt-dlp で自動字幕取得 → クリーンテキスト化
5. YouTube サムネイルをダウンロード
6. ロングツイートを作成:
   - 本投稿: フック（数字・ツール名入り）→ セクション分け解説 → プレゼント情報（あれば）
   - リプライ: 動画リンク + チャンネル登録CTA
7. x-mcp の post_tweet ツールでサムネイル付き投稿 → reply_to_tweet でリプライ

■ 投稿文のスタイル
- 冒頭フック: 具体的な数字・ツール名・金額を含める
- 「━━━━━━━━━━━━━━━━━━」で区切ったセクション構成
- 台本と文字起こしで確認できた情報のみ使う（捏造禁止）
- 数字やツール名は文字起こしで検証（自動字幕の誤変換に注意）

■ ツイートの保存先
成果物を日付別ディレクトリに保存:
（プロジェクトディレクトリ）/data/drafts/YYYY-MM-DD/
  ├── tweet_main.txt
  ├── tweet_reply.txt
  ├── thumbnail.jpg
  ├── transcript.txt
  └── meta.json

■ エラー通知
失敗時は Gmail MCP で自分のメールアドレスにドラフト作成。
「前日の動画が見つかりません」は休みの日なので正常終了。

■ 定期タスク
毎日13時に自動実行。タスクID: x-daily-post
scheduled-tasks MCP の create_scheduled_task で SKILL.md として登録する。
```

---

## 5. Threads 投稿

### 概要
前日の YouTube 動画を紹介する 3 投稿構成のスレッドを Threads API で自動投稿する。

### 必要なアカウント/API
- Instagram / Threads アカウント
- Meta Developer Dashboard で Threads API のアクセストークンを取得
  - `THREADS_USER_ID` と `THREADS_ACCESS_TOKEN` が必要
  - トークンは30日で期限切れ → 定期的に再生成

### プロンプト

```
YouTube チャンネルの前日の動画を紹介する Threads 投稿を自動作成する定期タスクを作ってほしい。
Threads API を使い、3投稿構成のスレッド（本投稿＋リプ2つ）で毎日投稿する。

■ 目的
前日の YouTube 動画を Threads にスレッド形式で投稿する。画像付き本投稿 + 2つのリプライで構成。

■ データソース
- YouTube チャンネル RSS: https://www.youtube.com/feeds/videos.xml?channel_id=（チャンネルID）
- 動画管理スプレッドシート: https://docs.google.com/spreadsheets/d/（スプレッドシートID）/
  - C列: 投稿日、G列: 台本リンク
- 台本: Google Docs（Google Drive MCP で取得）
- 文字起こし: yt-dlp で YouTube の自動字幕を取得

■ Threads API 設定
以下のファイルに保存する:
（プロジェクトディレクトリ）/config/credentials.env
```
THREADS_USER_ID=（ThreadsユーザーID）
THREADS_ACCESS_TOKEN=（アクセストークン）
```

■ 処理フロー（SKILL.md として直接実行。Node.js bot は作らない）
1. YouTube RSS から前日の動画を特定
2. 重複投稿チェック（posted-log.json で管理）
3. スプレッドシートから台本リンク取得 → Google Drive MCP で台本取得
4. yt-dlp で自動字幕取得 → クリーンテキスト化
5. 3投稿構成のスレッド文面を生成（各500文字以内）:

   **本投稿（画像付き）:**
   - 冒頭フック（数字・ツール名入り）
   - テーマ解説
   - 末尾に次の投稿への繋ぎ（「↓」）

   **リプライ1:**
   - 使うツール・手順
   - プレゼント情報（あれば）
   - 末尾に動画への繋ぎ

   **リプライ2:**
   - 動画リンク
   - チャンネル登録CTA

6. Threads API でスレッド投稿（Python の requests ライブラリを使用）:
   - 本投稿: media_type=IMAGE, image_url=YouTubeサムネイル
   - リプ1: media_type=TEXT, reply_to_id=本投稿ID
   - リプ2: media_type=TEXT, reply_to_id=リプ1のID
   - 各投稿間に3秒の間隔を空ける
7. 投稿ログを posted-log.json に記録（重複防止用）

■ Threads API の投稿コード（Python）
```python
import requests, time

def create_and_publish(user_id, token, params):
    resp = requests.post(
        f"https://graph.threads.net/v1.0/{user_id}/threads",
        params=params
    )
    resp.raise_for_status()
    creation_id = resp.json()["id"]
    for attempt in range(6):
        time.sleep(5)
        pub = requests.post(
            f"https://graph.threads.net/v1.0/{user_id}/threads_publish",
            params={"creation_id": creation_id, "access_token": token}
        )
        if pub.status_code == 200:
            return pub.json()["id"]
    pub.raise_for_status()
```

■ エラー通知
失敗時は Gmail MCP で自分のメールアドレスにドラフト作成。
エラー種別: AUTH_EXPIRED（トークン失効）/ API_RATE_LIMIT / CONTENT_REJECTED / NETWORK / OTHER

■ 定期タスク
毎日14時に自動実行。タスクID: threads-daily-post
scheduled-tasks MCP の create_scheduled_task で SKILL.md として登録する。
```

---

## セットアップの順番（推奨）

初めてやる場合は、以下の順番で1つずつ構築していくのがおすすめ:

1. **Threads**（最も簡単。API + SKILL.md だけで完結）
2. **X (Twitter)**（x-mcp のセットアップが必要だが、同じく SKILL.md で完結）
3. **YouTube コミュニティ投稿**（Playwright の練習になる）
4. **note 記事投稿**（Playwright + 記事生成 AI の品質調整が必要）
5. **切り抜き動画**（最も複雑。動画生成 + 3プラットフォーム + 3ジョブ構成）

## 共通の注意点

### 定期タスクの寿命
Claude Code の scheduled-tasks は**セッション内でのみ有効**（7日で自動期限切れ）。
常時稼働させるには Claude Code を起動しっぱなしにするか、マシン起動時に再登録する仕組みが必要。

### エラー通知の仕組み
全ての定期タスクに共通して、失敗時は **Gmail MCP** でドラフトメールを作成する設計にしている。
これにより、自動実行中にエラーが起きてもメールで気づける。

### Playwright のセッション管理
YouTube Studio / note.com / Instagram / TikTok はすべてブラウザログインが必要。
初回は `node setup-auth.js` で手動ログインし、Cookie を保存する。
セッションが切れたら再ログインが必要。

### 重複投稿防止
全ての定期タスクに「同じ動画を2回投稿しない」チェック機構を入れている。
posted-log.json やドラフトファイルの存在チェックで実現。
