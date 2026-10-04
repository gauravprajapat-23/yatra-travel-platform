export const sessionPolicy = {
  cookieName: "__Host-yatra_session",
  sameSite: "lax",
  httpOnly: true,
  secureInProduction: true,
  path: "/",
  sessionTtlHours: 24 * 7,
  idleRefreshHours: 24,
  tokenBytes: 32,
} as const;

export const authRateLimits = {
  loginAttemptsPer15MinutesPerIdentity: 8,
  loginAttemptsPer15MinutesPerIp: 30,
  passwordResetRequestsPerHourPerIdentity: 3,
} as const;
