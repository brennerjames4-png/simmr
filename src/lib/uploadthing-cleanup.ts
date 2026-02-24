import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

/**
 * Extract the file key from an Uploadthing URL and delete the file.
 * Handles both old-style (.url) and new-style (.ufsUrl) formats.
 *
 * Fire-and-forget safe — logs errors but never throws.
 */
export async function deleteUploadthingFile(url: string): Promise<void> {
  try {
    // Extract file key from URL
    // Format: https://atp9i3pru6.ufs.sh/f/KEY or https://utfs.io/f/KEY
    const match = url.match(/\/f\/(.+)$/);
    if (!match) {
      console.log(`Could not extract file key from URL: ${url}`);
      return;
    }

    const fileKey = match[1];
    await utapi.deleteFiles(fileKey);
    console.log(`Deleted file from Uploadthing: ${fileKey}`);
  } catch (error) {
    console.error("Failed to delete file from Uploadthing:", error);
  }
}
