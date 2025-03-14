const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TAGS_FILE = path.join(DATA_DIR, 'global-tags.json');

/**
 * Initialize the tags file if it doesn't exist
 */
async function initTagsFile() {
  fs.ensureDirSync(DATA_DIR);
  
  if (!fs.existsSync(TAGS_FILE)) {
    await fs.writeJson(TAGS_FILE, { tags: [] }, { spaces: 2 });
  }
}

/**
 * Get all available tags
 * @returns {Promise<Array>} - Array of all tags
 */
async function getAllTags() {
  await initTagsFile();
  
  const tagsData = await fs.readJson(TAGS_FILE);
  return tagsData.tags || [];
}

/**
 * Add a new tag to the global tags list
 * @param {string} tag - The tag to add
 * @returns {Promise<Array>} - Updated array of all tags
 */
async function addTag(tag) {
  await initTagsFile();
  
  const tagsData = await fs.readJson(TAGS_FILE);
  const tags = tagsData.tags || [];
  
  // Check if tag already exists
  if (tags.includes(tag)) {
    return tags; // Tag already exists, return unchanged tags
  }
  
  // Add the new tag
  tags.push(tag);
  
  // Sort tags alphabetically
  tags.sort();
  
  await fs.writeJson(TAGS_FILE, { tags }, { spaces: 2 });
  
  return tags;
}

/**
 * Remove a tag from the global tags list
 * @param {string} tag - The tag to remove
 * @returns {Promise<Array>} - Updated array of all tags
 */
async function removeTag(tag) {
  await initTagsFile();
  
  const tagsData = await fs.readJson(TAGS_FILE);
  const tags = tagsData.tags || [];
  
  // Remove the tag
  const updatedTags = tags.filter(t => t !== tag);
  
  await fs.writeJson(TAGS_FILE, { tags: updatedTags }, { spaces: 2 });
  
  return updatedTags;
}

/**
 * Import all existing tags from prompts
 * @param {Array} prompts - Array of all prompt objects
 * @returns {Promise<Array>} - Updated array of all tags
 */
async function importExistingTags(prompts) {
  await initTagsFile();
  
  const tagsData = await fs.readJson(TAGS_FILE);
  let tags = tagsData.tags || [];
  
  // Collect all tags from all prompts
  const allPromptTags = [];
  prompts.forEach(prompt => {
    if (prompt.tags && Array.isArray(prompt.tags)) {
      allPromptTags.push(...prompt.tags);
    }
  });
  
  // Add unique tags
  const uniquePromptTags = [...new Set(allPromptTags)];
  
  // Merge with existing tags
  tags = [...new Set([...tags, ...uniquePromptTags])];
  
  // Sort tags alphabetically
  tags.sort();
  
  await fs.writeJson(TAGS_FILE, { tags }, { spaces: 2 });
  
  return tags;
}

// Initialize the tags file when the service is loaded
initTagsFile();

module.exports = {
  getAllTags,
  addTag,
  removeTag,
  importExistingTags
};