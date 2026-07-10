const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\user\\Desktop\\akasawa\\apps\\akasawa-sns\\public';

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace 'instagram' with 'instagram_reel' for video specific checks
  content = content.replace(/if \(channel === 'instagram'\)/g, "if (channel === 'instagram_reel')");
  
  // Update data attributes to use instagram_reel
  content = content.replace(/drafts\?\.instagram\?\.narration/g, "drafts?.instagram_reel?.narration");
  content = content.replace(/channelSettings\?\.instagram\?\.assets/g, "channelSettings?.instagram_reel?.assets");

  // Insert instagram_feed branch
  const xBranchStr = "} else if (channel === 'x') {";
  const feedBranchStr = `} else if (channel === 'instagram_feed') {
      const attachAssets = setting.assets || row.assets || [];
      if (attachAssets.length > 0) {
        mediaPreviewHtml = \`
          <div style="margin: 8px 0;">
            <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">📷 フィード投稿用の添付画像:</span>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              \${attachAssets.map(renderAsset).join('')}
            </div>
          </div>
        \`;
      } else {
        mediaPreviewHtml = \`
          <div style="margin: 8px 0; padding: 6px; font-size: 12px; color: #94a3b8; text-align: left;">
            📝 テキストのみの投稿（画像添付なし）
          </div>
        \`;
      }
    } else if (channel === 'x') {`;

  content = content.replace(xBranchStr, feedBranchStr);

  if (original !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

updateFile(path.join(dir, 'index.js'));
updateFile(path.join(dir, 'review.js'));
