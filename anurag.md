PR title
Add copy roast button and per-run roast level selection

Description
This PR adds two features to the Code Roaster VS Code extension:

Copy Roast: Copy the generated roast to the clipboard directly from the results panel.
Choose Roast Level: Select Mild, Medium, or Savage for each run using the new Roast Code (Choose Level) command. It roasts the selected code, or the entire file if there’s no selection.
Roast output is HTML-escaped before display in the webview. README instructions and tests have also been updated.