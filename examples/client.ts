import type { NotifyRequest, NotifyResponse } from "../notifier.ts";
import { SOCK_PATH } from "../socket.ts";

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
  attribution: "attribution",
};

try {
  await conn.write(new TextEncoder().encode(JSON.stringify(req)));

  const buf = new Uint8Array(1024);
  const n = await conn.read(buf);

  const response: NotifyResponse = JSON.parse(
    new TextDecoder().decode(buf.subarray(0, n ?? 0)),
  );

  console.log(response);
} catch (error) {
  console.error("Client error:", error);
} finally {
  conn.close();
}
