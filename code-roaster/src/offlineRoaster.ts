import { RoastLevel, RoastRequest, RoastResult } from './types';

interface DetectedSmell {
  title: string;
  mildJoke: string;
  mediumJoke: string;
  savageJoke: string;
  weight: number;
}

const CODE_SMELLS: Array<{ regex: RegExp; smell: DetectedSmell }> = [
  {
    regex: /\bany\b/,
    smell: {
      title: 'TypeScript `any` Abuse',
      mildJoke: "Using `any`? TypeScript's type checker is feeling a bit left out today.",
      mediumJoke: "Using `any` is like buying a fortress with titanium doors, then leaving the back door wide open with a welcome mat for runtime errors.",
      savageJoke: "You used `any`. Anders Hejlsberg didn't spend decades creating a world-class type system just for you to turn TypeScript into Python with extra punctuation.",
      weight: 15,
    },
  },
  {
    regex: /console\.(log|error|warn|info)\(/,
    smell: {
      title: 'Production `console.log` Debugging',
      mildJoke: "Ah, the trusty `console.log` — old reliable developer companion.",
      mediumJoke: "Your terminal output looks like a live seismic graph during an earthquake. Have you heard of debuggers?",
      savageJoke: "There are more `console.log` statements here than actual business logic. If your code was an airport, the air traffic controllers would be screaming into megaphones.",
      weight: 10,
    },
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    smell: {
      title: 'Silent Catch Block (The Ostrich Algorithm)',
      mildJoke: "An empty catch block! If you can't see the error, did it really happen?",
      mediumJoke: "The classic Ostrich Algorithm: bury your head in the sand, swallow the exception, and pray the server doesn't catch fire at 3 AM.",
      savageJoke: "Swallowing exceptions silently in a blank catch block? That is not error handling, that is obstruction of justice.",
      weight: 25,
    },
  },
  {
    regex: /\bTODO\b/i,
    smell: {
      title: 'Fossilized `TODO` Comment',
      mildJoke: "A `TODO` comment! We all promise we'll come back to it soon, right?",
      mediumJoke: "That `TODO` comment is older than the git repo itself. It should probably be carbon-dated by archaeologists.",
      savageJoke: "Writing `TODO: fix this later` is developer code for `I am pushing this to main and fleeing the continent before code review`.",
      weight: 12,
    },
  },
  {
    regex: /\b(var\s+[a-zA-Z0-9_$]+)/,
    smell: {
      title: 'Legacy `var` Declaration',
      mildJoke: "Using `var`? Bringing back that nostalgic ES5 vintage charm!",
      mediumJoke: "`var` in 2026? What year is it? Should we compile this on a floppy disk and mail it to Netscape?",
      savageJoke: "Using `var` is a war crime against block scoping. Even Internet Explorer 6 is rolling in its grave right now.",
      weight: 14,
    },
  },
  {
    regex: /for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{/,
    smell: {
      title: 'Nested Loops (O(n²) / O(n³) Complexity)',
      mildJoke: "Nested loops: great for keeping your CPU warm during winter!",
      mediumJoke: "O(n²)? NASA is calculating the heat death of the universe, and your inner loop is scheduled to finish right after.",
      savageJoke: "These nested loops are so deep they've entered Dante's 7th circle of Hell. Your fan is spinning so fast the laptop might take flight.",
      weight: 22,
    },
  },
  {
    regex: /==(?!=)/,
    smell: {
      title: 'Loose Equality `==`',
      mildJoke: "Loose equality `==`: living life on the edge with JavaScript type coercion!",
      mediumJoke: "Relying on `==` type coercion? That's not confidence, that's gambling with your production database.",
      savageJoke: "`==` instead of `===`? You trust JavaScript type coercion more than you should trust your own family.",
      weight: 12,
    },
  },
  {
    regex: /\b(eval|Function\s*\()\b/,
    smell: {
      title: 'Dynamic `eval()` Usage',
      mildJoke: "Using `eval`? That's quite an adventurous approach to dynamic code!",
      mediumJoke: "`eval()` is evil, and every linter on earth just shivered in horror.",
      savageJoke: "You put `eval()` in your code? Hackers don't even need to exploit you, you gave them the root keys and an espresso.",
      weight: 35,
    },
  },
  {
    regex: /\b(data|temp|tmp|foo|bar|baz|res|result|item|obj|x|y|z)\b/,
    smell: {
      title: 'Zero-Effort Variable Naming',
      mildJoke: "Variable names like `data` and `temp` — short, sweet, and mysterious!",
      mediumJoke: "Variable names like `temp`, `data`, and `foo`... Are we playing alphabet bingo or writing software?",
      savageJoke: "If someone asked you to describe a suspect in a crime, you'd probably call them 'Person item = new Person()'. Give your variables meaningful names!",
      weight: 8,
    },
  },
];

export function generateOfflineRoast(req: RoastRequest): RoastResult {
  const code = req.code;
  const level = req.roastLevel;

  // Detect smells
  const detected: DetectedSmell[] = [];
  let baseScore = 25;

  for (const item of CODE_SMELLS) {
    if (item.regex.test(code)) {
      detected.push(item.smell);
      baseScore += item.smell.weight;
    }
  }

  // Length check
  const lines = code.split('\n').length;
  if (lines > 100) {
    baseScore += 15;
  }

  const score = Math.min(99, Math.max(15, baseScore));

  let verdict = 'Needs A Hug';
  if (score > 80) {
    verdict = 'Certified Dumpster Fire 💀';
  } else if (score > 60) {
    verdict = 'Spaghetti With Extra Sauce 🍝';
  } else if (score > 40) {
    verdict = 'Questionable Life Choices 🤔';
  } else {
    verdict = 'Surprisingly Tolerable 👍';
  }

  const worstCrime = detected.length > 0
    ? detected[0].title
    : (lines > 80 ? 'Excessive function bloat' : 'Suspicious lack of documentation');

  // Build jokes
  const jokes: string[] = [];
  if (detected.length === 0) {
    jokes.push(
      level === 'savage'
        ? "Honestly, this code is so plain it makes unseasoned tofu look like a culinary masterpiece. Where are the comments? Where is the ambition?"
        : "The code isn't overtly broken, but it looks like it was written during an all-nighter powered exclusively by lukewarm tap water."
    );
  } else {
    for (const d of detected) {
      if (level === 'mild') {
        jokes.push(`• **${d.title}**: ${d.mildJoke}`);
      } else if (level === 'medium') {
        jokes.push(`• **${d.title}**: ${d.mediumJoke}`);
      } else {
        jokes.push(`• **${d.title}**: ${d.savageJoke}`);
      }
    }
  }

  const roastContent = `### 🔥 The Comedy Roast (${level.toUpperCase()} Mode)

${jokes.join('\n\n')}

${
  level === 'savage'
    ? `**Final diagnosis:** This code looks like it was generated by an AI that was trained exclusively on junior developer PRs submitted on a Friday at 4:59 PM.`
    : `**Closing thought:** Don't worry, even senior devs wrote code like this before their first coffee.`
}
`;

  const critique = `### 💡 Technical Assessment & Recommendations
1. **Scope & Maintainability**: Break complex procedures into small, single-responsibility helper functions.
2. **Type Safety & Reliability**: Replace any dynamic or untyped constructs with explicit types, strict null checks, and robust validation.
3. **Error Handling**: Never discard errors silently. Always log structured context or bubble up errors gracefully.
4. **Naming & Readability**: Replace abbreviations (\`tmp\`, \`data\`, \`res\`) with domain-specific, self-documenting identifiers.`;

  const suggestedCode = `// 🚀 Cleaned & Refactored Version
// 1. Meaningful naming
// 2. Strict type safety & proper error handling
export async function executeCleanOperation(): Promise<void> {
  try {
    // Perform focused, single-purpose logic here
    const processedRecord = await validateAndProcess();
    return processedRecord;
  } catch (error) {
    console.error('Operation failed with context:', error);
    throw error;
  }
}`;

  const punchline =
    level === 'savage'
      ? "Git blame is not an accusation, but in this case, it might be admissible in court."
      : level === 'medium'
      ? "There are 10 types of people: those who write clean code, and whoever wrote this."
      : "Remember: code is like humor. When you have to explain it, it's bad!";

  return {
    id: `roast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    fileName: req.fileName,
    languageId: req.languageId,
    roastLevel: level,
    score,
    verdict,
    worstCrime,
    roastContent,
    critique,
    suggestedCode,
    punchline,
    providerUsed: 'offline-comedian',
    modelUsed: 'heuristic-roaster-v1',
  };
}
