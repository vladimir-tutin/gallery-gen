const express = require('express');
const router = express.Router();
const promptService = require('../services/promptService');
const tagService = require('../services/tagService');
const sdApi = require('../services/sdApi');
const imageStorage = require('../services/imageStorage');
const axios = require('axios');

const SD_API_URL = 'http://localhost:7860/sdapi/v1';

// Check API status
router.get('/status', async (req, res) => {
  try {
    const isAvailable = await sdApi.checkApiStatus();
    res.json({ 
      success: true, 
      isAvailable,
      message: isAvailable 
        ? 'Stable Diffusion API is available' 
        : 'Stable Diffusion API is not available'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all prompts
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await promptService.getAllPrompts();
    res.json({ success: true, prompts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a single prompt by ID
router.get('/prompts/:id', async (req, res) => {
  try {
    const prompt = await promptService.getPromptById(req.params.id);
    res.json({ success: true, prompt });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Create a new prompt
router.post('/prompts', async (req, res) => {
  try {
    const newPrompt = await promptService.createPrompt(req.body);
    res.status(201).json({ success: true, prompt: newPrompt });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update an existing prompt
router.put('/prompts/:id', async (req, res) => {
  try {
    const updatedPrompt = await promptService.updatePrompt(req.params.id, req.body);
    res.json({ success: true, prompt: updatedPrompt });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Delete a prompt
router.delete('/prompts/:id', async (req, res) => {
  try {
    await promptService.deletePrompt(req.params.id);
    res.json({ success: true, message: 'Prompt deleted successfully' });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Get all images for a prompt
router.get('/prompts/:id/images', async (req, res) => {
  try {
    const result = await promptService.getPromptWithImages(req.params.id);
    res.json({ 
      success: true, 
      prompt: result.prompt,
      images: result.images 
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Generate images for a prompt
router.post('/prompts/:id/generate', async (req, res) => {
  try {
    // Get the prompt data
    const prompt = await promptService.getPromptById(req.params.id);
    
    // Check if there are tags to apply
    let modifiedPrompt = { ...prompt };
    if (req.body.tags && req.body.tags.length > 0) {
      // Append tags to the prompt text
      modifiedPrompt.prompt = `${prompt.prompt} ${req.body.tags.join(' ')}`;
    }
    
    // Generate images
    const count = req.body.count || 1;
    const images = await sdApi.generateImages(modifiedPrompt, count);
    
    res.json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate temporary image for a prompt (without setting as preview)
router.post('/prompts/:id/generate-temp', async (req, res) => {
  try {
    // Get the prompt data
    const prompt = await promptService.getPromptById(req.params.id);
    
    // Check if there are tags to apply
    let modifiedPrompt = { ...prompt };
    if (req.body.tags && req.body.tags.length > 0) {
      // Append tags to the prompt text
      modifiedPrompt.prompt = `${prompt.prompt} ${req.body.tags.join(' ')}`;
    }
    
    // Generate a single image
    const images = await sdApi.generateImages(modifiedPrompt, 1);
    
    res.json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set preview image for a prompt
router.post('/prompts/:id/preview/:imageId', async (req, res) => {
  try {
    const result = await imageStorage.setPreviewImage(req.params.id, req.params.imageId);
    
    // Get the updated prompt
    const updatedPrompt = await promptService.getPromptById(req.params.id);
    
    res.json({ 
      success: true, 
      prompt: updatedPrompt,
      previewImage: result.previewImage,
      previewThumbnail: result.previewThumbnail
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Delete an image
router.delete('/prompts/:id/images/:imageId', async (req, res) => {
  try {
    await imageStorage.deleteImage(req.params.id, req.params.imageId);
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Add a route to check the current model
router.get('/check-model', async (req, res) => {
    try {
      const settings = await sdApi.getCurrentSettings();
      res.json({ 
        success: true, 
        current_model: settings.sd_model_checkpoint,
        all_settings: settings
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

// Get available SD models
router.get('/models', async (req, res) => {
  try {
    const models = await sdApi.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== GLOBAL TAGS API ENDPOINTS =====

// Get all global tags
router.get('/tags', async (req, res) => {
  try {
    const tags = await tagService.getAllTags();
    res.json({ success: true, tags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a global tag
router.post('/tags', async (req, res) => {
  try {
    if (!req.body.tag) {
      return res.status(400).json({ success: false, message: 'Tag value is required' });
    }
    
    const updatedTags = await tagService.addTag(req.body.tag);
    res.json({ success: true, tags: updatedTags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove a global tag
router.delete('/tags/:tag', async (req, res) => {
  try {
    const updatedTags = await tagService.removeTag(req.params.tag);
    res.json({ success: true, tags: updatedTags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Import existing tags from all prompts
router.post('/tags/import', async (req, res) => {
  try {
    const prompts = await promptService.getAllPrompts();
    const updatedTags = await tagService.importExistingTags(prompts);
    res.json({ success: true, tags: updatedTags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add a tag to a prompt
router.post('/prompts/:id/tags', async (req, res) => {
  try {
    if (!req.body.tag) {
      return res.status(400).json({ success: false, message: 'Tag value is required' });
    }
    
    // First, add tag to global list
    await tagService.addTag(req.body.tag);
    
    // Then add to the prompt
    const updatedPrompt = await promptService.addTagToPrompt(req.params.id, req.body.tag);
    res.json({ success: true, prompt: updatedPrompt });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

// Remove a tag from a prompt
router.delete('/prompts/:id/tags/:tag', async (req, res) => {
  try {
    const updatedPrompt = await promptService.removeTagFromPrompt(req.params.id, req.params.tag);
    res.json({ success: true, prompt: updatedPrompt });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

module.exports = router;