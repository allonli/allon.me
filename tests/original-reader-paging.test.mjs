import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(import.meta.dirname, "..");
const bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs = 8000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(80);
  }
  if (lastError) throw lastError;
  throw new Error("Timed out waiting for condition");
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function startServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(rootDir, requested));
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(filePath) });
    createReadStream(filePath).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function startBrowser() {
  const debuggingPort = 41000 + Math.floor(Math.random() * 10000);
  const userDataDir = await mkdtemp(path.join(tmpdir(), "zztj-reader-"));
  const browser = spawn(bravePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  browser.stderr.setEncoding("utf8");
  await waitFor(() => fetchJson(`http://127.0.0.1:${debuggingPort}/json/version`), 10000);
  return {
    debuggingPort,
    close: async () => {
      browser.kill("SIGTERM");
      await rm(userDataDir, { recursive: true, force: true });
    }
  };
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.socket.close();
  }
}

async function connectToPage(debuggingPort, url) {
  const target = await fetchJson(
    `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const cdp = new CdpClient(socket);
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  return cdp;
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result.value;
}

async function pressKey(cdp, key) {
  const code = key === "ArrowLeft" ? 37 : 39;
  await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code });
  await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code });
}

async function moveMouse(cdp, x, y) {
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

const readerMetricsExpression = `(() => {
  const page = document.querySelector(".book-page-full.original-page");
  const overlayBody = document.querySelector(".overlay-body");
  const viewport = document.querySelector(".original-page-viewport");
  const reader = document.querySelector(".original-paged-reader");
  const count = document.querySelector("#originalPageCount");
  const footer = document.querySelector(".original-page-footer");
  const progress = document.querySelector("#originalPageProgress");
  const pageStyle = page ? getComputedStyle(page) : null;
  const overlayStyle = overlayBody ? getComputedStyle(overlayBody) : null;
  const readerStyle = reader ? getComputedStyle(reader) : null;
  const progressStyle = progress ? getComputedStyle(progress) : null;
  const current = Number(viewport?.dataset.page || 0);
  return {
    hasPage: Boolean(page),
    hasViewport: Boolean(viewport),
    hasButtons: document.querySelectorAll("[data-page-turn]").length === 2,
    hasFooter: Boolean(footer),
    countText: count?.textContent || "",
    current,
    offset: Number(viewport?.dataset.offset || 0),
    viewportWidth: viewport?.clientWidth || 0,
    progressValue: progress?.value || "",
    progressMax: progress?.max || "",
    progressDirection: progressStyle?.direction || "",
    progressHeight: progress ? progress.getBoundingClientRect().height : 0,
    overlayPaddingTop: overlayStyle ? Number.parseFloat(overlayStyle.paddingTop) : 0,
    writingMode: readerStyle?.writingMode || "",
    scrollsHorizontally: reader ? reader.scrollWidth > viewport.clientWidth : false,
    radii: pageStyle ? [
      pageStyle.borderTopLeftRadius,
      pageStyle.borderTopRightRadius,
      pageStyle.borderBottomRightRadius,
      pageStyle.borderBottomLeftRadius
    ] : [],
    buttons: Array.from(document.querySelectorAll("[data-page-turn]")).map((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        direction: Number(button.dataset.pageTurn),
        disabled: button.disabled,
        opacity: Number(style.opacity),
        width: rect.width,
        height: rect.height
      };
    }),
    viewportRect: viewport ? (() => {
      const rect = viewport.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    })() : null
  };
})()`;

test("original reader has prominent contextual controls and right-to-left paging", async () => {
  const server = await startServer();
  const browser = await startBrowser();
  const cdp = await connectToPage(browser.debuggingPort, `${server.origin}/`);
  try {
    await waitFor(() => evaluate(cdp, "document.querySelectorAll('.volume-card').length > 0"));
    await evaluate(cdp, `document.querySelector('article.volume-card[data-volume="1"]').click()`);
    await waitFor(() => evaluate(cdp, "document.querySelector('[data-reader-mode=\"original\"]')"));
    await evaluate(cdp, `document.querySelector('[data-reader-mode="original"]').click()`);
    await waitFor(() => evaluate(cdp, "document.querySelector('.original-page')"));

    const initial = await evaluate(cdp, readerMetricsExpression);
    assert.equal(initial.hasPage, true);
    assert.equal(initial.hasViewport, true, "original reader should render a paged viewport");
    assert.equal(initial.hasButtons, true, "original reader should expose previous/next page buttons");
    assert.equal(initial.hasFooter, true, "original reader should show bottom paging controls");
    assert.equal(new Set(initial.radii).size, 1, "all page corners should use the same radius");
    assert.ok(initial.overlayPaddingTop <= 14, "outer dark frame around the reader should be slim");
    assert.ok(initial.buttons.some((button) => button.direction > 0 && button.opacity > 0.9), "next-page button should be visible before paging");
    assert.ok(initial.buttons.every((button) => button.width >= 54 && button.height >= 96), "page-turn buttons should be large enough to notice");
    assert.equal(initial.writingMode, "vertical-rl");
    assert.equal(initial.progressDirection, "rtl", "progress should run right-to-left with the text direction");
    assert.ok(initial.progressHeight <= 4, "progress track should be visually thin");
    assert.match(initial.countText, /^第 1 \//u);
    assert.equal(initial.progressValue, "0");

    await evaluate(cdp, `document.querySelector('.original-page-viewport').focus()`);
    await pressKey(cdp, "ArrowLeft");
    await waitFor(async () => (await evaluate(cdp, readerMetricsExpression)).current === 1);
    const afterLeft = await evaluate(cdp, readerMetricsExpression);
    assert.equal(afterLeft.offset, afterLeft.viewportWidth, "ArrowLeft should advance leftward by one page");
    assert.equal(afterLeft.progressValue, "1");

    await moveMouse(cdp, afterLeft.viewportRect.left + afterLeft.viewportRect.width / 2, afterLeft.viewportRect.top + 24);
    await waitFor(async () => {
      const metrics = await evaluate(cdp, readerMetricsExpression);
      return metrics.buttons.every((button) => button.disabled || button.opacity < 0.08);
    });

    await moveMouse(cdp, afterLeft.viewportRect.left + 32, afterLeft.viewportRect.top + afterLeft.viewportRect.height / 2);
    await waitFor(async () => {
      const metrics = await evaluate(cdp, readerMetricsExpression);
      return metrics.buttons.some((button) => button.direction > 0 && button.opacity > 0.9);
    });

    await moveMouse(cdp, afterLeft.viewportRect.left + afterLeft.viewportRect.width / 2, afterLeft.viewportRect.top + 24);
    await waitFor(async () => {
      const metrics = await evaluate(cdp, readerMetricsExpression);
      return metrics.buttons.every((button) => button.disabled || button.opacity < 0.08);
    });

    await pressKey(cdp, "ArrowRight");
    await waitFor(async () => (await evaluate(cdp, readerMetricsExpression)).current === 0);
    const afterRight = await evaluate(cdp, readerMetricsExpression);
    assert.equal(afterRight.offset, 0, "ArrowRight should return to the rightmost first page");
  } finally {
    cdp.close();
    await browser.close();
    await server.close();
  }
});

test("trackpad-style horizontal wheel gestures turn only one original page per swipe", async () => {
  const server = await startServer();
  const browser = await startBrowser();
  const cdp = await connectToPage(browser.debuggingPort, `${server.origin}/`);
  try {
    await waitFor(() => evaluate(cdp, "document.querySelectorAll('.volume-card').length > 0"));
    await evaluate(cdp, `document.querySelector('article.volume-card[data-volume="1"]').click()`);
    await waitFor(() => evaluate(cdp, "document.querySelector('[data-reader-mode=\"original\"]')"));
    await evaluate(cdp, `document.querySelector('[data-reader-mode="original"]').click()`);
    await waitFor(() => evaluate(cdp, "document.querySelector('.original-page')"));

    const initial = await evaluate(cdp, readerMetricsExpression);
    await evaluate(cdp, `
      (() => {
        const sideZone = document.querySelector(".original-page-turn.is-forward");
        sideZone.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 2400, deltaY: 0 }));
        sideZone.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 2400, deltaY: 0 }));
      })()
    `);
    await waitFor(async () => (await evaluate(cdp, readerMetricsExpression)).current === initial.current + 1);
    const afterBurst = await evaluate(cdp, readerMetricsExpression);
    assert.equal(afterBurst.current, initial.current + 1, "one large horizontal swipe burst should advance exactly one page");

    await delay(360);
    await evaluate(cdp, `
      document.querySelector(".original-page-viewport")
        .dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: -2400, deltaY: 0 }))
    `);
    await waitFor(async () => (await evaluate(cdp, readerMetricsExpression)).current === initial.current);
  } finally {
    cdp.close();
    await browser.close();
    await server.close();
  }
});
