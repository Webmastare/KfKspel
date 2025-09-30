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
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

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
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Validate file type
    const isValidImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isValidVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isValidImage && !isValidVideo) {
      return c.json({
        error:
          "Invalid file type. Allowed: JPG, PNG, GIF, WebP, MP4, WebM, MOV",
      }, 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json({
        error: "File too large. Maximum size: 30MB",
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
      return c.json({ error: "Failed to upload file" }, 500);
    }

    // Return the file path for the client to save in the feedback table
    return c.json({
      success: true,
      filePath: fullPath,
      originalName: file.name,
      size: file.size,
      type: file.type,
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
