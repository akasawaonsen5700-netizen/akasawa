import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface VerticalTextProps {
  text: string;
  startFrame: number;
  durationInFrames: number;
}

export const VerticalText: React.FC<VerticalTextProps> = ({
  text,
  startFrame,
  durationInFrames
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || relativeFrame > durationInFrames) {
    return null;
  }

  // 文字を一文字ずつバラして表示させるアニメーション
  const characters = text.split('');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row-reverse', // 右から左へ縦書き行を並べる
      writingMode: 'vertical-rl',
      textOrientation: 'mixed',
      fontFamily: 'Noto Serif JP, Shippori Mincho, Georgia, serif',
      fontSize: '54px',
      color: '#ffffff',
      fontWeight: 'bold',
      lineHeight: '1.8',
      letterSpacing: '0.2em',
      textShadow: '0px 0px 15px rgba(0, 0, 0, 0.8), 0px 0px 5px rgba(0, 0, 0, 0.5)',
      height: '80%',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
      {characters.map((char, index) => {
        // 各文字が少しずつ遅れて現れるようにする
        const delay = index * 3; // 3フレームの遅延
        const charFrame = relativeFrame - delay;

        const opacity = interpolate(
          charFrame,
          [0, 10], // 10フレームかけてフェードイン
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        const yOffset = interpolate(
          charFrame,
          [0, 10],
          [20, 0], // 少し下から上がってくる
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <span
            key={index}
            style={{
              opacity,
              transform: `translateY(${yOffset}px)`,
              display: 'inline-block'
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};
