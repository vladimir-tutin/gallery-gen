const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const imageStorage = require('./imageStorage');

const PROMPTS_DIR = path.join(__dirname, '..', 'data', 'prompts');

/**
 * Get all prompts
 * @returns {Promise<Array>} - Array of prompt objects
 */
async function getAllPrompts() {
  fs.ensureDirSync(PROMPTS_DIR);
  
  const files = await fs.readdir(PROMPTS_DIR);
  const promptFiles = files.filter(file => file.endsWith('.json'));
  
  const prompts = [];
  
  for (const file of promptFiles) {
    try {
      const promptData = await fs.readJson(path.join(PROMPTS_DIR, file));
      prompts.push(promptData);
    } catch (error) {
      console.error(`Error reading prompt file ${file}:`, error);
    }
  }
  
  // Sort by creation date (newest first)
  return prompts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get a single prompt by ID
 * @param {string} promptId - The prompt ID
 * @returns {Promise<Object>} - The prompt object
 */
async function getPromptById(promptId) {
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  
  if (!fs.existsSync(promptFile)) {
    throw new Error('Prompt not found');
  }
  
  const promptData = await fs.readJson(promptFile);
  return promptData;
}

/**
 * Create a new prompt
 * @param {Object} promptData - The prompt data
 * @returns {Promise<Object>} - The created prompt object
 */
async function createPrompt(promptData) {
  fs.ensureDirSync(PROMPTS_DIR);
  
  const promptId = uuidv4();
  const newPrompt = {
    id: promptId,
    prompt: promptData.prompt,
    negativePrompt: promptData.negativePrompt || "",
    seed: promptData.seed || -1,
    name: promptData.name || `Prompt ${new Date().toLocaleString()}`,
    previewImage: null,
    previewThumbnail: null,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  await fs.writeJson(promptFile, newPrompt, { spaces: 2 });
  
  return newPrompt;
}

/**
 * Update an existing prompt
 * @param {string} promptId - The prompt ID
 * @param {Object} promptData - The updated prompt data
 * @returns {Promise<Object>} - The updated prompt object
 */
async function updatePrompt(promptId, promptData) {
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  
  if (!fs.existsSync(promptFile)) {
    throw new Error('Prompt not found');
  }
  
  const existingPrompt = await fs.readJson(promptFile);
  
  const updatedPrompt = {
    ...existingPrompt,
    prompt: promptData.prompt || existingPrompt.prompt,
    negativePrompt: promptData.negativePrompt !== undefined ? promptData.negativePrompt : existingPrompt.negativePrompt,
    seed: promptData.seed !== undefined ? promptData.seed : existingPrompt.seed,
    name: promptData.name || existingPrompt.name,
    updatedAt: new Date().toISOString()
  };
  
  await fs.writeJson(promptFile, updatedPrompt, { spaces: 2 });
  
  return updatedPrompt;
}

/**
 * Delete a prompt and all its images
 * @param {string} promptId - The prompt ID
 * @returns {Promise<boolean>} - True if successful
 */
async function deletePrompt(promptId) {
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  const promptImagesDir = path.join(__dirname, '..', 'data', 'images', promptId);
  
  if (!fs.existsSync(promptFile)) {
    throw new Error('Prompt not found');
  }
  
  // Delete the prompt file
  await fs.remove(promptFile);
  
  // Delete all associated images if the directory exists
  if (fs.existsSync(promptImagesDir)) {
    await fs.remove(promptImagesDir);
  }
  
  return true;
}

/**
 * Get all images for a prompt with additional prompt data
 * @param {string} promptId - The prompt ID
 * @returns {Promise<Object>} - Object with prompt and images
 */
async function getPromptWithImages(promptId) {
  // Get the prompt data
  const prompt = await getPromptById(promptId);
  
  // Get all images for the prompt
  const images = await imageStorage.getImagesForPrompt(promptId);
  
  return {
    prompt,
    images
  };
}

/**
 * Add a tag to a prompt
 * @param {string} promptId - The prompt ID
 * @param {string} tag - The tag to add
 * @returns {Promise<Object>} - The updated prompt object
 */
async function addTagToPrompt(promptId, tag) {
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  
  if (!fs.existsSync(promptFile)) {
    throw new Error('Prompt not found');
  }
  
  const existingPrompt = await fs.readJson(promptFile);
  
  // Initialize tags array if it doesn't exist
  if (!existingPrompt.tags) {
    existingPrompt.tags = [];
  }
  
  // Check if tag already exists
  if (existingPrompt.tags.includes(tag)) {
    return existingPrompt; // Tag already exists, return unchanged prompt
  }
  
  // Add the new tag
  existingPrompt.tags.push(tag);
  existingPrompt.updatedAt = new Date().toISOString();
  
  await fs.writeJson(promptFile, existingPrompt, { spaces: 2 });
  
  return existingPrompt;
}

/**
 * Remove a tag from a prompt
 * @param {string} promptId - The prompt ID
 * @param {string} tag - The tag to remove
 * @returns {Promise<Object>} - The updated prompt object
 */
async function removeTagFromPrompt(promptId, tag) {
  const promptFile = path.join(PROMPTS_DIR, `${promptId}.json`);
  
  if (!fs.existsSync(promptFile)) {
    throw new Error('Prompt not found');
  }
  
  const existingPrompt = await fs.readJson(promptFile);
  
  // Check if tags array exists
  if (!existingPrompt.tags || !existingPrompt.tags.includes(tag)) {
    return existingPrompt; // Tag doesn't exist, return unchanged prompt
  }
  
  // Remove the tag
  existingPrompt.tags = existingPrompt.tags.filter(t => t !== tag);
  existingPrompt.updatedAt = new Date().toISOString();
  
  await fs.writeJson(promptFile, existingPrompt, { spaces: 2 });
  
  return existingPrompt;
}

/**
 * Get all unique tags across all prompts
 * @returns {Promise<Array>} - Array of unique tags
 */
async function getAllUniqueTags() {
  const prompts = await getAllPrompts();
  
  // Collect all tags from all prompts
  const allTags = [];
  prompts.forEach(prompt => {
    if (prompt.tags && Array.isArray(prompt.tags)) {
      allTags.push(...prompt.tags);
    }
  });
  
  // Return unique tags sorted alphabetically
  return [...new Set(allTags)].sort();
}

// Add this to the module.exports
module.exports = {
  getAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getPromptWithImages,
  addTagToPrompt,
  removeTagFromPrompt,
  getAllUniqueTags  // Add this new method
};