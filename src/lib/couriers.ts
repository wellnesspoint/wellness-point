/**
 * Courier presets: pick a courier and enter the AWB number and the customer's
 * tracking link is built automatically. Links open the courier's public tracking
 * page (no API account or key needed).
 *
 * `{n}` in a template is replaced with the URL-encoded tracking number.
 */
export interface CourierPreset {
  name: string;
  /** public tracking page, `{n}` = tracking number */
  urlTemplate: string;
}

export const COURIERS: CourierPreset[] = [
  { name: "Delhivery", urlTemplate: "https://www.delhivery.com/track/package/{n}" },
  { name: "India Post", urlTemplate: "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignment={n}" },
  { name: "Blue Dart", urlTemplate: "https://www.bluedart.com/tracking?trackfor={n}" },
  { name: "DTDC", urlTemplate: "https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno={n}" },
  { name: "Ecom Express", urlTemplate: "https://ecomexpress.in/tracking/?awb_field={n}" },
  { name: "Xpressbees", urlTemplate: "https://www.xpressbees.com/shipment/tracking?awbNo={n}" },
  { name: "Shadowfax", urlTemplate: "https://tracker.shadowfax.in/#/track/{n}" },
  { name: "Ekart", urlTemplate: "https://ekartlogistics.com/shipmenttrack/{n}" },
];

const normalize = (s: string) => s.trim().toLowerCase();

export function findCourier(name: string | undefined | null): CourierPreset | undefined {
  if (!name) return undefined;
  const n = normalize(name);
  return COURIERS.find((c) => normalize(c.name) === n);
}

/** Tracking link for a known courier + number, or undefined (unknown courier / no number). */
export function trackingUrlFor(courier: string | undefined | null, trackingNumber: string | undefined | null): string | undefined {
  const preset = findCourier(courier);
  const num = (trackingNumber ?? "").trim();
  if (!preset || !num) return undefined;
  return preset.urlTemplate.replace("{n}", encodeURIComponent(num));
}
