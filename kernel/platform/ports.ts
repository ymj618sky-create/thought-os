/**
 * Platform capability contracts (kernel-owned).
 * Mirror provides concrete implementations (file-backed prompt sources, etc.).
 */
export interface PromptSource {
  loadSync(): string;
}
