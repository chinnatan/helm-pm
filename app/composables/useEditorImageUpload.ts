import { optimizeUploadFile } from "~/utils/optimizeUploadFile";

/**
 * Upload an image for the rich-text editor: compress to WebP, store in editor-media.
 * Path: {workspaceId}/{userId}/{timestamp}.webp
 */
export function useEditorImageUpload() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const { workspace } = useWorkspace();

  async function uploadEditorImage(
    file: File,
  ): Promise<{ url?: string; error?: string }> {
    if (!user.value?.id) return { error: "Not signed in" };
    if (!workspace.value?.id) return { error: "No workspace" };
    if (!file.type.startsWith("image/")) return { error: "Not an image" };

    const optimized = await optimizeUploadFile(file, { forceWebp: true });
    const path = `${workspace.value.id}/${user.value.id}/${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("editor-media")
      .upload(path, optimized, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage
      .from("editor-media")
      .getPublicUrl(path);

    return { url: urlData.publicUrl };
  }

  return { uploadEditorImage };
}
