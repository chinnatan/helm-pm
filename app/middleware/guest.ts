export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();

  if (user.value) {
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : null;
    if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
      return navigateTo(redirect);
    }
    return navigateTo("/planner");
  }
});
