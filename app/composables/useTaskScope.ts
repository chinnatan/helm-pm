import type { TaskType } from "~/types";
import { TASK_TYPE_VALUES } from "~/types";
import type { TaskFilters } from "~/composables/useTasks";

/** ขอบเขตของหน้า Task (customer / feature / type) เก็บใน URL query เพื่อลิงก์มาจากหน้าอื่นได้ */
export function useTaskScope() {
  const route = useRoute();
  const router = useRouter();

  const one = (key: string) => {
    const v = route.query[key];
    return typeof v === "string" && v ? v : null;
  };

  const filters = computed<TaskFilters>(() => {
    const type = one("type");
    return {
      customerId: one("customer"),
      featureId: one("feature"),
      taskType: TASK_TYPE_VALUES.includes(type as TaskType) ? (type as TaskType) : null,
    };
  });

  function setScope(next: { customer?: string | null; feature?: string | null; type?: string | null }) {
    const query = { ...route.query };
    for (const [k, v] of Object.entries(next)) {
      if (v) query[k] = v;
      else delete query[k];
    }
    return router.replace({ query });
  }

  return { filters, setScope };
}
