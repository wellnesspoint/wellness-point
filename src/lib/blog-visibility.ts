/**
 * Filter for blog posts visible to the public: published, and not scheduled
 * for the future (`publishAt` unset or already passed).
 */
export function publicBlogFilter(now: Date = new Date()) {
  return {
    isPublished: true,
    $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
  };
}
