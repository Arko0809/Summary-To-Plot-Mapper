export class GuardrailViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailViolation";
  }
}

/** Baseline protection for prompts that try to alter agent rules or obtain secrets. */
export function assertSafeChatQuery(query: string) {
  if (new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]").test(query)) {
    throw new GuardrailViolation("The request contains unsupported control characters.");
  }

  const attemptsInstructionOverride = /\b(ignore|disregard|override|bypass)\b[\s\S]{0,100}\b(previous|system|developer|hidden)\b[\s\S]{0,80}\b(instruction|prompt|rule|message)\b/i;
  const attemptsSecretExtraction = /\b(reveal|show|print|dump|export|give)\b[\s\S]{0,100}\b(api[ _-]?key|password|secret|access token|\.env|environment variable)\b/i;
  const requestsMalware = /\b(write|create|generate|provide|build)\b[\s\S]{0,100}\b(ransomware|keylogger|credential stealer|malware)\b/i;

  if (attemptsInstructionOverride || attemptsSecretExtraction || requestsMalware) {
    throw new GuardrailViolation("That request cannot be processed.");
  }
}