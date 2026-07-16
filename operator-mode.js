/* operator-mode.js
 * ビズてす：オペレーターが特定の企業を指定して、企業管理者向けの操作画面
 * （operator-question-editor.html／operator-invites.html／company-admin-invite.html）
 * を代理操作していることを画面上に示すための共通ヘルパー。
 *
 * 使い方：
 *   各画面は、ログインユーザーが operators/{uid} に存在する場合（＝オペレーター）、
 *   BizTestOperatorMode.renderBanner({ companyId, companyName }) を呼び出し、
 *   画面上部にオレンジ色の運営モードバナーを表示する（視覚的な誤操作防止）。
 *   企業管理者本人（companyAdmins/{uid}）が自社の画面を開いた場合はバナーを出さない。
 *
 * 対応するfirestore.rulesのisOperator()が、企業横断の読み書き権限を許可している前提。
 */
(function (global) {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function injectStyle() {
    if (document.getElementById("biztesOperatorModeStyle")) return;
    const style = document.createElement("style");
    style.id = "biztesOperatorModeStyle";
    style.textContent = [
      ".biztes-operator-banner{position:sticky;top:0;z-index:10000;background:linear-gradient(90deg,#f97316,#ea580c);color:#fff;padding:10px 20px;font-size:13px;font-weight:800;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;box-shadow:0 2px 10px rgba(0,0,0,.18)}",
      ".biztes-operator-banner .bo-left{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}",
      ".biztes-operator-banner .bo-badge{background:rgba(255,255,255,.28);border-radius:999px;padding:3px 10px;font-size:11px;white-space:nowrap}",
      ".biztes-operator-banner a{color:#fff;text-decoration:underline;font-weight:800;white-space:nowrap}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureBannerEl() {
    injectStyle();
    const existing = document.getElementById("biztesOperatorBanner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "biztesOperatorBanner";
    banner.className = "biztes-operator-banner";
    document.body.insertBefore(banner, document.body.firstChild);
    return banner;
  }

  // opts: { companyId, companyName }
  function renderBanner(opts) {
    opts = opts || {};
    const banner = ensureBannerEl();
    const companyLabel = opts.companyName
      ? esc(opts.companyName) + "（" + esc(opts.companyId || "") + "）"
      : esc(opts.companyId || "未指定");
    banner.innerHTML =
      '<span class="bo-left">' +
      '<span class="bo-badge">運営モード</span>' +
      "<span>現在の操作対象企業：<strong>" + companyLabel + "</strong></span>" +
      "</span>" +
      '<span class="bo-left"><a href="operator-home.html">← 運営ホームへ戻る</a></span>';
  }

  function renderMissingCompanyNotice(message) {
    const banner = ensureBannerEl();
    banner.innerHTML =
      '<span class="bo-left"><span class="bo-badge">運営モード</span><span>' +
      esc(message || "対象企業が指定されていません。運営ホームから入り直してください。") +
      "</span></span>" +
      '<span class="bo-left"><a href="operator-home.html">← 運営ホームへ戻る</a></span>';
  }

  global.BizTestOperatorMode = {
    renderBanner: renderBanner,
    renderMissingCompanyNotice: renderMissingCompanyNotice,
  };
})(window);
