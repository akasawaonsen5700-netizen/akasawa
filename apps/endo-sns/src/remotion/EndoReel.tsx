import React from 'react';
import { AbsoluteFill, Video, Audio, Img, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';

export interface EndoReelProps {
  text: string;           // ナレーションおよびテロップのテキスト
  voiceUrl?: string;      // Gemini APIで生成した音声のURL
  bgmUrl?: string;        // 自然音BGM of URL
  backgroundUrl?: string; // 背景映像または画像のURL（単一）
  backgroundUrls?: string[]; // 背景映像または画像のURL配列
}

export const EndoReel = ({
  text,
  voiceUrl,
  bgmUrl = 'endo.mp3',
  backgroundUrl,
  backgroundUrls
}: EndoReelProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // アセットURLの解決ヘルパー
  const resolveAssetUrl = (url: string | undefined) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const cleaned = url.startsWith('/') ? url.substring(1) : url;
    return staticFile(cleaned);
  };

  const resolvedBgmUrl = resolveAssetUrl(bgmUrl);
  const resolvedVoiceUrl = resolveAssetUrl(voiceUrl);

  // メタ指示語（ラベル）を削除
  const cleanedText = text
    .replace(/(?:ない\s*)?(冒頭フック|フック|台本|締めの一言|締め|ナレーション|タイトル)[:：\s]*/gi, '')
    .trim();

  // テキストを句読点や改行で分割
  const rawLines = cleanedText.split(/[。\n\?？！!]/).map((line: string) => line.trim()).filter(Boolean);

  // 1文が長すぎる場合、読点「、」でさらに細かく分割して、テロップが２〜３行に綺麗に収まるようにする
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.length <= 25) {
      lines.push(line);
    } else {
      // 25文字を超える場合は、読点「、」で分割を試みる
      const subParts = line.split(/[、,]/).map(p => p.trim()).filter(Boolean);
      let currentPart = '';
      for (const part of subParts) {
        if ((currentPart + part).length <= 25) {
          currentPart += (currentPart ? '、' : '') + part;
        } else {
          if (currentPart) lines.push(currentPart + '、');
          currentPart = part;
        }
      }
      if (currentPart) lines.push(currentPart);
    }
  }

  // 1文字あたりの表示フレーム数（全体の長さを文字数で均等に分配）
  const totalChars = lines.join('').length || 1;
  const framesPerChar = durationInFrames / totalChars;

  // 現在のフレームがどの行に該当するかを計算
  let currentLineIndex = 0;
  let framesAccumulated = 0;
  let framesForCurrentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineDuration = Math.max(1, Math.floor(lines[i].length * framesPerChar));
    if (frame < framesAccumulated + lineDuration) {
      currentLineIndex = i;
      framesForCurrentLine = lineDuration;
      break;
    }
    framesAccumulated += lineDuration;
  }

  // 最後のフレームを超えた場合のセーフフォールバック
  if (currentLineIndex === 0 && frame >= framesAccumulated && lines.length > 0) {
    currentLineIndex = lines.length - 1;
    framesForCurrentLine = Math.max(1, Math.floor(lines[currentLineIndex].length * framesPerChar));
    framesAccumulated -= framesForCurrentLine;
  }

  const currentLineText: string = lines[currentLineIndex] || '';
  
  // 現在の行の中での経過フレーム
  const lineFrame = frame - framesAccumulated;

  // フェードイン・アウトのアニメーション用opacity計算（前後12フレームでフェード）
  const fadeFrames = 12;
  let opacity = 1;
  if (lineFrame < fadeFrames) {
    opacity = lineFrame / fadeFrames; // フェードイン
  } else if (lineFrame > framesForCurrentLine - fadeFrames) {
    opacity = (framesForCurrentLine - lineFrame) / fadeFrames; // フェードアウト
  }

  // デフォルト背景画像のリスト (ローカルで生成した高解像度プレミアムイメージ)
  const defaultBgs = [
    staticFile('bg-premium.png'),
    staticFile('bg-premium2.png'),
    staticFile('bg-premium3.png')
  ];

  let finalBgUrls: string[] = [];
  if (backgroundUrls && backgroundUrls.length > 0) {
    finalBgUrls = backgroundUrls.map(url => resolveAssetUrl(url) || '');
  } else if (backgroundUrl) {
    finalBgUrls = [resolveAssetUrl(backgroundUrl) || ''];
  } else {
    finalBgUrls = defaultBgs;
  }

  // 現在のテロップインデックスに基づいて背景を切り替える (ループさせる)
  const loopBgIndex = currentLineIndex % finalBgUrls.length;
  const currentBgUrl = finalBgUrls[loopBgIndex];

  // 背景がビデオかどうか
  const isVideo = currentBgUrl.endsWith('.mp4') || currentBgUrl.includes('video') || currentBgUrl.includes('preview');

  // 1文字ずつのフェードイン用
  const chars: string[] = currentLineText.split('');

  return (
    <AbsoluteFill style={{ backgroundColor: '#07090e', overflow: 'hidden', fontFamily: '"Shippori Mincho", "Noto Serif JP", serif' }}>
      {/* 確実に明朝体を読み込むためのGoogle Fontsインポート */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600&family=Noto+Serif+JP:wght@400;600&display=swap');
      `}</style>
      
      {/* 1. 背景映像または画像 */}
      {isVideo ? (
        <Video
          src={currentBgUrl}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            opacity: 0.75, // 可視性を上げるため少し明るく
            transform: 'scale(1.05)'
          }}
          loop
          muted
        />
      ) : (
        <Img
          src={currentBgUrl}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            opacity: 0.75, // 可視性を上げるため少し明るく
            transform: 'scale(1.05)'
          }}
        />
      )}

      {/* 2. 背景の上下シネマティックシャドウ（可読性向上） */}
      <AbsoluteFill style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.7) 100%)',
        zIndex: 2
      }} />

      {/* 3. 環境音BGM (ループ再生) */}
      {resolvedBgmUrl && (
        <Audio
          src={resolvedBgmUrl}
          volume={0.08}
          loop
        />
      )}

      {/* 4. 本人ナレーション音声 */}
      {resolvedVoiceUrl && (
        <Audio
          src={resolvedVoiceUrl}
          volume={1.0}
        />
      )}

      {/* 5. プレミアムデザイン：エステティカルなフレーム（和風ゴールドライン） */}
      <AbsoluteFill style={{
        border: '25px solid #0c0e14',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 20
      }}>
        {/* 内側の細いゴールドの境界線 */}
        <div style={{
          width: '100%',
          height: '100%',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          boxSizing: 'border-box'
        }} />
      </AbsoluteFill>

      {/* 右上のエステティカルなロゴ/透かし */}
      <div style={{
        position: 'absolute',
        top: '45px',
        right: '45px',
        color: 'rgba(212, 175, 55, 0.7)',
        fontFamily: 'Cinzel, serif',
        fontSize: '14px',
        letterSpacing: '0.3em',
        zIndex: 25,
        writingMode: 'vertical-rl'
      }}>
        AKASAWA ONSEN
      </div>

      {/* 左下のエステティカルな署名 */}
      <div style={{
        position: 'absolute',
        bottom: '45px',
        left: '45px',
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: '11px',
        letterSpacing: '0.15em',
        zIndex: 25
      }}>
        遠藤正俊 — 枯れ葉の美学
      </div>

      {/* 6. テロップ表示エリア（中央固定・縦書き） */}
      <AbsoluteFill style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
      }}>
        {/* 背景の曇りガラス調の優美なカード */}
        <div style={{
          width: '500px',
          height: '1100px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 15, 12, 0.45)',
          borderRadius: '24px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          padding: '50px',
          boxSizing: 'border-box',
          opacity: opacity,
          transition: 'opacity 0.2s ease'
        }}>
          {/* 縦書きテキスト本体 */}
          <div style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: '"Shippori Mincho", "Noto Serif JP", serif',
            fontSize: '54px',
            lineHeight: '2.0',
            letterSpacing: '0.25em',
            color: '#f5f2eb',
            textShadow: '0 4px 20px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0,0,0,0.5)',
            fontWeight: 600,
            height: '80%',
            boxSizing: 'border-box'
          }}>
            {chars.map((char: string, index: number) => {
              // 一文字ずつのフェードイン効果
              const charDelay = index * 2.5;
              let charOpacity = 0;
              if (lineFrame > charDelay) {
                charOpacity = Math.min(1, (lineFrame - charDelay) / 8);
              }
              return (
                <span
                  key={index}
                  style={{
                    opacity: charOpacity,
                    display: 'inline-block',
                    transform: charOpacity < 1 ? 'translateY(10px)' : 'none',
                    transition: 'opacity 0.3s ease, transform 0.3s ease'
                  }}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default EndoReel;
