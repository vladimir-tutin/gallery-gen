// DOM Elements
const apiStatusIndicator = document.getElementById('api-status-indicator');
const apiStatusText = document.getElementById('api-status-text');
const createPromptForm = document.getElementById('create-prompt-form');
const promptNameInput = document.getElementById('prompt-name');
const promptTextInput = document.getElementById('prompt-text');
const negativePromptInput = document.getElementById('negative-prompt');
const seedValueInput = document.getElementById('seed-value');
const promptCardsContainer = document.getElementById('prompt-cards');
const galleryLoadingIndicator = document.getElementById('gallery-loading');

// Modal Elements
const promptModal = document.getElementById('prompt-modal');
const modalPromptName = document.getElementById('modal-prompt-name');
const modalPromptText = document.getElementById('modal-prompt-text');
const modalNegativePrompt = document.getElementById('modal-negative-prompt');
const modalSeedValue = document.getElementById('modal-seed-value');
const updatePromptBtn = document.getElementById('update-prompt-btn');
const generateImagesBtn = document.getElementById('generate-images-btn');
const imageCountSlider = document.getElementById('image-count');
const imageCountLabel = document.getElementById('image-count-label');
const imageGallery = document.getElementById('image-gallery');
const imageGenerationStatus = document.getElementById('image-generation-status');

// Global state
let currentPromptId = null;
let prompts = [];
let lastUpdateTime = 0;
const updateThrottleTime = 300; // ms between updates

// Detect if we're on a mobile device for different drag behavior
function isMobileDevice() {
  return window.innerWidth <= 768;
}

// Check API Status
async function checkApiStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    if (data.success && data.isAvailable) {
      apiStatusIndicator.classList.add('available');
      apiStatusIndicator.classList.remove('unavailable');
      apiStatusText.textContent = 'Stable Diffusion API connected';
    } else {
      apiStatusIndicator.classList.add('unavailable');
      apiStatusIndicator.classList.remove('available');
      apiStatusText.textContent = 'Stable Diffusion API not available';
      showToast('error', 'Stable Diffusion API is not available. Please make sure it\'s running on localhost:7860');
    }
  } catch (error) {
    apiStatusIndicator.classList.add('unavailable');
    apiStatusIndicator.classList.remove('available');
    apiStatusText.textContent = 'Stable Diffusion API connection error';
    showToast('error', 'Error connecting to API: ' + error.message);
  }
}

// Load all prompts
async function loadPrompts() {
  try {
    galleryLoadingIndicator.style.display = 'flex';
    promptCardsContainer.innerHTML = '';
    
    const response = await fetch('/api/prompts');
    const data = await response.json();
    
    if (data.success) {
      prompts = data.prompts;
      renderPromptCards(prompts);
    } else {
      showToast('error', 'Error loading prompts: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error loading prompts: ' + error.message);
  } finally {
    galleryLoadingIndicator.style.display = 'none';
  }
}

// Save the card order to localStorage
function saveCardOrder() {
  const cards = document.querySelectorAll('.prompt-card');
  const order = Array.from(cards).map(card => card.dataset.promptId);
  localStorage.setItem('cardOrder', JSON.stringify(order));
}

// Load the card order from localStorage
function loadCardOrder() {
  const savedOrder = localStorage.getItem('cardOrder');
  if (!savedOrder) return null;
  
  try {
    return JSON.parse(savedOrder);
  } catch (error) {
    console.error('Error parsing saved card order:', error);
    return null;
  }
}

// Sort the prompts based on saved order
function sortPromptsByCustomOrder(prompts) {
  const customOrder = loadCardOrder();
  
  // If no custom order exists, return the original array
  if (!customOrder || !customOrder.length) return prompts;
  
  // Create a map for quick lookup
  const promptMap = new Map(prompts.map(prompt => [prompt.id, prompt]));
  
  // Create a new array based on the custom order
  const sortedPrompts = [];
  
  // First add prompts in the custom order
  customOrder.forEach(promptId => {
    if (promptMap.has(promptId)) {
      sortedPrompts.push(promptMap.get(promptId));
      promptMap.delete(promptId);
    }
  });
  
  // Then add any new prompts that weren't in the custom order
  promptMap.forEach(prompt => {
    sortedPrompts.push(prompt);
  });
  
  return sortedPrompts;
}

// Initialize drag and drop for prompt cards
function initDragAndDrop() {
  const cardsContainer = document.getElementById('prompt-cards');
  
  // Variables to track drag state
  let draggedCard = null;
  let startX, startY, startScrollLeft;
  let isDragging = false;
  
  // Touch event handlers for horizontal scrolling on mobile
  cardsContainer.addEventListener('touchstart', function(e) {
    if (isMobileDevice()) {
      startX = e.touches[0].pageX - cardsContainer.offsetLeft;
      startY = e.touches[0].pageY - cardsContainer.offsetTop;
      startScrollLeft = cardsContainer.scrollLeft;
    }
  });
  
  cardsContainer.addEventListener('touchmove', function(e) {
    // Only if we're on mobile and not dragging a card for reordering
    if (isMobileDevice() && !isDragging) {
      const x = e.touches[0].pageX - cardsContainer.offsetLeft;
      const y = e.touches[0].pageY - cardsContainer.offsetTop;
      
      // Calculate how far the touch has moved in x direction
      const deltaX = x - startX;
      
      // Move the scroll position of the container
      cardsContainer.scrollLeft = startScrollLeft - deltaX;
    }
  });
  
  // Desktop drag and drop functionality
  cardsContainer.addEventListener('dragstart', event => {
    // Only handle drag events from the card itself (not from buttons inside it)
    if (!event.target.closest('.card-generate-btn') && 
        !event.target.closest('.dropdown-toggle') &&
        !event.target.closest('.tag-dropdown-menu')) {
      draggedCard = event.target.closest('.prompt-card');
      if (!draggedCard) return;
      
      // Set the drag effect and data
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedCard.dataset.promptId);
      
      // Add a class to style the dragged element
      setTimeout(() => {
        draggedCard.classList.add('dragging');
      }, 0);
      
      isDragging = true;
    }
  });
  
  cardsContainer.addEventListener('dragend', event => {
    if (draggedCard) {
      draggedCard.classList.remove('dragging');
      draggedCard = null;
      
      // Save the new order after drop
      saveCardOrder();
      isDragging = false;
    }
  });
  
  cardsContainer.addEventListener('dragover', event => {
    // Prevent default to allow drop
    event.preventDefault();
    
    if (!draggedCard) return;
    
    // Get the card being dragged over
    const targetCard = event.target.closest('.prompt-card');
    if (!targetCard || targetCard === draggedCard) return;
    
    // Determine the drop position (different calculation for mobile)
    if (isMobileDevice()) {
      // For mobile horizontal layout, use X position
      const rect = targetCard.getBoundingClientRect();
      const mouseX = event.clientX;
      
      // Calculate the middle point of the target card
      const middleX = rect.left + rect.width / 2;
      
      // Get all cards
      const cards = Array.from(document.querySelectorAll('.prompt-card'));
      const draggedIndex = cards.indexOf(draggedCard);
      const targetIndex = cards.indexOf(targetCard);
      
      // Logic for horizontal layout
      if ((draggedIndex < targetIndex && mouseX < middleX) ||
          (draggedIndex > targetIndex && mouseX > middleX)) {
        return;
      }
      
      // Insert horizontally based on position
      if (mouseX < middleX) {
        cardsContainer.insertBefore(draggedCard, targetCard);
      } else {
        cardsContainer.insertBefore(draggedCard, targetCard.nextSibling);
      }
    } else {
      // For desktop vertical layout, use Y position
      const rect = targetCard.getBoundingClientRect();
      const mouseY = event.clientY;
      
      // Calculate the middle point of the target card
      const middleY = rect.top + rect.height / 2;
      
      // Get all cards
      const cards = Array.from(document.querySelectorAll('.prompt-card'));
      const draggedIndex = cards.indexOf(draggedCard);
      const targetIndex = cards.indexOf(targetCard);
      
      // Logic for vertical layout
      if ((draggedIndex < targetIndex && mouseY < middleY) ||
          (draggedIndex > targetIndex && mouseY > middleY)) {
        return;
      }
      
      // Insert vertically based on position
      if (mouseY < middleY) {
        cardsContainer.insertBefore(draggedCard, targetCard);
      } else {
        cardsContainer.insertBefore(draggedCard, targetCard.nextSibling);
      }
    }
  });
  
  // Add scroll indicators for mobile
  if (isMobileDevice()) {
    addScrollIndicators();
    
    // Update indicators when scrolling
    cardsContainer.addEventListener('scroll', () => {
      handleCardScroll();
    });
  }
}

// Add scroll indicators for mobile view
function addScrollIndicators() {
  const promptsGallery = document.getElementById('prompts-gallery');
  const cards = document.querySelectorAll('.prompt-card');
  
  // Remove existing indicators
  const existingIndicator = document.querySelector('.scroll-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  // If not enough cards, don't add indicators
  if (cards.length < 2) return;
  
  // Create indicator container
  const indicatorContainer = document.createElement('div');
  indicatorContainer.className = 'scroll-indicator';
  
  // Add a dot for each card
  for (let i = 0; i < cards.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'scroll-indicator-dot';
    if (i === 0) dot.classList.add('active');
    indicatorContainer.appendChild(dot);
  }
  
  // Add indicator after the cards container
  promptsGallery.appendChild(indicatorContainer);
  
  // Initial update
  updateScrollIndicators();
}

// Update scroll indicators based on scroll position
function updateScrollIndicators() {
  const cardsContainer = document.getElementById('prompt-cards');
  const cards = document.querySelectorAll('.prompt-card');
  const dots = document.querySelectorAll('.scroll-indicator-dot');
  
  if (!cardsContainer || cards.length === 0 || dots.length === 0) return;
  
  const scrollPosition = cardsContainer.scrollLeft;
  const containerWidth = cardsContainer.offsetWidth;
  
  // Calculate which card is most visible
  let activeIndex = 0;
  let maxVisibility = 0;
  
  cards.forEach((card, index) => {
    // Get card position relative to container
    const cardLeft = card.offsetLeft - cardsContainer.offsetLeft;
    const cardVisible = Math.min(
      cardLeft + card.offsetWidth - scrollPosition, // right edge
      containerWidth, // container width
      card.offsetWidth // card width
    ) - Math.max(cardLeft, scrollPosition, 0); // left edge
    
    // If this card is more visible than the current most visible
    if (cardVisible > maxVisibility) {
      maxVisibility = cardVisible;
      activeIndex = index;
    }
  });
  
  // Update active dot
  dots.forEach((dot, index) => {
    if (index === activeIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
  
  // Add active-card class to the most visible card
  cards.forEach((card, index) => {
    if (index === activeIndex) {
      card.classList.add('active-card');
    } else {
      card.classList.remove('active-card');
    }
  });
  
  // Update mobile buttons if they exist
  updateMobileButtons();
}

// Throttled scroll handler
function handleCardScroll() {
  const now = Date.now();
  if (now - lastUpdateTime < updateThrottleTime) {
    return; // Skip this update if too soon after the last one
  }
  
  updateScrollIndicators();
  
  // Mark the container as having been scrolled to hide the hint
  const cardsContainer = document.getElementById('prompt-cards');
  if (cardsContainer) {
    cardsContainer.classList.add('has-scrolled');
  }
  
  lastUpdateTime = now;
}

// Function to enable touch-based drag and drop on mobile
function enableMobileDragDrop() {
  if (!isMobileDevice()) return;
  
  const cards = document.querySelectorAll('.prompt-card');
  let draggedCard = null;
  let dragStartX, dragStartY;
  let initialPos;
  let isLongPress = false;
  let longPressTimer;
  
  cards.forEach(card => {
    // Handle long press to start dragging
    card.addEventListener('touchstart', function(e) {
      // Only start if touching the drag handle or card header
      const target = e.target;
      if (target.closest('.drag-handle') || target.closest('.prompt-card-title')) {
        e.preventDefault();
        
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        initialPos = card.getBoundingClientRect();
        
        // Long press detection (500ms)
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          draggedCard = card;
          card.classList.add('dragging');
          
          // Show visual feedback
          navigator.vibrate && navigator.vibrate(50);
        }, 500);
      }
    });
    
    // Cancel long press if moved too much
    card.addEventListener('touchmove', function(e) {
      if (!isLongPress) {
        const moveX = Math.abs(e.touches[0].clientX - dragStartX);
        const moveY = Math.abs(e.touches[0].clientY - dragStartY);
        
        // If moved more than 10px, cancel long press (for scrolling)
        if (moveX > 10 || moveY > 10) {
          clearTimeout(longPressTimer);
        }
      } else if (draggedCard) {
        e.preventDefault(); // Prevent scrolling while dragging
        // Handle drag repositioning here if needed
      }
    });
    
    // End dragging
    card.addEventListener('touchend', function() {
      clearTimeout(longPressTimer);
      
      if (isLongPress && draggedCard) {
        draggedCard.classList.remove('dragging');
        saveCardOrder();
        
        // Reset variables
        draggedCard = null;
        isLongPress = false;
      }
    });
  });
}

// Render all prompt cards
function renderPromptCards(prompts) {
  promptCardsContainer.innerHTML = '';
  
  // Remove any existing dropdowns
  const existingDropdowns = document.querySelectorAll('.tag-dropdown-menu');
  existingDropdowns.forEach(dropdown => dropdown.remove());
  
  if (prompts.length === 0) {
    promptCardsContainer.innerHTML = `
      <div class="no-prompts-message">
        <p>No prompts yet. Create your first prompt to get started!</p>
      </div>
    `;
    return;
  }
  
  // Sort prompts by custom order if available
  const sortedPrompts = sortPromptsByCustomOrder(prompts);
  
  sortedPrompts.forEach(prompt => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.promptId = prompt.id;
    card.draggable = true; // Make card draggable
    
    // Create preview image or placeholder
    let imageHtml = '';
    if (prompt.previewImage) {
      imageHtml = `<img src="${prompt.previewThumbnail || prompt.previewImage}" alt="${prompt.name}">`;
    } else {
      imageHtml = `<div class="no-image"><i class="fas fa-image"></i></div>`;
    }
    
    // Format date
    const createdDate = new Date(prompt.createdAt);
    const formattedDate = createdDate.toLocaleDateString();
    
    card.innerHTML = `
      <div class="prompt-card-image" data-prompt-id="${prompt.id}">${imageHtml}</div>
      <div class="prompt-card-content">
        <h3 class="prompt-card-title">${prompt.name}</h3>
        <p class="prompt-card-text">${prompt.prompt}</p>
        <div class="prompt-card-actions">
          <div class="card-generate-container">
            <button class="btn sm primary card-generate-btn" data-prompt-id="${prompt.id}">
              <i class="fas fa-magic"></i> Generate
            </button>
            <button class="btn sm primary dropdown-toggle" data-prompt-id="${prompt.id}">
              <i class="fas fa-caret-down"></i>
            </button>
          </div>
        </div>
        <div class="prompt-card-footer">
          <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
          <span class="card-status" id="status-${prompt.id}"></span>
          <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-lines"></i></span>
        </div>
      </div>
    `;
    
    promptCardsContainer.appendChild(card);
    
    // Create dropdown for tags
    createTagDropdown(prompt);
    
    // Add event listener for card title and image (to open modal)
    const cardImage = card.querySelector('.prompt-card-image');
    cardImage.addEventListener('click', (e) => {
      if (!e.target.closest('.card-generate-btn') && !e.target.closest('.dropdown-toggle')) {
        openPromptModal(prompt.id);
      }
    });
    
    const cardTitle = card.querySelector('.prompt-card-title');
    cardTitle.addEventListener('click', () => openPromptModal(prompt.id));
    
    // Add event listener for card generate button
    const generateBtn = card.querySelector('.card-generate-btn');
    generateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      generateImageForCard(prompt.id);
    });
    
    // Add event listener for dropdown toggle
    const dropdownToggle = card.querySelector('.dropdown-toggle');
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTagDropdown(prompt.id);
    });
  });
  
  // Initialize drag and drop after all cards are created
  initDragAndDrop();
  
  // Add this for mobile support
  if (isMobileDevice()) {
    enableMobileDragDrop();
    
    // Add scroll indicators for mobile
    setTimeout(() => {
      addScrollIndicators();
    }, 100);
    
    // Set up the mobile buttons
    setupMobileButtons();
    
    // Set up enhanced mobile navigation
    enhanceMobileCardNavigation();
  }
}

// Fixed createTagDropdown function that attaches dropdown to the card
function createTagDropdown(prompt) {
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
        ${renderTagList(prompt.id, prompt.tags || [])}
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
    checkboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  });
  
  // Add event listener for add tag button
  const addTagBtn = dropdown.querySelector('.add-tag-btn');
  addTagBtn.addEventListener('click', () => {
    const input = document.getElementById(`add-tag-input-${prompt.id}`);
    const tag = input.value.trim();
    
    if (tag) {
      addTagToPrompt(prompt.id, tag);
    }
  });
  
  // Add key press event for add tag input
  const addTagInput = dropdown.querySelector(`#add-tag-input-${prompt.id}`);
  addTagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = addTagInput.value.trim();
      if (tag) {
        addTagToPrompt(prompt.id, tag);
      }
    }
  });
  
  // Add event listeners for remove tag buttons
  const removeTagBtns = dropdown.querySelectorAll('.remove-tag-btn');
  removeTagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      removeTag(prompt.id, tag);
    });
  });
  
  // Add event listeners for tag checkboxes
  const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      updateSelectAllCheckbox(prompt.id);
    });
  });
  
  return dropdown;
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

// Render tag list for dropdown
function renderTagList(promptId, tags) {
  if (!tags || tags.length === 0) {
    return '<p class="no-tags-message">No tags yet. Add tags to enhance your prompts.</p>';
  }
  
  let html = '';
  tags.forEach(tag => {
    html += `
      <div class="tag-item">
        <div class="tag-checkbox-container">
          <input type="checkbox" id="tag-${promptId}-${tag}" class="tag-checkbox" data-tag="${tag}">
          <label for="tag-${promptId}-${tag}">${tag}</label>
        </div>
        <button type="button" class="remove-tag-btn" data-prompt-id="${promptId}" data-tag="${tag}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });
  
  return html;
}

// Toggle tag dropdown - revised to work with in-card dropdowns
function toggleTagDropdown(promptId) {
  const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
  if (!dropdown) return;
  
  // Close all other dropdowns first
  const allDropdowns = document.querySelectorAll('.tag-dropdown-menu');
  allDropdowns.forEach(d => {
    if (d.id !== `tag-dropdown-${promptId}`) {
      d.style.display = 'none';
    }
  });
  
  // Toggle the clicked dropdown
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    dropdown.style.display = 'block';
    
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
    dropdown.style.display = 'none';
    document.removeEventListener('click', closeTagDropdownsOnClickOutside);
  }
}

// Close tag dropdowns when clicking outside
function closeTagDropdownsOnClickOutside(event) {
  if (!event.target.closest('.tag-dropdown-menu') && !event.target.closest('.dropdown-toggle')) {
    const dropdowns = document.querySelectorAll('.tag-dropdown-menu');
    dropdowns.forEach(dropdown => {
      dropdown.style.display = 'none';
    });
    document.removeEventListener('click', closeTagDropdownsOnClickOutside);
  }
}

// Add a tag to a prompt
async function addTagToPrompt(promptId, tag) {
  try {
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
      // Clear the input
      const input = document.getElementById(`add-tag-input-${promptId}`);
      if (input) input.value = '';
      
      // Update the tag list in the dropdown
      const tagList = document.getElementById(`tag-list-${promptId}`);
      tagList.innerHTML = renderTagList(promptId, data.prompt.tags);
      
      // Add event listeners to new elements
      const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
      
      const removeTagBtns = dropdown.querySelectorAll('.remove-tag-btn');
      removeTagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.getAttribute('data-tag');
          removeTag(promptId, tag);
        });
      });
      
      const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          updateSelectAllCheckbox(promptId);
        });
      });
      
      // Update select all checkbox
      updateSelectAllCheckbox(promptId);
      
      showToast('success', `Tag "${tag}" added`);
    } else {
      showToast('error', 'Error adding tag: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error adding tag: ' + error.message);
  } finally {
    // Reset loading state
    const addTagBtn = document.querySelector(`.add-tag-btn[data-prompt-id="${promptId}"]`);
    if (addTagBtn) addTagBtn.disabled = false;
  }
}

// Remove a tag from a prompt
async function removeTag(promptId, tag) {
  try {
    const response = await fetch(`/api/prompts/${promptId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update the tag list in the dropdown
      const tagList = document.getElementById(`tag-list-${promptId}`);
      tagList.innerHTML = renderTagList(promptId, data.prompt.tags);
      
      // Add event listeners to remaining elements
      const dropdown = document.getElementById(`tag-dropdown-${promptId}`);
      
      const removeTagBtns = dropdown.querySelectorAll('.remove-tag-btn');
      removeTagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.getAttribute('data-tag');
          removeTag(promptId, tag);
        });
      });
      
      const checkboxes = dropdown.querySelectorAll('.tag-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          updateSelectAllCheckbox(promptId);
        });
      });
      
      // Update select all checkbox
      updateSelectAllCheckbox(promptId);
      
      showToast('success', `Tag "${tag}" removed`);
    } else {
      showToast('error', 'Error removing tag: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error removing tag: ' + error.message);
  }
}

// Create a new prompt
async function createPrompt(e) {
  e.preventDefault();
  
  const promptData = {
    name: promptNameInput.value,
    prompt: promptTextInput.value,
    negativePrompt: negativePromptInput.value,
    seed: parseInt(seedValueInput.value)
  };
  
  try {
    const response = await fetch('/api/prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promptData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', 'Prompt created successfully');
      createPromptForm.reset();
      
      // Close the collapsible section
      const section = document.getElementById('create-prompt-section');
      const content = section.querySelector('.collapsible-content');
      content.style.display = 'none';
      section.classList.remove('active');
      
      loadPrompts();
      
      // Open the prompt modal to generate images
      setTimeout(() => {
        openPromptModal(data.prompt.id);
      }, 500);
    } else {
      showToast('error', 'Error creating prompt: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error creating prompt: ' + error.message);
  }
}

// Open prompt modal
async function openPromptModal(promptId) {
  currentPromptId = promptId;
  
  try {
    const response = await fetch(`/api/prompts/${promptId}/images`);
    const data = await response.json();
    
    if (data.success) {
      // Fill modal with prompt data
      modalPromptName.textContent = data.prompt.name;
      modalPromptText.value = data.prompt.prompt;
      modalNegativePrompt.value = data.prompt.negativePrompt || '';
      modalSeedValue.value = data.prompt.seed || -1;
      
      // Render tags in modal
      renderModalTags(data.prompt.tags || []);
      
      // Render images in gallery
      renderImageGallery(data.images, data.prompt.previewImage);
      
      // Show the modal
      promptModal.style.display = 'block';
      
      // Ensure generate button is set up
      setTimeout(setupGenerateButton, 100);
    } else {
      showToast('error', 'Error loading prompt: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error loading prompt: ' + error.message);
  }
}

// Render tags in the modal
function renderModalTags(tags) {
  const modalTagsList = document.getElementById('modal-tags-list');
  if (!modalTagsList) return;
  
  modalTagsList.innerHTML = '';
  
  if (tags.length === 0) {
    modalTagsList.innerHTML = '<p class="no-tags-message">No tags available. Add tags from the home page.</p>';
    return;
  }
  
  tags.forEach(tag => {
    const tagOption = document.createElement('div');
    tagOption.className = 'modal-tag-option';
    
    tagOption.innerHTML = `
      <input type="checkbox" id="modal-tag-${tag}" class="tag-checkbox" data-tag="${tag}">
      <label for="modal-tag-${tag}">${tag}</label>
    `;
    
    modalTagsList.appendChild(tagOption);
  });
}

// Close prompt modal
function closePromptModal() {
  promptModal.style.display = 'none';
  currentPromptId = null;
  imageGallery.innerHTML = '';
}

// Update prompt
async function updatePrompt() {
  if (!currentPromptId) return;
  
  const promptData = {
    prompt: modalPromptText.value,
    negativePrompt: modalNegativePrompt.value,
    seed: parseInt(modalSeedValue.value)
  };
  
  try {
    const response = await fetch(`/api/prompts/${currentPromptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promptData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', 'Prompt updated successfully');
      loadPrompts();
    } else {
      showToast('error', 'Error updating prompt: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error updating prompt: ' + error.message);
  }
}

// Setup generate button
function setupGenerateButton() {
  const generateImagesBtn = document.getElementById('generate-images-btn');
  
  if (generateImagesBtn) {
    // Remove any existing event listeners to prevent duplicates
    generateImagesBtn.removeEventListener('click', generateImages);
    // Add the event listener
    generateImagesBtn.addEventListener('click', generateImages);
  }
}

// Generate images with improved error handling
async function generateImages() {
  if (!currentPromptId) {
    showToast('error', 'No prompt selected. Please try again.');
    return;
  }
  
  const imageCount = parseInt(imageCountSlider.value);
  
  // Get selected tags, if any
  const selectedTags = [];
  const tagCheckboxes = document.querySelectorAll(`#modal-tags-list .tag-checkbox:checked`);
  tagCheckboxes.forEach(checkbox => {
    selectedTags.push(checkbox.dataset.tag);
  });
  
  try {
    // Show generation status
    const statusElement = document.getElementById('image-generation-status');
    if (statusElement) {
      statusElement.style.display = 'flex';
      statusElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generating ${imageCount} image(s)...`;
    }
    
    if (generateImagesBtn) {
      generateImagesBtn.disabled = true;
    }
    
    const response = await fetch(`/api/prompts/${currentPromptId}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        count: imageCount,
        tags: selectedTags
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', `${imageCount} image${imageCount > 1 ? 's' : ''} generated successfully`);
      
      // Refresh the image gallery
      const promptResponse = await fetch(`/api/prompts/${currentPromptId}/images`);
      const promptData = await promptResponse.json();
      
      if (promptData.success) {
        renderImageGallery(promptData.images, promptData.prompt.previewImage);
      } else {
        showToast('warning', 'Generated successfully but failed to refresh gallery');
      }
      
      // Refresh all prompts to update preview image if needed
      loadPrompts();
    } else {
      showToast('error', 'Error generating images: ' + (data.message || 'Unknown error'));
    }
  } catch (error) {
    showToast('error', 'Error generating images: ' + error.message);
  } finally {
    const statusElement = document.getElementById('image-generation-status');
    if (statusElement) {
      statusElement.style.display = 'none';
    }
    
    if (generateImagesBtn) {
      generateImagesBtn.disabled = false;
    }
  }
}

// Generate image directly from the card
async function generateImageForCard(promptId) {
  const statusElement = document.getElementById(`status-${promptId}`);
  const cardImage = document.querySelector(`.prompt-card-image[data-prompt-id="${promptId}"]`);
  const generateBtn = document.querySelector(`.card-generate-btn[data-prompt-id="${promptId}"]`);
  
  // Get selected tags, if any
  const selectedTags = [];
  const checkboxes = document.querySelectorAll(`#tag-dropdown-${promptId} .tag-checkbox:checked`);
  checkboxes.forEach(checkbox => {
    selectedTags.push(checkbox.dataset.tag);
  });
  
  try {
    // Update UI to show generation in progress
    statusElement.textContent = 'Generating...';
    if (generateBtn) generateBtn.disabled = true;
    
    // Disable mobile buttons if they exist
    const mobileButtons = document.getElementById('mobile-buttons-container');
    if (mobileButtons) {
      const buttons = mobileButtons.querySelectorAll('button');
      buttons.forEach(button => {
        button.disabled = true;
      });
    }
    
    const response = await fetch(`/api/prompts/${promptId}/generate-temp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        count: 1,
        tags: selectedTags
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.images && data.images.length > 0) {
      // Update the card image with the new temporary image
      const image = data.images[0];
      cardImage.innerHTML = `<img src="${image.path}" alt="Generated image">`;
      
      // Show success message
      statusElement.textContent = 'Generated!';
      setTimeout(() => {
        statusElement.textContent = '';
      }, 3000);
      
      // Show selected tags in status if any
      if (selectedTags.length > 0) {
        statusElement.textContent = `Used tags: ${selectedTags.join(', ')}`;
        setTimeout(() => {
          statusElement.textContent = '';
        }, 5000);
      }
      
      showToast('success', 'Image generated! Open gallery to set as favorite.');
    } else {
      statusElement.textContent = 'Failed';
      setTimeout(() => {
        statusElement.textContent = '';
      }, 3000);
      
      showToast('error', 'Error generating image: ' + (data.message || 'Unknown error'));
    }
  } catch (error) {
    statusElement.textContent = 'Failed';
    setTimeout(() => {
      statusElement.textContent = '';
    }, 3000);
    
    showToast('error', 'Error generating image: ' + error.message);
  } finally {
    if (generateBtn) generateBtn.disabled = false;
    
    // Re-enable mobile buttons if they exist
    const mobileButtons = document.getElementById('mobile-buttons-container');
    if (mobileButtons) {
      const buttons = mobileButtons.querySelectorAll('button');
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }
}

// Render image gallery
function renderImageGallery(images, previewImage) {
  imageGallery.innerHTML = '';
  
  if (images.length === 0) {
    imageGallery.innerHTML = `
      <div class="no-images-message">
        <p>No images generated yet. Click "Generate Images" to create some!</p>
      </div>
    `;
    return;
  }
  
  images.forEach(image => {
    const isPreview = previewImage && previewImage.includes(image.filename);
    
    const imageContainer = document.createElement('div');
    imageContainer.className = `image-container ${isPreview ? 'is-preview' : ''}`;
    imageContainer.dataset.imageId = image.id;
    
    imageContainer.innerHTML = `
      <img src="${image.path}" alt="Generated image">
      <div class="image-actions">
        <button class="btn sm primary set-preview-btn" title="Set as preview">
          <i class="fas fa-star"></i>
        </button>
        <button class="btn sm danger delete-image-btn" title="Delete image">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    // Add click event handler for the image itself
    const img = imageContainer.querySelector('img');
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      viewFullImage(image.path);
    });
    
    // Add event listeners for image actions
    const setPreviewBtn = imageContainer.querySelector('.set-preview-btn');
    setPreviewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setPreviewImage(image.id);
    });
    
    const deleteImageBtn = imageContainer.querySelector('.delete-image-btn');
    deleteImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteImage(image.id);
    });
    
    imageGallery.appendChild(imageContainer);
  });
}

// Set preview image
async function setPreviewImage(imageId) {
  if (!currentPromptId) return;
  
  try {
    const response = await fetch(`/api/prompts/${currentPromptId}/preview/${imageId}`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', 'Preview image updated');
      
      // Update all preview markers in the gallery
      const allImageContainers = imageGallery.querySelectorAll('.image-container');
      allImageContainers.forEach(container => {
        container.classList.remove('is-preview');
        if (container.dataset.imageId === imageId) {
          container.classList.add('is-preview');
        }
      });
      
      // Reload prompts to update cards
      loadPrompts();
    } else {
      showToast('error', 'Error setting preview image: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error setting preview image: ' + error.message);
  }
}

// Delete image
async function deleteImage(imageId) {
  if (!currentPromptId) return;
  
  if (!confirm('Are you sure you want to delete this image?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/prompts/${currentPromptId}/images/${imageId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('success', 'Image deleted successfully');
      
      // Refresh the image gallery
      const promptResponse = await fetch(`/api/prompts/${currentPromptId}/images`);
      const promptData = await promptResponse.json();
      
      if (promptData.success) {
        renderImageGallery(promptData.images, promptData.prompt.previewImage);
      }
      
      // Refresh all prompts to update preview image if needed
      loadPrompts();
    } else {
      showToast('error', 'Error deleting image: ' + data.message);
    }
  } catch (error) {
    showToast('error', 'Error deleting image: ' + error.message);
  }
}

// Function to view a full image
function viewFullImage(imagePath) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  
  modal.innerHTML = `
    <img src="${imagePath}" style="max-width: 90%; max-height: 90%;">
    <button style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: white; font-size: 30px; cursor: pointer;">&times;</button>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden'; // Prevent scrolling
  
  // Close button
  const closeBtn = modal.querySelector('button');
  closeBtn.onclick = function(e) {
    e.stopPropagation();
    document.body.removeChild(modal);
    document.body.style.overflow = '';
  };
  
  // Close on background click
  modal.onclick = function(e) {
    if (e.target === modal) {
      document.body.removeChild(modal);
      document.body.style.overflow = '';
    }
  };
}

// Show toast notification
function showToast(type, message) {
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
    case 'info':
      icon = '<i class="fas fa-info-circle"></i>';
      break;
    case 'warning':
      icon = '<i class="fas fa-exclamation-triangle"></i>';
      break;
  }
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  
  const toastContainer = document.getElementById('toast-container');
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Update image count label
function updateImageCountLabel() {
  imageCountLabel.textContent = imageCountSlider.value;
}

// Toggle collapsible section
function toggleCollapsible(header) {
  const section = header.closest('.collapsible-section');
  const content = section.querySelector('.collapsible-content');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    section.classList.add('active');
  } else {
    content.style.display = 'none';
    section.classList.remove('active');
  }
}

// Setup collapsible sections
function setupCollapsibleSections() {
  const headers = document.querySelectorAll('.collapsible-header');
  
  headers.forEach(header => {
    header.addEventListener('click', () => {
      toggleCollapsible(header);
    });
  });
}

// Setup the mobile buttons container with generate and tag buttons
function setupMobileButtons() {
  // Only run on mobile devices
  if (!isMobileDevice()) return;
  
  // Remove existing mobile generate button if it exists
  const existingGenerateBtn = document.getElementById('mobile-generate-btn');
  if (existingGenerateBtn && existingGenerateBtn.parentElement && existingGenerateBtn.parentElement.id !== 'mobile-buttons-container') {
    existingGenerateBtn.parentElement.remove();
  }
  
  // Check if the container already exists
  let buttonsContainer = document.getElementById('mobile-buttons-container');
  
  // Create the container if it doesn't exist
  if (!buttonsContainer) {
    buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'mobile-buttons-container';
    buttonsContainer.className = 'mobile-buttons-container';
    
    // Add generate and tag buttons
    buttonsContainer.innerHTML = `
      <button id="mobile-generate-btn" class="btn mobile-generate-btn">
        <i class="fas fa-magic"></i> Generate Image
      </button>
      <button id="mobile-tag-btn" class="btn mobile-tag-btn">
        <i class="fas fa-tags"></i>
      </button>
    `;
    
    document.body.appendChild(buttonsContainer);
    
    // Create tag modal
    createTagModal();
    
    // Add click event for tag button
    const tagBtn = document.getElementById('mobile-tag-btn');
    if (tagBtn) {
      tagBtn.addEventListener('click', function() {
        openTagModal();
      });
    }
  }
  
  // Add click event for generate button
  const generateBtn = document.getElementById('mobile-generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', function() {
      const visibleCard = document.querySelector('.prompt-card.active-card');
      if (visibleCard) {
        const promptId = visibleCard.dataset.promptId;
        generateImageForCard(promptId);
      } else {
        showToast('error', 'Could not determine which prompt to use');
      }
    });
  }
  
  // Initially hide the container until cards are loaded
  buttonsContainer.style.display = 'none';
  
  // Set up listeners for scroll to update active card
  const promptCardsContainer = document.getElementById('prompt-cards');
  if (promptCardsContainer) {
    promptCardsContainer.addEventListener('scroll', handleCardScroll);
  }
  
  // Initial update
  setTimeout(updateActiveCard, 500);
}

// Update mobile buttons based on active card
function updateMobileButtons() {
  const buttonsContainer = document.getElementById('mobile-buttons-container');
  if (!buttonsContainer) return;
  
  const activeCard = document.querySelector('.prompt-card.active-card');
  if (!activeCard) {
    buttonsContainer.style.display = 'none';
    return;
  }
  
  // Show the buttons since we have an active card
  buttonsContainer.style.display = 'flex';
  
  // Store the current prompt ID on the buttons container for later use
  const promptId = activeCard.dataset.promptId;
  buttonsContainer.dataset.promptId = promptId;
  
  // Update generate button text with the prompt name
  const generateBtn = document.getElementById('mobile-generate-btn');
  if (generateBtn) {
    const cardTitle = activeCard.querySelector('.prompt-card-title');
    if (cardTitle) {
      const cardName = cardTitle.textContent.trim();
      const shortName = cardName.length > 15 ? cardName.substring(0, 12) + '...' : cardName;
      generateBtn.innerHTML = `<i class="fas fa-magic"></i> Generate "${shortName}"`;
    } else {
      generateBtn.innerHTML = `<i class="fas fa-magic"></i> Generate Image`;
    }
  }
}

// Update the active card
function updateActiveCard() {
  const now = Date.now();
  if (now - lastUpdateTime < updateThrottleTime) {
    return; // Skip this update if too soon after the last one
  }
  lastUpdateTime = now;
  
  updateScrollIndicators(); // This will also set the active-card class
  updateMobileButtons(); // Update the mobile buttons based on active card
}

// Create the tag modal
function createTagModal() {
  // Check if modal already exists
  if (document.getElementById('mobile-tag-modal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'mobile-tag-modal';
  modal.className = 'mobile-tag-modal';
  
  modal.innerHTML = `
    <div class="mobile-tag-modal-content">
      <div class="mobile-tag-modal-header">
        <h3>Prompt Tags</h3>
        <button class="mobile-tag-modal-close">&times;</button>
      </div>
      <div class="mobile-tag-list" id="mobile-tag-list">
        <!-- Tags will be populated here -->
      </div>
      <div class="mobile-add-tag-container">
        <input type="text" class="mobile-add-tag-input" id="mobile-add-tag-input" placeholder="Add new tag">
        <button class="mobile-add-tag-btn" id="mobile-add-tag-btn">Add</button>
      </div>
      <div class="mobile-tag-actions">
        <button class="mobile-tag-cancel" id="mobile-tag-cancel">Cancel</button>
        <button class="mobile-tag-apply" id="mobile-tag-apply">Apply</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = modal.querySelector('.mobile-tag-modal-close');
  closeBtn.addEventListener('click', closeTagModal);
  
  const cancelBtn = document.getElementById('mobile-tag-cancel');
  cancelBtn.addEventListener('click', closeTagModal);
  
  const applyBtn = document.getElementById('mobile-tag-apply');
  applyBtn.addEventListener('click', applyTags);
  
  const addTagBtn = document.getElementById('mobile-add-tag-btn');
  addTagBtn.addEventListener('click', addNewTag);
  
  const addTagInput = document.getElementById('mobile-add-tag-input');
  addTagInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addNewTag();
    }
  });
  
  // Close modal when clicking outside content
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeTagModal();
    }
  });
}

// Open the tag modal and populate it with the current card's tags
function openTagModal() {
  const modal = document.getElementById('mobile-tag-modal');
  if (!modal) return;
  
  // Get the active card
  const activeCard = document.querySelector('.prompt-card.active-card');
  if (!activeCard) {
    showToast('error', 'No active card found');
    return;
  }
  
  const promptId = activeCard.dataset.promptId;
  if (!promptId) {
    showToast('error', 'Could not determine prompt ID');
    return;
  }
  
  // Store the prompt ID on the modal
  modal.dataset.promptId = promptId;
  
  // Get card title for the header
  const cardTitle = activeCard.querySelector('.prompt-card-title');
  const cardName = cardTitle ? cardTitle.textContent.trim() : 'Prompt';
  
  // Update modal header
  const header = modal.querySelector('.mobile-tag-modal-header h3');
  if (header) {
    header.textContent = `Tags for "${cardName}"`;
  }
  
  // Load all available tags and the prompt's selected tags
  fetchTagsForModal(promptId);
  
  // Show the modal
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
}

// Close the tag modal
function closeTagModal() {
  const modal = document.getElementById('mobile-tag-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Fetch all available tags and the prompt's selected tags
async function fetchTagsForModal(promptId) {
  try {
    // Show loading state
    const tagList = document.getElementById('mobile-tag-list');
    if (tagList) {
      tagList.innerHTML = '<div class="loading-tags">Loading tags...</div>';
    }
    
    // Get all global tags
    const tagsResponse = await fetch('/api/tags');
    const tagsData = await tagsResponse.json();
    
    // Get prompt details to know which tags are selected
    const promptResponse = await fetch(`/api/prompts/${promptId}`);
    const promptData = await promptResponse.json();
    
    if (tagsData.success && promptData.success) {
      const allTags = tagsData.tags || [];
      const promptTags = promptData.prompt.tags || [];
      
      // Render tags in the modal
      renderTagsInModal(allTags, promptTags);
    } else {
      showToast('error', 'Error loading tags');
      if (tagList) {
        tagList.innerHTML = '<div class="error-message">Error loading tags</div>';
      }
    }
  } catch (error) {
    console.error('Error fetching tags:', error);
    showToast('error', 'Error loading tags: ' + error.message);
    
    const tagList = document.getElementById('mobile-tag-list');
    if (tagList) {
      tagList.innerHTML = '<div class="error-message">Error loading tags</div>';
    }
  }
}

// Render tags in the modal
function renderTagsInModal(allTags, selectedTags) {
  const tagList = document.getElementById('mobile-tag-list');
  if (!tagList) return;
  
  // Clear existing tags
  tagList.innerHTML = '';
  
  if (allTags.length === 0) {
    tagList.innerHTML = '<div class="no-tags-message">No tags available. Add your first tag below.</div>';
    return;
  }
  
  // Render each tag
  allTags.forEach(tag => {
    const isSelected = selectedTags.includes(tag);
    const tagElement = document.createElement('div');
    tagElement.className = `mobile-tag-item${isSelected ? ' selected' : ''}`;
    tagElement.dataset.tag = tag;
    tagElement.textContent = tag;
    
    // Add click event to toggle selection
    tagElement.addEventListener('click', function() {
      this.classList.toggle('selected');
    });
    
    tagList.appendChild(tagElement);
  });
}

// Add a new tag
async function addNewTag() {
  const input = document.getElementById('mobile-add-tag-input');
  if (!input) return;
  
  const tag = input.value.trim();
  if (!tag) {
    showToast('error', 'Please enter a tag name');
    return;
  }
  
  try {
    // Add to global tags first
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tag })
    });
    
    const data = await response.json();
    
    if (data.success) {
      input.value = ''; // Clear input
      
      // Refresh tags in modal
      const modal = document.getElementById('mobile-tag-modal');
      if (modal) {
        const promptId = modal.dataset.promptId;
        if (promptId) {
          fetchTagsForModal(promptId);
        }
      }
      
      showToast('success', `Tag "${tag}" added`);
    } else {
      showToast('error', 'Error adding tag: ' + data.message);
    }
  } catch (error) {
    console.error('Error adding tag:', error);
    showToast('error', 'Error adding tag: ' + error.message);
  }
}

// Apply the selected tags to the current prompt
async function applyTags() {
  const modal = document.getElementById('mobile-tag-modal');
  if (!modal) return;
  
  const promptId = modal.dataset.promptId;
  if (!promptId) {
    showToast('error', 'No prompt ID found');
    return;
  }
  
  // Get all selected tags
  const selectedTagElements = document.querySelectorAll('.mobile-tag-item.selected');
  const selectedTags = Array.from(selectedTagElements).map(el => el.dataset.tag);
  
  try {
    // First get the current prompt to know its existing tags
    const promptResponse = await fetch(`/api/prompts/${promptId}`);
    const promptData = await promptResponse.json();
    
    if (promptData.success) {
      const currentTags = promptData.prompt.tags || [];
      
      // Find tags to add (in selected but not in current)
      const tagsToAdd = selectedTags.filter(tag => !currentTags.includes(tag));
      
      // Find tags to remove (in current but not in selected)
      const tagsToRemove = currentTags.filter(tag => !selectedTags.includes(tag));
      
      // Add new tags
      for (const tag of tagsToAdd) {
        await fetch(`/api/prompts/${promptId}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tag })
        });
      }
      
      // Remove tags that are no longer selected
      for (const tag of tagsToRemove) {
        await fetch(`/api/prompts/${promptId}/tags/${encodeURIComponent(tag)}`, {
          method: 'DELETE'
        });
      }
      
      if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
        showToast('success', 'Tags updated successfully');
      } else {
        showToast('info', 'No changes to tags');
      }
      
      // Close the modal
      closeTagModal();
    } else {
      showToast('error', 'Error updating tags: ' + promptData.message);
    }
  } catch (error) {
    console.error('Error applying tags:', error);
    showToast('error', 'Error updating tags: ' + error.message);
  }
}

// Enhanced function to handle mobile card navigation
function enhanceMobileCardNavigation() {
  // Only run on mobile
  if (!isMobileDevice()) return;
  
  const cardsContainer = document.getElementById('prompt-cards');
  if (!cardsContainer) return;
  
  // Add scroll indicators for visual feedback
  addScrollIndicators();
  
  // Remove existing listeners to prevent duplicates
  cardsContainer.removeEventListener('scroll', handleCardScroll);
  
  // Update indicators when scrolling with throttling
  cardsContainer.addEventListener('scroll', handleCardScroll, { passive: true });
  
  // Add swipe navigation (optional)
  let startX, startTime;
  
  cardsContainer.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startTime = new Date().getTime();
  }, { passive: true });
  
  cardsContainer.addEventListener('touchend', function(e) {
    if (!startX) return;
    
    const endX = e.changedTouches[0].clientX;
    const endTime = new Date().getTime();
    const deltaX = endX - startX;
    const deltaTime = endTime - startTime;
    
    // Determine if it was a swipe (fast enough and long enough)
    if (deltaTime < 300 && Math.abs(deltaX) > 50) {
      const cards = document.querySelectorAll('.prompt-card');
      if (cards.length < 2) return;
      
      // Find the current card
      let currentCardIndex = 0;
      let maxVisibility = 0;
      
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const visibility = Math.min(
          rect.right, 
          window.innerWidth
        ) - Math.max(rect.left, 0);
        
        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          currentCardIndex = index;
        }
      });
      
      // Calculate target card based on swipe direction
      let targetCardIndex;
      if (deltaX > 0) {
        // Swiped right, go to previous card
        targetCardIndex = Math.max(0, currentCardIndex - 1);
      } else {
        // Swiped left, go to next card
        targetCardIndex = Math.min(cards.length - 1, currentCardIndex + 1);
      }
      
      // Scroll to the target card
      if (targetCardIndex !== currentCardIndex) {
        cards[targetCardIndex].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center'
        });
        
        // Update the active card after scroll animation completes
        setTimeout(updateActiveCard, 500);
      }
    }
    
    startX = null;
  }, { passive: true });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check API status on load
  checkApiStatus();
  
  // Load prompts on page load
  loadPrompts();
  
  // Setup collapsible sections
  setupCollapsibleSections();
  
  // Setup generate button
  setupGenerateButton();
  
  // Update image count label when slider changes
  imageCountSlider.addEventListener('input', updateImageCountLabel);
  
  // Create prompt form submission
  createPromptForm.addEventListener('submit', createPrompt);
  
  // Update prompt button click
  updatePromptBtn.addEventListener('click', updatePrompt);
  
  // Close modal when clicking outside or on close button
  promptModal.addEventListener('click', (e) => {
    if (e.target === promptModal) {
      closePromptModal();
    }
  });
  
  const modalCloseBtn = document.querySelector('.modal-close');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closePromptModal);
  }
  
  // Add resize handler to adjust layout when switching between mobile and desktop
  window.addEventListener('resize', function() {
    const wasMobile = document.body.classList.contains('mobile-layout');
    const isMobile = isMobileDevice();
    
    if (wasMobile !== isMobile) {
      document.body.classList.toggle('mobile-layout', isMobile);
      
      if (isMobile) {
        setupMobileButtons();
        enhanceMobileCardNavigation();
      } else {
        // Remove mobile buttons if switching to desktop
        const buttonsContainer = document.getElementById('mobile-buttons-container');
        if (buttonsContainer) {
          buttonsContainer.remove();
        }
        
        // Remove tag modal
        const tagModal = document.getElementById('mobile-tag-modal');
        if (tagModal) {
          tagModal.remove();
        }
      }
      
      // Reload the layout with a slight delay to ensure DOM updates
      setTimeout(() => {
        loadPrompts();
      }, 300);
    }
  });
  
  // Set initial mobile class
  document.body.classList.toggle('mobile-layout', isMobileDevice());
  
  // Setup mobile-specific features if on mobile
  if (isMobileDevice()) {
    setupMobileButtons();
    enhanceMobileCardNavigation();
  }
  
  // Set up periodic API status check
  setInterval(checkApiStatus, 60000); // Check every minute
});

// Initialize image count label
updateImageCountLabel();