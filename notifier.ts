export interface NotifyRequest {
  /**
   * タイトル。
   */
  title: string;

  /**
   * メッセージ。
   */
  message: string;

  /**
   * 通知クリック時に開く遷移先。
   */
  url?: string;

  /**
   * ボタン。
   */
  button?: {
    /**
     * ラベル。
     */
    label: string;

    /**
     * 遷移先。
     */
    src: string;
  }[];

  /**
   * アイコンのパス。
   * Windows パスである必要がある。
   */
  icon?: string;
}

export interface NotifyResponse {
  /**
   * 処理結果のステータス。
   */
  status: "ok" | "error";

  /**
   * エラー時のメッセージ。
   */
  error?: string;
}

/**
 * XML の特殊文字をエスケープする。
 * @param text エスケープする文字列
 * @returns エスケープされた文字列
 */
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * NotifyRequest から Windows トースト通知用の XML を構築する。
 * @param req 通知リクエスト
 * @returns Windows トースト通知用の XML 文字列
 */
export const buildToastXml = (req: NotifyRequest): string => {
  const declaration = '<?xml version="1.0"?>';

  const toastAttrs = `activationType="protocol" launch="${
    escapeXml(req.url ?? "")
  }"`;

  const imageTag = req.icon
    ? `<image placement="appLogoOverride" src="${escapeXml(req.icon)}"/>`
    : "";

  const binding = `<binding template="ToastGeneric">${imageTag}<text>${
    escapeXml(req.title)
  }</text><text>${escapeXml(req.message)}</text></binding>`;

  const visual = `<visual>${binding}</visual>`;

  const actionsTag = req.button && req.button.length > 0
    ? `<actions>${
      req.button.map(({ label, src }) =>
        `<action content="${
          escapeXml(label)
        }" activationType="protocol" arguments="${escapeXml(src)}"/>`
      ).join("")
    }</actions>`
    : "";

  return `${declaration}<toast ${toastAttrs}>${visual}${actionsTag}</toast>`;
};

/**
 * Windows トースト通知を送信する。
 * PowerShell を介して Windows Toast Notification API を呼び出す。
 * @param req 通知リクエスト
 * @throws PowerShell の実行に失敗した場合にエラーをスロー
 */
export const sendWindowsNotification = async (
  req: NotifyRequest,
): Promise<void> => {
  const ps = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

  const xmlContent = buildToastXml(req);

  const script = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'

$xml = @"
${xmlContent}
"@

$XmlDocument = [Windows.Data.Xml.Dom.XmlDocument]::new()
$XmlDocument.LoadXml($xml)

$toast = [Windows.UI.Notifications.ToastNotification]::new($XmlDocument)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show($toast)
  `;

  const cmd = new Deno.Command(ps, { args: ["-Command", script] });
  const { code } = await cmd.output();

  if (code !== 0) {
    throw new Error(`PowerShell exited with code ${code}`);
  }
};
