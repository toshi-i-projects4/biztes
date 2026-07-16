// password-policy.js
// ビズてす共通パスワードポリシー（ビズもんと同一の考え方を採用）
// 新規登録時・パスワード変更時・パスワード再設定時のみ使用します。
// ログイン画面では使用しないでください。

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_TEXT = `パスワードは15文字以上で設定してください。
単語をつなげた「パスフレーズ」を推奨しています。
例）todayIwillfinishmyworkearly

※英大文字・小文字・数字・記号の組み合わせは必須ではありません。
※最大128文字まで設定可能です。`;

export function validatePassword(password, label = "パスワード") {
  if (!password) return `${label}を入力してください。`;
  if (password.length < PASSWORD_MIN_LENGTH) return `${label}は${PASSWORD_MIN_LENGTH}文字以上で設定してください。`;
  if (password.length > PASSWORD_MAX_LENGTH) return `${label}は${PASSWORD_MAX_LENGTH}文字以内で設定してください。`;
  return "";
}

export function getPasswordLengthMessage(password) {
  const length = password ? password.length : 0;
  return `${length} / ${PASSWORD_MAX_LENGTH}文字`;
}

export function getPasswordLengthStatus(password) {
  const length = password ? password.length : 0;
  if (length === 0) return "empty";
  if (length < PASSWORD_MIN_LENGTH) return "short";
  if (length <= PASSWORD_MAX_LENGTH) return "ok";
  return "over";
}

export function applyPasswordCountStyle(element, status) {
  if (!element) return;
  if (status === "empty") element.style.color = "#6b7280";
  else if (status === "short" || status === "over") element.style.color = "#dc2626";
  else if (status === "ok") element.style.color = "#166534";
}
