import type { Profile } from "~/types";

export function useProfile() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const profile = useState<Profile | null>("my-profile", () => null);
  const loading = ref(false);

  const displayName = computed(() => {
    const p = profile.value;
    if (!p) return user.value?.email ?? "";
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    return name || p.full_name || p.email || user.value?.email || "";
  });

  const initials = computed(() => {
    const p = profile.value;
    if (p?.first_name || p?.last_name) {
      return `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?";
    }
    const name = displayName.value;
    return name[0]?.toUpperCase() ?? "?";
  });

  async function fetchMyProfile() {
    if (!user.value) {
      profile.value = null;
      return null;
    }

    loading.value = true;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.value.id)
      .single();

    loading.value = false;
    if (!error && data) {
      profile.value = data as Profile;
    }
    return profile.value;
  }

  async function updateProfile(input: {
    first_name: string;
    last_name: string;
  }) {
    if (!user.value) return { error: "Not signed in" };

    const first = input.first_name.trim();
    const last = input.last_name.trim();
    if (!first || !last) return { error: "name_required" };

    const full_name = `${first} ${last}`;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: first,
        last_name: last,
        full_name,
      })
      .eq("id", user.value.id)
      .select()
      .single();

    if (!error && data) profile.value = data as Profile;
    return { data: data as Profile | null, error: error?.message };
  }

  async function uploadAvatar(file: File) {
    if (!user.value) return { error: "Not signed in" };

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.value.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) return { error: uploadError.message };

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // bust cache
    const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { data, error } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", user.value.id)
      .select()
      .single();

    if (!error && data) profile.value = data as Profile;
    return { data: data as Profile | null, error: error?.message };
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!user.value?.email) return { error: "Not signed in" };

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.value.email,
      password: currentPassword,
    });

    if (reauthError) return { error: "current_password_invalid" };

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message };
  }

  return {
    profile,
    loading,
    displayName,
    initials,
    fetchMyProfile,
    updateProfile,
    uploadAvatar,
    changePassword,
  };
}
