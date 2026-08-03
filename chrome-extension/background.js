const API_BASE_URL = 'http://localhost:8000';

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

      else if (message.action === 'executePostBack') {
        const tabId = sender.tab.id;
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (target, arg) => {
            const script = document.createElement('script');
            // Escape single quotes in target/arg to prevent breaking the string literal
            const safeTarget = target.replace(/'/g, "\\'");
            const safeArg = arg.replace(/'/g, "\\'");
            script.textContent = `__doPostBack('${safeTarget}', '${safeArg}');`;
            document.documentElement.appendChild(script);
            script.remove();
          },
          args: [message.target, message.argument]
        }).catch((err) => {
          console.error('[LocalPRO] executeScript failed:', err);
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
