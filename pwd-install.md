
# 📄 `pwa-install-ux.md`

```md
# HABUKS – PWA Install UX Implementation

## Objective

Improve installation rate of the Habuks web app by:

1. Supporting the browser's default one-time install prompt.
2. Allowing users to install the app later from inside the UI.
3. Providing a soft install suggestion after user engagement.
4. Supporting fallback instructions for browsers that do not support install prompts.

Implementation should work with the existing PWA setup (manifest + service worker).

---

# 1. Current Behavior (Browser Prompt)

Browsers fire a `beforeinstallprompt` event once when a user first visits the site.

Typical behavior today:

- User visits Habuks
- Browser shows install suggestion
- If user dismisses it, it may not appear again

This means users often lose the chance to install the app.

We need to capture this event and allow it to be triggered later.

---

# 2. Capture Install Prompt

## TODO

Listen for the `beforeinstallprompt` event.

When it fires:

1. Prevent the default prompt.
2. Store the event in a variable for later use.

Example logic:

```

let deferredInstallPrompt = null

window.addEventListener("beforeinstallprompt", (event) => {
event.preventDefault()
deferredInstallPrompt = event
})

```

This allows the app to trigger installation manually later.

---

# 3. Add "Install App" Action in the UI

Users should always have a way to install the app.

## TODO

Add an **Install App** option in one of the following locations:

Preferred locations:

- More menu
- Avatar profile menu
- Settings page

Example:

More  
→ Install App

---

# 4. Install Button Behavior

## TODO

When user taps **Install App**:

```

if deferredInstallPrompt exists
show install prompt
else
show fallback instructions

```

If install succeeds:

- hide the install option
- show confirmation toast

Example message:

"Habuks installed successfully"

---

# 5. Detect Installed State

## TODO

Hide the install option when the app is already installed.

Check display mode:

```

window.matchMedia('(display-mode: standalone)')

```

If true:

- hide Install App button
- do not show install banners

---

# 6. Add Soft Install Banner (Recommended UX)

To increase install rate, show a **small suggestion banner** after the user engages with the app.

This pattern is used by:

- Twitter
- Notion
- Linear

---

## Banner Placement

Place banner:

- above bottom navigation  
OR
- below the header

Example layout:

Habuks works better as an app  
Install for faster access and offline use

[ Install ]   [ Not now ]

---

## Banner Behavior

## TODO

Show banner only after meaningful engagement.

Possible triggers:

- user logs in
- user creates first project
- second visit/session
- after generating a document

Do NOT show on first page load.

---

## Install Button

Install button triggers:

```

deferredInstallPrompt.prompt()

```

---

## Not Now Button

If user taps **Not Now**:

- hide banner
- store dismissal in local storage

Example:

```

localStorage.installPromptDismissed = true

```

---

# 7. Reminder Timing

## TODO

If user dismissed the install banner:

- do not show it again for 7 days.

Example logic:

```

lastDismissed = localStorage.installPromptDismissed

if today - lastDismissed > 7 days
show banner again

```

---

# 8. Fallback for Safari (iOS)

Safari does not support the `beforeinstallprompt` event.

Instead show manual instructions.

## TODO

If install prompt not available:

Show bottom drawer with instructions.

Example:

Title: Install Habuks

Steps:

1. Tap the Share icon in Safari
2. Choose "Add to Home Screen"
3. Tap Add

Optional:
Add illustration showing the Share icon.

---

# 9. Install Success Detection

## TODO

Listen for the install success event.

```

window.addEventListener("appinstalled", () => {
hide install UI
show success toast
})

```

---

# 10. Bottom Drawer Pattern

All install instructions should use a bottom drawer.

Drawer behavior:

- slide up from bottom
- max height 60–70% of screen
- swipe down to dismiss
- tap outside to dismiss

---

# 11. UX Rules

Install suggestions must follow these rules:

- never block the user
- always allow dismissal
- do not repeat frequently
- hide after installation
- show only after engagement

---

# 12. Expected Result

Users can install Habuks in three ways:

1. Browser's automatic install prompt
2. In-app Install button
3. Soft install banner suggestion

This increases install rate significantly compared to relying on the browser prompt alone.

---

# End Spec
```

