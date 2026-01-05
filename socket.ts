import type { NotifyRequest, NotifyResponse } from "./notifier.ts";

export const SOCK_PATH = Deno.env.get("WSL_NOTIFY_SOCK") ??
  "/tmp/wsl-notify.sock";

export interface SocketServerOptions {
  /**
   * UNIX ソケットのパス。
   */
  sockPath: string;

  /**
   * メッセージ受信時のハンドラ。
   * @param req 受信した通知リクエスト
   * @returns 処理結果のレスポンス
   */
  onMessage: (req: NotifyRequest) => Promise<NotifyResponse>;
}

/**
 * レスポンスを安全に書き込む。
 * クライアントが既に切断している場合でも、エラーをキャッチしてサーバーを継続動作させる。
 * @param conn ソケット接続
 * @param res レスポンスデータ
 */
const safeWriteResponse = async (
  conn: Deno.Conn,
  res: NotifyResponse,
): Promise<void> => {
  try {
    await conn.write(new TextEncoder().encode(JSON.stringify(res)));
  } catch (error) {
    console.error("Failed to send response:", error);
  }
};

/**
 * ソケット接続を処理する。
 * クライアントからのリクエストを受信し、onMessage ハンドラを実行して、レスポンスを返す。
 * @param conn ソケット接続
 * @param onMessage メッセージ受信時のハンドラ
 */
const handleConnection = async (
  conn: Deno.Conn,
  onMessage: (req: NotifyRequest) => Promise<NotifyResponse>,
): Promise<void> => {
  try {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);

    if (n) {
      const req: NotifyRequest = JSON.parse(
        new TextDecoder().decode(buf.subarray(0, n)),
      );

      const res = await onMessage(req);
      await safeWriteResponse(conn, res);
    }
  } catch (error) {
    console.error("Connection error:", error);

    const res: NotifyResponse = {
      status: "error",
      error: String(error),
    };

    await safeWriteResponse(conn, res);
  } finally {
    conn.close();
  }
};

/**
 * UNIX ソケットサーバーを起動する。
 * 既存のソケットファイルが存在する場合は削除してから、新しいソケットでリスニングを開始する。
 * @param options サーバーオプション
 */
export const startSocketServer = async (
  { sockPath, onMessage }: SocketServerOptions,
): Promise<void> => {
  // 既存のソケットファイルが存在する場合は削除
  try {
    await Deno.remove(sockPath);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  const listener = Deno.listen({
    path: sockPath,
    transport: "unix",
  });

  console.log(`Listening on ${sockPath}`);

  for await (const conn of listener) {
    handleConnection(conn, onMessage);
  }
};
