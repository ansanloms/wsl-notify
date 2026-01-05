import type { NotifyRequest, NotifyResponse } from "../notifier.ts";
import { SOCK_PATH } from "../socket.ts";

// タイムアウト時間（ミリ秒）
const TIMEOUT_MS = 10000; // 10秒

const conn = await Deno.connect({
  path: SOCK_PATH,
  transport: "unix",
});

const req: NotifyRequest = {
  title: "Example title",
  message: "Example message.\nExample message.\nExample message.",
  url: "https://example.com",
  button: [
    { label: "Open", src: "https://example.com/open" },
    { label: "Dismiss", src: "https://example.com/dismiss" },
  ],
};

try {
  await conn.write(new TextEncoder().encode(JSON.stringify(req)));

  const buf = new Uint8Array(1024);

  // タイムアウト付きでレスポンスを待つ
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout waiting for response")), TIMEOUT_MS)
  );

  const readPromise = conn.read(buf);

  const n = await Promise.race([readPromise, timeoutPromise]);

  const response: NotifyResponse = JSON.parse(
    new TextDecoder().decode(buf.subarray(0, n ?? 0)),
  );

  console.log(response);
} catch (error) {
  console.error("Client error:", error);
} finally {
  conn.close();
}
