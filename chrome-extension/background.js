let API_BASE_URL = 'https://local-pro-hub-production.up.railway.app';

// Load stored API base URL on startup
chrome.storage.local.get('apiBaseUrl', (data) => {
  if (data.apiBaseUrl) {
    API_BASE_URL = data.apiBaseUrl;
    console.log('[LocalPRO] Initial API Base URL:', API_BASE_URL);
  }
});

// Watch for API base URL updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.apiBaseUrl) {
    API_BASE_URL = changes.apiBaseUrl.newValue;
    console.log('[LocalPRO] API Base URL updated to:', API_BASE_URL);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'login') {
        const { email, password } = message;
        const response = await fetch(`${API_BASE_URL}/extension/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Login failed.');
        }
        const data = await response.json();
        await chrome.storage.session.set({
          token: data.access_token,
          user: data.user,
        });
        sendResponse({ success: true, user: data.user });
      }

      else if (message.action === 'loadListing') {
        const { listingId } = message;
        const { token } = await chrome.storage.session.get('token');
        if (!token) {
          throw new Error('Not authenticated.');
        }

        const response = await fetch(`${API_BASE_URL}/extension/listing/${listingId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to load listing.');
        }
        const data = await response.json();
        await chrome.storage.session.set({
          listingId: listingId,
          listingData: data,
        });

        // Broadcast to active tabs
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        for (const tab of tabs) {
          if (tab.id && tab.url && tab.url.includes('ntrdd.mlsmatrix.com')) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'listingLoaded',
                listingData: data,
              });
            } catch (err) {
              // Fail silently if content script is not loaded on this tab
            }
          }
        }

        sendResponse({ success: true, listingData: data });
      }

      else if (message.action === 'getCurrentListing') {
        const { listingData } = await chrome.storage.session.get('listingData');
        sendResponse({ success: true, listingData: listingData || null });
      }

      else if (message.action === 'executeTabClick') {
        const tabId = sender.tab.id;
        const elementId = message.elementId;
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (id) => {
            const script = document.createElement('script');
            const safeId = id.replace(/'/g, "\\'");
            script.textContent = `const el = document.getElementById('${safeId}'); if (el) { el.click(); if (safeId.startsWith('localpro-temp-click-')) { el.removeAttribute('id'); } }`;
            document.documentElement.appendChild(script);
            script.remove();
          },
          args: [elementId]
        }).catch((err) => {
          console.error('[LocalPRO] executeScript for tab click failed:', err);
        });
        sendResponse({ success: true });
      }

      else if (message.action === 'getUser') {
        const { user } = await chrome.storage.session.get('user');
        sendResponse({ success: true, user: user || null });
      }

      else if (message.action === 'logout') {
        await chrome.storage.session.clear();
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('Error in background listener:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true;
});
