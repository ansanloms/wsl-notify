import type { NotifyRequest, NotifyResponse } from "./notifier.ts";

export const SOCK_PATH = Deno.env.get("WSL_NOTIFY_SOCK") ??
  "/tmp/wsl-notify.sock";

export interface SocketServerOptions {
  /**
   * UNIX ソケットのパス。
   */
  sockPath: string;

  /**
   * メッセージ受信時のハンドラ
   * @param req 受信した通知リクエスト
   * @returns 処理結果のレスポンス
   */
  onMessage: (req: NotifyRequest) => Promise<NotifyResponse>;
}

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
      await conn.write(new TextEncoder().encode(JSON.stringify(res)));
    }
  } catch (error) {
    console.error("Connection error:", error);

    const res: NotifyResponse = {
      status: "error",
      error: String(error),
    };

    await conn.write(new TextEncoder().encode(JSON.stringify(res)));
  } finally {
    conn.close();
  }
};

export const startSocketServer = async (
  { sockPath, onMessage }: SocketServerOptions,
): Promise<void> => {
  // Remove existing socket file if it exists
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
