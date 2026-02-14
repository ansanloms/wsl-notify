import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildToastXml, hashFile, isWslPath } from "./notifier.ts";
import type { NotifyRequest } from "./notifier.ts";

// --- isWslPath ---

Deno.test("isWslPath - `/` で始まるパスは WSL パスと判定されること。", () => {
  assertEquals(isWslPath("/home/user/image.png"), true);
});

Deno.test("isWslPath - `/mnt/` で始まるパスも WSL パスと判定されること。", () => {
  assertEquals(isWslPath("/mnt/c/Users/user/image.png"), true);
});

Deno.test("isWslPath - Windows パスは WSL パスと判定されないこと。", () => {
  assertEquals(isWslPath("C:\\Users\\user\\image.png"), false);
});

Deno.test("isWslPath - 空文字列は WSL パスと判定されないこと。", () => {
  assertEquals(isWslPath(""), false);
});

// --- hashFile ---

Deno.test("hashFile - 同じ内容のファイルは同じハッシュを返すこと。", async () => {
  const tmp1 = await Deno.makeTempFile();
  const tmp2 = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(tmp1, "hello");
    await Deno.writeTextFile(tmp2, "hello");
    const hash1 = await hashFile(tmp1);
    const hash2 = await hashFile(tmp2);
    assertEquals(hash1, hash2);
  } finally {
    await Deno.remove(tmp1);
    await Deno.remove(tmp2);
  }
});

Deno.test("hashFile - 異なる内容のファイルは異なるハッシュを返すこと。", async () => {
  const tmp1 = await Deno.makeTempFile();
  const tmp2 = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(tmp1, "hello");
    await Deno.writeTextFile(tmp2, "world");
    const hash1 = await hashFile(tmp1);
    const hash2 = await hashFile(tmp2);
    assertEquals(hash1 !== hash2, true);
  } finally {
    await Deno.remove(tmp1);
    await Deno.remove(tmp2);
  }
});

Deno.test("hashFile - SHA-256 の16進文字列（64文字）を返すこと。", async () => {
  const tmp = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(tmp, "test");
    const hash = await hashFile(tmp);
    assertEquals(hash.length, 64);
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
  } finally {
    await Deno.remove(tmp);
  }
});

// --- buildToastXml ---

Deno.test("buildToastXml - タイトルとメッセージのみの基本的な通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
  };

  const xml = buildToastXml(req);

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

Deno.test("buildToastXml - 画像付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    image: {
      placement: "appLogoOverride",
      src: "C:\\path\\to\\icon.png",
    },
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "<image");
  assertStringIncludes(xml, 'placement="appLogoOverride"');
  assertStringIncludes(xml, 'src="C:\\path\\to\\icon.png"');
});

Deno.test("buildToastXml - hero 画像付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    image: {
      placement: "hero",
      src: "C:\\path\\to\\hero.png",
    },
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'placement="hero"');
  assertStringIncludes(xml, 'src="C:\\path\\to\\hero.png"');
});

Deno.test("buildToastXml - hint-crop 付き画像の通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    image: {
      placement: "appLogoOverride",
      hintCrop: "circle",
      src: "C:\\path\\to\\avatar.png",
    },
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'hint-crop="circle"');
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

  // xmlbuilder2 escapes <, >, & in text nodes (", ' are not required to be escaped)
  assertStringIncludes(xml, "&lt;");
  assertStringIncludes(xml, "&gt;");
  assertStringIncludes(xml, "&amp;");
});

Deno.test("buildToastXml - メッセージ内のXML特殊文字をエスケープすること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Message with <tags> & 'apostrophes'",
  };

  const xml = buildToastXml(req);

  // xmlbuilder2 escapes <, >, & in text nodes (', " are not required to be escaped)
  assertStringIncludes(xml, "&lt;tags&gt;");
  assertStringIncludes(xml, "&amp;");
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
    image: {
      placement: "appLogoOverride",
      src: "C:\\icons\\build.png",
    },
    button: [
      { label: "View Details", src: "https://example.com/build/123" },
      { label: "Dismiss", src: "dismiss://action" },
    ],
  };

  const xml = buildToastXml(req);

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

Deno.test("buildToastXml - attribution 付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    attribution: "via WSL",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'placement="attribution"');
  assertStringIncludes(xml, "via WSL");
});

Deno.test("buildToastXml - audio 付きの通知を生成できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    audio: {
      src: "ms-winsoundevent:Notification.Default",
      loop: true,
      silent: false,
    },
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, "<audio");
  assertStringIncludes(
    xml,
    'src="ms-winsoundevent:Notification.Default"',
  );
  assertStringIncludes(xml, 'loop="true"');
  assertStringIncludes(xml, 'silent="false"');
});

Deno.test("buildToastXml - duration を long に設定できること。", () => {
  const req: NotifyRequest = {
    title: "Test Title",
    message: "Test Message",
    duration: "long",
  };

  const xml = buildToastXml(req);

  assertStringIncludes(xml, 'duration="long"');
});
