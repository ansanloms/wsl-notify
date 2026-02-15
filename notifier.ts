import { create } from "npm:xmlbuilder2@4.0.3";
import { extname } from "jsr:@std/path@1.1.4";

const PS_PATH = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

/**
 * WSL パスかどうかを判定する。
 * `/` で始まるパスを WSL パスとみなす（Windows パスはドライブレターで始まる）。
 */
export const isWslPath = (path: string): boolean => {
  return path.startsWith("/");
};

/**
 * Windows の TEMP フォルダーのパスを取得する。
 */
const getWindowsTempPath = async (): Promise<string> => {
  const cmd = new Deno.Command(PS_PATH, {
    args: ["-NoProfile", "-Command", "[System.IO.Path]::GetTempPath()"],
  });
  const result = await cmd.output();

  if (result.code !== 0) {
    throw new Error(
      `Failed to get TEMP path: ${new TextDecoder().decode(result.stderr)}`,
    );
  }

  return new TextDecoder().decode(result.stdout).trim();
};

/**
 * ファイルの SHA-256 ハッシュを16進文字列で返す。
 */
export const hashFile = async (path: string): Promise<string> => {
  const data = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * WSL パスの画像を Windows 側の TEMP フォルダーにコピーし、Windows パスを返す。
 * ハッシュベースのファイル名を使い、既にコピー済みならスキップする。
 * @param src WSL 上の画像パス
 * @returns Windows パス形式の一時ファイルパス
 */
const copyImageToWindowsTemp = async (
  src: string,
): Promise<string | undefined> => {
  let resolvedSrc: string;
  try {
    resolvedSrc = await Deno.realPath(src);
  } catch {
    return undefined;
  }

  const ext = extname(resolvedSrc);
  const hash = await hashFile(resolvedSrc);
  const tempDir = await getWindowsTempPath();
  const fileName = `wsl-notify-${hash}${ext}`;
  const winPath = `${tempDir}${fileName}`;

  const wslpathCmd = new Deno.Command("wslpath", {
    args: ["-u", winPath],
  });
  const wslpathResult = await wslpathCmd.output();
  const wslTmpPath = new TextDecoder().decode(wslpathResult.stdout).trim();

  try {
    await Deno.stat(wslTmpPath);
  } catch {
    await Deno.copyFile(resolvedSrc, wslTmpPath);
  }

  return winPath;
};

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
   * 属性表示。
   */
  attribution?: string;

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
   * 画像表示。
   */
  image?: {
    /**
     * 画像の配置。
     */
    placement?: "appLogoOverride" | "hero";

    /**
     * 画像のトリミング。
     */
    hintCrop?: "circle";

    /**
     * 画像のパス。
     */
    src: string;
  };

  /**
   * オーディオ出力。
   */
  audio?: {
    /**
     * @see https://learn.microsoft.com/ja-jp/uwp/schemas/tiles/toastschema/element-audio
     */
    src?: string;

    /**
     * ループ再生するかどうか。
     */
    loop?: boolean;

    /**
     * 無音にするかどうか。
     */
    silent?: boolean;
  };

  /**
   * 通知の表示時間。
   */
  duration?: "long" | "short";
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
 * NotifyRequest から Windows トースト通知用の XML を構築する。
 * @param req 通知リクエスト
 * @returns Windows トースト通知用の XML 文字列
 */
export const buildToastXml = (req: NotifyRequest): string => {
  const root = create().ele("toast", {
    launch: req.url ?? "",
    duration: req.duration ?? "short",
  });

  const binding = root
    .ele("visual")
    .ele("binding", {
      template: "ToastGeneric",
    });

  if (req.image) {
    binding.ele("image", {
      placement: req.image.placement,
      "hint-crop": req.image.hintCrop,
      src: req.image.src,
    });
  }

  binding.ele("text").txt(req.title);
  binding.ele("text").txt(req.message);

  if (req.attribution) {
    binding.ele("text", {
      placement: "attribution",
    }).txt(req.attribution);
  }

  const actions = root.ele("actions");
  if (req.button) {
    for (const { label, src } of req.button) {
      actions.ele("action", {
        content: label,
        activationType: "protocol",
        arguments: src,
      });
    }
  }

  if (req.audio) {
    root.ele("audio", {
      src: req.audio.src ?? "",
      loop: req.audio.loop ? "true" : "false",
      silent: req.audio.silent ? "true" : "false",
    });
  }

  return root.end({ headless: true });
};

/**
 * Windows トースト通知を送信するための PowerShell スクリプトを生成する。
 * @param xmlContent トースト通知用の XML 文字列
 * @returns PowerShell スクリプト
 */
const buildToastScript = (xmlContent: string): string => `
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

/**
 * Windows トースト通知を送信する。
 * PowerShell を介して Windows Toast Notification API を呼び出す。
 * @param req 通知リクエスト
 * @throws PowerShell の実行に失敗した場合にエラーをスロー
 */
export const sendWindowsNotification = async (
  req: NotifyRequest,
): Promise<void> => {
  if (req.image && isWslPath(req.image.src)) {
    const resolvedSrc = await copyImageToWindowsTemp(req.image.src);
    if (resolvedSrc) {
      req.image.src = resolvedSrc;
    } else {
      delete req.image;
    }
  }

  const cmd = new Deno.Command(PS_PATH, {
    args: ["-Command", buildToastScript(buildToastXml(req))],
  });
  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const stdoutText = new TextDecoder().decode(stdout);
    const stderrText = new TextDecoder().decode(stderr);

    console.error("PowerShell execution failed:");
    console.error("Exit code:", code);
    if (stdoutText) {
      console.error("stdout:", stdoutText);
    }
    if (stderrText) {
      console.error("stderr:", stderrText);
    }

    throw new Error(`PowerShell exited with code ${code}`);
  }
};
