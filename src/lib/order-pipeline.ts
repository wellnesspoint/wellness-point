/**
 * Mongo aggregation expressions that mirror lib/order-math.ts, for pipelines.
 * Amounts are derived from line items, never the stored `total`.
 */
export const ORDER_GROSS_EXPR = {
  $subtract: [
    {
      $add: [
        {
          $sum: {
            $map: {
              input: { $ifNull: ["$items", []] },
              as: "i",
              in: { $multiply: [{ $ifNull: ["$$i.price", 0] }, { $ifNull: ["$$i.quantity", 1] }] },
            },
          },
        },
        { $ifNull: ["$shipping", 0] },
      ],
    },
    { $ifNull: ["$discount", 0] },
  ],
};

/** Gross minus partial refunds: what the order actually brought in. */
export const ORDER_NET_EXPR = {
  $subtract: [ORDER_GROSS_EXPR, { $ifNull: ["$refundedAmount", 0] }],
};
