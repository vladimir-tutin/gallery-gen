const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const DATA_DIR = path.join(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const PROMPTS_DIR = path.join(DATA_DIR, 'prompts');

/**
 * Ensure all required directories exist
 */
function ensureDirectories() {
  fs.ensureDirSync(DATA_DIR);
  fs.ensureDirSync(IMAGES_DIR);
  fs.ensureDirSync(PROMPTS_DIR);
}

/**
 * Save an image to disk
 * @param {string} promptId - The prompt ID
 * @param {string} filename - The filename
 * @param {Buffer} imageBuffer - The image data
 * @returns {Object} - Object with image details
 */
async function saveImage(promptId, filename, imageBuffer) {
  const promptDir = path.join(IMAGES_DIR, promptId);
  fs.ensureDirSync(promptDir);
  
  const imagePath = path.join(promptDir, filename);
  
  // Save the original image
  await fs.writeFile(imagePath, imageBuffer);
  
  // Create a thumbnail version
  const thumbnailPath = path.join(promptDir, `thumb_${filename}`);
  await createThumbnail(imageBuffer, thumbnailPath);
  
  return {
    id: path.basename(filename, '.png'),
    filename,
    path: `/images/${promptId}/${filename}`,
    thumbnailPath: `/images/${promptId}/thumb_${filename}`,
    createdAt: new Date().toISOString()
  };
}

/**
 * Create a thumbnail image
 * @param {Buffer} imageBuffer - The original image data
 * @param {string} outputPath - Path to save the thumbnail
 * @returns {Promise<void>}
 */
async function createThumbnail(imageBuffer, outputPath) {
  await sharp(imageBuffer)
    .resize(256, null, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

/**
 * Get all images for a prompt
 * @param {string} promptId - The prompt ID
 * @returns {Array} - Array of image objects
 */
async function getImagesForPrompt(promptId) {
  const promptDir = path.join(IMAGES_DIR, promptId);
  
  if (!fs.existsSync(promptDir)) {
    return [];
  }
  
  const files = await fs.readdir(promptDir);
  const imageFiles = files.filter(file => 
    !file.startsWith('thumb_') && 
    (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
  );
  
  return imageFiles.map(filename => {
    const stats = fs.statSync(path.join(promptDir, filename));
    return {
      id: path.basename(filename, path.extname(filename)),
      filename,
      path: `/images/${promptId}/${filename}`,
      thumbnailPath: `/images/${promptId}/thumb_${filename}`,
      createdAt: stats.birthtime.toISOString()
    };
  }).sort((a, b) => {
    // Sort by creation date (newest first)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * Set preview image for a prompt
 * @param {string} promptId - The prompt ID
 * @param {string} imageId - The image ID
 * @returns {Promise<string>} - Path to the preview image
 */
async function setPreviewImage(promptId, imageId) {
  const promptDir = path.join(IMAGES_DIR, promptId);
  const promptData = path.join(PROMPTS_DIR, `${promptId}.json`);
  
  if (!fs.existsSync(promptDir) || !fs.existsSync(promptData)) {
    throw new Error('Prompt not found');
  }
  
  // Find the image file
  const files = await fs.readdir(promptDir);
  const imageFile = files.find(file => 
    !file.startsWith('thumb_') && 
    file.startsWith(imageId)
  );
  
  if (!imageFile) {
    throw new Error('Image not found');
  }
  
  // Update the prompt data
  const promptJSON = await fs.readJson(promptData);
  promptJSON.previewImage = `/images/${promptId}/${imageFile}`;
  promptJSON.previewThumbnail = `/images/${promptId}/thumb_${imageFile}`;
  
  await fs.writeJson(promptData, promptJSON, { spaces: 2 });
  
  return {
    previewImage: promptJSON.previewImage,
    previewThumbnail: promptJSON.previewThumbnail
  };
}

/**
 * Delete an image
 * @param {string} promptId - The prompt ID
 * @param {string} imageId - The image ID
 * @returns {Promise<boolean>} - True if successful
 */
async function deleteImage(promptId, imageId) {
  const promptDir = path.join(IMAGES_DIR, promptId);
  
  if (!fs.existsSync(promptDir)) {
    throw new Error('Prompt not found');
  }
  
  const files = await fs.readdir(promptDir);
  const imageFile = files.find(file => 
    !file.startsWith('thumb_') && 
    file.startsWith(imageId)
  );
  
  if (!imageFile) {
    throw new Error('Image not found');
  }
  
  const thumbnailFile = `thumb_${imageFile}`;
  
  // Delete the image and its thumbnail
  await fs.remove(path.join(promptDir, imageFile));
  
  if (files.includes(thumbnailFile)) {
    await fs.remove(path.join(promptDir, thumbnailFile));
  }
  
  // Check if this was the preview image and update if necessary
  const promptData = path.join(PROMPTS_DIR, `${promptId}.json`);
  if (fs.existsSync(promptData)) {
    const promptJSON = await fs.readJson(promptData);
    
    if (promptJSON.previewImage && promptJSON.previewImage.includes(imageFile)) {
      // Find a new preview image or set to null
      const remainingImages = await getImagesForPrompt(promptId);
      
      if (remainingImages.length > 0) {
        promptJSON.previewImage = remainingImages[0].path;
        promptJSON.previewThumbnail = remainingImages[0].thumbnailPath;
      } else {
        promptJSON.previewImage = null;
        promptJSON.previewThumbnail = null;
      }
      
      await fs.writeJson(promptData, promptJSON, { spaces: 2 });
    }
  }
  
  return true;
}

// Initialize directories on startup
ensureDirectories();

module.exports = {
  saveImage,
  getImagesForPrompt,
  setPreviewImage,
  deleteImage
};