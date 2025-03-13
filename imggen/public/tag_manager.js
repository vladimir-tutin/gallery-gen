// Tag Manager - Separate file to manage tags
document.addEventListener('DOMContentLoaded', function() {
    setupTagManager();
  });
  
  // Set up the tag manager 
  function setupTagManager() {
    // Create tag manager UI
    createTagManagerUI();
    
    // Set up event listeners
    document.getElementById('open-tag-manager-btn').addEventListener('click', function() {
      document.getElementById('tag-manager-modal').style.display = 'block';
      loadAllPrompts();
    });
    
    document.getElementById('close-tag-manager').addEventListener('click', function() {
      document.getElementById('tag-manager-modal').style.display = 'none';
    });
    
    // Close when clicking outside
    document.getElementById('tag-manager-modal').addEventListener('click', function(e) {
      if (e.target === this) {
        this.style.display = 'none';
      }
    });
  }
  
  // Create tag manager UI
  function createTagManagerUI() {
    const tagManagerHTML = `
      <div id="tag-manager-modal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2>Tag Manager</h2>
            <button id="close-tag-manager" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div id="prompt-selector">
              <label for="prompt-select">Select Prompt:</label>
              <select id="prompt-select" class="form-control">
                <option value="">Loading prompts...</option>
              </select>
            </div>
            
            <div id="tag-management" style="margin-top: 1.5rem; display: none;">
              <h3 id="selected-prompt-name"></h3>
              
              <div class="current-tags" style="margin: 1rem 0;">
                <h4>Current Tags</h4>
                <div id="current-tags-list" class="tags-display">
                  <p>No tags yet</p>
                </div>
              </div>
              
              <div class="add-tag-section">
                <h4>Add New Tag</h4>
                <div class="form-row" style="margin-top: 0.5rem;">
                  <input type="text" id="new-tag-input" class="form-control" placeholder="Enter new tag">
                  <button id="add-tag-btn" class="btn primary">Add Tag</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button id="open-tag-manager-btn" class="btn primary" style="position: fixed; bottom: 20px; left: 20px; z-index: 100;">
        <i class="fas fa-tags"></i> Tag Manager
      </button>
    `;
    
    // Create a container for the tag manager
    const tagManagerContainer = document.createElement('div');
    tagManagerContainer.innerHTML = tagManagerHTML;
    document.body.appendChild(tagManagerContainer);
    
    // Add event listeners
    setTimeout(() => {
      const promptSelect = document.getElementById('prompt-select');
      promptSelect.addEventListener('change', function() {
        const promptId = this.value;
        if (promptId) {
          loadPromptTags(promptId);
        } else {
          document.getElementById('tag-management').style.display = 'none';
        }
      });
      
      document.getElementById('add-tag-btn').addEventListener('click', function() {
        const promptId = document.getElementById('prompt-select').value;
        const newTag = document.getElementById('new-tag-input').value.trim();
        
        if (promptId && newTag) {
          addNewTag(promptId, newTag);
        }
      });
    }, 100);
  }
  
  // Load all prompts for the selector
  async function loadAllPrompts() {
    try {
      const response = await fetch('/api/prompts');
      const data = await response.json();
      
      if (data.success) {
        const promptSelect = document.getElementById('prompt-select');
        promptSelect.innerHTML = '<option value="">Select a prompt...</option>';
        
        data.prompts.forEach(prompt => {
          const option = document.createElement('option');
          option.value = prompt.id;
          option.textContent = prompt.name;
          promptSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }
  
  // Load tags for selected prompt
  async function loadPromptTags(promptId) {
    try {
      const response = await fetch(`/api/prompts/${promptId}`);
      const data = await response.json();
      
      if (data.success) {
        const prompt = data.prompt;
        document.getElementById('selected-prompt-name').textContent = prompt.name;
        document.getElementById('tag-management').style.display = 'block';
        
        // Display current tags
        const currentTagsList = document.getElementById('current-tags-list');
        
        if (!prompt.tags || prompt.tags.length === 0) {
          currentTagsList.innerHTML = '<p>No tags yet</p>';
        } else {
          currentTagsList.innerHTML = '';
          
          prompt.tags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.innerHTML = `
              <span>${tag}</span>
              <button class="tag-delete-btn" data-tag="${tag}">
                <i class="fas fa-times"></i>
              </button>
            `;
            currentTagsList.appendChild(tagElement);
          });
          
          // Add event listeners to delete buttons
          const deleteButtons = currentTagsList.querySelectorAll('.tag-delete-btn');
          deleteButtons.forEach(btn => {
            btn.addEventListener('click', function() {
              const tag = this.dataset.tag;
              deleteTag(promptId, tag);
            });
          });
        }
      }
    } catch (error) {
      console.error('Error loading prompt tags:', error);
    }
  }
  
  // Add a new tag
  async function addNewTag(promptId, tag) {
    try {
      const response = await fetch(`/api/prompts/${promptId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag })
      });
      
      const data = await response.json();
      
      if (data.success) {
        document.getElementById('new-tag-input').value = '';
        showTagToast('success', `Tag "${tag}" added`);
        loadPromptTags(promptId);
      } else {
        showTagToast('error', 'Error adding tag: ' + data.message);
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      showTagToast('error', 'Error adding tag: ' + error.message);
    }
  }
  
  // Delete a tag
  async function deleteTag(promptId, tag) {
    try {
      const response = await fetch(`/api/prompts/${promptId}/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showTagToast('success', `Tag "${tag}" removed`);
        loadPromptTags(promptId);
      } else {
        showTagToast('error', 'Error removing tag: ' + data.message);
      }
    } catch (error) {
      console.error('Error removing tag:', error);
      showTagToast('error', 'Error removing tag: ' + error.message);
    }
  }
  
  // Show toast message
  function showTagToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
    }
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      const newToastContainer = document.createElement('div');
      newToastContainer.id = 'toast-container';
      newToastContainer.className = 'toast-container';
      document.body.appendChild(newToastContainer);
      newToastContainer.appendChild(toast);
    } else {
      toastContainer.appendChild(toast);
    }
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  // Add styles for the tag manager
  const tagStyles = document.createElement('style');
  tagStyles.textContent = `
    .tag-item {
      display: inline-flex;
      align-items: center;
      background-color: var(--primary-light);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 16px;
      margin: 0.25rem;
      font-size: 0.875rem;
    }
    
    .tag-delete-btn {
      background: none;
      border: none;
      color: white;
      margin-left: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
    }
    
    .tag-delete-btn:hover {
      color: var(--danger-color);
    }
    
    .tags-display {
      display: flex;
      flex-wrap: wrap;
      padding: 0.5rem;
      background-color: #f9fafb;
      border-radius: var(--border-radius);
      min-height: 50px;
    }
    
    .form-control {
      padding: 0.75rem;
      border: 1px solid var(--gray-light);
      border-radius: var(--border-radius);
      font-size: 1rem;
      flex: 1;
    }
  `;
  document.head.appendChild(tagStyles);