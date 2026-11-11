import { SIGNING_SECTION } from "./signing";
import type { PanelGuide } from "./types";

/** The çizer panel: the contract, the documents and the drawings. */
export const ILLUSTRATOR_GUIDE: PanelGuide = {
  title: "Çizer paneli kullanım rehberi",
  intro:
    "Sözleşmenizi imzalamaktan çizimlerinizi göndermeye kadar çizer panelinin her sayfası. Hem yazar hem çizer olanlar Çizimlerim sayfasına yazar menüsünden de ulaşır.",
  sections: [
    {
      id: "baslarken",
      title: "Başlarken",
      blocks: [
        {
          kind: "steps",
          items: [
            "**Sözleşmem ve belgelerim** sayfasında Genel Katkı Sağlayan Sözleşmesi'ni okuyup imzalayın ve PDF olarak yükleyin.",
            "Çizimlerinizi **Çizimlerim** sayfasından, hangi sayı için olduğunu seçerek gönderin.",
            "Yönetim, sayı başına bir ruhsat formu hazırlar; form e-postanıza ve **Belgelerim**e gelir. İmzalayıp yükleyin.",
          ],
        },
        {
          kind: "flow",
          steps: ["Sözleşmeyi imzala, yükle", "Çizimi gönder", "Yönetim ruhsat formunu hazırlar", "Formu imzala, yükle", "Çizim yayımlanabilir"],
          caption: "Çiziminizin panelden geçtiği yol.",
        },
        {
          kind: "note",
          text: "Çizimi yüklemek yayın izni değildir. Ruhsat formunu imzalamadan çiziminiz yayımlanmaz ve haklar sizde kalır. Her sayfanın üst çubuğundaki **Bu sayfanın rehberi** düğmesi o sayfayı anlatan bölümü açar.",
        },
      ],
    },
    {
      id: "sozlesme",
      title: "Sözleşmem ve belgelerim",
      href: "/cizer",
      blocks: [
        {
          kind: "steps",
          items: [
            "**Sözleşme metnini göster**e basarak metni okuyun.",
            "Yazdırın; **her sayfanın** altına paraf atın, son sayfayı el yazınızla imzalayın ve bütün sayfaları tek PDF olarak tarayın (ayrıntı: bir sonraki bölüm).",
            "**İmzalı sözleşmeyi yükle** kartından PDF'i seçin (yalnızca PDF, en çok 4 MB) ve **İmzalı PDF'i yükle**ye basın.",
            "Yönetici doğrulayınca sayfada \"İmzalı sözleşmeniz doğrulandı.\" yazar. Reddedilirse nedeni yazılır; düzeltip yeniden yükleyin.",
          ],
        },
        {
          kind: "p",
          text: "**Belgelerim** tablosunda size hazırlanan belgeler durur: sözleşme ve çizimleriniz için Eser Bazlı Kullanım Ruhsatı Formları. Her satırda **İndir** ile belgeyi alır, her sayfasını parafe edip imzalar, bütün sayfalarını tarar ve **İmzalı PDF** alanından yüklersiniz. Ruhsat formu iki tarafın imzasıyla yürürlüğe girer; yüklediğiniz kopya kabul edilmezse satırda \"yeniden yükleyin\" yazar.",
        },
        {
          kind: "p",
          text: "**Yüklediğim sözleşmeler** kartı önceki yüklemelerinizi ve sonuçlarını gösterir.",
        },
      ],
    },
    SIGNING_SECTION,
    {
      id: "cizimler",
      title: "Çizimlerim",
      href: "/cizer/cizimler",
      blocks: [
        {
          kind: "p",
          text: "Gönderdiğiniz çizimleri yalnızca yöneticiler görür. Her yüklemede yöneticilere panel bildirimi gider.",
        },
        {
          kind: "steps",
          items: [
            "**Çizim gönder** kartında **Dosya**yı seçin: JPG, PNG ya da WEBP, en çok 4 MB. Dosya türü içeriğinden doğrulanır.",
            "**Çizimin adı**nı yazın (zorunlu).",
            "**Hangi sayı için?** alanından sayıyı seçin (zorunlu; yayımlanmış sayılar da listelenir).",
            "İsterseniz **Not** ekleyin ve **Gönder**e basın.",
          ],
        },
        {
          kind: "compare",
          items: [
            { title: "Kaldırabilirsiniz", tone: "ok", points: ["Ruhsat formu henüz size gönderilmedi", "Dosya silinir, geri alınamaz"] },
            { title: "Kaldıramazsınız", tone: "warn", points: ["Ruhsat formu gönderildi ya da imzalandı", "Yöneticiye yazın"] },
          ],
        },
        {
          kind: "list",
          items: [
            "**Yüklediğim çizimler** listesinde her çizimin **Kaldır** düğmesi vardır; dosya silinir ve geri alınamaz.",
            "Ruhsat formu size gönderilmiş ya da imzalanmış bir çizimi kaldıramazsınız; bunun için yöneticiye yazın.",
            "Çizimin hangi alana ait olduğunu yönetim belirler.",
          ],
        },
      ],
    },
    {
      id: "hesap",
      title: "Hesabım",
      href: "/account",
      blocks: [
        {
          kind: "p",
          text: "Ad, şifre, e-posta değişikliği, iki adımlı doğrulama ve hesap silme Hesabım sayfasındadır. İki adımlı doğrulama çizerler için zorunlu değildir ama önerilir.",
        },
      ],
    },
  ],
};
