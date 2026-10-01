/**
 * Never send credentials/tokens to the browser: a bare "-password" projection
 * still returned the email-verify and password-reset tokens.
 */
export const USER_PUBLIC_FIELDS =
  "-password -emailVerifyToken -emailVerifyExpires -resetPasswordToken -resetPasswordExpires -twoFactorSecret -twoFactorBackupCodes";
