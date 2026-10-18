const OpenAI = require("openai");

const ROAST_PROMPTS = {
  mild: "You are a friendly code reviewer who gives light-hearted, gentle jokes about code quality while being helpful.",
  medium: "You are a savage but helpful code reviewer. Roast the code like a comedian — be funny, use emojis, point out bad practices dramatically, but always end with actual improvement tips.",
  savage: "You are an EXTREMELY savage code roaster. Tear this code apart like a comedy roast. Be brutal, funny, use memes and emojis 💀🔥. Make the developer feel the pain but give real fixes at the end.",
};

function generateFallbackRoast(code, level = "medium", reason = "") {
  const issues = [];
  const fixes = [];

  if (/\bvar\b/.test(code)) {
    issues.push("• You're using `var`! What is this, 2011? Even jQuery feels embarrassed for you. 🦕");
    fixes.push("Replace `var` with `const` or `let` to save your scope from doom.");
  }
  if (/console\.log/.test(code)) {
    issues.push("• Leftover `console.log` statements spotted! Your terminal must look like a crime scene. 🕵️‍♂️");
    fixes.push("Remove debug logging before pushing or use a structured logging framework.");
  }
  if (/for\s*\(\s*(var|let)?\s*i\s*=/.test(code)) {
    issues.push("• A classic C-style `for` loop with index manipulation. Did your CS 101 professor ghostwrite this? 👨‍🏫");
    fixes.push("Prefer functional iterations like `.map()`, `.filter()`, or `.reduce()`.");
  }
  if (/==(?!=)/.test(code)) {
    issues.push("• Loose equality `==` detected. You really like playing Russian Roulette with JavaScript type coercion, huh? 🎲");
    fixes.push("Always use strict equality `===` unless you deliberately enjoy bizarre type bugs.");
  }
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(code)) {
    issues.push("• Empty `catch` block! Ah yes, if we swallow the error in darkness, it never happened. Ignorance is bliss. 🙈");
    fixes.push("Handle or at least log your caught exceptions.");
  }
  if (/TODO/i.test(code)) {
    issues.push("• Found a `TODO` comment! We all know that's going to stay there until the heat death of the universe. ⏳");
    fixes.push("Either implement the TODO now or file a tracked GitHub issue.");
  }

  if (issues.length === 0) {
    issues.push("• At first glance, this code looks deceptively innocent, which makes me suspect the bugs are hiding in plain sight. 🧐");
    fixes.push("Add automated unit tests and strict linter rules.");
  }

  const prefix = level === "savage"
    ? "💀 ROAST LEVEL: SAVAGE 💀\nHold onto your keyboard, this is going to hurt:\n\n"
    : level === "mild"
    ? "🍵 ROAST LEVEL: MILD 🍵\nHere are some gentle thoughts on your masterpiece:\n\n"
    : "🔥 ROAST LEVEL: MEDIUM 🔥\nLet's unpack this algorithmic rollercoaster:\n\n";

  let out = prefix + issues.join("\n\n");
  out += "\n\n💡 Actual Improvement Tips:\n" + fixes.map((f, i) => `${i + 1}. ${f}`).join("\n");

  if (reason) {
    out += `\n\n*(⚡ Offline/Fallback Roaster activated — OpenAI note: ${reason})*`;
  }

  return out;
}

async function roastCode(code, apiKey, level = "medium") {
  if (!apiKey) {
    return generateFallbackRoast(code, level, "No API key configured");
  }

  try {
    const client = new OpenAI({ apiKey });
    const systemPrompt = ROAST_PROMPTS[level] || ROAST_PROMPTS.medium;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Roast this code:\n\n\`\`\`\n${code}\n\`\`\``,
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content;
  } catch (err) {
    // If OpenAI returns quota limit (429) or network failure, provide fallback roast
    if (err.status === 429 || (err.message && err.message.includes("credits"))) {
      return generateFallbackRoast(code, level, "Quota / credits exceeded on OpenAI key");
    }
    throw err;
  }
}

module.exports = { roastCode, generateFallbackRoast };
