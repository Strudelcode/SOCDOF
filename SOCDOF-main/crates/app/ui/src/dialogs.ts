import { invoke } from "@tauri-apps/api/core";

/// Opens the native yes/no dialog and returns true only for the yes button.
export async function confirmDialog(text: string, title = "SOCDOF"): Promise<boolean> {
  try {
    const reply = await invoke<{ outcome: string }>("confirm_message", { text, title });
    return reply.outcome === "confirmed";
  } catch {
    return false;
  }
}
