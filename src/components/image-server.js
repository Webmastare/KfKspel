import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { log } from 'console';
import { hash } from 'crypto';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate required environment variables
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service key for backend operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for backend operations
);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'images', 'mushrooms');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Supported image formats for server processing
const SUPPORTED_FORMATS = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff', 'image/tif',
  'image/heic', 'image/heif', 'image/avif', 'image/gif', 'image/bmp'
];

// HEIC files often have incorrect MIME types, so check by extension too
const SUPPORTED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', 
  '.heic', '.heif', '.avif', '.gif', '.bmp'
];

function isImageFileSupported(file) {
  // Check MIME type first
  if (SUPPORTED_FORMATS.includes(file.mimetype)) {
    return true;
  }
  
  // For HEIC files that might have wrong MIME type (often 'application/octet-stream')
  const extension = path.extname(file.originalname).toLowerCase();
  if (SUPPORTED_EXTENSIONS.includes(extension)) {
    return true;
  }
  
  return false;
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isImageFileSupported(file)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`), false);
    }
  }
});

async function calculateImageHash(buffer) {
  // Simple hash based on resized image data
  const resized = await sharp(buffer)
    .resize(8, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  
  let hash = 0;
  for (let i = 0; i < resized.length; i++) {
    hash = ((hash << 5) - hash + resized[i]) & 0xffffffff;
  }
  return hash;
}

// File upload endpoint - saves single optimized image and handles database operations
app.post('/upload-images', upload.array('images', 10), async (req, res) => {
  try {
    console.log('Trying to upload images:', req.body);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { shroom_name, shroom_id, descriptions, tags, photographer, main_image_index } = req.body;
    if (!shroom_id) {
      return res.status(400).json({ error: 'shroom_id is required' });
    }

    // Parse metadata arrays
    const parsedDescriptions = descriptions ? JSON.parse(descriptions) : [];
    const parsedTags = tags ? JSON.parse(tags) : [];
    const mainImageIndex = parseInt(main_image_index) || 0;
    
    console.log('Upload parameters:', { shroom_id, shroom_name, mainImageIndex, fileCount: req.files.length });

    const uploadedFiles = [];
    const heicErrors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const folderName = shroom_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        const folderPath = path.join(__dirname, '..', 'public', 'images', 'mushrooms', folderName);
        
        // Create species folder if it doesn't exist
        if (!existsSync(folderPath)) {
          await fs.mkdir(folderPath, { recursive: true });
        }
        
        // Detect original format for logging
        const originalExtension = path.extname(file.originalname).toLowerCase();
        const isHEIC = originalExtension === '.heic' || originalExtension === '.heif';
        
        console.log(`Processing ${isHEIC ? 'HEIC' : 'standard'} image: ${file.originalname} (${file.mimetype})`);
        
        // If it's a HEIC file, suggest client-side conversion instead
        if (isHEIC) {
          heicErrors.push({
            filename: file.originalname,
            error: 'HEIC files should be converted to JPEG on the client before uploading. Please use the browser preview system to convert HEIC files.'
          });
          console.log(`Skipping HEIC file ${file.originalname} - client should handle conversion`);
          continue;
        }
        
        const baseFilename = `${timestamp}-${i}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        // Always save as .jpg for web compatibility
        const webFilename = baseFilename.replace(/\.(png|webp|tiff?|bmp|gif)$/i, '.jpg');
        const fullImagePath = path.join(folderPath, webFilename);
        
        // Create thumbnail filename with _thumb suffix
        const thumbFilename = webFilename.replace(/(\.[^.]+)$/, '_thumb$1');
        const thumbnailPath = path.join(folderPath, thumbFilename);

        // Process images with Sharp (non-HEIC files only)
        try {
          const sharpInstance = sharp(file.buffer);
          
          // Test if Sharp can read the image
          const metadata = await sharpInstance.metadata();
          console.log(`Image metadata:`, { 
            format: metadata.format, 
            width: metadata.width, 
            height: metadata.height,
            originalFile: file.originalname 
          });
          
          // Preserve EXIF data (orientation, etc.)
          await sharpInstance
            .rotate() // Auto-rotate based on EXIF orientation
            .resize(1200, 1200, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .jpeg({ 
              quality: 85,
              mozjpeg: true // Better compression
            })
            .toFile(fullImagePath);

          // Generate thumbnail (400px square, cropped) 
          await sharp(file.buffer)
            .rotate() // Auto-rotate based on EXIF orientation
            .resize(400, 400, { 
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ 
              quality: 80,
              mozjpeg: true
            })
            .toFile(thumbnailPath);
            
          console.log(`Successfully processed ${metadata.format} -> JPEG: ${webFilename}`);
          
        } catch (sharpError) {
          console.error(`Sharp processing error for ${file.originalname}:`, sharpError);
          throw new Error(`Failed to process image: ${sharpError.message}`);
        }

        // Calculate hash for duplicate detection
        const hashValue = await calculateImageHash(file.buffer);
        // TODO: Implement duplicate check logic here
        
        const fullImageUrl = `${folderName}/${webFilename}`;

        // Insert into database with metadata
        // Store original filename in a separate field for reference
        const { data, error } = await supabase
          .from('shroom_images')
          .insert([{
            species_id: shroom_id,
            filename: fullImageUrl,
            description: parsedDescriptions[i] || null,
            tags: parsedTags[i] ? [parsedTags[i]] : null,
            photographer: photographer || null,
            hash_value: hashValue,
            original_filename: file.originalname, // Store original name for reference
            converted_from_heic: isHEIC // Flag to track HEIC conversions
          }])
          .select();

        if (error) {
          console.error('Database error:', error);
          // Delete the uploaded files if database insertion fails
          try {
            await fs.unlink(fullImagePath);
            await fs.unlink(thumbnailPath);
          } catch (unlinkError) {
            console.error('Error deleting files after database failure:', unlinkError);
          }
          continue; // Skip this file and continue with others
        }

        uploadedFiles.push({
          ...data[0],
          originalName: file.originalname
        });

      } catch (imageError) {
        console.error('Error processing image:', imageError);
        // Continue with other images even if one fails
      }
    }

    if (uploadedFiles.length === 0 && heicErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Only HEIC files were uploaded. HEIC files must be converted to JPEG on the client before uploading.',
        heicErrors: heicErrors,
        suggestion: 'Please use the browser preview system which automatically converts HEIC files to JPEG before upload.'
      });
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({ error: 'Failed to upload any images' });
    }

    // Set main image if specified and valid
    let mainImageResult = null;
    if (main_image_index !== undefined && main_image_index !== null && main_image_index !== '') {
      const mainImageIndex = parseInt(main_image_index);
      if (mainImageIndex >= 0 && mainImageIndex < uploadedFiles.length) {
        const mainImageFile = uploadedFiles[mainImageIndex];
        console.log('Setting main image:', { mainImageIndex, imageId: mainImageFile.img_id, speciesId: shroom_id });
        try {
          const { data: shroomData, error: updateError } = await supabase
            .from('shrooms')
            .update({ main_image: mainImageFile.img_id })
            .eq('species_id', shroom_id)
            .select();

          if (updateError) {
            console.error('Error setting main image:', updateError);
          } else {
            mainImageResult = mainImageFile.img_id;
            console.log('Main image successfully set to:', mainImageFile.img_id);
          }
        } catch (mainImageError) {
          console.error('Error setting main image:', mainImageError);
        }
      } else {
        console.log('Main image not set - invalid index:', { mainImageIndex, totalFiles: uploadedFiles.length });
      }
    } else {
      console.log('No main image index provided - not setting main image');
    }

    console.log('Successfully uploaded files:', uploadedFiles);

    const responseData = { 
      success: true, 
      images: uploadedFiles,
      main_image_id: mainImageResult,
      message: `Successfully uploaded ${uploadedFiles.length} image(s)`
    };

    // Include HEIC warnings if any
    if (heicErrors.length > 0) {
      responseData.heicWarnings = heicErrors;
      responseData.message += `. Note: ${heicErrors.length} HEIC file(s) were skipped - please convert to JPEG first.`;
    }

    res.json(responseData);

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Delete image endpoint
app.delete('/delete-image/:image_id', async (req, res) => {
  try {
    const { image_id } = req.params;

    // Get image details first
    const { data: imageData, error: fetchError } = await supabase
      .from('shroom_images')
      .select('filename')
      .eq('id', image_id)
      .single();

    if (fetchError) {
      console.error('Error fetching image:', fetchError);
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('shroom_images')
      .delete()
      .eq('id', image_id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete image from database' });
    }

    // Delete file from filesystem
    try {
      const filename = path.basename(imageData.filename);
      const filePath = path.join(uploadDir, filename);
      await fs.unlink(filePath);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
      // Don't fail the request if file deletion fails
    }

    res.json({ 
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Image Upload Server' });
});

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Image upload server running on http://localhost:${PORT}`);
});
