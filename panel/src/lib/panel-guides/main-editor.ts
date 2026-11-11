import { ARTICLE_EDIT_SECTION, ARTICLE_LIST_SECTION, JOURNEY_SECTION } from "./editor";
import { EDITOR_ROLES, ISSUE_WINDOWS, MEDIA_SECTION, TWO_FACTOR_SECTION } from "./shared";
import type { PanelGuide } from "./types";

/** The main editor's guide: the category editor's ground plus the main editor's own tools. */
export const MAIN_EDITOR_GUIDE: PanelGuide = {
  title: "Ana editör rehberi",
  intro:
    "Ana editör için editör panelinin her sayfası: ikinci onay, ret, yazıyı başka editöre gönderme, konu kararları, geçici alan, e-posta kuyruğu ve ekip iletişimi.",
  sections: [
    TWO_FACTOR_SECTION,
    {
      id: "rol",
      title: "Ana editörün işi",
      blocks: [
        EDITOR_ROLES,
        {
          kind: "p",
          text: "Ana editör tek kişidir ve bütün kategorileri görür. Kategori editörünün yapabildiği her şeyi bütün alanlarda (editörü atanmamış alanlar dahil) yapabilirsiniz; ayrıca ikinci onay ve aşağıdaki sayfalar yalnızca sizdedir. Sayılar, duyurular, Eser Onayı takibi, yazar başvuruları ve çizimler yönetimin işidir.",
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
          text: "**Sayı takvimi** kartında sayıların konu ve teslim dönemleri görünür (saatler Türkiye saatidir). Sayaçlar varsayılan olarak aktif sayıya aittir; başka bir sayı için **Sayı** seçip **Uygula**ya basın.",
        },
        ISSUE_WINDOWS,
        {
          kind: "list",
          items: [
            "**Kategori onayı bekliyor:** kategori editörlerinin önündeki yazılar.",
            "**Ana editör onayı bekliyor:** sizin kararınızı bekleyen yazılar.",
            "**Revizyon bekleniyor:** yazara geri dönmüş yazılar.",
            "Bir sayaca tıklamak, yazı listesini o durumla süzülmüş olarak açar.",
          ],
        },
      ],
    },
    ARTICLE_LIST_SECTION,
    {
      id: "ana-editor-onayi",
      title: "Ana editör onayı",
      href: "/editor/articles",
      blocks: [
        {
          kind: "p",
          text: "\"Ana editör onayında\" durumundaki bir yazıda dört düğme görürsünüz:",
        },
        {
          kind: "compare",
          items: [
            { title: "Onayla", tone: "ok", points: ["Yazı yayın kuyruğuna geçer", "Bundan sonrası yönetimin"] },
            {
              title: "Yazardan revizyon iste",
              tone: "warn",
              points: ["Yazı yazara döner", "Notunuz yazara e-postayla gider"],
            },
            {
              title: "Kategori editöründen revizyon iste",
              tone: "warn",
              points: ["Yazı kategori editörüne döner", "Açıklama zorunlu", "Yazara haber verilmez"],
            },
            {
              title: "Reddet",
              tone: "warn",
              points: ["Ret gerekçesi zorunlu", "Gerekçe yazara e-postayla gider", "Yazı yazara taslak olarak döner"],
            },
          ],
        },
        {
          kind: "note",
          text: "Kategori aşamasındaki yazılarda da kategori editörünün düğmelerini görürsünüz (**Onayla ve Ana Editöre Gönder**, **Revizyon İste**, **Taslağa Dön**); alanın editörü yoksa ya da gecikiyorsa bu aşamayı siz yürütebilirsiniz.",
        },
      ],
    },
    {
      id: "devretme",
      title: "Yazıyı başka bir editöre göndermek",
      href: "/editor/articles",
      blocks: [
        {
          kind: "flow",
          steps: ["Yazıyı aç", "İnceleyen editör kartı", "Editörü seç", "Bu editöre gönder", "Editöre bildirim gider"],
          loop: "Geri almak için Kategori editörüne geri ver.",
          caption: "Bir yazının kategori aşamasını başka bir editöre devretmek.",
        },
        {
          kind: "list",
          items: [
            "Yalnızca taslak, incelemede ya da revizyondaki yazılar gönderilebilir; kategori aşamasını geçmiş yazı gönderilemez.",
            "Gönderilen editör yazının kategori aşamasını tek başına yürütür; alanın kendi editörü yazıyı görmez.",
            "Listede askıda olmayan, doğrulanmış editörler yer alır; yazının yazarı seçilemez.",
          ],
        },
      ],
    },
    ARTICLE_EDIT_SECTION,
    JOURNEY_SECTION,
    {
      id: "konu-onerileri",
      title: "Konu önerileri",
      href: "/editor/topics",
      blocks: [
        {
          kind: "p",
          text: "Yazarların sayılar için gönderdiği konular. Üstten **Sayı** ve **Durum** seçip **Süz**e basın; aktif sayı \"(aktif sayı)\" ile işaretlidir. Her kartta konu, yazar, açıklama, son not ve geçmiş yer alır.",
        },
        {
          kind: "compare",
          items: [
            { title: "Kabul et", tone: "ok", points: ["Yazar yazmaya başlar", "Not isteğe bağlı"] },
            { title: "Değişiklik iste", tone: "neutral", points: ["Not zorunlu", "Yazar düzeltip yeniden gönderir"] },
            { title: "Reddet", tone: "warn", points: ["Not zorunlu", "Konu bu sayı için kapanır"] },
          ],
        },
        {
          kind: "steps",
          items: [
            "Değerlendirme bekleyen bir öneride **Karar** alanından seçiminizi yapın.",
            "**Yazara not** yazın (en çok 2000 karakter); yazar bu notu görür.",
            "**Kararı kaydet**e basın. Karar yazara panel bildirimi ve e-postayla gider.",
          ],
        },
        {
          kind: "note",
          text: "Kendi önerinize karar veremezsiniz. Reddedilen bir konuyu yeniden açmak yönetimin işidir. Öneri bu sırada başka bir sekmede güncellendiyse sayfayı yenilemeniz istenir.",
        },
      ],
    },
    {
      id: "gecici-alan",
      title: "Geçici alan",
      href: "/editor/gecici-alan",
      blocks: [
        {
          kind: "p",
          text: "Bir yazara, kendi alanı olmayan bir alanı yalnızca bir sayı için verir; yazar o sayıda bu alanda konu önerebilir ve yazı yazabilir. Geçici alan alanın kontenjanından sayılmaz.",
        },
        {
          kind: "flow",
          steps: ["Sayıyı seç", "Yazar + alan", "Geçici alanı ver ve e-posta gönder", "Yazar o sayıda bu alanda yazar"],
          caption: "Geçici alan yalnızca seçilen sayı için geçerlidir.",
        },
        {
          kind: "list",
          items: [
            "Yalnızca yayımlanmamış (planlanan ya da hazırlanan) sayılar için ve aktif yazarlara verilir.",
            "Yazarın kendi alanı ya da o sayı için zaten verilmiş bir alan yeniden verilemez.",
            "**Geri al** geçici alanı kaldırır; o alanda açılmış konu ve yazılar yerinde kalır.",
          ],
        },
      ],
    },
    {
      id: "e-posta-kuyrugu",
      title: "E-posta kuyruğu",
      href: "/editor/mail",
      blocks: [
        {
          kind: "flow",
          steps: ["E-posta kuyruğa yazılır", "Gönderilir", "Başarısızsa 6 kez yeniden denenir", "İçerik silinir, kayıt 30 gün"],
          caption: "Sistemin her e-postası bu yoldan geçer.",
        },
        {
          kind: "list",
          items: [
            "Üstteki sayaçlar bekleyen, gönderilen ve başarısız iletileri gösterir.",
            "**Kuyruğu şimdi işle** bekleyen iletileri hemen gönderir ve kaç tanesinin gittiğini yazar.",
            "**Önizle** iletinin alıcının göreceği hâlini açar. Giriş, doğrulama ya da şifre bağlantısı taşıyan iletilerin içeriği güvenlik için gösterilmez.",
            "Başarısız satırda **Yeniden dene** düğmesiyle gönderimi tekrar başlatın.",
          ],
        },
      ],
    },
    {
      id: "ekip",
      title: "Ekip iletişimi",
      href: "/editor/team",
      blocks: [
        {
          kind: "p",
          text: "Yazarlara ve ekibe telefonla ya da WhatsApp'tan ulaşmak için. Numaraları yalnızca ana editör ve yöneticiler görür; başkalarıyla paylaşmayın. **Ara** alanına ad ya da mahlas yazın; kişinin kartında telefona tıklayarak arayabilir ya da **WhatsApp'tan yaz** ile mesaj başlatabilirsiniz. Bağlantılar kendi cihazınızda açılır; sistem bir şey göndermez.",
        },
      ],
    },
    MEDIA_SECTION,
  ],
};
