let badgeElement = null;

// Initialize
(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
    if (response && response.success && response.listingData) {
      createOrUpdateBadge(response.listingData);
    }
  } catch (err) {
    console.log('LocalPRO extension could not communicate with background service worker:', err);
  }
})();

const FIELD_MAPPING = {
  'Input_219': {
    type: 'select',
    localField: 'property_sub_type',
  },
  'Input_220': {
    type: 'checkbox_group',
    localField: 'housing_type',
    valueMapping: {
      'Single Detached': 'SINDET',
      'Apartment': 'APT',
      'Attached or 1/2 Duplex': 'ATT',
      'Condo/Townhome': 'CON',
      'Garden/Zero Lot Line': 'GARDEN'
    }
  },
  'Input_222': {
    type: 'select',
    localField: 'property_attached_yn',
  },
  'Input_223': {
    type: 'select',
    localField: 'listing_agreement_type',
  },
  'Input_224': {
    type: 'select',
    localField: 'transaction_type',
  },
  'Input_381': {
    type: 'select',
    localField: 'will_subdivide_yn',
  },
  'Input_237': {
    type: 'select',
    localField: 'multi_parcel_id_yn',
  },
  'Input_77': {
    type: 'text',
    localField: 'list_price',
  },
  'Input_80': {
    type: 'text',
    localField: 'list_date',
  },
  'Input_81': {
    type: 'text',
    localField: 'expire_date',
  },
  'Input_231': {
    type: 'text',
    localField: 'year_built',
  },
  'Input_233': {
    type: 'text',
    localField: 'living_area_sqft',
  },
  'Input_234': {
    type: 'select',
    localField: 'sqft_source',
  },
  'Input_235': {
    type: 'text',
    localField: 'parcel_id',
  }
};

function highlightField(el) {
  el.classList.add('localpro-filled-highlight');
}

function updateCompanionDV(matrixId, value) {
  const dvId = matrixId.replace('Input_', 'DV_');
  const dvEl = document.getElementById(dvId);
  if (dvEl) {
    dvEl.value = value || 'DV';
    dvEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function fillPage1(formData) {
  let filledCount = 0;
  
  for (const [matrixId, config] of Object.entries(FIELD_MAPPING)) {
    const rawVal = formData[config.localField];
    
    // Explicit skip logic for empty/null/undefined values on all fields (text, select, checkbox)
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      console.warn(`[LocalPRO] Skipped field ${matrixId} because local data was empty/null`);
      continue;
    }
    
    if (config.type === 'select') {
      const el = document.getElementById(matrixId);
      if (el) {
        if (matrixId === 'Input_219') {
          // Keep existing working logic for Input_219 untouched
          let matched = false;
          if (el.options) {
            for (const opt of el.options) {
              if (opt.value.toLowerCase() === String(rawVal).toLowerCase() || opt.text.toLowerCase() === String(rawVal).toLowerCase()) {
                el.value = opt.value;
                matched = true;
                break;
              }
            }
          }
          if (!matched) {
            el.value = rawVal;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          updateCompanionDV(matrixId, 'DV');
          highlightField(el);
          filledCount++;
        } else {
          // Dropdown matching by visible text/title only (no fallback, no DV_xxx companion)
          let matched = false;
          if (el.options) {
            const searchVal = String(rawVal).trim().toLowerCase();
            for (const opt of el.options) {
              const optText = (opt.text || '').trim().toLowerCase();
              const optTitle = (opt.title || '').trim().toLowerCase();
              if (optText === searchVal || optTitle === searchVal) {
                el.value = opt.value;
                matched = true;
                break;
              }
            }
          }
          if (matched) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            highlightField(el);
            filledCount++;
          } else {
            console.warn(`[LocalPRO] Dropdown match failed for field ID: ${matrixId} with value: "${rawVal}"`);
          }
        }
      }
    } 
    else if (config.type === 'checkbox_group') {
      // Normalize rawVal to an array to support both string and array inputs
      const values = Array.isArray(rawVal) ? rawVal : [rawVal];
      
      if (matrixId === 'Input_220') {
        // Keep existing working logic for Input_220 untouched
        let groupFilled = false;
        for (const val of values) {
          const suffix = config.valueMapping[val];
          if (suffix) {
            const checkboxId = `${matrixId}_${suffix}`;
            const cb = document.getElementById(checkboxId);
            if (cb) {
              cb.checked = true;
              cb.dispatchEvent(new Event('change', { bubbles: true }));
              updateCompanionDV(matrixId, 'DV');
              
              const container = document.getElementById(matrixId) || cb.parentElement;
              if (container) {
                highlightField(container);
              }
              groupFilled = true;
            }
          }
        }
        if (groupFilled) {
          filledCount++;
        }
      } else {
        let groupFilled = false;
        for (const val of values) {
          const suffix = config.valueMapping[val];
          if (suffix) {
            const checkboxId = `${matrixId}_${suffix}`;
            const cb = document.getElementById(checkboxId);
            if (cb) {
              cb.checked = true;
              cb.dispatchEvent(new Event('change', { bubbles: true }));
              
              const container = document.getElementById(matrixId) || cb.parentElement;
              if (container) {
                highlightField(container);
              }
              groupFilled = true;
            }
          }
        }
        if (groupFilled) {
          filledCount++;
        }
      }
    }
    else if (config.type === 'text') {
      const el = document.getElementById(matrixId);
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.value = String(rawVal);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        highlightField(el);
        filledCount++;
      }
    }
  }
  
  if (filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }
  
  return true;
}

function fillPage2(formData) {
  let filledCount = 0;

  function fillDropdown(matrixId, localField) {
    const rawVal = formData[localField];
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      console.warn(`[LocalPRO] Skipped field ${matrixId} because local data was empty/null`);
      return false;
    }

    const el = document.getElementById(matrixId);
    if (!el) return false;

    let matched = false;
    if (el.options) {
      const searchVal = String(rawVal).trim().toLowerCase();
      for (const opt of el.options) {
        const optText = (opt.text || '').trim().toLowerCase();
        const optTitle = (opt.title || '').trim().toLowerCase();
        if (optText === searchVal || optTitle === searchVal) {
          el.value = opt.value;
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlightField(el);
      filledCount++;
      return true;
    } else {
      console.warn(`[LocalPRO] Dropdown match failed for field ID: ${matrixId} with value: "${rawVal}"`);
      return false;
    }
  }

  function fillText(matrixId, localField) {
    const rawVal = formData[localField];
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      console.warn(`[LocalPRO] Skipped field ${matrixId} because local data was empty/null`);
      return false;
    }

    const el = document.getElementById(matrixId);
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      el.value = String(rawVal);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      highlightField(el);
      filledCount++;
      return true;
    }
    return false;
  }

  // Cascading fill order: State -> County -> (City and School District)
  // 1. State (Input_286)
  fillDropdown('Input_286', 'state');

  // 2. County/Parish (Input_285)
  fillDropdown('Input_285', 'county');

  // 3. City (Input_284) and School District (Input_334)
  fillDropdown('Input_284', 'city');
  fillDropdown('Input_334', 'school_district');

  // Independent plain text fields
  fillText('Input_170', 'street_name');
  fillText('Input_242', 'street_number');
  fillText('Input_294', 'zip_code');
  fillText('Input_290', 'subdivision');

  if (filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillSharedDropdown(formData, matrixId, localField, tracker) {
  const rawVal = formData[localField];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    console.warn(`[LocalPRO] Skipped field ${matrixId} because local data was empty/null`);
    return false;
  }

  const el = document.getElementById(matrixId);
  if (!el) return false;

  let matched = false;
  if (el.options) {
    const searchVal = String(rawVal).trim().toLowerCase();
    for (const opt of el.options) {
      const optText = (opt.text || '').trim().toLowerCase();
      const optTitle = (opt.title || '').trim().toLowerCase();
      if (optText === searchVal || optTitle === searchVal) {
        el.value = opt.value;
        matched = true;
        break;
      }
    }
  }

  if (matched) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    highlightField(el);
    tracker.filledCount++;
    return true;
  } else {
    console.warn(`[LocalPRO] Dropdown match failed for field ID: ${matrixId} with value: "${rawVal}"`);
    return false;
  }
}

function fillSharedText(formData, matrixId, localField, tracker, allowZero = false) {
  const rawVal = formData[localField];
  const isZeroVal = allowZero && (rawVal === 0 || rawVal === '0' || rawVal === '0.0000');
  
  if (!isZeroVal && (rawVal === undefined || rawVal === null || String(rawVal).trim() === '')) {
    console.warn(`[LocalPRO] Skipped field ${matrixId} because local data was empty/null`);
    return false;
  }

  const el = document.getElementById(matrixId);
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    el.value = String(rawVal);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
    highlightField(el);
    tracker.filledCount++;
    return true;
  }
  return false;
}

function fillSharedCheckboxGroup(formData, matrixId, localField, tracker) {
  const rawVal = formData[localField];
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    console.warn(`[LocalPRO] Skipped checkbox group ${matrixId} because local data was empty/null`);
    return false;
  }

  const values = Array.isArray(rawVal) ? rawVal : [rawVal];
  const container = document.getElementById(matrixId);
  if (!container) {
    console.warn(`[LocalPRO] Checkbox group container not found for ID: ${matrixId}`);
    return false;
  }

  const labels = container.querySelectorAll('label');
  let groupFilled = false;

  for (const val of values) {
    if (val === undefined || val === null || String(val).trim() === '') continue;
    const searchVal = String(val).trim().toLowerCase();
    let matched = false;

    for (const label of labels) {
      if (label.textContent.trim().toLowerCase() === searchVal) {
        const forId = label.getAttribute('for');
        const cb = forId ? document.getElementById(forId) : label.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          highlightField(label.parentElement || container);
          matched = true;
          groupFilled = true;
          break;
        }
      }
    }

    if (!matched) {
      console.warn(`[LocalPRO] No matching checkbox found in group ${matrixId} for value: "${val}"`);
    }
  }

  if (groupFilled) {
    tracker.filledCount++;
    return true;
  }
  return false;
}

function fillPage3(formData) {
  const tracker = { filledCount: 0 };

  // Plain text fields
  fillSharedText(formData, 'Input_243', 'bedrooms_total', tracker);
  fillSharedText(formData, 'Input_398', 'bathrooms_full', tracker);
  fillSharedText(formData, 'Input_399', 'bathrooms_half', tracker);
  fillSharedText(formData, 'Input_401', 'living_areas', tracker);
  fillSharedText(formData, 'Input_402', 'dining_areas', tracker);

  // Dropdown field
  fillSharedDropdown(formData, 'Input_539', 'levels', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage4(formData) {
  const tracker = { filledCount: 0 };

  // Dropdowns / Yes-No fields
  fillSharedDropdown(formData, 'Input_309', 'accessibility_yn', tracker);
  fillSharedDropdown(formData, 'Input_342', 'smart_home_yn', tracker);
  fillSharedDropdown(formData, 'Input_300', 'pool_yn', tracker);
  fillSharedDropdown(formData, 'Input_310', 'basement_yn', tracker);
  fillSharedDropdown(formData, 'Input_304', 'garage_yn', tracker);
  fillSharedDropdown(formData, 'Input_306', 'attached_garage_yn', tracker);

  // Plain text fields
  fillSharedText(formData, 'Input_308', 'fireplace_count', tracker);
  fillSharedText(formData, 'Input_301', 'carport_spaces', tracker);
  fillSharedText(formData, 'Input_303', 'covered_spaces_total', tracker);
  fillSharedText(formData, 'Input_305', 'garage_spaces', tracker);

  // Checkbox groups (multi-select, label-based matching)
  fillSharedCheckboxGroup(formData, 'Input_244', 'interior_features', tracker);
  fillSharedCheckboxGroup(formData, 'Input_315', 'appliances', tracker);
  fillSharedCheckboxGroup(formData, 'Input_296', 'parking_features', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage5(formData) {
  const tracker = { filledCount: 0 };

  // Plain text field (with allowZero = true to prevent skipping "0.0000")
  fillSharedText(formData, 'Input_247', 'lot_size_area', tracker, true);

  // Dropdowns
  fillSharedDropdown(formData, 'Input_248', 'lot_size_unit', tracker);
  fillSharedDropdown(formData, 'Input_323', 'lot_size_acreage', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage6(formData) {
  const tracker = { filledCount: 0 };

  // Checkbox group
  fillSharedCheckboxGroup(formData, 'Input_252', 'utilities', tracker);

  // Dropdown
  fillSharedDropdown(formData, 'Input_364', 'mud_district_yn', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage8(formData) {
  const tracker = { filledCount: 0 };

  // Checkbox group
  fillSharedCheckboxGroup(formData, 'Input_255', 'possession', tracker);

  // Dropdowns
  fillSharedDropdown(formData, 'Input_365', 'loan_type', tracker);
  fillSharedDropdown(formData, 'Input_374', 'second_mortgage_yn', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage9(formData) {
  const tracker = { filledCount: 0 };

  // Dropdowns
  fillSharedDropdown(formData, 'Input_383', 'hoa_type', tracker);
  fillSharedDropdown(formData, 'Input_257', 'hoa_billing_frequency', tracker);

  // Text fields
  fillSharedText(formData, 'Input_382', 'hoa_dues', tracker);
  fillSharedText(formData, 'Input_384', 'hoa_management_company', tracker);
  fillSharedText(formData, 'Input_480', 'hoa_management_phone', tracker);

  // Checkbox group
  fillSharedCheckboxGroup(formData, 'Input_385', 'hoa_includes', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage10(formData) {
  let filledCount = 0;

  const supervisorVal = "Tricia Andrews (0543406)";
  const el = document.getElementById('filter_Input_761');
  if (el) {
    el.value = supervisorVal;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    highlightField(el);
    filledCount++;
    console.log('[LocalPRO] Supervisor ID set to hardcoded default — VERIFY THIS WORKED, do not trust silently');

    // Inspect whether there's a real "Refresh" link/button near this field.
    const parentContainer = el.closest('td') || el.parentElement;
    if (parentContainer) {
      const refreshLink = parentContainer.querySelector('a');
      if (refreshLink && refreshLink.textContent.toLowerCase().includes('refresh')) {
        try {
          console.log('[LocalPRO] Supervisor ID Refresh link found. Triggering click...');
          refreshLink.click();
          console.log('[LocalPRO] Supervisor ID Refresh link clicked successfully.');
        } catch (clickErr) {
          console.error('[LocalPRO] Supervisor ID Refresh link found but clicking it failed:', clickErr);
        }
      } else {
        console.log('[LocalPRO] Supervisor ID Refresh link NOT found near filter_Input_761.');
      }
    } else {
      console.log('[LocalPRO] Supervisor ID parent container NOT found.');
    }
  } else {
    console.warn('[LocalPRO] Supervisor input field filter_Input_761 not found.');
  }

  if (filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage12(formData) {
  const tracker = { filledCount: 0 };

  // Dropdowns
  fillSharedDropdown(formData, 'Input_261', 'allow_address_display', tracker);
  fillSharedDropdown(formData, 'Input_415', 'allow_comments_reviews', tracker);
  fillSharedDropdown(formData, 'Input_416', 'allow_avm', tracker);
  fillSharedDropdown(formData, 'Input_417', 'allow_internet_display', tracker);

  // Textarea
  fillSharedText(formData, 'Input_262', 'public_driving_directions', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

function fillPage11(formData) {
  const tracker = { filledCount: 0 };

  // Checkbox groups
  fillSharedCheckboxGroup(formData, 'Input_380', 'special_listing_conditions', tracker);
  fillSharedCheckboxGroup(formData, 'Input_391', 'showing_requirements', tracker);

  // Dropdown
  fillSharedDropdown(formData, 'Input_260', 'lockbox_type', tracker);

  // Plain text fields
  fillSharedText(formData, 'Input_493', 'owner_name', tracker);
  fillSharedText(formData, 'Input_388', 'key_box_number', tracker);

  if (tracker.filledCount === 0) {
    throw new Error('No matching fields found on the page to fill.');
  }

  return true;
}

const MATRIX_TABS = [
  'Property Info',
  'Location/Schools',
  'Rooms',
  'Features',
  'Lot Info',
  'Utilities',
  'Environment',
  'Financial',
  'HOA',
  'Agent/Office',
  'Showing',
  'Remarks',
  'Condo Info',
  'Farm & Ranch',
  'Status'
];

function getCurrentPage() {
  const tds = document.querySelectorAll('table.stepButtonBar td.link');
  for (const td of tds) {
    if (td.classList.contains('selected')) {
      const a = td.querySelector('a');
      if (a) {
        return a.textContent.trim();
      }
    }
  }
  console.warn('[LocalPRO] Active tab not found among table.stepButtonBar td.link elements.');
  return null;
}

function clickTabLink(tabName) {
  const tds = document.querySelectorAll('table.stepButtonBar td.link');
  for (const td of tds) {
    const a = td.querySelector('a');
    if (a && a.textContent.trim().toLowerCase() === tabName.toLowerCase()) {
      let id = a.id;
      if (!id) {
        id = `localpro-temp-click-${Date.now()}`;
        a.id = id;
      }
      chrome.runtime.sendMessage({
        action: 'executeTabClick',
        elementId: id
      });
      return true;
    }
  }
  console.warn(`[LocalPRO] Clickable tab link for "${tabName}" not found on page.`);
  return false;
}

function goToNextPage() {
  const currentPage = getCurrentPage();
  if (!currentPage) return false;
  
  const idx = MATRIX_TABS.indexOf(currentPage);
  if (idx === -1) {
    console.warn(`[LocalPRO] Unknown current page: ${currentPage}`);
    return false;
  }
  if (idx === MATRIX_TABS.length - 1) {
    console.warn('[LocalPRO] Already on the last page. Cannot go next.');
    return false;
  }
  
  const targetPage = MATRIX_TABS[idx + 1];
  return clickTabLink(targetPage);
}

function goToPrevPage() {
  const currentPage = getCurrentPage();
  if (!currentPage) return false;
  
  const idx = MATRIX_TABS.indexOf(currentPage);
  if (idx === -1) {
    console.warn(`[LocalPRO] Unknown current page: ${currentPage}`);
    return false;
  }
  if (idx === 0) {
    console.warn('[LocalPRO] Already on the first page. Cannot go prev.');
    return false;
  }
  
  const targetPage = MATRIX_TABS[idx - 1];
  return clickTabLink(targetPage);
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'listingLoaded') {
    createOrUpdateBadge(message.listingData);
    sendResponse({ success: true });
    return false;
  } 
  else if (message.action === 'prevPage') {
    try {
      const navigated = goToPrevPage();
      if (navigated) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Cannot navigate previous (already on first page or tab not found).' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return false;
  }
  else if (message.action === 'nextPage') {
    try {
      const navigated = goToNextPage();
      if (navigated) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Cannot navigate next (already on last page or tab not found).' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return false;
  }
  else if (message.action === 'fillActivePage') {
    (async () => {
      try {
        const currentPage = getCurrentPage();
        if (!currentPage) {
          throw new Error('Could not determine active page.');
        }
        
        if (currentPage === 'Property Info') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage1(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Location/Schools') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage2(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Rooms') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage3(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Features') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage4(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Lot Info') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage5(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Utilities') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage6(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Financial') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage8(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'HOA') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage9(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Agent/Office') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage10(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Showing') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage11(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else if (currentPage === 'Remarks') {
          const response = await chrome.runtime.sendMessage({ action: 'getCurrentListing' });
          if (!response || !response.success || !response.listingData) {
            throw new Error('No active listing loaded or session data lost. Please reload the listing in the popup.');
          }
          fillPage12(response.listingData);
          sendResponse({ success: true, page: currentPage });
        } else {
          sendResponse({ success: false, error: 'Fill not yet available for this page.', page: currentPage });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});

function createOrUpdateBadge(listingData) {
  if (!listingData) {
    if (badgeElement) {
      badgeElement.remove();
      badgeElement = null;
    }
    return;
  }

  const address = listingData.address_full || 'Loaded Listing';

  if (!badgeElement) {
    badgeElement = document.createElement('div');
    badgeElement.id = 'localpro-matrix-badge';
    
    const dot = document.createElement('span');
    dot.className = 'localpro-pulse-dot';
    
    const text = document.createElement('span');
    text.id = 'localpro-badge-text';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'localpro-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      badgeElement.remove();
      badgeElement = null;
    });

    badgeElement.appendChild(dot);
    badgeElement.appendChild(text);
    badgeElement.appendChild(closeBtn);
    document.body.appendChild(badgeElement);
  }

  const textNode = document.getElementById('localpro-badge-text');
  if (textNode) {
    textNode.textContent = `LocalPRO Hub connected — ${address}`;
  }
}
