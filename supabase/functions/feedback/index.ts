// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { createApp } from "../_shared/app.ts";
import { Context } from "jsr:@hono/hono";

const functionName = "feedback";
const app = createApp(`/${functionName}`);
const supabase = createServiceClient();

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/mov"];
const MAX_TOTAL_FILE_SIZE = 30 * 1024 * 1024; // 30MB total for all files

function generateRandomFilename(originalName: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() || "";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}.${ext}`;
}

function getStoragePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `feedback/${year}/${month}`;
}

app.get(
  "/",
  (c: Context) => c.json({ message: "Feedback Edge Function is running!" }),
);

app.post("/upload", async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const files: File[] = [];

    // Collect all files from the form data
    for (const [key, value] of formData.entries()) {
      if (key === "file" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return c.json({ error: "No files provided" }, 400);
    }

    // Calculate total size of all files
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_FILE_SIZE) {
      return c.json({
        error: `Total file size exceeds limit. Maximum: 30MB, provided: ${
          Math.round(totalSize / (1024 * 1024) * 100) / 100
        }MB`,
      }, 400);
    }

    const uploadedFiles: Array<{
      filePath: string;
      originalName: string;
      size: number;
      type: string;
    }> = [];

    // Process each file
    for (const file of files) {
      // Validate file type
      const isValidImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const isValidVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

      if (!isValidImage && !isValidVideo) {
        return c.json({
          error:
            `Invalid file type for ${file.name}. Allowed: JPG, PNG, GIF, WebP, MP4, WebM, MOV`,
        }, 400);
      }

      // Generate storage path and filename
      const storagePath = getStoragePath();
      const filename = generateRandomFilename(file.name);
      const fullPath = `${storagePath}/${filename}`;

      // Convert file to ArrayBuffer
      const fileBuffer = await file.arrayBuffer();

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from("feedback-media")
        .upload(fullPath, fileBuffer, {
          contentType: file.type,
          duplex: "half",
        });

      if (error) {
        console.error("Storage upload error:", error);
        return c.json({ error: `Failed to upload ${file.name}` }, 500);
      }

      uploadedFiles.push({
        filePath: fullPath,
        originalName: file.name,
        size: file.size,
        type: file.type,
      });
    }

    // Return the file paths for the client to save in the feedback table
    return c.json({
      success: true,
      files: uploadedFiles,
      totalSize,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

app.all(
  "*",
  (c) => c.json({ error: "Route not found", path: c.req.path }, 404),
);

Deno.serve(app.fetch);
