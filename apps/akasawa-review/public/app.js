document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generate-btn');
  const reviewInput = document.getElementById('review-input');
  const errorMsg = document.getElementById('error-message');
  const outputSection = document.getElementById('output-section');
  const spinner = document.getElementById('loading-spinner');
  const btnText = document.querySelector('.btn-text');

  generateBtn.addEventListener('click', async () => {
    const text = reviewInput.value.trim();
    if (!text) {
      showError('クチコミ本文を入力してください。');
      return;
    }

    setLoading(true);
    showError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒でタイムアウト

    try {
      const response = await fetch('/.netlify/functions/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewText: text }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`エラーが発生しました (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      // 結果をテキストエリアにセット
      document.getElementById('reply-standard').value = data.standard || '（生成失敗）';
      document.getElementById('reply-empathetic').value = data.empathetic || '（生成失敗）';
      document.getElementById('reply-concise').value = data.concise || '（生成失敗）';

      // 出力セクションを表示
      outputSection.style.display = 'block';
      outputSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === 'AbortError') {
        showError('返信の生成がタイムアウトしました。通信状況を確認するか、しばらく経ってから再度お試しください。');
      } else {
        showError(err.message || '通信エラーが発生しました。');
      }
    } finally {
      setLoading(false);
    }
  });

  // コピー機能
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textarea = document.getElementById(targetId);
      
      textarea.select();
      textarea.setSelectionRange(0, 99999); // スマホ対応
      
      navigator.clipboard.writeText(textarea.value).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'コピーしました！';
        btn.classList.add('copied');
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });

  function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    spinner.style.display = isLoading ? 'inline-block' : 'none';
    btnText.textContent = isLoading ? 'AIが生成中...' : 'AI 返信案を生成する';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
  }
});
