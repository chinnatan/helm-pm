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
    upper_header_height?: number;
    lower_header_height?: number;
    infinite_padding?: boolean;
    today_button?: boolean;
    view_mode_select?: boolean;
    popup_on?: "click" | "hover";
    on_date_change?: (task: GanttTask) => void;
    on_click?: (task: GanttTask) => void;
  }

  export default class Gantt {
    constructor(container: HTMLElement, tasks: GanttTask[], options?: GanttOptions);
  }
}
