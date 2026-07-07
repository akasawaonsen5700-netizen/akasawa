try {
  require('./apps/endo-sns/netlify/functions/submit-metadata.js');
  console.log('✅ submit-metadata.js loaded successfully without syntax errors.');
} catch (e) {
  console.error('❌ Error loading submit-metadata.js:', e);
}

try {
  require('./apps/endo-sns/netlify/functions/generate-assets-background.js');
  console.log('✅ generate-assets-background.js loaded successfully without syntax errors.');
} catch (e) {
  console.error('❌ Error loading generate-assets-background.js:', e);
}
