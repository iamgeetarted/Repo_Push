# Repo_Push

GitHub Repo Auto-Filler — a Firefox extension to automate creating GitHub repositories from the browser UI. It can open the GitHub new-repo page, fill in repository name/description/visibility, optionally initialize README/gitignore/license, and (optionally) auto-publish. The extension also supports generating unique names/descriptions per-repository with OpenAI and saving generated metadata.

This README documents installation, features, UI reference, security considerations, troubleshooting, and developer notes so you can run and extend the project.

---

## Table of contents
- Features
- Quick install (Firefox temporary load)
- UI / Controls reference
- OpenAI integration
- Automation flows
- Saving generated metadata
- Security, privacy & safety
- Troubleshooting
- Developer notes (files to edit, selectors)
- Roadmap & next steps
- License

---

## Features
- Open the GitHub "Create a new repository" page (`https://github.com/new`) and automatically fill the form fields.
- Loop automation: create many repositories automatically (single-tab loop to avoid tab spam).
- OpenAI integration (optional): generate unique repository names and descriptions per-run using your OpenAI API key.
- Options to initialize README, add .gitignore (with template), and add a license (with template) during creation.
- Auto-publish option (click Create repository) with user confirmation safeguards.
- Per-run options: retries, load timeout, number of loops (1–999).
- Metadata collection: collect generated name/description per-run and export as JSON to Downloads or save to local storage.
- UI customizations and a calm color theme for a pleasant UX.

## Quick install (development / testing)
To load the extension temporarily in Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select the `manifest.json` file from this repository folder.
3. The extension icon will appear in the toolbar (pin it if needed). Click it to open the popup.

Note: this is for development/testing only. For production you should follow Firefox extension signing and publication steps.

## UI / Controls reference
All control IDs referenced below are present in the popup UI (`popup.html`) and wired in `popup.js`.

- Logo / Title: top of the popup.
- OpenAI API Key (input `#openai-key`, button `#save-openai-key`): store your key locally (used to generate names/descriptions). Check `Use OpenAI` (`#use-openai`) to enable generation.
- Repository Name (`#repo-name`) — text input. Options:
  - Keep (`#keep-name`) — preserve current text when generating.
  - Auto-generate (`#autogen-name`) — generate lorem or OpenAI name.
- Description (`#repo-desc`) — text input. Options:
  - Keep (`#keep-desc`) — preserve current description.
  - Auto-generate (`#autogen-desc`) — generate lorem or OpenAI description.
- Visibility (`#repo-visibility`) — select `public` or `private`.
- Auto-generate (button `#auto-generate`) — quick-fill the popup fields with generated lorem text.
- Open & Fill (`#open-fill`) — opens `https://github.com/new` in a tab and fills fields for a single run.
- Start Loop (`#start-loop`) / Stop Loop (`#stop-loop`) — start or stop the automated loop. Loop options are below.

Loop / Control options:
- Loops slider (`#loops-slider`) — number of repositories to create (1–999), displayed in `#loops-count`.
- Auto-publish (`#auto-publish`) — when enabled the extension will click the Create button on GitHub.
- Confirm before publish (`#confirm-before-publish`) — prompt before proceeding if Auto-publish enabled.
- Load timeout (`#load-timeout`) — seconds to wait for the new-repo page to load before timing out.
- Retries (`#retries`) — number of retries per iteration if page load or messaging fails.
- Close tab after fill (`#close-tab`) — close the GitHub tab after filling (helps avoid tab clutter).

Repository options:
- Initialize with README (`#add-readme`) — check the checkbox that tells GitHub to initialize a repository with a README.
- Add .gitignore (`#add-gitignore`) and template input (`#gitignore-template`) — best-effort selection of a template.
- Add license (`#add-license`) and template input (`#license-template`) — best-effort selection of a license.

Co-pilot (prompt insertion):
- Co-pilot text (`#copilot-text`) — arbitrary text you want appended to description and README.
- Use prompt per loop (`#copilot-loop`) — apply the prompt to each generated repository.

Saving & metadata:
- Save generated metadata: choose Downloads or Local Storage via radio buttons (`name="save-loc"`).
- Export Metadata Now (`#export-metadata`) — export collected metadata that was generated during the session.
- While the popup is open, generated metadata is accumulated; background also stores/appends it to `chrome.storage.local` when configured.

Status & telemetry:
- Status area (`#status`) — shows current progress and per-run statuses.
- Timer & Runs (`#pacman-timer`, `#run-count`) — visual runtime information.

## OpenAI integration
If you enable OpenAI generation (`#use-openai`) and save your OpenAI API key via the popup, the extension will call the OpenAI Chat Completions API (default model `gpt-3.5-turbo`) to generate a JSON object containing `name` and `description`. The extension parses that JSON and uses the generated values for the current run.

How to use OpenAI in the extension:

1. Paste your OpenAI key into the password input and click **Save Key**.
2. Check **Use OpenAI for generation** and optionally provide a Co-pilot prompt in the Co-pilot textarea. The prompt will be included when requesting name/description generation.
3. Run a single test with Loops=1 to verify output and adjust the prompt or options.

Notes on OpenAI usage:
- The extension stores your OpenAI key in `chrome.storage.local` on your machine.
- API usage consumes tokens — monitor costs and rate limits.
- The extension attempts to parse JSON from the model response. If the model returns non-JSON text, the extension extracts the first JSON object found. If parsing fails it falls back to lorem ipsum.

## Automation flows

Single run (Open & Fill):
1. Configure fields or use Auto-generate.
2. Click **Open & Fill**. The extension opens `https://github.com/new`, waits for it to load, fills the fields (and optionally selects README/gitignore/license), and will auto-click Create if Auto-publish is enabled.

Loop run (automated batch):
1. Configure Loops (1–999) and other options (retries, timeout, close-tab, auto-publish).
2. Optionally enable OpenAI generation and provide a Co-pilot prompt for varied names/descriptions.
3. Click **Start Loop**. The extension reuses a single working tab and, for each iteration, navigates it to `https://github.com/new`, waits for load, fills fields (or auto-clicks Create), collects metadata, and continues until the configured count finishes or you click **Stop Loop**.

Important: the extension performs DOM automation on GitHub's public UI. This relies on GitHub's DOM structure and is inherently brittle — if GitHub changes their markup the extension may need selector updates.

## Saving generated metadata
- While the popup is open, generated metadata is pushed to the popup and saved in memory.
- When `saveLoc` is set to `downloads` the extension will create JSON files via the Downloads API (one per-run or aggregated via export). When set to `storage` metadata will be stored in `chrome.storage.local` under the key `generatedMetadata`.

## Security, privacy & safety
- Your OpenAI API key is stored locally via `chrome.storage.local`. Do not share the extension bundle containing your key.
- Auto-publishing many repositories can create noise and may violate GitHub usage policies or trigger rate limits. Use the confirmation step and limit the number of loops when testing.
- The extension injects and interacts with pages matching `https://github.com/new`. The extension requests host permission for `https://github.com/*` so it can programmatically open and fill pages.
- The extension uses the Downloads API to save metadata when configured.

## Troubleshooting
- Popup doesn't appear or closes immediately: open the extension console in `about:debugging` and inspect for script errors. Common cause: missing or malformed imports — the extension uses no external bundling for background/popup to improve Firefox compatibility.
- Fields not filled: GitHub changed selectors — open the page, inspect the target elements and paste the selectors or a screenshot; I can update `content.js` to match the live DOM.
- OpenAI failures: check the background console for errors (missing API key, rate limit, or invalid responses). Test with Loops=1.

## Developer notes
Files of interest:
- `manifest.json` — extension manifest (MV2 for Firefox in this project).
- `popup.html`, `popup.css`, `popup.js` — user interface and logic for the popup.
- `background.js` — background script that performs tab navigation, orchestration, OpenAI calls and metadata saving.
- `content.js` — injected content script that interacts with the GitHub new-repo form and performs DOM operations.
- `utils.js` — small helper (lorem ipsum); some helpers were inlined into popup/background for compatibility.

Selector tips:
- The content script searches for `#repository_name`, `#repository_description`, and `input[name="repository[visibility]"]` to set name, description and visibility. GitHub may use different selectors; update `content.js` accordingly if necessary.

Development & debugging (Firefox):
1. Load via `about:debugging` -> Load Temporary Add-on.
2. Use the extension's **Inspect** link to open the background console and view logs.
3. Test with Loops=1 and Close-tab disabled to watch the live behavior on `https://github.com/new`.

## Roadmap & next steps
- Add OAuth-based GitHub API integration (create repos via the API using an OAuth token) as an alternative to DOM automation — more robust but requires app registration.
- Improve OpenAI prompt engineering and (optionally) integrate function-calling for strict JSON outputs.
- Add retry/backoff strategies and rate-limit handling for OpenAI and GitHub.
- Add automated tests and CI for builds targeting MV3 (Chrome) and MV2 (Firefox), with a bundling step for MV3 service worker modules.

## License
This repository does not include a license by default. If you want to publish it, add a LICENSE file (for example MIT) and ensure any logos or trademarks used in the UI are permitted.

---

If you want, I can also produce a short quick-start video or step-by-step screenshots showing a single successful run and how to adjust prompts for better OpenAI results.
