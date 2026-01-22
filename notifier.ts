import { create } from "npm:xmlbuilder2@4.0.3";

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
   * アイコンのパス。
   * Windows パスである必要がある。
   */
  icon?: string;

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
    .ele("binding", { template: "ToastGeneric" });

  if (req.icon) {
    binding.ele("image", { placement: "appLogoOverride", src: req.icon });
  }

  binding.ele("text").txt(req.title);
  binding.ele("text").txt(req.message);

  if (req.attribution) {
    binding.ele("text", { placement: "attribution" }).txt(req.attribution);
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
 * WSL パスを Windows パスに変換する。
 * @param wslPath WSL パス
 * @returns Windows パス
 */
const toWindowsPath = async (wslPath: string): Promise<string> => {
  const cmd = new Deno.Command("wslpath", { args: ["-w", wslPath] });
  const { code, stdout } = await cmd.output();

  if (code !== 0) {
    throw new Error(`wslpath failed with code ${code}`);
  }

  return new TextDecoder().decode(stdout).trim();
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

  // notifier.ps1 のパスを取得し Windows パスに変換
  const cmd = new Deno.Command(ps, {
    args: [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      await toWindowsPath(new URL("./notifier.ps1", import.meta.url).pathname),
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const process = cmd.spawn();

  // 標準入力に XML を書き込む
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(xmlContent));
  await writer.close();

  const { code, stdout, stderr } = await process.output();

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
