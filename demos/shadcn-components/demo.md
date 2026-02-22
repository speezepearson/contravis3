# Replace Custom UI Elements with shadcn Components

This PR replaces custom UI elements with shadcn/ui components and fixes the distance drag increment.

## Changes

### shadcn Combobox (replaces SearchableDropdown)
The `InlineDropdown` component now uses shadcn's `Command` + `Popover` pattern instead of the custom `SearchableDropdown`. This provides a polished combobox with built-in fuzzy search, keyboard navigation, and check-mark indicators for the selected item. The same replacement was applied to the facing direction picker in `StepFields`.

### shadcn Select (replaces `<select>`)
The example dance loader dropdown in `CommandPane` now uses shadcn's `Select` component instead of a native `<select>`. This gives a consistent styled dropdown with proper dark theme support.

### shadcn Input (replaces `<input>`)
Text/number inputs in `InlineNumber`, `InlineText`, and `StepFields` now use the shadcn `Input` component for consistent styling.

### shadcn Checkbox (replaces `<input type="checkbox">`)
Instruction selection checkboxes now use the shadcn `Checkbox` component (Radix-based) with a check icon indicator, replacing the native checkbox. Shift-click range selection continues to work.

### Distance drag increment fix
Changed the drag step for distance fields from **0.5m** to **0.05m** in both `StepFields` and `BalanceFields`, allowing finer-grained adjustments.

## Infrastructure

- Added **Tailwind CSS v4** with `@tailwindcss/vite` plugin (layered as `tw` to avoid interfering with existing CSS)
- Defined theme variables matching the existing dark color scheme
- Added `@/` path alias for cleaner imports
- Created shadcn component files: `command`, `select`, `checkbox`, `input`, `popover`

## Verification

- `npm run build` passes
- All 185 tests pass
- `npm run lint` clean
