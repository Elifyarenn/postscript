/**
 * The word budget of one category in one issue (D-331). Pure, without
 * imports, so the forms count live with the same rule the server enforces.
 *
 * The limit is the category's total across every author in that issue, not a
 * per-article or per-author one; issues never share a total. 500 words per
 * article is only a warning.
 */
export const CATEGORY_WORD_LIMIT = 1600;
export const ARTICLE_WORD_WARNING = 500;

export type BudgetCheck = {
  ok: boolean;
  /** The category's total once the change is saved. */
  total: number;
  /** What is still free after the change; negative when over. */
  remaining: number;
};

/**
 * `others` is every other article of the category in that issue; `before` is
 * this article's own count while it already sat in the same category and
 * issue (0 for a new or moved-in article), so it is never counted twice.
 *
 * A change is refused only when it takes the total over the limit and makes
 * it larger: a category that is already over (older content is never cut)
 * may still be shortened or corrected.
 */
export function checkCategoryBudget(input: {
  others: number;
  before: number;
  after: number;
  limit?: number;
}): BudgetCheck {
  const limit = input.limit ?? CATEGORY_WORD_LIMIT;
  const total = input.others + input.after;
  const previous = input.others + input.before;
  return { ok: total <= limit || total <= previous, total, remaining: limit - total };
}

/** The refusal the server returns and the form repeats. */
export function budgetRefusal(input: {
  category: string;
  issueNumber: number;
  others: number;
  after: number;
  limit?: number;
}): string {
  const limit = input.limit ?? CATEGORY_WORD_LIMIT;
  const room = Math.max(0, limit - input.others);
  const tr = (n: number) => n.toLocaleString("tr-TR");
  return (
    `"${input.category}" kategorisinin Sayı ${input.issueNumber} toplamı ${tr(input.others + input.after)} kelime olur; ` +
    `sınır ${tr(limit)} kelime. Diğer yazılar ${tr(input.others)} kelime kullanıyor; bu yazı için kalan hak ` +
    `${tr(room)} kelime, yazı ${tr(input.after)} kelime.`
  );
}
