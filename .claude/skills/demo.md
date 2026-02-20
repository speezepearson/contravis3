# Demo Skill

Create a visual demo document showcasing UI changes using `rodney` (headless Chrome automation) and `showboat` (executable demo document builder).

## When to use

Use this skill when creating a pull request that modifies the user interface. Trigger when any of these files are changed:

- `src/App.tsx`
- `src/CommandPane.tsx`
- `src/SearchableDropdown.tsx`
- `src/SearchableDropdown.css`
- `src/renderer.ts`
- `src/index.css`
- `src/main.tsx`

## Instructions

### 1. Determine the demo directory name

Choose a short kebab-case name describing the UI change (e.g. `drag-reorder`, `export-button`, `theme-update`). The demo will live at `demos/<name>/`.

```bash
mkdir -p demos/<name>
```

### 2. Build the app and start the dev server

```bash
npm run build
npm run dev -- --port 5199 &
DEV_PID=$!
# wait for the server to be ready
sleep 3
```

### 3. Start the headless browser

```bash
uvx rodney start --local
uvx rodney open http://localhost:5199
uvx rodney waitload
uvx rodney waitstable
```

### 4. Initialize the showboat demo document

```bash
uvx showboat init demos/<name>/demo.md "<Title Describing the Change>"
```

### 5. Add an introductory note

Use `showboat note` to describe what the PR changes and why it matters.

```bash
uvx showboat note demos/<name>/demo.md "Brief description of what changed and why."
```

### 6. Capture the UI walkthrough

Walk through the change step by step. For each step:

1. **Add a note** explaining what the user is about to see:
   ```bash
   uvx showboat note demos/<name>/demo.md "## Step N: Description"
   ```

2. **Interact with the app** using rodney to demonstrate the change. Load example dances, click buttons, edit fields, etc. Use `rodney wait`, `rodney waitstable`, and `rodney sleep` as needed between interactions.

3. **Screenshot the result** and add it to the demo:
   ```bash
   uvx rodney screenshot demos/<name>/screenshot-N.png
   uvx showboat image demos/<name>/demo.md "demos/<name>/screenshot-N.png"
   ```

Repeat for each meaningful state you want to showcase. Aim for 3-6 screenshots that tell the story of the change.

### 7. Run verification commands (optional but encouraged)

If relevant, capture test or build output to prove nothing is broken:

```bash
uvx showboat exec demos/<name>/demo.md bash "npx vitest run 2>&1 | tail -8"
uvx showboat exec demos/<name>/demo.md bash "npx tsc --noEmit 2>&1 | tail -3"
```

### 8. Clean up

```bash
uvx rodney stop
kill $DEV_PID 2>/dev/null
```

### 9. Commit the demo

Stage and commit the entire `demos/<name>/` directory along with the rest of the PR changes.

## Tips

- Use `uvx rodney screenshot-el <selector> <file>` to capture a specific element instead of the full page.
- Use `uvx rodney js <expression>` to manipulate app state (e.g. load a specific dance, set a beat position).
- Use `uvx rodney click <selector>` and `uvx rodney input <selector> <text>` to interact with forms.
- Use `uvx showboat pop demos/<name>/demo.md` to remove a bad entry and redo it.
- Use `uvx showboat verify demos/<name>/demo.md` at the end to confirm all exec blocks still reproduce.
- The dev server port 5199 is used to avoid conflicts with other running servers.
