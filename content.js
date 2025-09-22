chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillRepo") {
    const nameField = document.getElementById("repository_name");
    const descField = document.getElementById("repository_description");
    const visibility = document.querySelector(`input[name="repository[visibility]"][value="${msg.visibility}"]`);

    if (nameField) nameField.value = msg.name || nameField.value;
    if (descField) descField.value = msg.description || descField.value;
    if (visibility) visibility.checked = true;

    // README checkbox
    if (msg.addReadme) {
      const readmeCheckbox = document.querySelector('input[name="repository[auto_init]"]') || document.querySelector('#repository_auto_init');
      if (readmeCheckbox) {
        readmeCheckbox.checked = true;
        readmeCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // gitignore template - best-effort: find dropdown and choose matching text
    if (msg.addGitignore && msg.gitignoreTemplate) {
      // GitHub uses a details/summary that opens a list; try to open and select
      const gitignoreBtn = Array.from(document.querySelectorAll('summary')).find(s => /gitignore/i.test(s.textContent || ''));
      if (gitignoreBtn) {
        gitignoreBtn.click();
        setTimeout(() => {
          const option = Array.from(document.querySelectorAll('label')).find(l => (l.textContent || '').toLowerCase().includes((msg.gitignoreTemplate || '').toLowerCase()));
          option?.click();
        }, 200);
      }
    }

    // license template - best-effort similar approach
    if (msg.addLicense && msg.licenseTemplate) {
      const licenseBtn = Array.from(document.querySelectorAll('summary')).find(s => /license/i.test(s.textContent || ''));
      if (licenseBtn) {
        licenseBtn.click();
        setTimeout(() => {
          const option = Array.from(document.querySelectorAll('label')).find(l => (l.textContent || '').toLowerCase().includes((msg.licenseTemplate || '').toLowerCase()));
          option?.click();
        }, 200);
      }
    }

    // Co-pilot text insertion: if copilotText present, append to description and try to insert into README field later
    if (msg.copilotText) {
      if (descField) {
        descField.value = (descField.value ? descField.value + '\n' : '') + msg.copilotText;
      }
      // If README textarea exists after expanding options, attempt to set it after a short delay
      setTimeout(() => {
        const readmeTextarea = document.querySelector('textarea[name="repository[readme]"]') || document.querySelector('textarea#readme');
        if (readmeTextarea) {
          readmeTextarea.value = (readmeTextarea.value ? readmeTextarea.value + '\n' : '') + msg.copilotText;
        }
      }, 500);
    }

    // Auto publish (click Create repository)
    if (msg.autoPublish) {
      setTimeout(() => {
        const submitBtn = document.querySelector("button.first-in-line") || Array.from(document.querySelectorAll('button')).find(b => /create repository/i.test(b.textContent || ''));
        submitBtn?.click();
      }, 700);
    }

    sendResponse({ success: true });
  }
});

