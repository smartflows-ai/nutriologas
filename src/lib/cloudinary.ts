// src/lib/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const extractPublicId = (url: string) => {
  try {
    const parts = url.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) return null;

    // Cloudinary URLs usually have a version string like v1234567890 after 'upload'
    const hasVersion = /^v\d+$/.test(parts[uploadIndex + 1]);
    const startIndex = uploadIndex + (hasVersion ? 2 : 1);

    const fileWithExtension = parts.slice(startIndex).join("/");
    // Extraer el public ID (eliminando la extensión .jpg, .png, etc.)
    const publicId = fileWithExtension.replace(/\.[^/.]+$/, "");
    return publicId;
  } catch (error) {
    console.error("Error extrayendo publicId de Cloudinary:", error);
    return null;
  }
};

export const deleteImageFromCloudinary = async (url: string | null | undefined) => {
  if (!url) return false;
  const publicId = extractPublicId(url);
  
  if (publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === "ok";
    } catch (error) {
      console.error("Error al borrar de Cloudinary:", error);
      return false;
    }
  }
  return false;
};
