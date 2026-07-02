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
          bgmUrl: 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav',
          backgroundUrl: 'https://assets.mixkit.co/posts/music/preview/mixkit-forest-river-in-morning-1335-large.mp4'
        }}
      />
    </>
  );
};

registerRoot(RemotionVideo);
