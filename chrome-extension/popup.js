document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('login-section');
  const mainSection = document.getElementById('main-section');
  
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const userNameText = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  
  const listingIdInput = document.getElementById('listing-id');
  const loadBtn = document.getElementById('load-btn');
  const loadError = document.getElementById('load-error');
  const loadSuccess = document.getElementById('load-success');
  
  const listingPreview = document.getElementById('listing-preview');
  const propertyAddress = document.getElementById('property-address');
  const propertyMls = document.getElementById('property-mls');
  const propertyPrice = document.getElementById('property-price');
  const fillActivePageBtn = document.getElementById('fill-active-page-btn');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const actionSection = document.getElementById('action-section');
  const fillStatus = document.getElementById('fill-status');

  // Check auth state on open
  try {
    const userRes = await chrome.runtime.sendMessage({ action: 'getUser' });
    if (userRes && userRes.success && userRes.user) {
      showMain(userRes.user);
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }

  // Handle login submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'login',
        email,
        password
      });

      if (res && res.success) {
        showMain(res.user);
      } else {
        loginError.textContent = res.error || 'Authentication failed.';
      }
    } catch (err) {
      loginError.textContent = 'Error connecting to background service.';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Log In';
    }
  });

  // Handle logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'logout' });
    } catch (err) {
      console.error(err);
    }
    showLogin();
  });

  // Handle load listing
  loadBtn.addEventListener('click', async () => {
    loadError.textContent = '';
    loadSuccess.textContent = '';
    const listingId = listingIdInput.value.trim();

    if (!listingId) {
      loadError.textContent = 'Please enter a Listing ID.';
      return;
    }

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';

    try {
      const res = await chrome.runtime.sendMessage({
        action: 'loadListing',
        listingId
      });

      if (res && res.success) {
        loadSuccess.textContent = 'Listing loaded successfully!';
        displayListing(res.listingData);
        listingIdInput.value = '';
      } else {
        loadError.textContent = res.error || 'Failed to load listing.';
        listingPreview.classList.add('hidden');
        actionSection.classList.add('hidden');
      }
    } catch (err) {
      loadError.textContent = 'Error requesting listing load.';
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load Listing';
    }
  });

  function showLogin() {
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
    loginForm.reset();
    loginError.textContent = '';
  }

  async function showMain(user) {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    userNameText.textContent = user.full_name || 'Agent';
    loadError.textContent = '';
    loadSuccess.textContent = '';
    listingIdInput.value = '';
    fillStatus.textContent = '';

    // Check if listing is already loaded
    try {
      const listRes = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
      if (listRes && listRes.success && listRes.listingData) {
        displayListing(listRes.listingData);
      } else {
        listingPreview.classList.add('hidden');
        actionSection.classList.add('hidden');
      }
    } catch (err) {
      listingPreview.classList.add('hidden');
      actionSection.classList.add('hidden');
    }
  }

  let activeListingData = null;

  function displayListing(data) {
    activeListingData = data;
    listingPreview.classList.remove('hidden');
    propertyAddress.textContent = data.address_full || 'No Address Provided';
    propertyMls.textContent = data.mls_number || 'N/A';
    
    if (data.list_price) {
      const priceVal = parseFloat(data.list_price);
      propertyPrice.textContent = isNaN(priceVal) ? data.list_price : `$${priceVal.toLocaleString()}`;
    } else {
      propertyPrice.textContent = 'N/A';
    }

    // Determine if active tab is on Matrix Input
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const isMatrixInput = activeTab && activeTab.url && activeTab.url.includes('ntrdd.mlsmatrix.com/Matrix/Input');
      
      actionSection.classList.remove('hidden');
      if (isMatrixInput) {
        fillActivePageBtn.disabled = false;
        prevPageBtn.disabled = false;
        nextPageBtn.disabled = false;
        fillActivePageBtn.textContent = 'Fill Active Page';
      } else {
        fillActivePageBtn.disabled = true;
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        fillActivePageBtn.textContent = 'Not on Matrix Input page';
      }
    });
  }

  fillActivePageBtn.addEventListener('click', async () => {
    fillStatus.textContent = '';
    fillActivePageBtn.disabled = true;
    fillActivePageBtn.textContent = 'Filling...';
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        throw new Error('No active tab found.');
      }
      
      const res = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'fillActivePage'
      });
      
      if (res && res.success) {
        fillStatus.textContent = 'Autofill applied successfully!';
      } else {
        fillStatus.textContent = res ? res.error : 'Failed to autofill page.';
      }
    } catch (err) {
      fillStatus.textContent = 'Error: Make sure you are on the Matrix tab.';
    } finally {
      fillActivePageBtn.disabled = false;
      fillActivePageBtn.textContent = 'Fill Active Page';
    }
  });

  prevPageBtn.addEventListener('click', async () => {
    fillStatus.textContent = '';
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        const res = await chrome.tabs.sendMessage(activeTab.id, { action: 'prevPage' });
        if (res && !res.success && res.error) {
          fillStatus.textContent = res.error;
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  nextPageBtn.addEventListener('click', async () => {
    fillStatus.textContent = '';
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        const res = await chrome.tabs.sendMessage(activeTab.id, { action: 'nextPage' });
        if (res && !res.success && res.error) {
          fillStatus.textContent = res.error;
        }
      }
    } catch (err) {
      console.error(err);
    }
  });
});
