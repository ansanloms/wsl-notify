import { assertStringIncludes } from "./deps/@std/assert/mod.ts";
import { buildToastXml } from "./notifier.ts";
import type { NotifyRequest } from "./notifier.ts";

Deno.test("buildToastXml - タイトルとメッセージのみの基本的な通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, '<?xml version="1.0"');
  assertStringIncludes(xml, "<toast");
  assertStringIncludes(xml, "<text>Test Title</text>");
  assertStringIncludes(xml, "<text>Test Message</text>");
});

Deno.test("buildToastXml - URL付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    url: "https://example.com",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'launch="https://example.com"');
});

Deno.test("buildToastXml - アイコン付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    icon: "C:\\path\\to\\icon.png",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "<image");
  assertStringIncludes(xml, 'placement="appLogoOverride"');
  assertStringIncludes(xml, 'src="C:\\path\\to\\icon.png"');
});

Deno.test("buildToastXml - ボタン付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    button: [
      { label: "Open", src: "https://example.com" },
      { label: "Dismiss", src: "https://example.com/dismiss" },
    ],
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "<actions>");
  assertStringIncludes(xml, 'content="Open"');
  assertStringIncludes(xml, 'arguments="https://example.com"');
  assertStringIncludes(xml, 'content="Dismiss"');
  assertStringIncludes(xml, 'arguments="https://example.com/dismiss"');
});

Deno.test("buildToastXml - タイトル内のXML特殊文字をエスケープすること。", () => {
  const req: NotifyRequest = {
    title: 'Test <Title> & "Quote"',
    message: "Test Message",
  };

  const xml = buildToastXml(req);

  // xml package should escape special characters
  assertStringIncludes(xml, "&lt;");
  assertStringIncludes(xml, "&gt;");
  assertStringIncludes(xml, "&amp;");
  assertStringIncludes(xml, "&quot;");
});

Deno.test("buildToastXml - メッセージ内のXML特殊文字をエスケープすること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Message with <tags> & 'apostrophes'",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "&lt;tags&gt;");
  assertStringIncludes(xml, "&amp;");
  assertStringIncludes(xml, "&apos;");
});

Deno.test("buildToastXml - ボタンラベル内のXML特殊文字をエスケープすること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    button: [
      { label: "Open <Now>", src: "https://example.com" },
    ],
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "Open &lt;Now&gt;");
});

Deno.test("buildToastXml - 全てのオプションを含む通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Build Complete",
    message: "Your project has been built successfully",
    url: "https://example.com/build/123",
    icon: "C:\\icons\\build.png",
    button: [
      { label: "View Details", src: "https://example.com/build/123" },
      { label: "Dismiss", src: "dismiss://action" },
    ],
  };

  const xml = buildToastXml(req);

  // Verify all components are present
  assertStringIncludes(xml, '<?xml version="1.0"');
  assertStringIncludes(xml, "<toast");
  assertStringIncludes(xml, 'launch="https://example.com/build/123"');
  assertStringIncludes(xml, "<text>Build Complete</text>");
  assertStringIncludes(
    xml,
    "<text>Your project has been built successfully</text>",
  );
  assertStringIncludes(xml, 'src="C:\\icons\\build.png"');
  assertStringIncludes(xml, 'content="View Details"');
  assertStringIncludes(xml, 'content="Dismiss"');
});

Deno.test("buildToastXml - URLが空の場合は空のlaunch属性になること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'launch=""');
});
