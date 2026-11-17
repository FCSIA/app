# Navigation customization

Settings → Navigation (`/profile?section=navigation`) offers separate desktop
sidebar and mobile bottom-bar editors. Preferences belong to the signed-in
account and sync through the self-profile query.

- Desktop: reorder checked destinations; unchecked destinations appear in a
  collapsible More section. Home, Search, and Profile & Settings remain fixed.
  Reset restores the original Primary/Social/Account grouping.
- Mobile: choose four or five destinations between fixed Home and More controls.
  Unchecked destinations remain in the existing More drawer. Reset restores the
  role-appropriate default. Existing saved mobile layouts remain compatible.
- Drag handles support mouse, touch, and keyboard (Space, arrows, Space).
  Cancel discards edits; changes and Reset take effect only after Save.
- Role and seasonal availability are applied when rendering, independently of
  saved preferences. Desktop edits retain temporarily unavailable destinations.
  Preferences do not grant access to routes or data.

The editor reuses the existing Fluid Dialog/CheckboxGroup/Button composition
and ReUI Sortable. Sidebar overflow uses the existing Fluid SidebarGroup API;
shared primitive APIs and geometry are unchanged. Current documentation and
Radix registry sources consulted: [Sidebar](https://www.fluidfunctionalism.com/docs/sidebar),
[CheckboxGroup](https://www.fluidfunctionalism.com/docs/checkbox-group),
[Dialog](https://www.fluidfunctionalism.com/docs/dialog), and their `/r/*.json`
sources, alongside the installed adapters.

Verification covers layout normalization, authenticated preference ownership,
independent desktop/mobile storage, reset, and invalid/unauthenticated writes.
On 2026-11-17, the actual shared editor passed isolated Chromium interaction
checks at 1440px and 390px, including dark mode and reduced motion: selection
limits, Save, Cancel, Reset, keyboard reordering, failed-save recovery, Escape,
and a fitting dialog, with no page errors. The fixture uses an in-memory save
callback; authenticated full-app interactions, physical devices, and
design-owner visual approval remain pending. Web/shared tests, navigation
ownership tests, backend/web typechecks, web lint, and production build passed
on the combined main integration. The optional schema field and
mutation require a normal backend deployment before using the desktop editor;
no shared deployment is selected or modified by this implementation.
