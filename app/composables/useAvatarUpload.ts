import { optimizeUploadFile } from "~/utils/optimizeUploadFile";

/**
 * Shared avatar upload (signup + profile settings).
 * Optimizes the image, writes to the avatars bucket, updates profiles.avatar_url.
 */
export function useAvatarUpload() {
  const supabase = useSupabaseClient();

  async function uploadAvatarFile(
    userId: string,
    file: File,
    options?: { bustCache?: boolean },
  ): Promise<{ avatar_url?: string; error?: string }> {
    const optimized = await optimizeUploadFile(file);
    const ext = optimized.name.split(".").pop() || "webp";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, optimized, {
        upsert: true,
        contentType: optimized.type || "image/webp",
      });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = options?.bustCache
      ? `${urlData.publicUrl}?t=${Date.now()}`
      : urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", userId);

    if (updateError) return { error: updateError.message };
    return { avatar_url };
  }

  return { uploadAvatarFile };
}
