import type { Types } from "mongoose";
import { User } from "@/lib/models/User";
import { openSecret } from "@/lib/auth/secretBox";
import { verifyTotp } from "@/lib/auth/totp";
import { hashRecoveryCode } from "@/lib/auth/recoveryCodes";

export const TWO_FACTOR_ISSUER = "BudgetBliss";

/** How long a started-but-unconfirmed setup stays valid */
export const TOTP_SETUP_TTL_MS = 15 * 60 * 1000;

/** Failed 2FA codes allowed per account before code checks pause for the window */
export const TWO_FACTOR_MAX_FAILURES = 5;
export const TWO_FACTOR_WINDOW_MS = 15 * 60 * 1000;

/**
 * Checks a 6-digit authenticator code or a recovery code for a user with 2FA turned on.
 * Authenticator codes are accepted at most once (replay protection); recovery codes are
 * removed when used.
 */
export async function verifySecondFactor(userId: Types.ObjectId | string, input: string): Promise<boolean> {
  const code = input.replace(/\s/g, "");

  if (/^\d{6}$/.test(code)) {
    const user = await User.findById(userId).select("+totpSecretEnc").lean();
    if (!user?.twoFactorEnabled || !user.totpSecretEnc) return false;

    const step = verifyTotp(openSecret(user.totpSecretEnc), code);
    if (step === null) return false;

    // Only succeeds if this step is newer than the last accepted one
    const result = await User.updateOne(
      { _id: userId, $or: [{ totpLastStep: { $lt: step } }, { totpLastStep: null }] },
      { $set: { totpLastStep: step } },
    );
    return result.modifiedCount === 1;
  }

  const hash = hashRecoveryCode(code);
  if (!hash) return false;

  const result = await User.updateOne(
    { _id: userId, twoFactorEnabled: true, recoveryCodeHashes: hash },
    { $pull: { recoveryCodeHashes: hash } },
  );
  return result.modifiedCount === 1;
}
