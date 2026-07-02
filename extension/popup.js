// Target Domain - Update this to https://click2video.com when deploying to production
const APP_URL = "https://click2video.com";

document.addEventListener("DOMContentLoaded", () => {
  const currentTitleEl = document.getElementById("current-title");
  const currentUrlEl = document.getElementById("current-url");
  const btnDownloadCurrent = document.getElementById("btn-download-current");
  
  const manualUrlInput = document.getElementById("manual-url");
  const btnDownloadManual = document.getElementById("btn-download-manual");

  let activeTabUrl = "";

  // 1. Query the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      activeTabUrl = tab.url || "";
      
      // Update UI with tab info
      if (activeTabUrl.startsWith("http")) {
        currentTitleEl.textContent = tab.title || "Unknown Page";
        currentUrlEl.textContent = getDomain(activeTabUrl);
      } else {
        currentTitleEl.textContent = "Not a valid webpage";
        currentUrlEl.textContent = "Cannot download from this page";
        btnDownloadCurrent.disabled = true;
        btnDownloadCurrent.style.opacity = "0.5";
        btnDownloadCurrent.style.cursor = "not-allowed";
      }
    }
  });

  // 2. Handle "Download Current Page" click
  btnDownloadCurrent.addEventListener("click", () => {
    if (activeTabUrl && activeTabUrl.startsWith("http")) {
      openClick2Video(activeTabUrl);
    }
  });

  // 3. Handle Manual Input click
  btnDownloadManual.addEventListener("click", () => {
    const url = manualUrlInput.value.trim();
    if (url && url.startsWith("http")) {
      openClick2Video(url);
    } else {
      manualUrlInput.style.borderColor = "red";
      setTimeout(() => manualUrlInput.style.borderColor = "rgba(255,255,255,0.08)", 1000);
    }
  });

  // Enter key support for manual input
  manualUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      btnDownloadManual.click();
    }
  });
});

// Helper to open the new tab
function openClick2Video(url) {
  const encodedUrl = encodeURIComponent(url);
  const downloadUrl = `${APP_URL}/?url=${encodedUrl}`;
  chrome.tabs.create({ url: downloadUrl });
}

// Helper to extract domain for cleaner display
function getDomain(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace("www.", "");
  } catch (e) {
    return url;
  }
}
