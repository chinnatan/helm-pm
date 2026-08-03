export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use error; archive/warning use warning */
  color?: "error" | "warning" | "primary" | "neutral";
  icon?: string;
};

type ConfirmState = {
  open: boolean;
  options: ConfirmDialogOptions | null;
};

let pendingResolve: ((value: boolean) => void) | null = null;

export function useConfirmDialog() {
  const state = useState<ConfirmState>("helm:confirm-dialog", () => ({
    open: false,
    options: null,
  }));

  function confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }

    state.value = { open: true, options };

    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  function respond(ok: boolean) {
    const resolve = pendingResolve;
    pendingResolve = null;
    state.value = { open: false, options: null };
    resolve?.(ok);
  }

  return {
    open: computed({
      get: () => state.value.open,
      set: (value: boolean) => {
        if (!value && state.value.open) respond(false);
        else state.value = { ...state.value, open: value };
      },
    }),
    options: computed(() => state.value.options),
    confirm,
    respond,
  };
}
