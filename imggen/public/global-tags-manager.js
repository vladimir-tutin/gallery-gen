// global-tags-manager.js - Add this to your public folder

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupGlobalTagsManager();
  });
  
  // Set up the global tags manager
  function setupGlobalTagsManager() {
    createGlobalTagsUI();
    
    // Set up event listeners after a short delay to ensure DOM is ready
    setTimeout(() => {
      document.getElementById('open-tags-manager-btn').addEventListener('click', function() {
        document.getElementById('global-tags-modal').style.display = 'block';
        loadAllGlobalTags();
      });
      
      document.getElementById('close-tags-manager').addEventListener('click', function() {
        document.getElementById('global-tags-modal').style.display = 'none';
      });
      
      // Close when clicking outside
      document.getElementById('global-tags-modal').addEventListener('click', function(e) {
        if (e.target === this) {
          this.style.display = 'none';
        }
      });
      
      // Add tag button
      document.getElementById('add-global-tag-btn').addEventListener('click', function() {
        addGlobalTag();
      });
      
      // Enter key in input field
      document.getElementById('new-global-tag-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addGlobalTag();
        }
      });
    }, 100);
  }
  
  // Create global tags manager UI
  function createGlobalTagsUI() {
    const tagsManagerHTML = `
      <div id="global-tags-modal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2>Global Tags Manager</h2>
            <button id="close-tags-manager" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>Manage all available tags that can be used across all prompts.</p>
            
            <div class="global-tags-section" style="margin: 1.5rem 0;">
              <h3>Available Tags</h3>
              <div id="global-tags-list" class="tags-display" style="margin-top: 1rem;">
                <p>Loading tags...</p>
              </div>
            </div>
            
            <div class="add-tag-section">
              <h3>Add New Global Tag</h3>
              <div class="form-row" style="margin-top: 0.5rem;">
                <input type="text" id="new-global-tag-input" class="form-control" placeholder="Enter new tag">
                <button id="add-global-tag-btn" class="btn primary">Add Tag</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button id="open-tags-manager-btn" class="btn primary" style="position: fixed; bottom: 20px; right: 20px; z-index: 100;">
        <i class="fas fa-tags"></i> Manage Global Tags
      </button>
    `;
    
    // Create a container for the tags manager
    const tagsManagerContainer = document.createElement('div');
    tagsManagerContainer.innerHTML = tagsManagerHTML;
    document.body.appendChild(tagsManagerContainer);
  }
  
  // Load all global tags
  async function loadAllGlobalTags() {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      
      if (data.success) {
        renderGlobalTags(data.tags);
      } else {
        showToast('error', 'Error loading tags: ' + data.message);
      }
    } catch (error) {
      showToast('error', 'Error loading tags: ' + error.message);
    }
  }
  
  // Render global tags in the manager
  function renderGlobalTags(tags) {
    const tagsContainer = document.getElementById('global-tags-list');
    
    if (!tags || tags.length === 0) {
      tagsContainer.innerHTML = '<p>No tags created yet. Add your first tag below.</p>';
      return;
    }
    
    tagsContainer.innerHTML = '';
    
    tags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'global-tag-item';
      tagElement.innerHTML = `
        <span>${tag}</span>
        <button class="tag-delete-btn" data-tag="${tag}">
          <i class="fas fa-times"></i>
        </button>
      `;
      tagsContainer.appendChild(tagElement);
    });
    
    // Add event listeners to delete buttons
    const deleteButtons = tagsContainer.querySelectorAll('.tag-delete-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const tag = this.dataset.tag;
        deleteGlobalTag(tag);
      });
    });
  }
  
  // Add a new global tag
  async function addGlobalTag() {
    const tagInput = document.getElementById('new-global-tag-input');
    const tag = tagInput.value.trim();
    
    if (!tag) return;
    
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag })
      });
      
      const data = await response.json();
      
      if (data.success) {
        tagInput.value = '';
        renderGlobalTags(data.tags);
        showToast('success', `Global tag "${tag}" added successfully`);
      } else {
        showToast('error', 'Error adding tag: ' + data.message);
      }
    } catch (error) {
      showToast('error', 'Error adding tag: ' + error.message);
    }
  }
  
  // Delete a global tag
  async function deleteGlobalTag(tag) {
    if (!confirm(`Are you sure you want to delete the tag "${tag}"? This will remove it from all prompts that use it.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/tags/${encodeURIComponent(tag)}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        renderGlobalTags(data.tags);
        showToast('success', `Tag "${tag}" removed successfully`);
      } else {
        showToast('error', 'Error removing tag: ' + data.message);
      }
    } catch (error) {
      showToast('error', 'Error removing tag: ' + error.message);
    }
  }
  
  // Add styles for the global tags manager
  const globalTagsStyles = document.createElement('style');
  globalTagsStyles.textContent = `
    .global-tag-item {
      display: inline-flex;
      align-items: center;
      background-color: var(--primary-light);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 16px;
      margin: 0.35rem;
      font-size: 0.9rem;
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
      color: rgba(255, 255, 255, 0.7);
    }
    
    .tags-display {
      display: flex;
      flex-wrap: wrap;
      padding: 1rem;
      background-color: #f9fafb;
      border-radius: var(--border-radius);
      min-height: 100px;
      border: 1px solid var(--gray-light);
    }
  `;
  document.head.appendChild(globalTagsStyles);