/**
 * E-mail templates (specification §12).
 *
 * Each template is a pure function describing its message as blocks; the
 * shared layout (`./layout`, D-269) turns them into a subject, a plain text
 * body and an HTML body. Keeping them free of imports from the service layer
 * means they can be previewed and unit tested on their own.
 *
 * Links are built by the calling service from `APP_URL`; the templates never
 * invent a route.
 */
import { renderMail, type Template } from "./layout";

export type { Template } from "./layout";

export function verifyEmail(input: { displayName: string; url: string }): Template {
  return renderMail({
    kind: "verify_email",
    sensitive: true,
    subject: "postscript · E-posta adresinizi doğrulayın",
    heading: "E-posta adresinizi doğrulayın",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead: "Hesabınızı kullanmaya başlamak için e-posta adresinizi doğrulayın:",
        url: input.url,
        label: "Adresimi doğrula",
      },
      {
        type: "paragraph",
        text: "Bağlantı 24 saat geçerlidir. Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz.",
      },
    ],
  });
}

export function resetPassword(input: { displayName: string; url: string }): Template {
  return renderMail({
    kind: "reset_password",
    sensitive: true,
    subject: "postscript · Şifre sıfırlama",
    heading: "Şifrenizi sıfırlayın",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead: "Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:",
        url: input.url,
        label: "Yeni şifre belirle",
      },
      {
        type: "paragraph",
        text:
          "Bağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.\n" +
          "Şifreniz sıfırlandığında tüm açık oturumlarınız kapatılır.",
      },
    ],
  });
}

export function changeEmail(input: {
  displayName: string;
  newEmail: string;
  url: string;
}): Template {
  return renderMail({
    kind: "change_email",
    sensitive: true,
    subject: "postscript · E-posta adresinizi doğrulayın",
    heading: "Yeni e-posta adresinizi doğrulayın",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          `Hesabınızın e-posta adresini ${input.newEmail} adresine değiştirmek istediniz. ` +
          "Bu adresi doğrulamak için aşağıdaki bağlantıyı kullanın:",
        url: input.url,
        label: "Yeni adresimi doğrula",
      },
      {
        type: "paragraph",
        text:
          "Bağlantı 24 saat geçerlidir. Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz; " +
          "adresiniz değişmez.",
      },
    ],
  });
}

export function promotedToWriter(input: { displayName: string; url: string }): Template {
  return renderMail({
    kind: "promoted_to_writer",
    subject: "postscript · Yazar olarak yetkilendirildiniz",
    heading: "Yazar olarak yetkilendirildiniz",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          "Hesabınız yazar olarak onaylandı; yazar sayfalarınız açık. Çerçeve sözleşme " +
          "size ayrıca iletilecek.",
      },
      { type: "action", url: input.url, label: "Yazar paneline git" },
    ],
  });
}

export function applicationSubmitted(input: { displayName: string }): Template {
  return renderMail({
    kind: "application_submitted",
    subject: "postscript · Yazar başvurunuz alındı",
    heading: "Yazar başvurunuz alındı",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          "Yazar başvurunuz alındı. Önce editörlerimiz, ardından yönetim başvurunuzu " +
          "değerlendirecek. Durum, Hesabım sayfasından takip edilebilir.",
      },
      { type: "paragraph", text: "Değerlendirme sürerken yeni başvuru gönderilemez." },
    ],
  });
}

export function applicationEditorApproved(input: { displayName: string }): Template {
  return renderMail({
    kind: "application_editor_approved",
    subject: "postscript · Yazar başvurunuz editör onayından geçti",
    heading: "Başvurunuz editör onayından geçti",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          "Örnek eseriniz editörlerimiz tarafından onaylandı. Başvurunuz artık yönetim " +
          "onayına gönderildi.",
      },
      { type: "paragraph", text: "Sonuç, Hesabım sayfasından takip edilebilir." },
    ],
  });
}

export function applicationRejected(input: { displayName: string; reason: string }): Template {
  return renderMail({
    kind: "application_rejected",
    subject: "postscript · Yazar başvurunuzla ilgili karar",
    heading: "Yazar başvurunuzla ilgili karar",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      { type: "paragraph", text: "Yazar başvurunuz şu anda kabul edilmedi." },
      { type: "note", label: "Değerlendirme notu:", text: input.reason },
      {
        type: "paragraph",
        text: "Gerekli koşulları sağladıktan sonra 30 günün ardından yeniden başvurabilirsiniz.",
      },
    ],
  });
}

export function applicationContractReady(input: {
  displayName: string;
  url: string;
}): Template {
  return renderMail({
    kind: "application_contract_ready",
    subject: "postscript · Yazar sözleşmeniz hazır",
    heading: "Yazar sözleşmeniz hazır",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          "Başvurunuz yönetim tarafından onaylandı. Yazar olmanın son adımı, çerçeve " +
          "sözleşmeyi okuyup imzalamak:",
        url: input.url,
        label: "Sözleşmeyi oku",
      },
      {
        type: "paragraph",
        text: "Sözleşmeyi imzaladığınızda hesabınız otomatik olarak yazar rolüne geçer.",
      },
    ],
  });
}

export function newAgreementVersion(input: {
  displayName: string;
  version: number;
  url: string;
}): Template {
  return renderMail({
    kind: "new_agreement_version",
    subject: `postscript · Yeni sözleşme sürümü (v${input.version}) onayınızı bekliyor`,
    heading: `Sözleşmenin ${input.version}. sürümü onayınızı bekliyor`,
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          `Çerçeve sözleşmenin ${input.version}. sürümü yayınlandı. Yazar sayfalarına ` +
          "yeniden erişebilmek için yeni sürümü okuyup onaylamanız gerekiyor:",
        url: input.url,
        label: "Yeni sürümü oku",
      },
    ],
  });
}

export function agreementAccepted(input: { displayName: string; version: number }): Template {
  return renderMail({
    kind: "agreement_accepted",
    subject: `postscript · Sözleşme onayınız kaydedildi (v${input.version})`,
    heading: "Sözleşme onayınız kaydedildi",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          `Yazar sözleşmesinin ${input.version}. sürümünü onayladınız. Onayladığınız metnin ` +
          "tam kopyası PDF olarak bu iletiye eklendi; kayıtlarınız için saklayın.",
      },
      { type: "paragraph", text: "Yazar sayfalarınız açıldı." },
    ],
  });
}

export function rightsGrantPending(input: {
  displayName: string;
  articleTitle: string;
  url: string;
}): Template {
  return renderMail({
    kind: "rights_grant_pending",
    subject: `postscript · Eser Onayı bekliyor: ${input.articleTitle}`,
    heading: "Eser Onayınız bekleniyor",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          `"${input.articleTitle}" başlıklı yazınız yayına kabul edildi ve Eser Onayınızı ` +
          "bekliyor. Onay ekranında eserin metin özetini ve sözleşme sürümünü görecek, " +
          "adınızın nasıl görüneceğini seçeceksiniz:",
        url: input.url,
        label: "Onay ekranına git",
      },
      {
        type: "paragraph",
        text: "Onay verilmeden eser hiçbir mecrada yayımlanmaz (Sözleşme m. 5.4).",
      },
    ],
  });
}

export function rightsGrantReminder(input: {
  displayName: string;
  articleTitle: string;
  url: string;
}): Template {
  return renderMail({
    kind: "rights_grant_reminder",
    subject: `postscript · Hatırlatma: ${input.articleTitle} için Eser Onayı`,
    heading: "Eser Onayınız hâlâ bekleniyor",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead: `"${input.articleTitle}" başlıklı yazınız hâlâ Eser Onayınızı bekliyor:`,
        url: input.url,
        label: "Onay ekranına git",
      },
    ],
  });
}

export function rightsGrantSigned(input: {
  displayName: string;
  articleTitle: string;
}): Template {
  return renderMail({
    kind: "rights_grant_signed",
    subject: `postscript · Eser Onayı kaydedildi: ${input.articleTitle}`,
    heading: "Eser Onayınız kaydedildi",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          `"${input.articleTitle}" başlıklı eseriniz için ruhsat onayı verdiniz. ` +
          "Onay kaydının PDF kopyası bu iletiye eklendi; kayıtlarınız için saklayın.",
      },
    ],
  });
}

export function articleStatusChanged(input: {
  displayName: string;
  articleTitle: string;
  status: string;
  note?: string;
  url: string;
}): Template {
  const labels: Record<string, string> = {
    revision_requested: "revizyon istendi",
    published: "yayınlandı",
    withdrawn: "geri çekildi",
  };
  const label = labels[input.status] ?? input.status;

  return renderMail({
    kind: "article_status_changed",
    subject: `postscript · "${input.articleTitle}" — ${label}`,
    heading: `Yazınızın durumu: ${label}`,
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      { type: "paragraph", text: `"${input.articleTitle}" başlıklı yazının durumu değişti: ${label}.` },
      ...(input.note ? [{ type: "note" as const, label: "Editör notu:", text: input.note }] : []),
      { type: "action", lead: "Ayrıntılar:", inline: true, url: input.url, label: "Yazıyı aç" },
    ],
  });
}

/**
 * Tells an admin a content report is waiting (D-098). Only the kinds are
 * named: the reported text, the reporter and the reported account stay in the
 * panel, because a mailbox is outside the boundary D-091 and D-092 draw.
 */
export function adminReportReceived(input: {
  target: string;
  category: string;
  url: string;
}): Template {
  return renderMail({
    kind: "admin_report_received",
    subject: "postscript · Yeni içerik bildirimi: 24 saat içinde sonuçlandırılmalı",
    heading: "Yeni içerik bildirimi",
    greeting: "Merhaba,",
    blocks: [
      { type: "paragraph", text: "Topluluktan yeni bir içerik bildirimi geldi." },
      {
        type: "details",
        rows: [
          ["Bildirilen", input.target],
          ["Bildirim türü", input.category],
        ],
      },
      {
        type: "action",
        lead:
          "5651 sayılı Kanun gereği en geç 24 saat içinde sonuçlandırılmalıdır. " +
          "İçerik ve hesaplar yalnızca panelde görünür:",
        url: input.url,
        label: "Bildirimi incele",
      },
    ],
  });
}

/** Tells an admin an application passed the editor and needs their decision (D-098). */
export function adminApplicationAwaiting(input: { url: string }): Template {
  return renderMail({
    kind: "admin_application_awaiting",
    subject: "postscript · Yönetim onayı bekleyen yazar başvurusu",
    heading: "Yönetim onayı bekleyen başvuru",
    greeting: "Merhaba,",
    blocks: [
      {
        type: "action",
        lead:
          "Bir yazar başvurusu editör onayından geçti ve yönetim kararını bekliyor. " +
          "Başvuru sahibinin bilgileri yalnızca panelde görünür:",
        url: input.url,
        label: "Başvuruları aç",
      },
    ],
  });
}

/**
 * Tells the owner a recovery code was spent at login (D-099). If it was not
 * them, this mail is how they find out before the codes run out.
 */
export function recoveryCodeUsed(input: { displayName: string; remaining: number }): Template {
  return renderMail({
    kind: "recovery_code_used",
    subject: "postscript · Kurtarma kodu kullanıldı",
    heading: "Kurtarma kodu kullanıldı",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text:
          "Hesabınıza iki adımlı doğrulama kurtarma koduyla giriş yapıldı. " +
          `Kullanılmamış ${input.remaining} kurtarma kodunuz kaldı.`,
      },
      {
        type: "paragraph",
        text:
          "Bu girişi siz yapmadıysanız hemen şifrenizi değiştirin, Hesabım sayfasından " +
          "diğer oturumları kapatın ve yeni kurtarma kodları oluşturun.",
      },
    ],
  });
}

/**
 * A material change to the KVKK notice (D-104, notice §10). It informs; the
 * notice never asks for consent, so the mail does not ask for anything either.
 */
export function kvkkNewVersion(input: {
  displayName: string;
  version: number;
  url: string;
}): Template {
  return renderMail({
    kind: "kvkk_new_version",
    subject: `postscript · KVKK aydınlatma metni güncellendi (sürüm ${input.version})`,
    heading: "Aydınlatma metnimiz güncellendi",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          "Kişisel verilerinizin nasıl işlendiğini anlatan aydınlatma metnimizin " +
          `${input.version}. sürümü yayınlandı. Yeni metni buradan okuyabilirsiniz:`,
        url: input.url,
        label: "Metni oku",
      },
      { type: "paragraph", text: "Bu bir bilgilendirmedir; sizden onay istenmiyor." },
    ],
  });
}

export function mandatoryAnnouncement(input: {
  displayName: string;
  title: string;
  url: string;
}): Template {
  return renderMail({
    kind: "mandatory_announcement",
    subject: `postscript · Onayınız gereken duyuru: ${input.title}`,
    heading: "Onayınız gereken bir duyuru var",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "action",
        lead:
          `"${input.title}" başlıklı duyuru onayınızı bekliyor. Onaylamadan diğer yazar ` +
          "sayfalarına erişemezsiniz:",
        url: input.url,
        label: "Duyuruyu oku",
      },
    ],
  });
}

export function contactMessage(input: {
  name: string;
  email: string;
  subject: string | null;
  topic: string | null;
  message: string;
}): Template {
  return renderMail({
    kind: "contact_message",
    subject: `postscript · İletişim formu: ${input.subject ?? input.topic ?? "yeni mesaj"}`,
    heading: "İletişim formundan yeni mesaj",
    blocks: [
      { type: "paragraph", text: "İletişim formundan yeni bir mesaj geldi." },
      {
        type: "details",
        rows: [
          ["Ad", input.name],
          ["E-posta", input.email],
          ["Konu", input.subject ?? "—"],
          ["Başlık", input.topic ?? "—"],
        ],
      },
      { type: "quote", label: "Mesaj:", text: input.message },
      { type: "paragraph", text: "Yanıtlamak için gönderenin e-posta adresine yazın." },
    ],
  });
}

/**
 * The issue's topic window has opened (D-272). A writer with two areas is
 * reminded that each area takes its own topic (D-271).
 */
export function topicWindowOpened(input: {
  displayName: string;
  issueLabel: string;
  theme: string | null;
  closesAt: string;
  areas: string[];
  url: string;
}): Template {
  return renderMail({
    kind: "topic_window_opened",
    subject: `postscript · ${input.issueLabel} için konu belirleme dönemi başladı`,
    heading: "Konu belirleme dönemi başladı",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      { type: "paragraph", text: `${input.issueLabel} için konu belirleme dönemi başladı.` },
      {
        type: "details",
        rows: [
          ...(input.theme ? [["Tema", input.theme] as [string, string]] : []),
          ["Son gün", input.closesAt],
        ],
      },
      ...(input.areas.length >= 2
        ? [
            {
              type: "paragraph" as const,
              text: `Alanlarınızın her biri için ayrı bir konu önerebilirsiniz: ${input.areas.join(", ")}.`,
            },
          ]
        : []),
      {
        type: "action",
        lead: "Konunuzu yazar panelinden önerebilirsiniz; editör değerlendirdikten sonra yazınıza başlarsınız:",
        url: input.url,
        label: "Konumu öner",
      },
      { type: "paragraph", text: "Saatler Türkiye saatidir." },
    ],
  });
}

/**
 * The main editor has decided on a writer's topic proposal (D-273). The
 * editor's note goes in as written: for a change request or a refusal it is
 * the whole point of the message.
 */
export function topicDecided(input: {
  displayName: string;
  issueLabel: string;
  topicTitle: string;
  decision: "accept" | "revision" | "reject";
  note: string | null;
  url: string;
}): Template {
  const copy = {
    accept: {
      label: "kabul edildi",
      heading: "Konunuz kabul edildi",
      lead: "Yazı kabul dönemi açıldığında yazınızı bu konudan başlatabilirsiniz:",
      button: "Konularımı aç",
    },
    revision: {
      label: "değişiklik istendi",
      heading: "Konunuz için değişiklik istendi",
      lead: "Konunuzu editörün notuna göre düzenleyip yeniden gönderebilirsiniz:",
      button: "Konumu düzenle",
    },
    reject: {
      label: "kabul edilmedi",
      heading: "Konunuz kabul edilmedi",
      lead: "Ayrıntıları yazar panelinde görebilirsiniz:",
      button: "Konularımı aç",
    },
  }[input.decision];

  return renderMail({
    kind: "topic_decided",
    subject: `postscript · "${input.topicTitle}" — ${copy.label}`,
    heading: copy.heading,
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text: `${input.issueLabel} için önerdiğiniz "${input.topicTitle}" konusu ${copy.label}.`,
      },
      ...(input.note ? [{ type: "note" as const, label: "Editör notu:", text: input.note }] : []),
      { type: "action", lead: copy.lead, url: input.url, label: copy.button },
    ],
  });
}

/**
 * The issue's delivery window has opened (D-270). Only an article for an
 * accepted topic may be handed in (D-261), so a writer without one is told
 * that rather than invited to send something the panel will refuse.
 */
export function submissionWindowOpened(input: {
  displayName: string;
  issueLabel: string;
  closesAt: string;
  acceptedTopic: string | null;
  url: string;
}): Template {
  return renderMail({
    kind: "submission_window_opened",
    subject: `postscript · ${input.issueLabel} için yazı kabul dönemi başladı`,
    heading: "Yazı kabul dönemi başladı",
    greeting: `Merhaba ${input.displayName},`,
    blocks: [
      {
        type: "paragraph",
        text: `${input.issueLabel} için yazı kabul dönemi başladı.`,
      },
      { type: "details", rows: [["Son teslim", input.closesAt]] },
      ...(input.acceptedTopic
        ? [
            { type: "note" as const, label: "Kabul edilen konunuz:", text: input.acceptedTopic },
            {
              type: "action" as const,
              lead: "Yazınızı konunuzdan başlatıp dönem bitmeden incelemeye gönderebilirsiniz:",
              url: input.url,
              label: "Yazımı teslim et",
            },
          ]
        : [
            {
              type: "action" as const,
              lead:
                "Bu dönemde yalnızca konusu kabul edilmiş yazılar teslim edilebilir. Sayının " +
                "takvimini ve konunuzun durumunu buradan görebilirsiniz:",
              url: input.url,
              label: "Sayı takvimini aç",
            },
          ]),
      { type: "paragraph", text: "Saatler Türkiye saatidir." },
    ],
  });
}
