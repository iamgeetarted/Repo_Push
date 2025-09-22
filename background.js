function generateLoremIpsum(wordsCount) {
  const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(" ");
  let result = [];
  for (let i = 0; i < wordsCount; i++) {
    result.push(words[Math.floor(Math.random() * words.length)]);
  }
  return result.join(" ");
}

let loopActive = false;

async function callOpenAI(prompt, apiKey) {
  if (!apiKey) throw new Error('No OpenAI API key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content;
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "startLoop") {
    if (loopActive) return; // already running
    loopActive = true;

    const repo = msg.repo || {};
    const options = msg.options || {};
    const loops = options.loops || 1;
    const autoPublish = !!options.autoPublish;
    const loadTimeout = Number(options.loadTimeout) || 10;
    const retries = Number(options.retries) || 1;
    const closeTab = !!options.closeTab;

    // Create or reuse a single tab for the whole loop
    let workingTab = null;
    try {
      const created = await chrome.tabs.create({ url: 'about:blank' });
      workingTab = created;
    } catch (e) {
      console.error('Failed to create working tab:', e);
    }

    for (let i = 0; i < loops; i++) {
      if (!loopActive) break;

      let attempt = 0;
      let success = false;

      while (attempt <= retries && !success && loopActive) {
        attempt++;
        try {
          // If OpenAI is requested, generate repo name/description per iteration
          let dynamicName = repo.name;
          let dynamicDesc = repo.description;
          if ((options.useOpenAI || options.copilotText) && loopActive) {
            try {
              const stored = await chrome.storage.local.get('openaiKey');
              const apiKey = stored && stored.openaiKey;
              const promptParts = [];
              if (options.copilotText) promptParts.push(`Base prompt: ${options.copilotText}`);
              promptParts.push('Generate a JSON object with keys "name" (short repo name) and "description" (one-line description).');
              promptParts.push('Return ONLY valid JSON.');
              const prompt = promptParts.join('\n');
              const response = await callOpenAI(prompt, apiKey);
              // Try to parse JSON out of the response
              const jsonMatch = response && response.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                dynamicName = parsed.name || dynamicName || generateLoremIpsum(2);
                dynamicDesc = parsed.description || dynamicDesc || generateLoremIpsum(6);
              }
            } catch (e) {
              console.error('OpenAI generation failed, falling back:', e);
              dynamicName = dynamicName || generateLoremIpsum(2);
              dynamicDesc = dynamicDesc || generateLoremIpsum(6);
            }
          }
          // reuse workingTab
          let tabId;
          if (!workingTab || !workingTab.id) {
            const created = await chrome.tabs.create({ url: 'https://github.com/new' });
            tabId = created.id;
            workingTab = created;
          } else {
            tabId = workingTab.id;
            await chrome.tabs.update(tabId, { url: 'https://github.com/new' });
          }

          // Wait for load
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(listener);
              reject(new Error('Tab load timed out'));
            }, loadTimeout * 1000);

            function listener(updatedTabId, info) {
              if (updatedTabId === tabId && info.status === 'complete') {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            }

            chrome.tabs.onUpdated.addListener(listener);
          });

          // Send fill message (use dynamicName/dynamicDesc when available)
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: 'fillRepo', name: dynamicName || repo.name || generateLoremIpsum(2), description: dynamicDesc || repo.description || generateLoremIpsum(6), visibility: repo.visibility || 'public', autoPublish, addReadme: options.addReadme, addGitignore: options.addGitignore, gitignoreTemplate: options.gitignoreTemplate, addLicense: options.addLicense, licenseTemplate: options.licenseTemplate, copilotText: options.copilotText }, (resp) => {
              const err = chrome.runtime.lastError;
              if (err) return reject(err);
              resolve(resp);
            });
          });

          // Collect metadata for this run
          const meta = { name: dynamicName || repo.name, description: dynamicDesc || repo.description, visibility: repo.visibility || 'public', timestamp: Date.now() };
          // send to popup listeners
          chrome.runtime.sendMessage({ action: 'metadata', data: meta });

          // Optionally save immediately to downloads if requested
          if (options.saveLoc === 'downloads') {
            try {
              const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              await chrome.downloads.download({ url, filename: `repo-metadata-${Date.now()}.json` });
              URL.revokeObjectURL(url);
            } catch (e) { /* ignore download errors */ }
          } else if (options.saveLoc === 'storage') {
            // store incrementally in local storage
            try {
              const data = await chrome.storage.local.get('generatedMetadata');
              const arr = data.generatedMetadata || [];
              arr.push(meta);
              await chrome.storage.local.set({ generatedMetadata: arr });
            } catch (e) { /* ignore storage errors */ }
          }

          chrome.runtime.sendMessage({ action: "incrementRun" });
          chrome.runtime.sendMessage({ action: "status", status: `Run ${i+1} succeeded` });
          success = true;
        } catch (e) {
          console.error('loop attempt failed:', e);
          chrome.runtime.sendMessage({ action: "status", status: `Run ${i+1} failed: ${e.message || e}` });
          if (attempt > retries) {
            // give up this iteration
            break;
          }
          // small backoff before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // brief pause between loops unless user stopped
      if (loopActive) await new Promise(r => setTimeout(r, 500));
    }

    loopActive = false;
  } else if (msg.action === "stopLoop") {
    loopActive = false;
  } else if (msg.action === "openFill") {
    const repo = msg.repo || {};
    try {
      // Open a new tab to the new-repo page
      const created = await chrome.tabs.create({ url: 'https://github.com/new' });
      const tabId = created.id;

      // Wait for the tab to complete loading (or time out after 10s)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error('Tab load timed out'));
        }, 10000);

        function listener(updatedTabId, info) {
          if (updatedTabId === tabId && info.status === 'complete') {
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        }

        chrome.tabs.onUpdated.addListener(listener);
      });

      // Send repo data to the content script in that tab
      await chrome.tabs.sendMessage(tabId, { action: 'fillRepo', name: repo.name, description: repo.description, visibility: repo.visibility, autoPublish: false, addReadme: options?.addReadme, addGitignore: options?.addGitignore, gitignoreTemplate: options?.gitignoreTemplate, addLicense: options?.addLicense, licenseTemplate: options?.licenseTemplate, copilotText: options?.copilotText });

      // Collect metadata and optionally save
      const meta = { name: repo.name, description: repo.description, visibility: repo.visibility, timestamp: Date.now() };
      chrome.runtime.sendMessage({ action: 'metadata', data: meta });
      if (options?.saveLoc === 'storage') {
        const data = await chrome.storage.local.get('generatedMetadata');
        const arr = data.generatedMetadata || [];
        arr.push(meta);
        await chrome.storage.local.set({ generatedMetadata: arr });
      } else if (options?.saveLoc === 'downloads') {
        try {
          const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          await chrome.downloads.download({ url, filename: `repo-metadata-${Date.now()}.json` });
          URL.revokeObjectURL(url);
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.error('openFill failed:', e);
    }
  }
});
