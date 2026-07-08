declare module "frappe-gantt" {
  interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    dependencies?: string;
    custom_class?: string;
  }

  interface GanttOptions {
    view_mode?: string;
    bar_height?: number;
    padding?: number;
    on_date_change?: (task: GanttTask) => void;
  }

  export default class Gantt {
    constructor(container: HTMLElement, tasks: GanttTask[], options?: GanttOptions);
  }
}
