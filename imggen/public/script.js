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
      updateScrollIndicators();
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
  
  // Also update the mobile generate button
  updateMobileGenerateButton();
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
    
    // Set up the mobile generate button
    setupMobileGenerateButton();
    
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
  console.log("Setting up generate button");
  const generateImagesBtn = document.getElementById('generate-images-btn');
  
  if (generateImagesBtn) {
    console.log("Generate button found, adding event listener");
    // Remove any existing event listeners to prevent duplicates
    generateImagesBtn.removeEventListener('click', generateImages);
    // Add the event listener
    generateImagesBtn.addEventListener('click', generateImages);
  } else {
    console.error("Generate button not found!");
  }
}

// Generate images with improved error handling
async function generateImages() {
  console.log("Generate button clicked, currentPromptId:", currentPromptId);
  
  if (!currentPromptId) {
    showToast('error', 'No prompt selected. Please try again.');
    return;
  }
  
  const imageCount = parseInt(imageCountSlider.value);
  console.log("Generating", imageCount, "images");
  
  // Get selected tags, if any
  const selectedTags = [];
  const tagCheckboxes = document.querySelectorAll(`#modal-tags-list .tag-checkbox:checked`);
  tagCheckboxes.forEach(checkbox => {
    selectedTags.push(checkbox.dataset.tag);
  });
  
  if (selectedTags.length > 0) {
    console.log("Selected tags:", selectedTags);
  }
  
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
    
    console.log(`Sending request to /api/prompts/${currentPromptId}/generate`);
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
    console.log("API response:", data);
    
    if (data.success) {
      showToast('success', `${imageCount} image${imageCount > 1 ? 's' : ''} generated successfully`);
      
      // Refresh the image gallery
      console.log("Refreshing gallery");
      const promptResponse = await fetch(`/api/prompts/${currentPromptId}/images`);
      const promptData = await promptResponse.json();
      
      if (promptData.success) {
        renderImageGallery(promptData.images, promptData.prompt.previewImage);
      } else {
        console.error("Error refreshing gallery:", promptData);
        showToast('warning', 'Generated successfully but failed to refresh gallery');
      }
      
      // Refresh all prompts to update preview image if needed
      loadPrompts();
    } else {
      console.error("Generation failed:", data);
      showToast('error', 'Error generating images: ' + (data.message || 'Unknown error'));
    }
  } catch (error) {
    console.error("Exception in generateImages:", error);
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
    
    // Also update the mobile generate button if it exists
    const mobileGenerateBtn = document.getElementById('mobile-generate-btn');
    if (mobileGenerateBtn) {
      const button = mobileGenerateBtn.querySelector('button');
      if (button) button.disabled = true;
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
    
    // Also update the mobile generate button if it exists
    const mobileGenerateBtn = document.getElementById('mobile-generate-btn');
    if (mobileGenerateBtn) {
      const button = mobileGenerateBtn.querySelector('button');
      if (button) button.disabled = false;
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
    
    // Add click event handler for the image itself - ADDED FOR IMAGE VIEWER
    const img = imageContainer.querySelector('img');
    img.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Create full-screen modal for the image
      const viewerModal = document.createElement('div');
      viewerModal.className = 'image-viewer-modal';
      viewerModal.style.position = 'fixed';
      viewerModal.style.top = '0';
      viewerModal.style.left = '0';
      viewerModal.style.width = '100%';
      viewerModal.style.height = '100%';
      viewerModal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      viewerModal.style.display = 'flex';
      viewerModal.style.justifyContent = 'center';
      viewerModal.style.alignItems = 'center';
      viewerModal.style.zIndex = '2000';
      
      // Get all images from gallery for navigation
      const allImages = [];
      const galleryImages = imageGallery.querySelectorAll('.image-container');
      let currentIndex = 0;
      
      galleryImages.forEach((container, idx) => {
        const img = container.querySelector('img');
        if (img) {
          allImages.push({
            src: img.src,
            id: container.dataset.imageId
          });
          
          // Find current image index
          if (container.dataset.imageId === image.id) {
            currentIndex = idx;
          }
        }
      });
      
      // Add navigation buttons if there are multiple images
      let prevButton = '';
      let nextButton = '';
      
      if (allImages.length > 1) {
        prevButton = `
          <button id="prev-btn" style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 50%; font-size: 20px; cursor: pointer; display: ${currentIndex > 0 ? 'block' : 'none'}">
            <i class="fas fa-chevron-left"></i>
          </button>
        `;
        
        nextButton = `
          <button id="next-btn" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 50px; height: 50px; border-radius: 50%; font-size: 20px; cursor: pointer; display: ${currentIndex < allImages.length - 1 ? 'block' : 'none'}">
            <i class="fas fa-chevron-right"></i>
          </button>
        `;
      }
      
      // Add image counter if there are multiple images
      const counter = allImages.length > 1 ? 
        `<div style="position: absolute; bottom: 20px; color: white; background: rgba(0,0,0,0.5); padding: 5px 10px; border-radius: 15px;">
          <span id="img-counter">${currentIndex + 1}</span> of ${allImages.length}
        </div>` : '';
      
      // Create modal content
      viewerModal.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
          <button id="close-btn" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: white; font-size: 30px; cursor: pointer;">&times;</button>
          
          ${prevButton}
          
          <img id="fullsize-img" src="${image.path}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
          
          ${nextButton}
          
          ${counter}
        </div>
      `;
      
      // Add the modal to the body
      document.body.appendChild(viewerModal);
      
      // Prevent scrolling on the body
      document.body.style.overflow = 'hidden';
      
      // Close button functionality
      const closeBtn = document.getElementById('close-btn');
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(viewerModal);
        document.body.style.overflow = '';
      });
      
      // Close on background click
      viewerModal.addEventListener('click', (evt) => {
        if (evt.target === viewerModal) {
          document.body.removeChild(viewerModal);
          document.body.style.overflow = '';
        }
      });
      
      // Function to update the displayed image
      function updateImage(idx) {
        const fullsizeImg = document.getElementById('fullsize-img');
        const imgCounter = document.getElementById('img-counter');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        if (fullsizeImg) {
          fullsizeImg.src = allImages[idx].src;
        }
        
        if (imgCounter) {
          imgCounter.textContent = idx + 1;
        }
        
        if (prevBtn) {
          prevBtn.style.display = idx > 0 ? 'block' : 'none';
        }
        
        if (nextBtn) {
          nextBtn.style.display = idx < allImages.length - 1 ? 'block' : 'none';
        }
        
        currentIndex = idx;
      }
      
      // Previous button functionality
      const prevBtn = document.getElementById('prev-btn');
      if (prevBtn) {
        prevBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          if (currentIndex > 0) {
            updateImage(currentIndex - 1);
          }
        });
      }
      
      // Next button functionality
      const nextBtn = document.getElementById('next-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          if (currentIndex < allImages.length - 1) {
            updateImage(currentIndex + 1);
          }
        });
      }
      
      // Keyboard navigation
      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          document.body.removeChild(viewerModal);
          document.body.style.overflow = '';
          document.removeEventListener('keydown', handleKeyDown);
        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
          updateImage(currentIndex - 1);
        } else if (e.key === 'ArrowRight' && currentIndex < allImages.length - 1) {
          updateImage(currentIndex + 1);
        }
      }
      
      document.addEventListener('keydown', handleKeyDown);
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

// Modify the setupMobileGenerateButton function to ensure the button is always properly initialized
function setupMobileGenerateButton() {
  // Only run on mobile devices
  if (!isMobileDevice()) return;
  
  // Remove any existing button first to avoid duplicates
  const existingBtn = document.getElementById('mobile-generate-btn');
  if (existingBtn) existingBtn.remove();
  
  // Create the fixed generate button
  const mobileGenerateBtn = document.createElement('div');
  mobileGenerateBtn.id = 'mobile-generate-btn';
  mobileGenerateBtn.className = 'mobile-generate-btn';
  mobileGenerateBtn.innerHTML = `
    <button class="btn primary">
      <i class="fas fa-magic"></i> Generate Image
    </button>
  `;
  document.body.appendChild(mobileGenerateBtn);
  
  // Initially hide the button until cards are loaded
  mobileGenerateBtn.style.display = 'none';
  
  // Set up listeners for scroll to update button
  const promptCardsContainer = document.getElementById('prompt-cards');
  if (promptCardsContainer) {
    promptCardsContainer.addEventListener('scroll', updateMobileGenerateButton);
  }
  
  // Initial update after a delay to ensure cards are rendered
  setTimeout(updateMobileGenerateButton, 500);
  
  // Also force another update after a longer delay to catch any late rendering
  setTimeout(updateMobileGenerateButton, 2000);
  
  // Add click event directly to the button
  const button = mobileGenerateBtn.querySelector('button');
  button.addEventListener('click', function() {
    const promptId = mobileGenerateBtn.dataset.promptId;
    if (promptId) {
      console.log('Generating for prompt ID:', promptId);
      generateImageForCard(promptId);
    } else {
      // If no promptId is set, find the currently visible card
      const visibleCard = document.querySelector('.prompt-card.active-card');
      if (visibleCard) {
        const visiblePromptId = visibleCard.dataset.promptId;
        console.log('Fallback: Generating for visible prompt ID:', visiblePromptId);
        generateImageForCard(visiblePromptId);
      } else {
        console.error('No active prompt found');
        showToast('error', 'Could not determine which prompt to use');
      }
    }
  });
}

// Update the mobile generate button based on current visible card
// Update the mobile generate button based on current visible card
function updateMobileGenerateButton() {
  const mobileGenerateBtn = document.getElementById('mobile-generate-btn');
  if (!mobileGenerateBtn) return;
  
  // Get all prompt cards
  const cards = document.querySelectorAll('.prompt-card');
  if (cards.length === 0) {
    mobileGenerateBtn.style.display = 'none';
    return;
  }
  
  // Show the button since we have cards
  mobileGenerateBtn.style.display = 'block';
  
  // Find the card that's most visible in the viewport
  const cardsContainer = document.getElementById('prompt-cards');
  if (!cardsContainer) return;
  
  const scrollPosition = cardsContainer.scrollLeft;
  const containerWidth = cardsContainer.offsetWidth;
  
  let currentCard = null;
  let maxVisibility = 0;
  
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2;
    const screenCenterX = window.innerWidth / 2;
    const distanceFromCenter = Math.abs(cardCenterX - screenCenterX);
    
    // The card with center closest to screen center is most visible
    if (currentCard === null || distanceFromCenter < maxVisibility) {
      maxVisibility = distanceFromCenter;
      currentCard = card;
    }
  });
  
  // Mark the current card as active for visual feedback
  cards.forEach(card => card.classList.remove('active-card'));
  if (currentCard) {
    currentCard.classList.add('active-card');
    
    const promptId = currentCard.dataset.promptId;
    console.log('Active card prompt ID:', promptId);
    
    // Store the active prompt ID on the button element
    mobileGenerateBtn.dataset.promptId = promptId;
    
    // Update button text to include card name if available
    const cardTitle = currentCard.querySelector('.prompt-card-title');
    const cardName = cardTitle ? cardTitle.textContent.trim() : 'Image';
    const buttonText = mobileGenerateBtn.querySelector('button');
    buttonText.innerHTML = `<i class="fas fa-magic"></i> Generate "${cardName.substring(0, 15)}${cardName.length > 15 ? '...' : ''}"`;
    
    // Clear any existing click listeners
    const button = mobileGenerateBtn.querySelector('button');
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Add new click listener with explicit prompt ID to avoid closure issues
    newButton.addEventListener('click', function() {
      const activePromptId = mobileGenerateBtn.dataset.promptId;
      console.log('Generating for prompt ID:', activePromptId);
      generateImageForCard(activePromptId);
    });
  }
}

// Enhanced function to handle mobile card navigation
// Call updateMobileGenerateButton more aggressively
function enhanceMobileCardNavigation() {
  // Only run on mobile
  if (!isMobileDevice()) return;
  
  const cardsContainer = document.getElementById('prompt-cards');
  if (!cardsContainer) return;
  
  // Add scroll indicators for visual feedback
  addScrollIndicators();
  
  // Update indicators when scrolling
  cardsContainer.addEventListener('scroll', function() {
    updateScrollIndicators();
    updateMobileGenerateButton(); // Update generate button on each scroll
    
    // Mark the container as having been scrolled to hide the hint
    cardsContainer.classList.add('has-scrolled');
  });
  
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
        
        // Update the generate button after scroll animation completes
        setTimeout(updateMobileGenerateButton, 500);
      }
    }
    
    startX = null;
  }, { passive: true });
  
  // Also update the button periodically to handle any edge cases
  setInterval(updateMobileGenerateButton, 2000);
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
        setupMobileGenerateButton();
        enhanceMobileCardNavigation();
      } else {
        // Remove mobile generate button if switching to desktop
        const mobileGenerateBtn = document.getElementById('mobile-generate-btn');
        if (mobileGenerateBtn) {
          mobileGenerateBtn.remove();
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
    setupMobileGenerateButton();
    enhanceMobileCardNavigation();
  }
  
  // Set up periodic API status check
  setInterval(checkApiStatus, 60000); // Check every minute
});

// Initialize image count label
updateImageCountLabel();