// Global Tags Management
let globalTags = []; // Store all available tags

// Fetch all available tags
async function fetchGlobalTags() {
  try {
    const response = await fetch('/api/tags');
    const data = await response.json();
    
    if (data.success) {
      globalTags = data.tags || [];
      return globalTags;
    } else {
      console.error('Error fetching global tags:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching global tags:', error);
    return [];
  }
}

// Import existing tags from all prompts
async function importExistingTags() {
  try {
    const response = await fetch('/api/tags/import', {
      method: 'POST'
    });
    const data = await response.json();
    
    if (data.success) {
      globalTags = data.tags || [];
      showToast('success', 'Imported existing tags');
      return globalTags;
    } else {
      showToast('error', 'Error importing tags: ' + data.message);
      return [];
    }
  } catch (error) {
    showToast('error', 'Error importing tags: ' + error.message);
    return [];
  }
}

// Create tag dropdown with global tags
function createGlobalTagDropdown(prompt) {
  // First, remove any existing dropdown for this prompt
  const existingDropdown = document.getElementById(`tag-dropdown-${prompt.id}`);
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  // Find the card
  const card = document.querySelector(`.prompt-card[data-prompt-id="${prompt.id}"]`);
  if (!card) return;
  
  // Find the content area where we'll insert the dropdown
  const cardContent = card.querySelector('.prompt-card-content');
  if (!cardContent) return;
  
  // Create the dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'tag-dropdown-menu';
  dropdown.id = `tag-dropdown-${prompt.id}`;
  dropdown.setAttribute('data-prompt-id', prompt.id);
  dropdown.style.display = 'none'; // Initially hidden
  
  // Get the prompt's tags
  const promptTags = prompt.tags || [];
  
  // Create dropdown content
  dropdown.innerHTML = `
    <div class="tag-dropdown-header">
      <h4>Tags for "${prompt.name}"</h4>
    </div>
    <div class="tag-dropdown-body">
      <div class="select-all-container">
        <label class="select-all-label">
          <input type="checkbox" id="select-all-tags-${prompt.id}" class="select-all-checkbox">
          <span>Select All Tags</span>
        </label>
      </div>
      <div class="tag-list" id="tag-list-${prompt.id}">
        ${renderGlobalTagsList(prompt.id, promptTags)}
      </div>
      <div class="add-tag-section">
        <div class="add-tag-form">
          <input type="text" id="add-tag-input-${prompt.id}" class="add-tag-input" placeholder="Enter new tag">
          <button type="button" class="btn sm success add-tag-btn" data-prompt-id="${prompt.id}">
            Add
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Simply append the dropdown to the card content
  cardContent.appendChild(dropdown);
  
  // Add event listener for select all checkbox
  const selectAllCheckbox = dropdown.querySelector(`#select-all-tags-${prompt.id}`);
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
    
    // Process each checkbox
    checkboxes.forEach(async (checkbox) => {
      const tag = checkbox.getAttribute('data-tag');
      const wasChecked = checkbox.checked;
      
      checkbox.checked = isChecked;
      
      // If the state changed, update the prompt's tags
      if (wasChecked !== isChecked) {
        if (isChecked) {
          await addTagToPrompt(prompt.id, tag);
        } else {
          await removeTagFromPrompt(prompt.id, tag);
        }
      }
    });
  });
  
  // Add event listener for add tag button
  const addTagBtn = dropdown.querySelector('.add-tag-btn');
  addTagBtn.addEventListener('click', () => {
    const input = document.getElementById(`add-tag-input-${prompt.id}`);
    const tag = input.value.trim();
    
    if (tag) {
      addGlobalTagAndAssociate(prompt.id, tag);
    }
  });
  
  // Add key press event for add tag input
  const addTagInput = dropdown.querySelector(`#add-tag-input-${prompt.id}`);
  addTagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = addTagInput.value.trim();
      if (tag) {
        addGlobalTagAndAssociate(prompt.id, tag);
      }
    }
  });
  
  // Add event listeners for tag checkboxes
  const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      // Prevent event bubbling to avoid dropdown closing
      e.stopPropagation();
      
      updateSelectAllCheckbox(prompt.id);
      
      // Get the tag value
      const tag = checkbox.getAttribute('data-tag');
      
      try {
        // Update the prompt's tags based on checkbox state
        if (checkbox.checked) {
          await addTagToPrompt(prompt.id, tag);
        } else {
          await removeTagFromPrompt(prompt.id, tag);
        }
        
        // Refresh the tag dropdown entirely to ensure all tags remain visible
        refreshTagDropdown(prompt.id, prompt);
        
      } catch (error) {
        console.error('Error updating tag:', error);
        // Show error toast but keep dropdown open
        showToast('error', 'Error updating tag: ' + error.message);
      }
    });
  });
  
  // Update select all checkbox state
  updateSelectAllCheckbox(prompt.id);
  
  return dropdown;
}

// Function to rebuild tag dropdown after selection
async function refreshTagDropdown(promptId, promptData) {
  // First check if we need to fetch the prompt data
  let prompt = promptData;
  if (!prompt) {
    // Look for prompt in the global prompts array first
    prompt = prompts.find(p => p.id === promptId);
    
    // If not found, fetch it
    if (!prompt) {
      try {
        const response = await fetch(`/api/prompts/${promptId}`);
        const data = await response.json();
        if (data.success) {
          prompt = data.prompt;
        } else {
          console.error('Error fetching prompt data:', data.message);
          return;
        }
      } catch (error) {
        console.error('Error fetching prompt data:', error);
        return;
      }
    }
  }
  
  // Ensure we have the latest global tags
  await fetchGlobalTags();
  
  // Get the dropdown and tag list
  const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
  const tagList = dropdown?.querySelector(`#tag-list-${promptId}`);
  if (!dropdown || !tagList) return;
  
  // Save dropdown's display state
  const wasVisible = dropdown.style.display === 'block';
  
  // Reset tag list content with all global tags, marking which ones are selected
  tagList.innerHTML = renderGlobalTagsList(promptId, prompt.tags || []);
  
  // Re-add event listeners to all checkboxes
  const checkboxes = tagList.querySelectorAll('.tag-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      e.stopPropagation();
      updateSelectAllCheckbox(promptId);
      
      const tag = checkbox.getAttribute('data-tag');
      
      if (checkbox.checked) {
        await addTagToPrompt(promptId, tag);
      } else {
        await removeTagFromPrompt(promptId, tag);
      }
    });
  });
  
  // Update select all checkbox state
  updateSelectAllCheckbox(promptId);
  
  // Make sure dropdown stays visible if it was visible before
  if (wasVisible) {
    dropdown.style.display = 'block';
  }
}

// Render global tags list for dropdown
function renderGlobalTagsList(promptId, promptTags) {
  if (!globalTags || globalTags.length === 0) {
    return '<p class="no-tags-message">No tags yet. Add tags to enhance your prompts.</p>';
  }
  
  let html = '';
  globalTags.forEach(tag => {
    const isChecked = promptTags.includes(tag) ? 'checked' : '';
    
    html += `
      <div class="tag-item">
        <div class="tag-checkbox-container">
          <input type="checkbox" id="tag-${promptId}-${tag}" class="tag-checkbox" data-tag="${tag}" ${isChecked}>
          <label for="tag-${promptId}-${tag}">${tag}</label>
        </div>
      </div>
    `;
  });
  
  return html;
}

// Update tag checkbox states in the modal
function updateModalTagCheckboxes(promptTags) {
  const modalTagsList = document.getElementById('modal-tags-list');
  if (!modalTagsList) return;
  
  const checkboxes = modalTagsList.querySelectorAll('.tag-checkbox');
  checkboxes.forEach(checkbox => {
    const tag = checkbox.getAttribute('data-tag');
    checkbox.checked = promptTags.includes(tag);
  });
}

// Add a global tag and associate it with the current prompt
async function addGlobalTagAndAssociate(promptId, tag) {
  try {
    // Show loading state
    const addTagBtn = document.querySelector(`.add-tag-btn[data-prompt-id="${promptId}"]`);
    if (addTagBtn) addTagBtn.disabled = true;
    
    // Add the tag to the global list first
    const globalResponse = await fetch('/api/tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tag })
    });
    
    const globalData = await globalResponse.json();
    
    if (globalData.success) {
      globalTags = globalData.tags;
      
      // Then associate the tag with the prompt
      const promptResponse = await fetch(`/api/prompts/${promptId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag })
      });
      
      const promptData = await promptResponse.json();
      
      if (promptData.success) {
        // Clear the input
        const input = document.getElementById(`add-tag-input-${promptId}`);
        if (input) input.value = '';
        
        // Get the current prompt with updated tags
        const updatedPrompt = promptData.prompt;
        
        // Find this prompt in global prompts array and update it
        const promptIndex = prompts.findIndex(p => p.id === promptId);
        if (promptIndex !== -1) {
          prompts[promptIndex] = updatedPrompt;
        }
        
        // Refresh the specific dropdown to show all tags
        refreshTagDropdown(promptId, updatedPrompt);
        
        showToast('success', `Tag "${tag}" added to global list and prompt`);
      } else {
        showToast('error', 'Error associating tag with prompt: ' + promptData.message);
      }
    } else {
      showToast('error', 'Error adding global tag: ' + globalData.message);
    }
  } catch (error) {
    showToast('error', 'Error adding tag: ' + error.message);
  } finally {
    // Reset loading state
    const addTagBtn = document.querySelector(`.add-tag-btn[data-prompt-id="${promptId}"]`);
    if (addTagBtn) addTagBtn.disabled = false;
  }
}

// Toggle tag dropdown - revised to work with in-card dropdowns
function toggleTagDropdown(promptId) {
  const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
  if (!dropdown) return;
  
  // Store active dropdown ID in a data attribute on the document body
  // This helps us track which dropdown should stay open
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    // Close all other dropdowns first
    const allDropdowns = document.querySelectorAll('.tag-dropdown-menu');
    allDropdowns.forEach(d => {
      if (d.id !== `tag-dropdown-${promptId}`) {
        d.style.display = 'none';
      }
    });
    
    // Open this dropdown
    dropdown.style.display = 'block';
    document.body.setAttribute('data-active-dropdown', promptId);
    
    // Update select all checkbox state
    updateSelectAllCheckbox(promptId);
    
    // Focus on the add tag input
    setTimeout(() => {
      const input = document.getElementById(`add-tag-input-${promptId}`);
      if (input) input.focus();
    }, 100);
    
    // Add click outside listener
    setTimeout(() => {
      document.addEventListener('click', closeTagDropdownsOnClickOutside);
    }, 10);
  } else {
    // Close this dropdown
    dropdown.style.display = 'none';
    document.body.removeAttribute('data-active-dropdown');
    document.removeEventListener('click', closeTagDropdownsOnClickOutside);
  }
}

// Close tag dropdowns when clicking outside
function closeTagDropdownsOnClickOutside(event) {
  // Don't close if clicking on a tag checkbox or a dropdown toggle
  if (event.target.closest('.tag-checkbox') || 
      event.target.closest('.add-tag-btn') || 
      event.target.closest('.add-tag-input')) {
    return;
  }
  
  // Close only if clicking outside dropdown area and toggle button
  if (!event.target.closest('.tag-dropdown-menu') && !event.target.closest('.dropdown-toggle')) {
    const dropdowns = document.querySelectorAll('.tag-dropdown-menu');
    dropdowns.forEach(dropdown => {
      dropdown.style.display = 'none';
    });
    document.body.removeAttribute('data-active-dropdown');
    document.removeEventListener('click', closeTagDropdownsOnClickOutside);
  }
}

// Update select all checkbox based on individual checkbox states
function updateSelectAllCheckbox(promptId) {
  const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
  if (!dropdown) return;
  
  const selectAllCheckbox = dropdown.querySelector(`#select-all-tags-${promptId}`);
  const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
  
  if (checkboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.disabled = true;
    return;
  }
  
  selectAllCheckbox.disabled = false;
  
  const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
  const someChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
  
  selectAllCheckbox.checked = allChecked;
  selectAllCheckbox.indeterminate = someChecked && !allChecked;
}

// Add a tag to a prompt
async function addTagToPrompt(promptId, tag) {
  try {
    // Save the current dropdown state
    const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
    const wasDropdownOpen = dropdown && dropdown.style.display === 'block';
    
    // Show loading state
    const addTagBtn = document.querySelector(`.add-tag-btn[data-prompt-id="${promptId}"]`);
    if (addTagBtn) addTagBtn.disabled = true;
    
    const response = await fetch(`/api/prompts/${promptId}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tag })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Find the prompt in the global prompts array and update its tags
      const promptIndex = prompts.findIndex(p => p.id === promptId);
      if (promptIndex !== -1) {
        prompts[promptIndex].tags = data.prompt.tags;
      }
      
      // Clear the input if this was an add operation from the input field
      const input = document.getElementById(`add-tag-input-${promptId}`);
      if (input && input === document.activeElement) {
        input.value = '';
      }
      
      // Fetch all global tags first to ensure we have the latest
      await fetchGlobalTags();
      
      // Update the tag list in the dropdown
      const tagList = document.getElementById(`tag-list-${promptId}`);
      if (tagList) {
        tagList.innerHTML = renderGlobalTagsList(promptId, data.prompt.tags);
        
        // Add event listeners to checkboxes
        const checkboxes = tagList.querySelectorAll('.tag-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            updateSelectAllCheckbox(promptId);
            
            const tagValue = checkbox.getAttribute('data-tag');
            
            if (checkbox.checked) {
              await addTagToPrompt(promptId, tagValue);
            } else {
              await removeTagFromPrompt(promptId, tagValue);
            }
            
            // Keep dropdown open
            setTimeout(() => {
              const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
              if (dropdown) dropdown.style.display = 'block';
            }, 50);
          });
        });
      }
      
      // Update select all checkbox
      updateSelectAllCheckbox(promptId);
      
      // If the modal is open and showing this prompt, update its tags too
      if (currentPromptId === promptId) {
        renderGlobalTagsInModal(data.prompt.tags);
      }
      
      showToast('success', `Tag "${tag}" added to prompt`);
    } else {
      showToast('error', 'Error adding tag: ' + data.message);
    }
  } catch (error) {
    console.error('Error adding tag:', error);
    showToast('error', 'Error adding tag: ' + error.message);
  } finally {
    // Reset loading state
    const addTagBtn = document.querySelector(`.add-tag-btn[data-prompt-id="${promptId}"]`);
    if (addTagBtn) addTagBtn.disabled = false;
    
    // Make sure dropdown stays open if it was open before
    const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
    if (dropdown && document.body.getAttribute('data-active-dropdown') === promptId) {
      dropdown.style.display = 'block';
    }
  }
}

// Remove tag from a prompt
async function removeTagFromPrompt(promptId, tag) {
  try {
    // Save the current dropdown state
    const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
    const wasDropdownOpen = dropdown && dropdown.style.display === 'block';
    
    const response = await fetch(`/api/prompts/${promptId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Fetch all global tags to ensure we have the latest list
      await fetchGlobalTags();
      
      // Find the prompt in the global prompts array and update its tags
      const promptIndex = prompts.findIndex(p => p.id === promptId);
      if (promptIndex !== -1) {
        prompts[promptIndex].tags = data.prompt.tags;
      }
      
      // Update the tag list in the dropdown to show ALL tags
      const tagList = document.getElementById(`tag-list-${promptId}`);
      if (tagList) {
        tagList.innerHTML = renderGlobalTagsList(promptId, data.prompt.tags);
        
        // Add event listeners to checkboxes
        const checkboxes = tagList.querySelectorAll('.tag-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            updateSelectAllCheckbox(promptId);
            
            const tagValue = checkbox.getAttribute('data-tag');
            
            if (checkbox.checked) {
              await addTagToPrompt(promptId, tagValue);
            } else {
              await removeTagFromPrompt(promptId, tagValue);
            }
          });
        });
      }
      
      // Update select all checkbox
      updateSelectAllCheckbox(promptId);
      
      // If the modal is open and showing this prompt, update its tags too
      if (currentPromptId === promptId) {
        renderGlobalTagsInModal(data.prompt.tags);
      }
      
      showToast('success', `Tag "${tag}" removed from prompt`);
    } else {
      showToast('error', 'Error removing tag: ' + data.message);
    }
  } catch (error) {
    console.error('Error removing tag:', error);
    showToast('error', 'Error removing tag: ' + error.message);
  } finally {
    // Make sure dropdown stays open
    const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
    if (dropdown && document.body.getAttribute('data-active-dropdown') === promptId) {
      dropdown.style.display = 'block';
    }
  }
}

// Update all tag dropdowns with the latest global tags
function updateAllTagDropdowns() {
  // Get all open prompts
  const openPrompts = prompts;
  
  // Update all prompt cards - call the loadPrompts function
  loadPrompts();
  
  // If the modal is open, update its tags
  if (currentPromptId) {
    const currentPrompt = openPrompts.find(p => p.id === currentPromptId);
    if (currentPrompt) {
      renderModalTags(currentPrompt.tags || []);
    }
  }
}

// Render tags in the modal with global tags
function renderGlobalTagsInModal(promptTags) {
  const modalTagsList = document.getElementById('modal-tags-list');
  if (!modalTagsList) return;
  
  modalTagsList.innerHTML = '';
  
  if (globalTags.length === 0) {
    modalTagsList.innerHTML = '<p class="no-tags-message">No tags available. Add tags from the home page.</p>';
    return;
  }
  
  globalTags.forEach(tag => {
    const isChecked = promptTags.includes(tag) ? 'checked' : '';
    
    const tagOption = document.createElement('div');
    tagOption.className = 'modal-tag-option';
    
    tagOption.innerHTML = `
      <input type="checkbox" id="modal-tag-${tag}" class="tag-checkbox" data-tag="${tag}" ${isChecked}>
      <label for="modal-tag-${tag}">${tag}</label>
    `;
    
    modalTagsList.appendChild(tagOption);
    
    // Add event listener to checkbox
    const checkbox = tagOption.querySelector('.tag-checkbox');
    checkbox.addEventListener('change', function() {
      if (!currentPromptId) return;
      
      const tag = this.getAttribute('data-tag');
      
      if (this.checked) {
        // Add tag to current prompt
        addTagToPrompt(currentPromptId, tag);
      } else {
        // Remove tag from current prompt
        removeTagFromPrompt(currentPromptId, tag);
      }
    });
  });
}

// Initialize global tags
async function initializeGlobalTags() {
  // First try to fetch existing global tags
  await fetchGlobalTags();
  
  // If no tags exist yet, import from existing prompts
  if (globalTags.length === 0) {
    await importExistingTags();
  }
  
  // Override original functions to use global tags
  window.createTagDropdown = createGlobalTagDropdown;
  window.renderModalTags = renderGlobalTagsInModal;
}

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  initializeGlobalTags();
});