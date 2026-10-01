import User from "@/models/User";
import Order from "@/models/Order";
import Wishlist from "@/models/Wishlist";
import Review from "@/models/Review";

/**
 * Remove customer accounts. Customers who have placed orders are anonymised
 * instead of hard-deleted: their orders (financial records) must keep a valid
 * `user` reference, otherwise order lists/invoices lose the customer and
 * populate() returns null. Personal data on the account is wiped either way,
 * and the email address is freed for re-registration.
 *
 * Callers must have already excluded admin accounts.
 */
export async function removeUsers(
  ids: string[]
): Promise<{ deleted: string[]; anonymized: string[] }> {
  if (ids.length === 0) return { deleted: [], anonymized: [] };

  await Promise.all([
    Wishlist.deleteMany({ user: { $in: ids } }),
    Review.deleteMany({ user: { $in: ids } }),
  ]);

  const withOrders = new Set(
    (await Order.distinct("user", { user: { $in: ids } })).map((u: any) => u.toString())
  );
  const anonymized = ids.filter((id) => withOrders.has(id));
  const deleted = ids.filter((id) => !withOrders.has(id));

  if (deleted.length > 0) {
    await User.deleteMany({ _id: { $in: deleted }, role: { $ne: "admin" } });
  }

  if (anonymized.length > 0) {
    await User.bulkWrite(
      anonymized.map((id) => ({
        updateOne: {
          filter: { _id: id, role: { $ne: "admin" } },
          update: {
            $set: {
              name: "Deleted User",
              email: `deleted-${id}@deleted.invalid`,
              isActive: false,
              emailVerified: false,
              addresses: [],
              twoFactorEnabled: false,
              passwordChangedAt: new Date(),
              anonymizedAt: new Date(),
            },
            $unset: {
              password: "",
              image: "",
              phone: "",
              providerId: "",
              emailVerifyToken: "",
              emailVerifyExpires: "",
              resetPasswordToken: "",
              resetPasswordExpires: "",
              twoFactorSecret: "",
              twoFactorBackupCodes: "",
            },
          },
        },
      }))
    );
  }

  return { deleted, anonymized };
}
