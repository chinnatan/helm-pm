export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();
  const session = useSupabaseSession();

  if (import.meta.client && !user.value) {
    const supabase = useSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && !user.value) {
      session.value = data.session;
      user.value = data.session.user;
    }
  }

  if (user.value) {
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : null;
    if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
      return navigateTo(redirect);
    }
    return navigateTo("/planner");
  }
});
