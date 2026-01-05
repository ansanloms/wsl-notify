import { sendWindowsNotification } from "../notifier.ts";

await sendWindowsNotification({
  title: "Example title",
  message: "Example message.\nExample message.\nExample message.",
  url: "https://example.com",
  button: [
    { label: "Open", src: "https://example.com/open" },
    { label: "Dismiss", src: "https://example.com/dismiss" },
  ],
});
