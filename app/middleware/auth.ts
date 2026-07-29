export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();
  const session = useSupabaseSession();

  // On client, wait for GoTrue to finish URL/session init before bouncing to login
  // (avoids a false logout right after email confirm / hard refresh).
  if (import.meta.client && !user.value) {
    const supabase = useSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && !user.value) {
      session.value = data.session;
      user.value = data.session.user;
    }
  }

  if (!user.value) {
    const redirect = to.fullPath;
    return navigateTo({
      path: "/login",
      query: redirect && redirect !== "/" ? { redirect } : undefined,
    });
  }
});
