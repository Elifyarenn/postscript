/**
 * Sample inputs for every mail template. The plain text each one produced
 * before the HTML layout (D-269) is kept in `mail-text-baseline.json`, so the
 * move to one shared layout is proven not to change a single character of it.
 */
export const MAIL_SAMPLES: Record<string, Record<string, unknown>[]> = {
  verifyEmail: [{ displayName: "Ada <b>Yazar</b>", url: "https://example.com/verify-email?token=abc" }],
  resetPassword: [{ displayName: "Ada", url: "https://example.com/reset-password?token=def" }],
  changeEmail: [
    { displayName: "Ada", newEmail: "yeni@example.com", url: "https://example.com/verify-email?token=ghi" },
  ],
  promotedToWriter: [{ displayName: "Ada", url: "https://example.com/writer" }],
  applicationSubmitted: [{ displayName: "Ada" }],
  applicationEditorApproved: [{ displayName: "Ada" }],
  applicationRejected: [{ displayName: "Ada", reason: "Örnek metin <script>alert(1)</script> kısa kaldı." }],
  applicationContractReady: [{ displayName: "Ada", url: "https://example.com/writer-application/contract" }],
  newAgreementVersion: [{ displayName: "Ada", version: 3, url: "https://example.com/writer/agreement" }],
  agreementAccepted: [{ displayName: "Ada", version: 2 }],
  rightsGrantPending: [
    { displayName: "Ada", articleTitle: "Kış & \"Sessizlik\"", url: "https://example.com/writer/approvals/1" },
  ],
  rightsGrantReminder: [{ displayName: "Ada", articleTitle: "Kış", url: "https://example.com/writer/approvals/1" }],
  rightsGrantSigned: [{ displayName: "Ada", articleTitle: "Kış" }],
  articleStatusChanged: [
    { displayName: "Ada", articleTitle: "Kış", status: "revision_requested", note: "Giriş\nkısalsın.", url: "https://example.com/writer/articles/1" },
    { displayName: "Ada", articleTitle: "Kış", status: "published", url: "https://example.com/writer/articles/1" },
    { displayName: "Ada", articleTitle: "Kış", status: "some_other", url: "https://example.com/writer/articles/1" },
  ],
  adminReportReceived: [{ target: "Hesap", category: "Reklam veya spam", url: "https://example.com/admin/community" }],
  adminApplicationAwaiting: [{ url: "https://example.com/admin/applications" }],
  recoveryCodeUsed: [{ displayName: "Ada", remaining: 7 }],
  kvkkNewVersion: [{ displayName: "Ada", version: 4, url: "https://example.com/kvkk" }],
  mandatoryAnnouncement: [{ displayName: "Ada", title: "Toplantı <önemli>", url: "https://example.com/writer/announcements" }],
  contactMessage: [
    { name: "Ziyaretçi <img src=x>", email: "z@example.com", subject: "Soru", topic: null, message: "Merhaba,\n<a href=\"javascript:alert(1)\">tık</a>\nİyi günler." },
    { name: "Ziyaretçi", email: "z@example.com", subject: null, topic: "Künye", message: "Tek satır" },
    { name: "Ziyaretçi", email: "z@example.com", subject: null, topic: null, message: "Tek satır" },
  ],
  submissionWindowOpened: [
    { displayName: "Ada", issueLabel: "Sayı 2 · Gotizm", closesAt: "15 Ekim 18:00", acceptedTopic: "Karanlık <mimari>", url: "https://example.com/writer/topics" },
    { displayName: "Ada", issueLabel: "Sayı 2 · Gotizm", closesAt: "15 Ekim 18:00", acceptedTopic: null, url: "https://example.com/writer/topics" },
  ],
};

/** Templates written after the layout: they have no pre-layout text to match. */
export const ADDED_AFTER_LAYOUT = new Set(["submissionWindowOpened"]);
