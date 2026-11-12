export const SUPERADMIN_EMAIL = "admin@example.com";

export const isFixedSuperadminAccount = (
  email: string,
  role: string | undefined
): boolean => email.trim().toLowerCase() === SUPERADMIN_EMAIL && role === "superadmin";

export const isValidSuperadminIdentity = (
  email: string,
  role: string | undefined
): boolean => {
  const isReservedEmail = email.trim().toLowerCase() === SUPERADMIN_EMAIL;
  return isReservedEmail === (role === "superadmin");
};
