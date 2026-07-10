import { registerRoot, Composition } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { EndoReel, EndoReelProps } from './EndoReel';
import React from 'react';

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="EndoInstagramReel"
        component={EndoReel}
        durationInFrames={1800} // デフォルトフォールバック
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hookText: '【必見】温泉に行く前に知っておくべき3つのこと',
          text: '世界中を植林し、命を育んできた私が、最後にたどり着いたのは、この山奥の「枯れ葉」の美しさでした。効率だけを求める世界では見落とされてしまう、静かな命の循環が、ここにはあります。',
          voiceUrl: '',
          bgmUrl: '',
          backgroundUrl: ''
        }}
        calculateMetadata={async ({ props }) => {
          const fps = 30;
          let duration = 1800; // デフォルト60秒
          
          if (props.voiceUrl) {
            try {
              let audioUrl = props.voiceUrl;
              if (audioUrl.startsWith('/')) {
                audioUrl = 'https://akasawa.netlify.app' + audioUrl;
              }
              const durationSec = await getAudioDurationInSeconds(audioUrl);
              // 音声の長さに合わせて動画の全体のフレーム数を決定（＋余白として1秒分 ＋ 冒頭のフック表示用3秒を追加）
              duration = Math.ceil((durationSec + 3) * fps) + 30;
            } catch (err) {
              console.warn("Failed to fetch audio duration, using default", err);
            }
          }
          return {
            durationInFrames: duration,
            props: { ...props }
          };
        }}
      />
    </>
  );
};

registerRoot(RemotionVideo);
