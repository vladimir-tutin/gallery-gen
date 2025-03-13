const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const imageStorage = require('./imageStorage');

const SD_API_URL = 'http://localhost:7860/sdapi/v1';

/**
 * Generate images using Stable Diffusion API
 * @param {Object} promptData - The prompt data for the image generation
 * @param {number} count - Number of images to generate
 * @returns {Promise<Array>} - Array of generated image paths
 */
async function generateImages(promptData, count = 1) {
  try {
    // Define payload first before any logging or use
    const payload = {
      prompt: `${promptData.prompt} <lora:dmd2_sdxl_4step_lora_fp16:1>`,
      negative_prompt: promptData.negativePrompt || "",
      steps: 7,
      cfg_scale: 1,
      width: 640,
      height: 960,
      save_images: true,
      sampler_name: "LCM",
      scheduler: "Automatic",
      restore_faces: false,
      batch_size: count,
      seed: promptData.seed || -1
    };

    // Now we can safely log it
    console.log('Sending request to Stable Diffusion API:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${SD_API_URL}/txt2img`, payload);
    
    // Log response info if available
    if (response.data && response.data.parameters) {
      console.log('Response parameters:', JSON.stringify(response.data.parameters, null, 2));
    }
    
    if (!response.data || !response.data.images) {
      throw new Error('No images returned from Stable Diffusion API');
    }

    const generatedImages = [];
    
    // Save each generated image
    for (let i = 0; i < response.data.images.length; i++) {
      const imageBase64 = response.data.images[i];
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      // Generate unique filename
      const filename = `${Date.now()}_${i}_${uuidv4()}.png`;
      
      // Save the image using the imageStorage service
      const savedImage = await imageStorage.saveImage(promptData.id, filename, imageBuffer);
      generatedImages.push(savedImage);
    }
    
    return generatedImages;
  } catch (error) {
    console.error('Error generating images:', error);
    throw error;
  }
}

/**
 * Get available models from Stable Diffusion API
 * @returns {Promise<Array>} - Array of available models
 */
async function getAvailableModels() {
  try {
    const response = await axios.get(`${SD_API_URL}/sd-models`);
    return response.data;
  } catch (error) {
    console.error('Error fetching models:', error);
    throw error;
  }
}

/**
 * Check if Stable Diffusion API is available
 * @returns {Promise<boolean>} - True if API is available
 */
async function checkApiStatus() {
  try {
    await axios.get(`${SD_API_URL}/progress`);
    return true;
  } catch (error) {
    console.error('Stable Diffusion API not available:', error.message);
    return false;
  }
}

/**
 * Get current model and settings
 * @returns {Promise<Object>} - Current settings object
 */
async function getCurrentSettings() {
  try {
    const response = await axios.get(`${SD_API_URL}/options`);
    return response.data;
  } catch (error) {
    console.error('Error fetching current settings:', error);
    throw error;
  }
}

module.exports = {
  generateImages,
  getAvailableModels,
  checkApiStatus,
  getCurrentSettings
};