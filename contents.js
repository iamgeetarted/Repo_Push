chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillRepo") {
    const nameField = document.getElementById("repository_name");
    const descField = document.getElementById("repository_description");
    const visibility = document.querySelector(`input[name="repository[visibility]"][value="${msg.visibility}"]`);
    
    if(nameField) nameField.value = msg.name;
    if(descField) descField.value = msg.description;
    if(visibility) visibility.checked = true;

    if(msg.autoPublish) {
      const submitBtn = document.querySelector("button.first-in-line");
      submitBtn?.click();
    }

    sendResponse({ success: true });
  }
});
