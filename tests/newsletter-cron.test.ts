import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const findOneAndUpdate = vi.fn();
const updateOne = vi.fn(async (..._a: unknown[]) => ({}));
const findById = vi.fn();
const resolveAudience = vi.fn();
const deliverCampaign = vi.fn(async (..._a: unknown[]) => {});

vi.mock("@/lib/db", () => ({ default: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/models/NewsletterCampaign", () => ({
  default: {
    findOneAndUpdate: (...a: unknown[]) => findOneAndUpdate(...a),
    updateOne: (...a: unknown[]) => updateOne(...a),
    findById: () => ({ select: () => ({ lean: async () => findById() }) }),
  },
}));
vi.mock("@/lib/newsletter", () => ({
  resolveAudience: (...a: unknown[]) => resolveAudience(...a),
  deliverCampaign: (...a: unknown[]) => deliverCampaign(...a),
}));

import { GET } from "@/app/api/cron/newsletter/route";

const call = (auth?: string) =>
  GET(new NextRequest("http://x.test/api/cron/newsletter", { headers: auth ? { authorization: auth } : undefined }));

describe("GET /api/cron/newsletter", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    findOneAndUpdate.mockReset();
    updateOne.mockClear();
    resolveAudience.mockReset();
    deliverCampaign.mockClear();
    findById.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses to run without CRON_SECRET configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer anything")).status).toBe(503);
  });

  it("rejects a missing or wrong secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when no scheduled campaign is due", async () => {
    findOneAndUpdate.mockResolvedValue(null);
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ processed: 0, results: [] });
    expect(deliverCampaign).not.toHaveBeenCalled();
  });

  it("claims a due campaign (scheduled -> sending), resolves its audience and delivers it, then continues", async () => {
    findOneAndUpdate
      .mockResolvedValueOnce({ _id: "c1", subject: "Hi", body: "Body", audience: "customers" })
      .mockResolvedValueOnce(null);
    resolveAudience.mockResolvedValue(["a@x.test", "b@x.test"]);
    findById.mockResolvedValue({ status: "done" });

    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ processed: 1, results: [{ campaign: "c1", total: 2, status: "done" }] });

    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ status: "scheduled" });
    expect(update).toEqual({ $set: { status: "sending" } });
    expect(resolveAudience).toHaveBeenCalledWith("customers");
    expect(deliverCampaign).toHaveBeenCalledWith({ _id: "c1", subject: "Hi", body: "Body" }, ["a@x.test", "b@x.test"]);
  });

  it("marks a campaign failed (and sends nothing) when its audience is empty", async () => {
    findOneAndUpdate.mockResolvedValueOnce({ _id: "c2", subject: "S", body: "B" }).mockResolvedValueOnce(null);
    resolveAudience.mockResolvedValue([]);
    const res = await call("Bearer s3cret");
    expect((await res.json()).results[0].status).toContain("failed");
    expect(deliverCampaign).not.toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalledWith({ _id: "c2" }, { $set: expect.objectContaining({ status: "failed", total: 0 }) });
  });
});
