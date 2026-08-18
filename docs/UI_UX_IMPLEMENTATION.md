# UI/UX implementation guide

The frontend uses a small shadcn-style component layer on Tailwind CSS v4. New screens should use semantic design tokens and shared components instead of adding page-specific colors, spacing, or interaction patterns.

## Theme model

The application supports light, dark, and system preferences. `ThemeProvider` stores the choice under `ultrapc-theme`, follows operating-system changes while the preference is `system`, and applies the resolved `.dark` class to the document root. `public/theme-init.js` applies the stored theme before the application bundle loads, preventing a light-theme flash and remaining compatible with the production content-security policy.

Use semantic utilities such as:

- `bg-background`, `text-foreground` for the application canvas
- `bg-card`, `text-card-foreground`, `border-border` for content surfaces
- `text-muted-foreground`, `bg-muted` for supporting content
- `bg-primary`, `text-primary-foreground` for the main action
- `bg-destructive`, `text-destructive-foreground` for irreversible actions
- `ring-ring` for keyboard focus

Do not add new light-only `bg-white`, `text-slate-*`, or status-color combinations. Existing legacy utilities have a temporary dark compatibility layer in `resources/css/app.css`; new code should use semantic tokens directly.

## Shared components

The shared layer is under `resources/js/components` and `resources/js/components/ui`:

- `AppShell` provides permission-filtered desktop navigation, an accessible mobile drawer, utility actions, skip navigation, and the content landmark.
- `Breadcrumbs` derives route-aware breadcrumbs and supports display-label overrides for dynamic records.
- `PageHeader` and `SectionHeader` establish the heading hierarchy and responsive action layout.
- `FormField` connects a label, help text, validation error, and form control through stable IDs and ARIA attributes.
- `DataTable` provides a caption, column scopes, responsive overflow, row interaction styling, and a standardized empty state.
- `PageSkeleton` and `TableSkeleton` are the default asynchronous loading states.
- `EmptyState`, `ErrorState`, and `ApiErrorAlert` cover honest no-data and failure states.
- `ConfirmDialog` is required for destructive operations and includes safe initial focus, a focus loop, Escape/backdrop handling, pending protection, and focus restoration.
- UI primitives (`Button`, `Card`, `Input`, `Select`, `Textarea`, `Label`, `Badge`, `Alert`, and `Skeleton`) follow shadcn composition conventions without adding a runtime UI dependency.

## Responsive behavior

- Below `lg`, primary navigation is a modal drawer opened from the utility header.
- At `lg` and above, navigation becomes a persistent 272px sidebar.
- Page padding is 16px on phones, 24px on tablets, and 32px on larger workspaces.
- Header actions wrap below the title on narrow screens.
- Form grids collapse to one column and tables retain semantic markup inside horizontal overflow containers.
- Interactive controls have a minimum 40px height; high-frequency mobile navigation controls are 44px.

## Accessibility and interaction rules

1. Every page has one visible `h1`; sections begin at `h2`.
2. Every form control has an accessible label. Placeholder text is never the only label.
3. Validation errors use `role="alert"`, `aria-invalid`, and `aria-describedby`.
4. Icon-only actions have an `aria-label`; decorative icons are hidden from assistive technology.
5. Keyboard focus must remain visible. Modal surfaces trap focus and restore it to their trigger.
6. Status always includes readable text; color is supplemental.
7. Native selects remain native so keyboard, mobile, and assistive-technology behavior stays reliable.
8. Use a confirmation dialog only for irreversible or materially destructive operations. Reversible local edits, such as removing an unsaved invoice line, do not need one.

## Verification checklist

Run the frontend checks before merging:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Also verify the admin and client shells manually at 320px, 768px, 1024px, and a wide desktop viewport in both themes. Test keyboard-only navigation through the mobile menu, search palette, notifications, forms, pagination, and confirmation dialogs.
