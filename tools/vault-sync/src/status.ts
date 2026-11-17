export const HELM_TO_VAULT: Record<string, string> = {
  todo: "todo",
  in_progress: "in-progress",
  testing: "review",
  done: "done",
  cancelled: "superseded",
};
export const VAULT_TO_HELM: Record<string, string> = {
  ...Object.fromEntries(Object.entries(HELM_TO_VAULT).map(([h, v]) => [v, h])),
  cancelled: "cancelled", // ค่าที่ dotpm ใช้ในไฟล์เก่า (ขาเข้าอย่างเดียว ไม่เขียนกลับ)
};
/** null = not written to vault (inbox) */
export const toVaultStatus = (helm: string): string | null => HELM_TO_VAULT[helm] ?? null;
export const toHelmStatus = (vault: string): string | null => VAULT_TO_HELM[vault] ?? null;
