const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const newSection = `    <section class="benefit-section">
      <h2 class="section-title" style="font-size: 1.8rem;">売上 = 宿泊客数 × 客単価（ADR） × リピート回数</h2>
      
      <div style="text-align: center; margin: 2rem 0;">
        <p style="font-size: 1.3rem; font-weight: bold; color: var(--accent-color); margin-bottom: 1rem;">
          売上2.197倍 ＝ 宿泊客数1.3倍 × 客単価1.3倍 × リピート1.3倍
        </p>
        <p style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.5rem; font-weight: 600;">
          利益 = 顧客数 × 客単価 × リピート回数 × 利益率
        </p>
        <p style="font-size: 0.9rem; color: var(--text-sub);">
          この式にすると、AIでどこを改善するかが明確になります。
        </p>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 3rem; max-width: 800px; margin-left: auto; margin-right: auto;">
        <h3 style="color: var(--accent-color); margin-bottom: 1.2rem; text-align: center; font-size: 1.2rem;">AIでできること</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; line-height: 1.6;">
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="padding: 1rem; text-align: left; width: 25%; color: var(--text-main); font-weight: 600;">顧客数</th>
            <td style="padding: 1rem; color: var(--text-sub);">SEO、LLMO、OTA最適化、Google広告、SNS、口コミ改善</td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="padding: 1rem; text-align: left; color: var(--text-main); font-weight: 600;">客単価</th>
            <td style="padding: 1rem; color: var(--text-sub);">ダイナミックプライシング、アップセル、プラン最適化</td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="padding: 1rem; text-align: left; color: var(--text-main); font-weight: 600;">リピート</th>
            <td style="padding: 1rem; color: var(--text-sub);">LINE、メール、会員化、口コミ返信、CRM</td>
          </tr>
          <tr>
            <th style="padding: 1rem; text-align: left; color: var(--text-main); font-weight: 600;">利益率</th>
            <td style="padding: 1rem; color: var(--text-sub);">経費削減、業務効率化、OTA依存率低下、原価管理</td>
          </tr>
        </table>
      </div>

      <div class="benefit-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2.5rem;">
        
        <!-- ① AI集客エンジン -->
        <div class="benefit-item" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="color: var(--accent-color); font-size: 1.3rem; margin-bottom: 0.8rem;">① AI集客エンジン</h3>
            <p style="color: var(--text-main); font-weight: 600; margin-bottom: 0.6rem; font-size: 0.95rem;">
              新規客を増やす（宿泊客数 1.3倍）
            </p>
            <p style="font-size: 0.9rem; color: var(--text-sub); margin-bottom: 1.5rem; line-height: 1.6;">
              公式ブログの自動生成やSNSへの予約配信、GBP連携によりネット上の露出を高め、宿の魅力に共感する新規顧客を呼び込みます。
            </p>
          </div>
          <div style="font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <strong style="color: var(--accent-color); font-weight: 600;">現在の機能:</strong>
            <ul style="margin-left: 1.2rem; margin-top: 0.5rem; list-style-type: square; line-height: 1.7; color: var(--text-sub);">
              <li>オーナー投稿管理（SNS）</li>
              <li>赤沢温泉旅館投稿登録（SNS・GBP）</li>
              <li>公式ブログ生成システム</li>
            </ul>
          </div>
        </div>

        <!-- ② AI販売最適化エンジン -->
        <div class="benefit-item" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="color: var(--accent-color); font-size: 1.3rem; margin-bottom: 0.8rem;">② AI販売最適化エンジン</h3>
            <p style="color: var(--text-main); font-weight: 600; margin-bottom: 0.6rem; font-size: 0.95rem;">
              1人あたりの売上を最大化（客単価 1.3倍）
            </p>
            <p style="font-size: 0.9rem; color: var(--text-sub); margin-bottom: 1.5rem; line-height: 1.6;">
              需要予測と連動したダイナミックプライシングと、ターゲットの興味を惹く宿泊プランの自律設計により、適正価格で単価を向上させます。
            </p>
          </div>
          <div style="font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <strong style="color: var(--accent-color); font-weight: 600;">現在の機能:</strong>
            <ul style="margin-left: 1.2rem; margin-top: 0.5rem; list-style-type: square; line-height: 1.7; color: var(--text-sub);">
              <li>ダイナミックプライシング統合監視ダッシュボード</li>
              <li>AI OTA最適化エンジン</li>
              <li>宿泊プラン作成エージェント</li>
            </ul>
          </div>
        </div>

        <!-- ③ AIファン化エンジン -->
        <div class="benefit-item" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="color: var(--accent-color); font-size: 1.3rem; margin-bottom: 0.8rem;">③ AIファン化エンジン</h3>
            <p style="color: var(--text-main); font-weight: 600; margin-bottom: 0.6rem; font-size: 0.95rem;">
              また泊まりたい宿にする（リピート 1.3倍）
            </p>
            <p style="font-size: 0.9rem; color: var(--text-sub); margin-bottom: 1.5rem; line-height: 1.6;">
              宿泊後の適切なフォローアップメール送信や、一人一人に深く寄り添った温かみのあるクチコミ自動返信によりリピーターを増やします。
            </p>
          </div>
          <div style="font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <strong style="color: var(--accent-color); font-weight: 600;">現在の機能:</strong>
            <ul style="margin-left: 1.2rem; margin-top: 0.5rem; list-style-type: square; line-height: 1.7; color: var(--text-sub);">
              <li>メール・LINE自動連携</li>
              <li>口コミ返信エージェント</li>
            </ul>
          </div>
        </div>

        <!-- ④ AI業務効率化エンジン -->
        <div class="benefit-item" style="display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="color: var(--accent-color); font-size: 1.3rem; margin-bottom: 0.8rem;">④ AI業務効率化エンジン</h3>
            <p style="color: var(--text-main); font-weight: 600; margin-bottom: 0.6rem; font-size: 0.95rem;">
              利益率向上（利益率を上げる）
            </p>
            <p style="font-size: 0.9rem; color: var(--text-sub); margin-bottom: 1.5rem; line-height: 1.6;">
              多言語対応のAIチャットがよくある質問や案内を自律的に担当。人件費の抑制と接客時間の高付加価値化を同時に実現します。
            </p>
          </div>
          <div style="font-size: 0.85rem; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <strong style="color: var(--accent-color); font-weight: 600;">現在の機能:</strong>
            <ul style="margin-left: 1.2rem; margin-top: 0.5rem; list-style-type: square; line-height: 1.7; color: var(--text-sub);">
              <li>AIチャットコンシェルジュ</li>
            </ul>
          </div>
        </div>

      </div>
    </section>`;

let startIndex = content.indexOf('<section class="benefit-section">');
let endIndex = content.indexOf('</section>', startIndex);
if (startIndex !== -1 && endIndex !== -1) {
  let finalHtml = content.substring(0, startIndex) + newSection + content.substring(endIndex + '</section>'.length);
  fs.writeFileSync('index.html', finalHtml, 'utf8');
  console.log('Successfully updated index.html');
} else {
  console.log('Could not find tags');
}
