const assert = require("node:assert");
const test = require("node:test");
const Module = require("module");

// Mock 'vscode' module for pure Node test environments
const originalRequire = Module.prototype.require;
const mockCommands = new Map();

const vscodeMock = {
  commands: {
    registerCommand: (name, callback) => {
      mockCommands.set(name, callback);
      return { dispose: () => mockCommands.delete(name) };
    },
  },
  window: {
    activeTextEditor: null,
    showErrorMessage: (msg) => msg,
    showInformationMessage: (msg) => msg,
    createWebviewPanel: (viewType, title, viewColumn, options) => ({
      title,
      webview: { html: "" },
    }),
    withProgress: async (options, task) => await task(),
  },
  workspace: {
    getConfiguration: (section) => ({
      get: (key) => {
        if (key === "apiKey") return "mock-key";
        if (key === "roastLevel") return "medium";
        return null;
      },
    }),
  },
  ViewColumn: { Beside: 2 },
  ProgressLocation: { Notification: 15 },
};

Module.prototype.require = function (request) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalRequire.apply(this, arguments);
};

const extension = require("../src/extension");
const roaster = require("../src/roaster");

test("Extension exports activate and deactivate functions", () => {
  assert.strictEqual(typeof extension.activate, "function");
  assert.strictEqual(typeof extension.deactivate, "function");
});

test("Extension registers roast commands on activate", () => {
  const context = { subscriptions: [] };
  extension.activate(context);
  assert.strictEqual(context.subscriptions.length, 2);
  assert(mockCommands.has("code-roaster.roastMyCode"));
  assert(mockCommands.has("code-roaster.roastSelection"));
});

test("Roaster exports roastCode and generateFallbackRoast functions", () => {
  assert.strictEqual(typeof roaster.roastCode, "function");
  assert.strictEqual(typeof roaster.generateFallbackRoast, "function");
});

test("Fallback roaster produces helpful roast for code smells", () => {
  const result = roaster.generateFallbackRoast("var x = 10; console.log(x);", "savage");
  assert(result.includes("var"));
  assert(result.includes("console.log"));
  assert(result.includes("SAVAGE"));
});

test("Roaster falls back cleanly when API key is not provided", async () => {
  const roast = await roaster.roastCode("var a = 1; for (var i = 0; i < 10; i++) {}", "");
  assert(typeof roast === "string");
  assert(roast.includes("var"));
});
