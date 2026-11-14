import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Compile the actual source in memory so Node can exercise TS modules and aliases.
const modules = new Map();
function loadSource(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const mod = { exports: {} };
  modules.set(filename, mod);
  const localRequire = createRequire(filename);
  const requireSource = (id) => {
    if (id.startsWith("@/") || id.startsWith(".")) {
      const target = id.startsWith("@/")
        ? path.resolve(__dirname, "../src", id.slice(2))
        : path.resolve(path.dirname(filename), id);
      const source = [".ts", ".tsx"]
        .map((ext) => target + ext)
        .find(fs.existsSync);
      if (source) return loadSource(source);
    }
    return localRequire(id);
  };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInThisContext(`(function(exports, require, module) {${code}\n})`, {
    filename,
  })(mod.exports, requireSource, mod);
  return mod.exports;
}

// Two-frame, looping 1x1 GIF. Preserve both frame blocks byte for byte.
const frame = "21f904000a0000002c0000000001000100000202440100";
const gif = Buffer.from(
  "47494638396101000100800000000000ffffff21ff0b4e45545343415045322e300301000000" +
    frame +
    frame +
    "3b",
  "hex",
);
const b64 = gif.toString("base64");
const formats = loadSource("src/types/images.ts");

test("detect actual GIF bytes over incorrect metadata; handle mixed items and URL queries", () => {
  assert.equal(
    formats.imageFormat({ b64_json: b64, output_format: "png" }, "webp"),
    "gif",
  );
  assert.equal(
    formats.imageFormat(
      {
        b64_json: Buffer.from("\x89PNG\r\n\x1a\n", "binary").toString("base64"),
      },
      "gif",
    ),
    "png",
  );
  assert.equal(
    formats.imageFormat(
      { url: "https://example.com/ANIMATION.GIF?dl=1#preview" },
      "png",
    ),
    "gif",
  );
  assert.equal(
    formats.imageFormat(
      { url: "https://example.com/opaque", output_format: "webp" },
      "png",
    ),
    "webp",
  );
  assert.equal(formats.mimeFromFormat("gif"), "image/gif");
  assert.equal(formats.extFromFormat("gif"), "gif");
  assert.equal(formats.extFromFormat(undefined), "png");
});

test("animated GIF survives storage, GET/HEAD, rendering, and upload/delete unchanged", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-gif-test-"));
  const oldDir = process.env.UPLOAD_TMP_DIR;
  const oldPicbed = process.env.PICBED_BASE_URL;
  process.env.UPLOAD_TMP_DIR = dir;
  delete process.env.PICBED_BASE_URL;
  try {
    const { storeGeneratedImages } = loadSource("src/lib/generated-images.ts");
    const { toRenderedItems } = loadSource(
      "src/components/workshop/ResultSection.tsx",
    );
    const stored = await storeGeneratedImages(
      { created: 1, output_format: "png", data: [{ b64_json: b64 }] },
      "https://example.com",
    );
    const item = stored.data[0];
    assert.equal(item.output_format, "gif");
    assert.equal(item.b64_json, undefined);
    assert.equal(item.bytes, gif.length);
    const name = new URL(item.url).pathname.split("/").pop();
    assert.ok(name.endsWith(".gif"));
    assert.deepEqual(fs.readFileSync(path.join(dir, name)), gif);
    const route = loadSource("src/app/images/tmp/[name]/route.ts");
    const ctx = { params: Promise.resolve({ name }) };
    const response = await route.GET(new Request(item.url), ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/gif");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), gif);
    const head = await route.HEAD(new Request(item.url), ctx);
    assert.equal(head.headers.get("content-length"), String(gif.length));
    assert.equal(await head.text(), "");
    assert.equal(toRenderedItems(stored)[0].ext, "gif");
    assert.equal(
      toRenderedItems({
        created: 1,
        data: [{ b64_json: b64 }],
        output_format: "png",
      })[0].src,
      `data:image/gif;base64,${b64}`,
    );
    const { validateUploadFile } = loadSource(
      "src/components/workshop/constants.ts",
    );
    const file = new File([gif], "animation.gif", { type: "image/gif" });
    assert.equal(validateUploadFile(file), null);
    const upload = loadSource("src/app/api/upload/route.ts");
    const form = new FormData();
    form.set("file", file);
    const uploaded = await upload.POST(
      new Request("https://example.com/api/upload", {
        method: "POST",
        body: form,
      }),
    );
    assert.equal(uploaded.status, 200);
    const result = await uploaded.json();
    assert.deepEqual(fs.readFileSync(path.join(dir, result.fileName)), gif);
    const deleted = await upload.DELETE(
      new Request(
        "https://example.com/api/upload?name=" +
          encodeURIComponent(result.fileName),
        { method: "DELETE" },
      ),
    );
    assert.equal(deleted.status, 200);
    assert.equal(fs.existsSync(path.join(dir, result.fileName)), false);
    const { PICBED_GEN_KEY_RE } = loadSource("src/lib/picbed.ts");
    assert.ok(
      PICBED_GEN_KEY_RE.test(
        "20261114-120000_gen-12345678-1234-1234-1234-123456789abc.gif",
      ),
    );
    assert.equal(PICBED_GEN_KEY_RE.test("../unrelated.gif"), false);
  } finally {
    if (oldDir === undefined) delete process.env.UPLOAD_TMP_DIR;
    else process.env.UPLOAD_TMP_DIR = oldDir;
    if (oldPicbed === undefined) delete process.env.PICBED_BASE_URL;
    else process.env.PICBED_BASE_URL = oldPicbed;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("animation endpoint requires activation and pins GIF model/size/count on the server", async () => {
  const accessFile = path.resolve(__dirname, "../src/lib/image-access.ts");
  const previous = modules.get(accessFile);
  let resolved = 0;
  let accessResult = { official: true };
  modules.set(accessFile, {
    exports: {
      resolveImageAccess: async (_req, meta) => {
        resolved++;
        assert.equal(meta.n, 1);
        assert.equal(meta.size, "512x512");
        return accessResult;
      },
      isAccessError: (value) => "error" in value,
      forwardImageRequest: async (_req, _access, endpoint, payload) => {
        assert.equal(endpoint, "/v1/images/generations");
        assert.deepEqual(payload, {
          model: "gpt-image-2.6-sunburst",
          prompt: "a bouncing ball",
          size: "512x512",
          quality: "auto",
          output_format: "gif",
          n: 1,
        });
        return Response.json({ ok: true });
      },
    },
  });
  try {
    const route = loadSource("src/app/api/animate/route.ts");
    const makeRequest = (code) =>
      new Request("https://example.com/api/animate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(code ? { "x-image-activation-code": code } : {}),
        },
        body: JSON.stringify({
          prompt: "a bouncing ball",
          model: "other",
          size: "4096x4096",
          n: 4,
        }),
      });
    assert.equal((await route.POST(makeRequest())).status, 403);
    assert.equal(resolved, 0);
    accessResult = { error: "激活码无效", status: 403 };
    assert.equal((await route.POST(makeRequest("invalid"))).status, 403);
    accessResult = { official: true };
    assert.equal((await route.POST(makeRequest("valid"))).status, 200);
  } finally {
    if (previous) modules.set(accessFile, previous);
    else modules.delete(accessFile);
  }
});
