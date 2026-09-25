/**
 * WhatsApp links for the admin panel (D-231).
 *
 * Numbers are stored as the member typed them, only stripped of spaces,
 * brackets and hyphens (`normalisePhone`), so a stored value can be
 * "+90 532 …", "0532 …" or "532 …". wa.me wants one full international number
 * and nothing else, so the shape is worked out here rather than at each call
 * site, and anything that cannot be read is refused instead of guessed at.
 *
 * Nothing is sent from here: the link opens WhatsApp with the number and a
 * ready message, and the admin presses send.
 */

/** The digits wa.me needs, or null when the stored number cannot be read. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[^\d+]/g, "");

  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  // A Turkish number as it is dialled at home: the trunk zero becomes the code
  else if (compact.startsWith("0")) digits = `90${compact.slice(1)}`;
  else if (compact.length === 10) digits = `90${compact}`;
  else digits = compact;

  // Shorter than a country code plus a line is a typo, longer is not a number
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

/** Without a message it is a plain "open this chat" link. */
export function whatsappHref(raw: string | null | undefined, message = ""): string | null {
  const number = whatsappNumber(raw);
  if (number === null) return null;
  return message === "" ? `https://wa.me/${number}` : `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
