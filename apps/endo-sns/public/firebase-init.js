// Firebase client SDK は不使用（すべてNetlify Functions経由）
// このファイルは設定値のエクスポートのみを行う

export const apiBase = window.AKASAWA_CONFIG?.apiBase || '/api';
export const defaults = window.AKASAWA_CONFIG?.defaults || {
  ownerName: '遠藤正俊',
  hotelName: '赤沢温泉旅館',
  officialSite: 'https://akasawaonsen.com/',
  phone: '0287-46-5700',
  brandCopy: '世界中で自然と向き合ってきた私が、日本の「枯れ葉」に見出した、失われた心の救済'
};
