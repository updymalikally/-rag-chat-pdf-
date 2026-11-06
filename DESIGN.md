# Design and UX Specification

## Direction

Treat the app as a calm reading and research tool. Keep documents and their status easy to scan; let the conversation and source pages carry the main interaction. Use the existing shadcn-style component patterns and semantic theme tokens. Avoid decorative dashboards and unnecessary motion.

## Visual system

- **Typography:** Inter, loaded through `next/font`; use the existing sans-serif stack. Use clear hierarchy: page/document title, section heading, body, metadata.
- **Color:** use CSS variables in `app/globals.css` through Tailwind semantic tokens (`background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `primary`, `primary-foreground`). Primary is the existing rose accent. Success/warning/error use restrained status colors with text labels, not color alone.
- **Spacing:** use Tailwind's 4px-based spacing scale. Standard card padding is 16–20px; use 16–24px gaps; keep text columns readable and filenames truncatable with an accessible title.
- **Surfaces:** rounded cards with thin borders. Keep elevation subtle. Maintain contrast in both light and dark themes.
- **Brand:** shared mark in the site header and browser icon. Use one reusable component; do not recreate logo artwork inline in pages.

## Layout and navigation

- **Home:** sticky header with brand and primary upload action; responsive two-column desktop layout with upload/documents as the main column and concise help/status panels alongside. Stack in reading order on narrow screens.
- **Chat:** sticky header with back-to-documents navigation, document name, and theme control. Keep the conversation scrollable and the composer visible at the bottom. Place document metadata in a compact side panel on wide screens and before chat on narrow screens.
- Prefer links for navigation and buttons for actions. Every icon-only action has an accessible name.

## Reusable components

- `Button`, `Card`, `Badge`, `Textarea`, and `Progress` from `components/ui` are the base primitives.
- `BrandMark` is the single reusable brand symbol.
- `UploadDropzone` owns drag/drop, file selection, validation feedback, and transfer/processing progress.
- `DocumentList` and `StatusBadge` present document state consistently.
- `ChatWindow` owns conversation state and streaming; `MessageBubble` owns role styling, waiting state, and citations.
- Use semantic theme variables. Avoid hard-coded color values except for the brand asset and intentional status colors.

## Forms and interactions

- Make the upload target clickable via a visible button and support drag/drop. Communicate supported formats, maximum size, and one-at-a-time constraints before selection.
- Show a compact dark **Upload progress** section with a determinate shadcn-style bar, weighted percentage, filename, format, and current stage. Transfer percentage uses actual file bytes; extraction and chunking report their measured completion boundaries; Pinecone's integrated embedding/indexing reports successful chunk batches. Keep 100% for after the final MongoDB completion write.
- Allow an active upload to be cancelled. Show failed and cancelled outcomes with distinct readable labels.
- Disable duplicate upload/chat submissions while a request is active. Preserve clear recovery after failure.
- In chat, Enter sends and Shift+Enter inserts a line. Keep focus in the composer after the response.
- Distinguish a grounded refusal from a network/provider error. Show page sources only for an answer that uses document context.

## Loading, empty, and error states

- Empty document list: explain that uploaded documents will appear there.
- Empty chat: name the selected document and give one example question.
- Upload validation: concise error near the action and toast notification.
- Upload processing: visible file name, file size, phase label, and progress indicator.
- Chat waiting: subtle skeleton and “Generating answer…” label.
- Failed processing/API: readable text with a next step; never rely on color alone.

## Motion and responsive behavior

- Use short transitions for progress and hover/focus changes. Honor `prefers-reduced-motion` (already set globally).
- Avoid layout shifts; keep composer and status panel dimensions stable while requests run.
- At small widths, stack panels, preserve 44px-class touch targets where practical, prevent horizontal scrolling, and truncate long file names without hiding their full accessible label.

## Accessibility

- Use landmarks, ordered headings, semantic buttons/links, visible keyboard focus, and meaningful labels.
- Progress exposes `role="progressbar"`, min/max/current value and a descriptive label. Indeterminate progress omits the current numeric value. Source labels identify PDF pages, PowerPoint slides, or document-level references.
- Announce upload/chat status changes politely; use alert semantics for failures.
- Maintain WCAG AA contrast for text and controls; provide text labels for status colors and citation page numbers.
- Do not communicate source attribution by color alone.
