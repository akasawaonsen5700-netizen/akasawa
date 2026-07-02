import React from 'react';
import { AbsoluteFill, Video, Audio, Img } from 'remotion';
import { VerticalText } from './VerticalText';

export interface EndoReelProps {
  text: string;           // ナレーションおよびテロップのテキスト
  voiceUrl?: string;      // Gemini APIで生成した音声のURL
  bgmUrl?: string;        // 自然音BGMのURL (オプショナル)
  backgroundUrl?: string; // 背景映像または画像のURL (オプショナル)
}

export const EndoReel: React.FC<EndoReelProps> = ({
  text,
  voiceUrl,
  bgmUrl = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav', // デフォルトの自然音（小川の音などのプレースホルダー）
  backgroundUrl = 'https://assets.mixkit.co/posts/music/preview/mixkit-forest-river-in-morning-1335-large.mp4' // デフォルトの森と川の映像
}) => {
  const isVideo = backgroundUrl.endsWith('.mp4') || backgroundUrl.includes('video');

  // テキストを行ごとに分割して表示する
  const lines = text.split(/[。\n\?？！!]/).map(line => line.trim()).filter(Boolean);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0d14', overflow: 'hidden' }}>
      {/* 1. 背景映像または画像 */}
      {isVideo ? (
        <Video
          src={backgroundUrl}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            opacity: 0.65
          }}
          loop
          muted
        />
      ) : (
        <Img
          src={backgroundUrl}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            opacity: 0.65
          }}
        />
      )}

      {/* 2. 環境音BGM (ループ再生, 低音量) */}
      {bgmUrl && (
        <Audio
          src={bgmUrl}
          volume={0.12} // BGMは控えめに
          loop
        />
      )}

      {/* 3. Gemini API ナレーション音声 */}
      {voiceUrl && (
        <Audio
          src={voiceUrl}
          volume={1.0} // ナレーションははっきりと
        />
      )}

      {/* 4. 縦書きテロップレイヤー */}
      <AbsoluteFill style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row-reverse',
          justifyContent: 'center',
          alignItems: 'center',
          width: '80%',
          height: '75%',
          backgroundColor: 'rgba(0, 0, 0, 0.25)', // 背景と馴染ませるためのうっすらとした黒帯
          borderRadius: '16px',
          backdropFilter: 'blur(2px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
        }}>
          {lines.map((line, index) => {
            // 各行の表示タイミングをずらす (例: 1行あたり150フレーム = 5秒)
            const lineDuration = 150;
            const startFrame = index * 120; // 少し重なるように120フレーム間隔で開始

            return (
              <VerticalText
                key={index}
                text={line}
                startFrame={startFrame}
                durationInFrames={lineDuration}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {/* 画面装飾: シックでプレミアム感のあるフレーム効果 */}
      <AbsoluteFill style={{
        border: '30px solid #0f131a', // 映画的なフレーム
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 20
      }} />
    </AbsoluteFill>
  );
};
export default EndoReel;
