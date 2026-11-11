import { ARTICLE_JOURNEY, CHANGE_TYPE, EDITOR_ROLES, MEDIA_SECTION, TWO_FACTOR_SECTION, WORD_BUDGET } from "./shared";
import type { GuideSection, PanelGuide } from "./types";

/** The sections the category editor and the main editor read alike. */
export const ARTICLE_LIST_SECTION: GuideSection = {
  id: "yazilar",
  title: "Kategoriye düşen yazılar",
  href: "/editor/articles",
  blocks: [
    {
      kind: "p",
      text: "İnceleme kuyruğunuz. Liste her zaman tek bir sayıya aittir. Kategori editörü yalnızca kendi alanlarındaki yazıları görür; ana editörün başka bir editöre gönderdiği yazı listeden düşer, size gönderilmiş yazı listenize eklenir.",
    },
    {
      kind: "list",
      items: [
        "**Filtrele** kartında sayı, başlıkta geçen kelime (**Ara**), **Durum**, **Kategori**, **Yazar** ve **Sıralama** seçip **Uygula**ya basın.",
        "Tablo başlık, yazar, kategori, kelime sayısı, editör ve durumu gösterir. Editör sütununda \"· gönderildi\" yazıyorsa yazı başka bir editöre devredilmiştir.",
        "Durum sütunundaki \"Ana editör revizyon istedi\" notu, yazının ana editörden kategori editörüne geri döndüğünü gösterir.",
        "Sayfa başına 50 yazı vardır; **← Önceki / Sonraki →** ile gezinin.",
      ],
    },
    {
      kind: "p",
      text: "**Yeni makale kaydı** formuyla yazı oluşturabilirsiniz: **Başlık** ve **Sayı** zorunlu, yazar sonra da atanabilir. Yazı taslak olarak açılır. Yazar alanına yalnızca yazar rolündeki kişiler atanabilir.",
    },
  ],
};

export const ARTICLE_EDIT_SECTION: GuideSection = {
  id: "makale",
  title: "Bir yazıyı incelemek ve düzenlemek",
  href: "/editor/articles",
  pages: ["/editor/articles/"],
  blocks: [
    {
      kind: "p",
      text: "Listede bir başlığa tıklayınca yazının sayfası açılır. Üstte kelime sayısı ve durum rozeti, altında uyarılar yer alır: konusu kabul edilmemiş yazı, ana editörün revizyon notu, lisansı eksik görsel ve yazarın Eser Onayı durumu.",
    },
    {
      kind: "p",
      text: "**Durum** kartı yalnızca sizin yapabileceğiniz geçişleri düğme olarak gösterir. Bir düğmeye basınca küçük bir form açılır; gerekiyorsa notu yazıp onaylarsınız.",
    },
    {
      kind: "p",
      text: "**Makale** formunda başlık, özet, yazar, kategori, teslim tarihi, gövde (markdown) ve kaynakçayı düzenleyip **Kaydet**e basarsınız. Gövdeyi değiştirdiyseniz **Değişiklik notu**nu doldurun ve **Değişikliğin türü**nü doğru seçin:",
    },
    CHANGE_TYPE,
    {
      kind: "list",
      items: [
        "Planlanmış bir yazıda içerik değişikliği, yazıyı yeniden yazar onayı beklemeye düşürür.",
        "500 kelimeyi aşan yazıda uyarı çıkar; bu yalnızca öneridir. Bağlayıcı olan kategori toplamıdır (aşağıdaki çizim) ve yazarın kayıtlarında uygulanır.",
        "**Satır sonlarını paragrafa çevir** düğmesi, yapıştırılmış metindeki tek satır sonlarını paragrafa çevirir.",
      ],
    },
    WORD_BUDGET,
    {
      kind: "note",
      text: "Siz sayfayı açtıktan sonra yazıyı başka biri kaydettiyse ya da durumu değiştiyse kaydınız yazılmaz ve uyarı çıkar. Metninizi bir yere kopyalayın, sayfayı yenileyin ve değişikliği son sürümün üzerine yeniden yapın. Kaydedilmemiş değişiklikle sayfadan çıkmaya çalışırsanız tarayıcı sizi uyarır.",
    },
    {
      kind: "list",
      items: [
        "Kategori editörü yazıyı kendi alanı dışındaki bir kategoriye taşıyamaz.",
        "Yayımlanmış ya da arşivlenmiş yazının içeriği ve yazarı değiştirilemez; önce yönetimin geri çekmesi gerekir.",
        "**İntihal kontrolü** kartında durumu (Kontrol edilmedi / Temiz / İşaretlendi) ve notu kaydedin.",
        "**Editöryal notlar**a eklediğiniz notları yazar görür ama yanıt yazamaz. İşi biten notu **Çözüldü** ile kapatın.",
        "**Sürüm geçmişi**nden her sürümü (v1, v2…) açabilirsiniz; \"yayın\" etiketi yayımlanan hâli gösterir.",
      ],
    },
  ],
};

export const JOURNEY_SECTION: GuideSection = {
  id: "is-akisi",
  title: "Yazının yolculuğu",
  blocks: [
    ARTICLE_JOURNEY,
    {
      kind: "p",
      text: "Kabul, planlama, yayın, arşiv ve geri çekme yalnızca yönetimindir. Yazara e-posta yalnızca revizyon istendiğinde, yazı reddedildiğinde, yayımlandığında ve geri çekildiğinde gider; **Taslağa Dön** yazara mesaj göndermez. Yazar Eser Onayını reddederse tüm editörlere panel bildirimi düşer.",
    },
  ],
};

/** The category editor's guide; the main editor has its own (`main-editor.ts`). */
export const EDITOR_GUIDE: PanelGuide = {
  title: "Kategori editörü rehberi",
  intro:
    "Kategori editörü için editör panelinin her sayfası: ne gösterir, hangi düğme ne yapar, nerede durursunuz. Ana editörün rehberi ayrıdır.",
  sections: [
    TWO_FACTOR_SECTION,
    {
      id: "editor-turleri",
      title: "Sizin işiniz ve ana editörün işi",
      blocks: [
        EDITOR_ROLES,
        {
          kind: "p",
          text: "Sayılar, duyurular, Eser Onayı takibi, yazar başvuruları ve çizimler yönetimin işidir; bu sayfalar editörlere kapalıdır. Konu önerileri, geçici alan, e-posta kuyruğu ve ekip iletişimi ana editörün sayfalarıdır, sizin menünüzde görünmez.",
        },
      ],
    },
    {
      id: "genel-bakis",
      title: "Genel bakış",
      href: "/editor",
      blocks: [
        {
          kind: "p",
          text: "Panelin açılış sayfası. **Sayı takvimi** kartında sayıların konu ve teslim dönemleri görünür (saatler Türkiye saatidir). Kartta yalnızca size atanmış alanlar yazar. Henüz alan atanmadıysa \"Alan atanmamış\" uyarısı çıkar ve inceleme kuyruğunuz boş kalır; bu durumda yöneticiye başvurun.",
        },
        {
          kind: "list",
          items: [
            "Sayaçlar varsayılan olarak **aktif sayı**ya aittir. Başka bir sayıya bakmak için **Sayı** alanından seçip **Uygula**ya basın.",
            "**Alanınıza düşen incelemeler:** onayınızı bekleyen yazılar. **Revizyon bekleniyor:** yazara geri dönmüş yazılar.",
            "Bir sayaca tıklamak, yazı listesini o durumla süzülmüş olarak açar.",
          ],
        },
      ],
    },
    ARTICLE_LIST_SECTION,
    {
      id: "onay",
      title: "Onaylamak ya da revizyon istemek",
      href: "/editor/articles",
      blocks: [
        {
          kind: "compare",
          items: [
            {
              title: "Onayla ve Ana Editöre Gönder",
              tone: "ok",
              points: ["Yazı iyi durumda", "Ana editörün onayına geçer", "Bundan sonra sizde düğme kalmaz"],
            },
            {
              title: "Revizyon İste",
              tone: "warn",
              points: ["Yazarın düzeltmesi gerekiyor", "Notunuz yazara e-postayla gider", "Yazar düzeltip yeniden gönderir"],
            },
          ],
        },
        {
          kind: "list",
          items: [
            "**Yazara iletilecek not** isteğe bağlıdır ama yazara gider; ne istediğinizi açık ve madde madde yazın.",
            "**Taslağa Dön** yazıyı taslağa çeker; yazara mesaj gitmez.",
            "**İncelemeye Gönder** taslak ya da revizyondaki yazıyı incelemeye alır.",
            "Yazı ana editöre geçtikten sonra sayfada \"son durumdur\" yazması, o aşamada sizin için düğme olmadığı anlamına gelir.",
          ],
        },
        {
          kind: "note",
          text: "Ana editör yazıyı size geri gönderirse yazı yeniden \"İncelemede\" olur, sayfada ana editörün notu çıkar ve size panel bildirimi gelir; yazara haber verilmez. Metni düzeltip yeniden **Onayla ve Ana Editöre Gönder**e basabilir ya da yazardan revizyon isteyebilirsiniz.",
        },
      ],
    },
    ARTICLE_EDIT_SECTION,
    JOURNEY_SECTION,
    {
      id: "gonderilen",
      title: "Size gönderilen yazılar",
      href: "/editor/articles",
      blocks: [
        {
          kind: "p",
          text: "Ana editör bir yazının incelemesini size gönderebilir. Yazı listenize eklenir, size panel bildirimi gelir ve yazı sayfasındaki **İnceleyen editör** kartında kimin gönderdiği yazar. O yazının kategori aşamasını yalnızca siz yürütürsünüz; alanın kendi editörü görmez. Sizin alanınızdan bir yazı başkasına gönderilirse listenizden düşer.",
        },
      ],
    },
    MEDIA_SECTION,
  ],
};
