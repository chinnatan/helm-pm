/** Remembers the last selected project across menu switches and reloads. */
export function useLastProject() {
  const { projects, getProject } = useProjects();

  const stored = useCookie<string | null>("helm-last-project-id", {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const storedView = useCookie<string>("helm-last-project-view", {
    default: () => "board",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const route = useRoute();

  const routeProjectId = computed(() => {
    if (!route.path.startsWith("/projects/")) return null;
    const id = route.params.id;
    return typeof id === "string" ? id : null;
  });

  const routeProjectView = computed(() => {
    if (!routeProjectId.value) return null;
    const rest = route.path.slice(`/projects/${routeProjectId.value}`.length);
    if (rest === "" || rest === "/") return "overview";
    const match = rest.match(/^\/(board|list|gantt|calendar)\/?$/);
    return match?.[1] ?? null;
  });

  /** Prefer the project in the URL; otherwise the remembered one if it still exists. */
  const activeProjectId = computed(() => {
    if (routeProjectId.value) return routeProjectId.value;
    const remembered = stored.value;
    if (remembered && projects.value.some((p) => p.id === remembered)) {
      return remembered;
    }
    // Cookie may be set before projects finish loading
    if (remembered && projects.value.length === 0) return remembered;
    return null;
  });

  const activeProject = computed(() =>
    activeProjectId.value ? getProject(activeProjectId.value) : null,
  );

  /** Where the sidebar "Projects" item should go. */
  const projectsHomePath = computed(() => {
    const id = stored.value;
    if (!id) return "/projects";
    return projectWorkPath(id);
  });

  function projectWorkPath(projectId: string) {
    if (routeProjectId.value) {
      const rest = route.path.slice(`/projects/${routeProjectId.value}`.length);
      if (rest === "" || rest === "/") return `/projects/${projectId}`;
      if (/^\/(board|list|gantt|calendar)\/?$/.test(rest)) {
        return `/projects/${projectId}${rest.replace(/\/$/, "")}`;
      }
    }

    const view = storedView.value;
    if (view === "overview") return `/projects/${projectId}`;
    if (view === "list" || view === "gantt" || view === "calendar") {
      return `/projects/${projectId}/${view}`;
    }
    return `/projects/${projectId}/board`;
  }

  function rememberProject(projectId: string) {
    stored.value = projectId;
  }

  watch(
    routeProjectId,
    (id) => {
      if (id) stored.value = id;
    },
    { immediate: true },
  );

  watch(
    routeProjectView,
    (view) => {
      if (view) storedView.value = view;
    },
    { immediate: true },
  );

  watch(
    projects,
    (list) => {
      if (stored.value && list.length > 0 && !list.some((p) => p.id === stored.value)) {
        stored.value = null;
      }
    },
    { deep: true },
  );

  return {
    routeProjectId,
    activeProjectId,
    activeProject,
    projectsHomePath,
    projectWorkPath,
    rememberProject,
  };
}
