import { sendWindowsNotification } from "../notifier.ts";

const __dirname = new URL(".", import.meta.url).pathname;

await sendWindowsNotification({
  title: "Example title",
  message: "Example message.\nExample message.\nExample message.",
  url: "https://example.com",
  image: {
    placement: "appLogoOverride",
    hintCrop: "circle",
    src: `${__dirname}/sample.jpg`,
  },
  button: [
    { label: "Open", src: "https://example.com/open" },
    { label: "Dismiss", src: "https://example.com/dismiss" },
  ],
});
