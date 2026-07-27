export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();

  if (!user.value) {
    const redirect = to.fullPath;
    return navigateTo({
      path: "/login",
      query: redirect && redirect !== "/" ? { redirect } : undefined,
    });
  }
});
