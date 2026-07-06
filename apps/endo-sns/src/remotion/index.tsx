import { registerRoot, Composition } from 'remotion';
import { EndoReel } from './EndoReel';
import React from 'react';

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="EndoInstagramReel"
        component={EndoReel}
        durationInFrames={1800} // 60秒 (30fps)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          text: '世界中を植林し、命を育んできた私が、最後にたどり着いたのは、この山奥の「枯れ葉」の美しさでした。効率だけを求める世界では見落とされてしまう、静かな命の循環が、ここにはあります。',
          voiceUrl: '',
          bgmUrl: '',
          backgroundUrl: '' // MixkitのURLを削除してアクセス拒否クラッシュを防止
        }}
      />
    </>
  );
};

registerRoot(RemotionVideo);
