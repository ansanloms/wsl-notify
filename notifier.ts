import { xml } from "./deps/xml/mod.ts";

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
 * Build Windows Toast notification XML from NotifyRequest.
 * @param req Notification request
 * @returns XML string for Windows Toast notification
 */
export const buildToastXml = (req: NotifyRequest): string => {
  // Build XML structure using xml package
  const bindingContent = [
    { _attr: { template: "ToastGeneric" } },
    ...(req.icon
      ? [{
        image: [{
          _attr: { placement: "appLogoOverride", src: req.icon },
        }],
      }]
      : []),
    { text: req.title },
    { text: req.message },
  ];

  const actions = req.button
    ? [{
      actions: req.button.map(({ label, src }) => ({
        action: [{
          _attr: {
            content: label,
            activationType: "protocol",
            arguments: src,
          },
        }],
      })),
    }]
    : [];

  return xml([{
    toast: [
      {
        _attr: {
          activationType: "protocol",
          launch: req.url ?? "",
        },
      },
      {
        visual: [{
          binding: bindingContent,
        }],
      },
      ...actions,
    ],
  }], { declaration: true });
};

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
