import { useAuthStore, type UserIndustry } from '@/stores/authStore';

// Read the current user's industry. Returns undefined for accounts that
// aren't industry-scoped (the default for the pharma seed and brand demos).
export function useUserIndustry(): UserIndustry | undefined {
  return useAuthStore(s => s.user?.industry);
}

// Choose between the default mock dataset and an industry-specific override
// based on the logged-in user. Each QMS module hook uses this so a
// `medical_device` user transparently sees medical-device records while
// every other account keeps the existing pharma-themed mocks.
export function pickByIndustry<T>(
  userIndustry: UserIndustry | undefined,
  defaults: T,
  overrides: Partial<Record<UserIndustry, T>>,
): T {
  if (userIndustry && overrides[userIndustry]) return overrides[userIndustry] as T;
  return defaults;
}
