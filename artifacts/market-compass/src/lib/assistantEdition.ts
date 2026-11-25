/**
 * Edition is a deployment property, not a browser permission or an AI instruction.
 * A dedicated protected finance build sets VITE_MC_EDITION=finance.
 * Legacy ngrok hostname fallback keeps installed finance PWAs labelled
 * until the gateway deploys the dedicated build.
 */
export type AssistantEdition = 'personal' | 'finance';

export function selectAssistantEdition(buildEdition: unknown, hostname = ''): AssistantEdition {
  if (buildEdition === 'personal' || buildEdition === 'finance') return buildEdition;
  return /^[a-z0-9-]+\.ngrok-free\.(?:app|dev)$/.test(hostname) ? 'finance' : 'personal';
}

export function currentAssistantEdition(): AssistantEdition {
  return selectAssistantEdition(import.meta.env.VITE_MC_EDITION,
    typeof window === 'undefined' ? '' : window.location.hostname);
}

export function mayUsePersonalTools(edition: AssistantEdition): boolean {
  return edition === 'personal';
}
