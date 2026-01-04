import { SOCK_PATH, startSocketServer } from "./socket.ts";
import { sendWindowsNotification } from "./notifier.ts";

await startSocketServer({
  sockPath: SOCK_PATH,
  onMessage: async (req) => {
    try {
      await sendWindowsNotification(req);
      return { status: "ok" };
    } catch (e) {
      console.error("Notification error:", e);
      return { status: "error", error: String(e) };
    }
  },
});
