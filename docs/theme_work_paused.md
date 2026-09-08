# Theme Work Paused & Resumption Guide

**Date Paused:** September 8, 2026

---

## 1. Overview & Context

All theme/dark-light mode work has been paused and cleanly reverted via `git revert` on the `features` branch. This preserves the full development history while restoring the app to its exact pre-theme state (as of commit `a6469bc`).

* **Branch Strategy Note**: This branch (`features`) is preserved as-is with all theme development and revert code in its commit history. Active work continues on a new branch `features-new` created from `master` after this revert is merged.

---

## 2. Reverted Commits & Actions

The three theme-related commits were reverted in reverse chronological order:

| Original Commit | Original Description | Revert Commit | Notes |
| :--- | :--- | :--- | :--- |
| `7354eff` | `feat(theme): apply warm alabaster light palette, restore original dark tokens, and consolidate toggle into root AuthenticatedLayout` | `a3dd08a` | Reverted palette changes and `AuthenticatedLayout` wrapper |
| `0c465bc` | `fix(theme): default back to dark, fix invisible text on profile/inputs, fix auth pages` | `48bc907` | Reverted input/profile color changes and auth page tokens |
| `bd45853` | `feat(theme): implement light/dark theme toggle with light default and anti-flicker` | `0d92c21` | Reverted initial theme provider, toggle component, and anti-flicker script |

All non-theme features (commit `a6469bc` and earlier) were fully preserved and validated:
- Header Listing ID badge
- MLS disclaimer banner on RETS/PDF-imported listings
- Freely editable AI-generated text fields (description, captions, script review)
- AI description generation model `openai/gpt-oss-120b` (from `36794d9`)
- Initial-load orange incomplete-field warning icon in NTREIS form sidebar

---

## 3. Approved Color Palette Table for Future Resumption

When theme work resumes, do NOT use stark white (`#ffffff`) or stark black (`#000000`). Use the approved side-by-side palette below:

| Token / CSS Variable | Dark Theme (Original Verified) | Light Theme (Approved Warm Alabaster) | Usage / Component Mapping |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` / `--background` | `#0a0a0a` | `#fbf7f4` *(or `#FAF3E1` candidate)* | Main viewport background canvas |
| `--color-surface` / `--card` | `#1a1a1a` | `#ffffff` *(Crisp elevated white on cream)* | Main cards, modals, dropdown menus |
| `--color-surface-2` / `--muted` | `#141414` | `#f2eee9` *(Warm Ash tint)* | Nested panels, table headers, inactive pills |
| `--color-surface-3` / `--secondary` | `#222222` | `#e8e3dc` *(Deeper Ash)* | Card hover states, active tab pills, popovers |
| `--color-border` / `--border` | `#2a2a2a` | `#e4dfd7` *(Soft Ash border)* | Dividers, input outlines, table cell borders |
| `--color-text` / `--foreground` | `#ffffff` | `#1c1815` *(Espresso Charcoal — 15.6:1 AAA)* | Headings, body copy, input text |
| `--color-text-secondary` | `#888888` | `#62584f` *(LocalPro Signature Taupe — 5.3:1 AA)* | Subtitles, helper text, inactive nav items |
| `--color-text-tertiary` | `#555555` | `#82776f` *(Muted Ash Taupe — 4.52:1 AA)* | Input placeholders, micro-metadata, bullet dots |
| `--color-gold` / `--primary` | `#CFB87C` | `#b3974d` *(Calibrated for light backgrounds)* | Primary CTA buttons, active accents, focus rings |
| `--color-gold-hover` | `#dcc487` | `#9c823e` | Primary CTA hover state |
| `--color-gold-dim` | `rgba(207, 184, 124, 0.13)` | `rgba(179, 151, 77, 0.12)` | Badge backgrounds, selected row highlights |
| `--color-gold-border` | `rgba(207, 184, 124, 0.33)` | `rgba(179, 151, 77, 0.35)` | Accent borders, active badge outlines |
| `--primary-foreground` | `#000000` | `#000000` | High-contrast dark text on gold button |

*Alternative light base to consider*: `#FAF3E1` was suggested as an alternative warm cream candidate alongside `#fbf7f4`.

---

## 4. Real Bugs Discovered & Root Causes

To prevent repeating the same issues when resuming theme development, keep these two critical bugs documented:

### Bug 1: Invisible Text on Light Backgrounds (Data-Visibility Bug)
* **Symptom**: On `/profile` (and other pages), fields like Full Name, Phone, MLS ID, Bio, Agent License, and HeyGen API Key appeared completely blank in light mode, leading users to believe their data was lost or deleted.
* **Root Cause**: The background tokens were switched to light mode (`#ffffff`), but input styling in `UserProfileForm.tsx`, `ProfilePage.tsx`, and `AdminUserRoster.tsx` retained hardcoded `text-white` or `text-[var(--color-white)]` rather than using responsive semantic tokens (`text-[var(--color-text)]` or `text-foreground`).
* **Prevention**: Whenever background variables swap, all text color classes must be semantic tokens (`text-[var(--color-text)]`), and the base `Input` component (`frontend/src/components/ui/input.tsx`) must default to `text-foreground`.

### Bug 2: Toggle Placement Inconsistency & Layout Overlaps
* **Symptom**: The theme toggle was manually added per-shell and per-page (`MissionShell`, `AdminShell`, `ListingMissionHeader`, `ListingDetailPage`), causing it to disappear on sub-pages with custom headers (such as `PhotographyPage` or `ListingMissionLayout`), and when fixed positioning was tested, it collided with the top-right `<ProfileMenu />`.
* **Root Cause**: Fragmented placement across multiple header wrappers instead of a unified layout component, combined with fixed position collisions with relative header children.
* **Prevention**: Use a single root authenticated layout component (e.g. `AuthenticatedLayout`) wrapping all authenticated routes, with explicit dedicated header coordinates and reserved margin/padding so it never collides with profile avatars or page action buttons.
