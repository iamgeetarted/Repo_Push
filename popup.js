function generateLoremIpsum(wordsCount) {
  const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(" ");
  let result = [];
  for (let i = 0; i < wordsCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }
  return result.join(" ");
}

let timerInterval;
let startTime;
let runCount = 0;

document.getElementById("auto-generate").addEventListener("click", () => {
  document.getElementById("repo-name").value = generateLoremIpsum(2);
  document.getElementById("repo-desc").value = generateLoremIpsum(6);
});

document.getElementById("start-loop").addEventListener("click", async () => {
  // Reset timer and run count
  if (timerInterval) clearInterval(timerInterval);
  startTime = performance.now();
  runCount = 0;
  document.getElementById("run-count").textContent = `Runs: ${runCount}`;

  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById("pacman-timer").textContent = `⏱️ ${elapsed.toFixed(2)}s`;
  }, 100);

  await chrome.runtime.sendMessage({ action: "startLoop" });
});

document.getElementById("stop-loop").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "stopLoop" });
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
});

// OpenAI key save/load
document.getElementById('save-openai-key').addEventListener('click', async () => {
  const key = document.getElementById('openai-key').value.trim();
  await chrome.storage.local.set({ openaiKey: key });
  alert('OpenAI key saved (stored locally).');
});

// Load saved key on popup open
(async function loadKey(){
  const data = await chrome.storage.local.get('openaiKey');
  if (data && data.openaiKey) document.getElementById('openai-key').value = data.openaiKey;
})();

document.getElementById("open-fill").addEventListener("click", async () => {
  const nameField = document.getElementById("repo-name");
  const descField = document.getElementById("repo-desc");
  const name = document.getElementById("autogen-name").checked ? generateLoremIpsum(2) : nameField.value;
  const description = document.getElementById("autogen-desc").checked ? generateLoremIpsum(6) : descField.value;
  const visibility = document.getElementById("repo-visibility").value;
  const autoPublish = document.getElementById("auto-publish").checked;
  const confirmBefore = document.getElementById("confirm-before-publish").checked;
  const loadTimeout = Number(document.getElementById("load-timeout").value) || 10;
  const retries = Number(document.getElementById("retries").value) || 1;
  const closeTab = document.getElementById("close-tab").checked;
  const addReadme = document.getElementById('add-readme').checked;
  const addGitignore = document.getElementById('add-gitignore').checked;
  const gitignoreTemplate = document.getElementById('gitignore-template').value;
  const addLicense = document.getElementById('add-license').checked;
  const licenseTemplate = document.getElementById('license-template').value;
  const copilotText = document.getElementById('copilot-text').value;
  const copilotLoop = document.getElementById('copilot-loop').checked;
  const saveLoc = document.querySelector('input[name="save-loc"]:checked')?.value || 'downloads';

  if (autoPublish && confirmBefore) {
    const ok = confirm(`Auto-publish is enabled. Proceed to open GitHub and ${autoPublish ? 'auto-publish' : 'fill'}?`);
    if (!ok) return;
  }

  document.getElementById('status').textContent = 'Status: opening tab...';

  await chrome.runtime.sendMessage({ action: "openFill", repo: { name, description, visibility }, options: { autoPublish, loadTimeout, retries, closeTab, addReadme, addGitignore, gitignoreTemplate, addLicense, licenseTemplate, copilotText, copilotLoop, saveLoc } });
});

// Loops slider wiring
const slider = document.getElementById('loops-slider');
const loopsCount = document.getElementById('loops-count');
slider.addEventListener('input', () => {
  loopsCount.textContent = slider.value;
});

// Start loop should send loop options
document.getElementById("start-loop").addEventListener("click", async () => {
  if (timerInterval) clearInterval(timerInterval);
  startTime = performance.now();
  runCount = 0;
  document.getElementById("run-count").textContent = `Runs: ${runCount}`;

  timerInterval = setInterval(() => {
    const elapsed = (performance.now() - startTime) / 1000;
    document.getElementById("pacman-timer").textContent = `⏱️ ${elapsed.toFixed(2)}s`;
  }, 100);

  const loops = Number(document.getElementById('loops-slider').value) || 1;
  const name = document.getElementById("autogen-name").checked ? generateLoremIpsum(2) : document.getElementById("repo-name").value;
  const description = document.getElementById("autogen-desc").checked ? generateLoremIpsum(6) : document.getElementById("repo-desc").value;
  const visibility = document.getElementById("repo-visibility").value;
  const autoPublish = document.getElementById("auto-publish").checked;
  const confirmBefore = document.getElementById("confirm-before-publish").checked;
  const loadTimeout = Number(document.getElementById("load-timeout").value) || 10;
  const retries = Number(document.getElementById("retries").value) || 1;
  const closeTab = document.getElementById("close-tab").checked;
  const addReadme = document.getElementById('add-readme').checked;
  const addGitignore = document.getElementById('add-gitignore').checked;
  const gitignoreTemplate = document.getElementById('gitignore-template').value;
  const addLicense = document.getElementById('add-license').checked;
  const licenseTemplate = document.getElementById('license-template').value;
  const copilotText = document.getElementById('copilot-text').value;
  const copilotLoop = document.getElementById('copilot-loop').checked;
  const saveLoc = document.querySelector('input[name="save-loc"]:checked')?.value || 'downloads';

  if (autoPublish && confirmBefore) {
    const ok = confirm(`Auto-publish is enabled. Start loop of ${loops} runs?`);
    if (!ok) return;
  }

  document.getElementById('status').textContent = `Status: running ${loops} loops`;

  await chrome.runtime.sendMessage({ action: "startLoop", repo: { name, description, visibility }, options: { loops, autoPublish, loadTimeout, retries, closeTab, addReadme, addGitignore, gitignoreTemplate, addLicense, licenseTemplate, copilotText, copilotLoop, saveLoc } });
});

// Metadata collection and export
let generatedMetadata = [];

document.getElementById('export-metadata').addEventListener('click', async () => {
  const loc = document.querySelector('input[name="save-loc"]:checked').value;
  if (loc === 'downloads') {
    const blob = new Blob([JSON.stringify(generatedMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: `repo-metadata-${Date.now()}.json`, saveAs: true });
    URL.revokeObjectURL(url);
  } else {
    await chrome.storage.local.set({ generatedMetadata });
    alert('Metadata saved to local storage');
  }
});

// Listen for metadata messages from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'metadata') {
    generatedMetadata.push(msg.data);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "incrementRun") {
    runCount++;
    document.getElementById("run-count").textContent = `Runs: ${runCount}`;
  }
  if (msg.action === "status") {
    document.getElementById('status').textContent = `Status: ${msg.status}`;
  }
});
