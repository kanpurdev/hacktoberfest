#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { roastCode } = require("./roaster");

async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0];
  const level = args[1] || "medium";

  let sampleCode = `function calculateTotal(items) {
    var t = 0;
    for (var i = 0; i < items.length; i++) {
        t = t + items[i].price;
    }
    return t;
}`;

  if (targetFile) {
    const fullPath = path.resolve(process.cwd(), targetFile);
    if (fs.existsSync(fullPath)) {
      sampleCode = fs.readFileSync(fullPath, "utf-8");
      console.log(`📄 Roasting file: ${targetFile}`);
    } else {
      console.log(`⚠️  File "${targetFile}" not found, using sample code instead.`);
    }
  } else {
    console.log("ℹ️  No file specified. Using built-in sample code.");
  }

  console.log(`🔥 Code Roaster CLI (Level: ${level})`);
  console.log("-----------------------------------------");
  console.log("Input Code:\n" + sampleCode);
  console.log("-----------------------------------------");

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log("\n⚠️  No OPENAI_API_KEY found in environment variables.");
    console.log("💡 To connect real OpenAI AI roasts:");
    console.log("   - In Terminal: $env:OPENAI_API_KEY=\"sk-...\"");
    console.log("   - In VS Code: Set \"codeRoaster.apiKey\" in settings.\n");
    console.log("🔥 Here is what a savage Code Roast looks like:\n");
    console.log(`[SAMPLE ROAST - Medium/Savage]
💀 "var i = 0"? Did you write this in 2011 on Internet Explorer?
🔥 Using 'var' in 2026 is like bringing a horse and buggy to a Formula 1 race.
😂 'items[i].price' without checking if items is an array or has elements? 
   One undefined element and your whole app explodes into a million pieces.

💡 Improvement tips:
1. Use \`const\` and \`items.reduce((acc, item) => acc + (item?.price || 0), 0)\`
2. Add parameter validation or TypeScript types so you don't crash in production.
-----------------------------------------`);
    return;
  }

  console.log("\n🚀 Sending to OpenAI (gpt-4o-mini)...");
  try {
    const result = await roastCode(sampleCode, apiKey, level);
    console.log("\n🔥 ROAST RESULTS:\n");
    console.log(result);
  } catch (err) {
    console.error("\n❌ Roast failed:", err.message);
  }
}

main();
