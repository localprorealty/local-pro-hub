# Standing Rule: AI-Generated Text in Fixed-Size Visual Containers

## Rule Statement
Any new template or UI surface that renders AI-generated text into a fixed-size visual container MUST, at build time, adhere to the following four engineering and design requirements:

1. **Measure Real Capacity at Build Time**:
   - Measure the container's real character and word capacity from its actual CSS dimensions (width, height, padding, gap), font size, and line height (not an estimate).
   - Account for sibling elements in the layout (headers, badges, stat bars, collages, footers) that share the same vertical space.

2. **Constrain the AI Prompt to Match Container Capacity**:
   - Set the corresponding AI generation and refinement prompt's target length to match that measured capacity with an explicit word/character budget (e.g. "Strict maximum 90–110 characters, exactly 1 sentence").
   - **Never** leave AI text generation length-unconstrained when rendering into a fixed-height visual slot or print/export layout.

3. **Add a CSS-Level Safety Net as a Backstop**:
   - Every visual container rendering AI or user-edited text in a fixed template must include a CSS-level safety net:
     - `overflow-hidden` on the bounding container
     - `line-clamp-{N}` on text elements
     - Graceful truncation (`text-ellipsis`)
   - This prevents text from blowing out the page layout or pushing critical sibling elements (footers, contact cards, disclaimer logos) off-screen.

4. **Never Truncate by Raw Character Count**:
   - **Never** use crude string slicing like `text.slice(0, 600)` or `text.slice(0, length / 2)`.
   - Raw character-index slicing cuts words in half (e.g., leaving fragmented words like "spaci" or "beautif") and severs sentences abruptly.
   - Always rely on CSS `line-clamp`, or if algorithmic splitting is strictly required (such as dividing copy across columns or paragraphs), split at natural sentence boundaries (`[.!?]\s+`) or word whitespace boundaries.

5. **Refinements Must Never Anchor to Input Length**:
   - When refining, rewriting, or regenerating text (via user instruction or "Regenerate this page"), the prompt MUST explicitly instruct the LLM to target the destination container's measured capacity and **never anchor to or preserve the length of the input content**.
   - Because existing text may be an unconstrained MLS copy (~1,000 chars) or an expansive resume, refine prompts must explicitly command the model to condense, trim, or summarize down to the container's word/character budget.

---

## Agent Free-Editing Guarantee
This rule does **NOT** restrict agent-edited text in form inputs, textareas, or refinement panels:
- The CSS safety net (Requirement 3) applies equally to both AI-generated and agent-typed copy so that manual edits never break visual layouts or exports.
- Agents remain completely free to type text of any length in their edit panels without arbitrary input restrictions.

---

## Catalog of Governed Marketing Templates

| Template File | Visual Slot | CSS Constraints | Max Practical Capacity | Target AI Prompt Budget | Safety Net Applied |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ListingFlyerTemplate.tsx` | Property Description | 816×1056 page; ~220px slot; 14px text / 22.75px line-height | ~450–550 chars (5–6 lines) | 450–550 chars (~70–85 words, 1 paragraph) | `flex items-center justify-center overflow-hidden`, `line-clamp-6 text-ellipsis` |
| `BookPropertyDetailsPage.tsx` | Details Copy (Page 3) | 900×1200 page; 436px wide column; max 380px text height | ~600–750 chars across 2 paragraphs | 600–750 chars total (~45–55 words per paragraph, 2 paragraphs separated by `\n\n`) | `splitIntoTwoParagraphs` (sentence-aware midpoint split), `max-h-[380px] overflow-hidden`, `line-clamp-6 text-ellipsis` |
| `BookNeighborhoodPage.tsx` | Neighborhood Guide (Page 2) | 900×1200 page; 732px net text height across 9 fields | Intro: ~140 chars; 5 sections: ~90–110 chars each (~70px each) | Intro: max 140 chars; 5 sections: exactly 1 sentence, 90–110 chars each; Boundaries/Nearby: max 80 chars | `max-h-[780px] overflow-hidden`, `line-clamp-3` (intro), `line-clamp-2` (boundaries, nearby, 5 sections) |
| `BookAgentBioPage.tsx` | Agent Bio (Page 5) | 900×1200 page; 508px wide text column; max 480px height | ~1,200 chars max | 350–500 chars (3–4 sentences, ~50–75 words) | `line-clamp-12 max-h-[480px] overflow-hidden text-ellipsis` |

---

## Reference Requirement
Whenever a new marketing surface, print canvas, social graphic, or visual export template is created or modified, reference this rule file (`docs/ai_text_template_rule.md`) to verify that the container is measured and constrained before shipping.
