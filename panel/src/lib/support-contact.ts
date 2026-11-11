/**
 * The WhatsApp line for contract work and website problems (D-385). The owner
 * gave a WhatsApp username, not a number; `wa.me/<username>` is WhatsApp's
 * username link, still rolling out country by country, so check it opens a
 * chat whenever the handle changes. The KVKK notice (data/kvkk-aydinlatma-
 * metni.md) describes this channel; change both together.
 */
export const SUPPORT_WHATSAPP_HANDLE = "eyckc";

export const SUPPORT_WHATSAPP_HREF = `https://wa.me/${SUPPORT_WHATSAPP_HANDLE}`;
