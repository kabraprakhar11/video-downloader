// Click2Video Chrome Extension Service Worker

// Target Domain - Update this to https://click2video.com when deploying to production
const APP_URL = "https://click2video.com";

// 1. Create Context Menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "click2video-download",
    title: "Download Video with Click2Video",
    contexts: ["page", "link", "video", "audio"]
  });
});

// 2. Handle Context Menu Clicks (Right-Click)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "click2video-download") {
    // Priority: The URL of the link they right-clicked, or the URL of the page itself
    const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || (tab ? tab.url : null);
    
    if (targetUrl) {
      openClick2Video(targetUrl);
    }
  }
});

// 3. (Removed) Toolbar Icon Clicks are now handled by popup.html / popup.js

// Helper function to open the app with the URL injected
function openClick2Video(url) {
  const encodedUrl = encodeURIComponent(url);
  const downloadUrl = `${APP_URL}/?url=${encodedUrl}`;
  
  chrome.tabs.create({ url: downloadUrl });
}
