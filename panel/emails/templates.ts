/**
 * E-mail templates (specification §12).
 *
 * Each template is a pure function returning a subject and a plain text body.
 * Keeping them free of imports from the service layer means they can be
 * previewed and unit tested on their own.
 */

export type Template = { subject: string; text: string };

const signature = "\n\n—\npostscript\nBu ileti otomatik olarak gönderildi.";

export function verifyEmail(input: { displayName: string; url: string }): Template {
  return {
    subject: "postscript · E-posta adresinizi doğrulayın",
    text:
      `Merhaba ${input.displayName},\n\n` +
      "Hesabınızı kullanmaya başlamak için e-posta adresinizi doğrulayın:\n" +
      `${input.url}\n\n` +
      "Bağlantı 24 saat geçerlidir. Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz." +
      signature,
  };
}

export function resetPassword(input: { displayName: string; url: string }): Template {
  return {
    subject: "postscript · Şifre sıfırlama",
    text:
      `Merhaba ${input.displayName},\n\n` +
      "Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın:\n" +
      `${input.url}\n\n` +
      "Bağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.\n" +
      "Şifreniz sıfırlandığında tüm açık oturumlarınız kapatılır." +
      signature,
  };
}

export function changeEmail(input: {
  displayName: string;
  newEmail: string;
  url: string;
}): Template {
  return {
    subject: "postscript · E-posta adresinizi doğrulayın",
    text:
      `Merhaba ${input.displayName},\n\n` +
      `Hesabınızın e-posta adresini ${input.newEmail} adresine değiştirmek istediniz. ` +
      "Bu adresi doğrulamak için aşağıdaki bağlantıyı kullanın:\n" +
      `${input.url}\n\n` +
      "Bağlantı 24 saat geçerlidir. Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz; " +
      "adresiniz değişmez." +
      signature,
  };
}

export function promotedToWriter(input: { displayName: string; url: string }): Template {
  return {
    subject: "postscript · Yazar olarak yetkilendirildiniz",
    text:
      `Merhaba ${input.displayName},\n\n` +
      "Hesabınız yazar rolüne yükseltildi. Yazar paneline girip çerçeve sözleşmeyi " +
      "onayladıktan sonra tüm yazar sayfaları açılacak:\n" +
      `${input.url}` +
      signature,
  };
}

export function newAgreementVersion(input: {
  displayName: string;
  version: number;
  url: string;
}): Template {
  return {
    subject: `postscript · Yeni sözleşme sürümü (v${input.version}) onayınızı bekliyor`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `Çerçeve sözleşmenin ${input.version}. sürümü yayınlandı. Yazar sayfalarına ` +
      "yeniden erişebilmek için yeni sürümü okuyup onaylamanız gerekiyor:\n" +
      `${input.url}` +
      signature,
  };
}

export function agreementAccepted(input: { displayName: string; version: number }): Template {
  return {
    subject: `postscript · Sözleşme onayınız kaydedildi (v${input.version})`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `Yazar sözleşmesinin ${input.version}. sürümünü onayladınız. Onayladığınız metnin ` +
      "tam kopyası PDF olarak bu iletiye eklendi; kayıtlarınız için saklayın.\n\n" +
      "Yazar sayfalarınız açıldı." +
      signature,
  };
}

export function rightsGrantPending(input: {
  displayName: string;
  articleTitle: string;
  url: string;
}): Template {
  return {
    subject: `postscript · Eser Onayı bekliyor: ${input.articleTitle}`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `"${input.articleTitle}" başlıklı yazınız yayına kabul edildi ve Eser Onayınızı ` +
      "bekliyor. Onay ekranında eserin metin özetini ve sözleşme sürümünü görecek, " +
      "adınızın nasıl görüneceğini seçeceksiniz:\n" +
      `${input.url}\n\n` +
      "Onay verilmeden eser hiçbir mecrada yayımlanmaz (Sözleşme m. 5.4)." +
      signature,
  };
}

export function rightsGrantReminder(input: {
  displayName: string;
  articleTitle: string;
  url: string;
}): Template {
  return {
    subject: `postscript · Hatırlatma: ${input.articleTitle} için Eser Onayı`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `"${input.articleTitle}" başlıklı yazınız hâlâ Eser Onayınızı bekliyor:\n` +
      `${input.url}` +
      signature,
  };
}

export function rightsGrantSigned(input: {
  displayName: string;
  articleTitle: string;
}): Template {
  return {
    subject: `postscript · Eser Onayı kaydedildi: ${input.articleTitle}`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `"${input.articleTitle}" başlıklı eseriniz için ruhsat onayı verdiniz. ` +
      "Onay kaydının PDF kopyası bu iletiye eklendi; kayıtlarınız için saklayın." +
      signature,
  };
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

  return {
    subject: `postscript · "${input.articleTitle}" — ${label}`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `"${input.articleTitle}" başlıklı yazının durumu değişti: ${label}.\n` +
      (input.note ? `\nEditör notu: ${input.note}\n` : "") +
      `\nAyrıntılar: ${input.url}` +
      signature,
  };
}

export function mandatoryAnnouncement(input: {
  displayName: string;
  title: string;
  url: string;
}): Template {
  return {
    subject: `postscript · Onayınız gereken duyuru: ${input.title}`,
    text:
      `Merhaba ${input.displayName},\n\n` +
      `"${input.title}" başlıklı duyuru onayınızı bekliyor. Onaylamadan diğer yazar ` +
      "sayfalarına erişemezsiniz:\n" +
      `${input.url}` +
      signature,
  };
}
