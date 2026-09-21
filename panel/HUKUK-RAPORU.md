# postscript — Hukuki Uyum ve Sözleşme Yol Haritası

**Tarih:** 22 Eylül 2026 · **Araştırma tarihi:** 22 Eylül 2026
**Kapsam:** `postscriptmag.com` üzerinde canlı olan ürün (`panel/`), depodaki hukuki
metinler (`panel/data/`, `panel/contracts/`, `doc/`), `panel/DECISIONS.md` (D-001…D-220)
**Yöntem:** Ürün tanımı beyanlardan değil koddan ve canlı sayfalardan okundu. Hukuki
dayanaklar erişilebilen resmî kaynaklardan doğrulandı; erişilemeyenler işaretlendi.

> Bu rapor hukuki mütalaa değildir. Bir yazılım/uyum analizidir: hangi belgenin ve
> hangi ürün değişikliğinin gerektiğini, neden gerektiğini ve hangi sırayla
> yapılacağını gösterir. Avukat incelemesi gereken noktalar tek tek işaretlendi.

## Okuma anahtarı

| Etiket | Anlamı |
|---|---|
| **[D]** | Doğrulandı — kod, canlı sayfa veya resmî kaynak bu oturumda okundu |
| **[V]** | Varsayım — makul ama doğrulanmadı; yanlışsa sonucu değiştirir |
| **[S]** | Açık soru — cevabı bilinmiyor, plana etkisi belirtildi |
| **Z** | Yasal zorunluluk |
| **İ** | Yaygın iyi uygulama (zorunlu değil) |
| **Ö** | Bu raporun kendi önerisi |

---

# Yönetici özeti

postscript, iki kişinin adi ortaklık olarak yürüttüğü, ücretsiz, reklamsız, kâr amacı
gütmeyen bir e-dergidir ve **6 Eylül 2026'dan beri canlıdır** [D]. 41 hesap, 2 yönetici,
6 editör, 29 yazar, 4 çizer [D]. Ödeme, abonelik, reklam, ölçümleme ve yapay zekâ
**yoktur** — bu, uyum yükünün büyük bir kısmını (e-ticaret, tüketici, mesafeli satış,
ödeme, iade, İYS, AI Act) baştan kapsam dışına çıkarır.

Kalan yük üç kümede toplanıyor ve **üçünün de ağırlığı kodda değil, kâğıtta ve panel
ayarında**:

1. **Canlı aydınlatma metni üründen altı ay değil, yedi özellik geride.** Canlı metin
   hâlâ 1. sürüm (6 Eylül 2026): beş başlıklı, aktarım bilgisi yok, hukuki sebep yok,
   veri sorumlusu "postscript e-dergi" olarak geçiyor [D — 22 Eylül 2026'da
   `postscriptmag.com/kvkk` okundu]. Bu arada canlıya Spotify çaları, Cloudflare
   Turnstile, iletişim formu, özel mesajlar, anonim kutu, topluluklar ve ekip avatarı
   girdi. Depoda bunların tamamını anlatan tam metin **hazır** ama hiç yayınlanmadı;
   tek engel bir adres alanı. Bu, KVKK m. 10 ihlali olmanın ötesinde, kendi
   `CLAUDE.md`'sinin "metin koddan geri kalırsa yanlış beyan olur" kuralının ihlali.
2. **Yurt dışına aktarımın hukuki mekanizması hiç kurulmamış.** Bütün veri Vercel, Neon,
   Cloudflare, Resend ve (okur tıklarsa) Spotify üzerinden yurt dışında işleniyor [D].
   Türkiye henüz hiçbir ülke için yeterlilik kararı vermedi [D], dolayısıyla tek yol
   uygun güvence — pratikte **standart sözleşme** ve imzadan sonra **5 iş günü içinde
   Kuruma bildirim** [D, kvkk.gov.tr]. Depodaki metin bunu yapılmış gibi yazıyor;
   yapılmadı. Yayınlanmadan önce ya yapılmalı ya da cümle değişmeli.
3. **Ekip tarafında imzalı hiçbir şey yok — yazarlar hariç.** Yazar sözleşmesi ve eser
   bazlı ruhsat mimarisi gerçekten iyi kurulmuş (FSEK m. 48/3, 50, 52, 56'ya bilinçli
   yazılmış, hash + zaman + IP delili tutuluyor) [D]. Ama **6 editörün gizlilik ve veri
   işleme taahhüdü yok**, **4 çizerin eser ruhsatı yok**, **iki ortağın arasında yazılı
   ortaklık sözleşmesi yok** — oysa yazar sözleşmesi "ortaklardan her biri tek başına
   temsile yetkilidir" diye beyan ediyor [D]. Üstüne, veritabanı tablosu (tek dokümanlı
   `agreement_versions`) ikinci bir sözleşme türünü **taşıyamıyor**; migration gerekir [D].

Kodun hukuki olgunluğu beklenenin üstünde: 5651 m. 9 kaldırma usulü ve 24 saat taahhüdü
yayında, her yorum/mesaj için trafik kaydı tutuluyor, `audit_log` yalnızca eklenir
(trigger ile korunuyor), editör ve yönetici için 2FA zorunlu, public API hiçbir zaman
e-posta/gerçek ad/doğum tarihi döndürmüyor, çerez sayısı iki ve ikisi de zorunlu. Sorun
"yapılmadı" değil, **"yapıldı ama beyan edilmedi / imzalanmadı / açılmadı"**.

## En kritik 5 aksiyon

| # | Aksiyon | Neden bu sırada | Sorumlu | Süre |
|---|---|---|---|---|
| 1 | **Tebligat/başvuru adresi kararını ver (açık adres, KEP veya ikisi) ve KVKK metninin tam sürümünü panelden yayınla.** | Tek bir eksik alan, hazır bir metnin yayınını ve dolayısıyla 7 özelliğin aydınlatmasını bloke ediyor. En yüksek fayda/maliyet oranı burada. | Kurucu | 1 gün karar + 30 dk yayın |
| 2 | **Yurt dışı aktarım için standart sözleşme / uygun güvence sürecini başlat** (Vercel, Neon, Cloudflare, Resend; Spotify ayrı değerlendirilecek). | Metin (1) yayınlanınca "standart sözleşme esas alınmaktadır" cümlesi canlıya çıkar. O cümle doğru değilse ihlal, aydınlatma eksikliğinden daha ağır. | Kurucu + avukat | 2–4 hafta |
| 3 | **Vercel'de `CRON_SECRET` tanımlı mı doğrula.** Tanımlı değilse günlük iş hiç çalışmıyor: silme talepleri 30 günde işlenmiyor, 1 yıllık budama yapılmıyor, zamanlanmış yazı yayınlanmıyor. | Kâğıt işi değil: KVKK m. 7 silme yükümlülüğü ve metindeki saklama sürelerinin tamamı bu tek ortam değişkenine bağlı. | Kurucu | 15 dk |
| 4 | **Editör gizlilik + veri işleme taahhüdü ve çizer sözleşmesi/eser onayını hazırla** (önce `agreement_versions.kind` migration'ı). | 6 editör yayınlanmamış eserleri ve okur verisini görüyor, 4 çizerin çizimleri yayında — ikisi de dayanaksız. | Kurucu + avukat + geliştirme | 1–2 hafta |
| 5 | **Kayıt formuna yaş alt sınırı koy ve reşit olmayan üyelerin topluluk yetkisini netleştir.** | Bugün 10 yaşındaki biri kayıt olup herkese açık gönderi paylaşabilir; yalnızca özel mesaj ve anonim kutu 18+ [D]. Hem KVKK hem 5651 hem itibar riski. | Kurucu kararı + geliştirme | 1 gün karar + 1 gün kod |

---

# 1. Ürün ve hukuki kapsam

## 1.1. İş modeli ve taraflar arasındaki ilişki

| Unsur | Fiilî durum | Kaynak |
|---|---|---|
| Ürün | Ayda iki sayı çıkan, yalnızca web üzerinden yayınlanan e-dergi + kayıtlı okuyucu topluluğu | `CLAUDE.md`, `panel/README.md` [D] |
| Gelir modeli | **Yok.** Ödeme, abonelik, ödeme duvarı, reklam, sponsorluk, bağış toplama ve ölçümleme kodda hiç yok; ödeme kütüphanesi bile kurulu değil | `TEKNOLOJI-RAPORU.md` §4, `package.json` [D] |
| Hukuki yapı | "Postscript Dergisi adı altında faaliyet gösteren adi ortaklık" — ortaklar Elif Yaren Çekiç ve Tuanna Demir | `data/kvkk-aydinlatma-metni.md` §1, canlı `/kunye` [D] |
| Yazılı ortaklık sözleşmesi | **Yok** (depoda hiçbir izi yok) | `grep` [D] |
| Kullanıcı sayısı | 41 hesap: 2 admin, 6 editör, 29 yazar, 4 rolsüz; 4 hesapta çizer işareti | `TEKNOLOJI-RAPORU.md` §7 (20 Eylül 2026) [D] |
| Erişim modeli | Dergiyi okumak **üyelik ister** (`/magazine` oturum ister); künye, kullanım şartları ve KVKK herkese açık | `panel/README.md`, kod [D] |
| Yazı akışı | Yazar site üzerinden yazı **göndermez**; editör makaleyi oluşturur, yazar eser bazlı ruhsat onayı verir | `CLAUDE.md`, `src/services/rights.ts` [D] |
| Bedel | Yazara telif ödenmez; ruhsat bedelsiz, ticari kullanım hariç | `contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` m. 4.5, 4.6, 8.1 [D] |

**Taraflar ve her birinin hukuki niteliği:**

| Taraf | İlişkinin niteliği | Dayanak belge | Durum |
|---|---|---|---|
| Ortaklar (2) ↔ birbiri | Adi ortaklık (TBK m. 620 vd.); tüzel kişilik yok, ortaklar kişisel malvarlığıyla sorumlu | — | **Belge yok** |
| Dergi ↔ Yazar (29) | Eser sahibiyle basit ruhsat ilişkisi; mali haklar yazarda (FSEK m. 56/1) | `contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` + eser bazlı Eser Onayı | **Var, işliyor, imzalar kayıtlı** |
| Dergi ↔ Editör (6) | Gönüllü editoryal görev; yayınlanmamış eserlere, okur verisine ve moderasyon yetkisine erişim | — | **Belge yok** |
| Dergi ↔ Çizer (4) | Çizimler FSEK eseri; yayın için ruhsat gerekir | — | **Belge yok** |
| Dergi ↔ Okuyucu (kayıtlı) | Ücretsiz üyelik sözleşmesi + topluluk kuralları | `/kullanim-sartlari` | **Var** |
| Dergi ↔ Okuyucu (veri) | Veri sorumlusu – ilgili kişi | `/kvkk` (canlı sürüm eksik) | **Var ama eski** |
| Dergi ↔ Tedarikçiler (5) | Veri işleyen / hizmet sağlayıcı, tamamı yurt dışı | Sağlayıcıların standart şartları | **Ayrı sözleşme yok** |
| Dergi ↔ Tasarımcı | Tasarım dosyaları (`postscriptui/`, 461 MB `.ai`) ve avatar çizimleri | — | **Belge yok** |

**Çift sıfat — 5651 açısından kritik olan nokta:** Dergi yayımlanan yazılar bakımından
**içerik sağlayıcı**, okur yorumları / topluluk gönderileri / sohbet / özel mesajlar /
anonim kutu bakımından **yer sağlayıcı** konumunda. Bu ayrım künyede zaten doğru
kurulmuş [D].

## 1.2. Hangi ülkelerin mevzuatı neden gündemde

### Türkiye — birincil ve fiilî olarak tek uygulanacak hukuk

Ortaklar Türkiye'de, dil Türkçe, hedef kitle Türkiye, yetkili hukuk Türk hukuku olarak
seçilmiş. Gündemdeki mevzuat:

| Mevzuat | Neden gündemde | Uygulanma kesinliği |
|---|---|---|
| **6698 KVKK** | 45 tablolu bir veritabanında kimlik, iletişim, IP, içerik, trafik verisi işleniyor | **Kesin** |
| **5651** | Hem kendi yazılarını yayımlıyor (içerik sağlayıcı) hem kullanıcı içeriği barındırıyor (yer sağlayıcı) | **Kesin** |
| **5846 FSEK** | Yazı, çizim, tasarım, kapak/afiş görselleri, yazı tipi | **Kesin** |
| **6098 TBK** | Adi ortaklık, üyelik sözleşmesi, ruhsat sözleşmesi, zamanaşımı (m. 146 → 10 yıl saklama) | **Kesin** |
| **5187 Basın Kanunu** (7418 ile) | "İnternet haber sitesi" sayılıp sayılmadığı belirsiz; sayılırsa beyanname, sorumlu müdür, genişletilmiş künye, 2 yıl içerik saklama | **Belirsiz — [S] avukat sorusu #1** |
| **6563 ETK / İYS** | Bugün gündemde **değil** (ticari elektronik ileti gönderilmiyor); yazar sözleşmesinde geçen "e-bülten" hayata geçerse gündeme gelir | Koşullu |
| **6502 Tüketici** | Bedelsiz ve ticari amaç taşımayan bir hizmette tüketici işlemi bulunmadığı görüşü savunulabilir | **[S] avukat sorusu #6** |
| **6769 SMK (marka)** | "Postscript" adı ve logo tescilsiz | Koşullu — tescil bir tercih |
| **5253 Dernekler / 4721 Vakıflar** | Bugün uygulanmıyor (adi ortaklık); yapı değişirse gündeme gelir | Koşullu |

### Avrupa Birliği — dolaylı, iki başlık

- **Veri yerleşimi:** Uygulama Vercel `fra1` (Frankfurt), veritabanı Neon AWS
  `eu-central-1` (Frankfurt), nesne depolama Cloudflare R2 **EU jurisdiction** [D].
  Yani veri fiilen AB'de duruyor. Bu, GDPR'ı derginin üzerine **kendiliğinden
  yüklemez**: GDPR m. 3 yer bakımından uygulama ya AB'de bir yerleşim ya da AB'deki
  ilgili kişilere **yönelme** ister; işleyicinin sunucusunun AB'de olması tek başına
  veri sorumlusunu kapsama almaz (EDPB Guidelines 3/2018 çerçevesi) [D — kılavuz
  bulundu, ilgili paragraf bu oturumda metin olarak açılamadı]. **[S] avukat sorusu #7.**
- **Yönelme:** Site Türkçe, ödeme yok, AB'ye özel bir sunum yok. AB'de yaşayan
  Türkçe konuşan okur bulunması tek başına "yönelme" sayılmaz [V]. Bu doğruysa GDPR,
  DSA ve Avrupa Erişilebilirlik Yasası kapsam dışıdır. **AB'ye özel bir hedefleme
  (AB'de tanıtım, çoklu dil, AB'de etkinlik) yapılırsa bu değerlendirme değişir.**

### ABD — yalnızca tedarikçi ilişkisi

Vercel Inc., Neon Inc., Cloudflare Inc., Resend Inc. ABD merkezli [D]. Bu, ABD
mevzuatını dergiye uygulamaz; sonucu şudur: **her biri yurt dışına aktarım demektir ve
KVKK m. 9 rejimine tabidir.** ABD tüketici gizlilik kanunları (CCPA vb.) derginin
faaliyetine uygulanmaz [V]; dergi ABD'de mal/hizmet satmıyor ve ABD sakinlerini
hedeflemiyor.

## 1.3. Kesin değerlendirme için eksik olan bilgiler

| # | Eksik bilgi | Sonuca etkisi |
|---|---|---|
| E1 | Tebligata ve yazılı başvuruya esas **adres veya KEP adresi** | KVKK metninin yayınını, künyeyi ve 5651/5187 künye uyumunu bloke ediyor. En kritik eksik. |
| E2 | Derginin **"internet haber sitesi"** sayılıp sayılmadığı | Sayılırsa: beyanname + sorumlu müdür + telefon/e-tebligat/yer sağlayıcı adresi içeren künye + 2 yıl içerik saklama + her içerikte ilk yayın ve güncelleme tarihi. Plana 4–6 kalem ekler. |
| E3 | Vercel'de **`CRON_SECRET`** tanımlı mı | Tanımlı değilse silme/budama/zamanlanmış yayın **hiç çalışmıyor**; metindeki her saklama süresi yanlış beyan olur. |
| E4 | Tedarikçilerle hâlihazırda kurulmuş veri işleme ilişkisinin **hangi belgeye dayandığı** (sağlayıcının DPA'sı kabul edilmiş mi) | Standart sözleşme sürecinin kapsamını ve süresini belirler. |
| E5 | **Yıllık çalışan sayısı ve mali bilanço** (VERBİS istisnası için) | Ortaklık çalışan istihdam etmiyor ve gelir yok görünüyor [V]; doğruysa VERBİS kaydı gerekmez. |
| E6 | Ortaklar arası **kâr/zarar, temsil, fesih** mutabakatı | Ortaklık sözleşmesinin içeriğini belirler; yazar sözleşmesindeki "tek başına temsile yetkili" beyanının dayanağı. |
| E7 | Tasarımcının statüsü (ortak mı, gönüllü mü, ücretli mi) ve tasarım görsellerinin **gerçek kaynağı** | Fikri hak devri belgesinin türünü ve afiş/kapak görselleri riskinin çözümünü belirler. |
| E8 | Derginin **sosyal medya hesaplarında** hangi içeriğin paylaşıldığı | Yazar sözleşmesi sosyal medyayı mecra olarak kapsıyor; ekip avatarı yayımı için açık rıza gerekiyor. |

---

# 2. Yasal yükümlülükler ve riskler

## 2.1. Şirketleşme ve sorumluluk

**Fiilî durum [D]:** Adi ortaklık. Tüzel kişiliği yoktur; hak ve borçların sahibi
ortakların kendisidir. Bir okuyucunun açacağı tazminat davası, bir hak sahibinin telif
talebi ya da bir KVKK idari para cezası **doğrudan iki gerçek kişinin malvarlığına**
yönelir. Ortaklar birlikte sorumludur.

| Konu | Değerlendirme |
|---|---|
| Kuruluş formalitesi | Adi ortaklık yazılı şekle tabi değil; **Z** bir tescil yükümlülüğü yok. Ancak yazılı sözleşme yapılmaması, temsil yetkisi ve fesih konularını ispatsız bırakıyor (**Ö**). |
| Vergi | Gelir yoksa beyan doğuracak bir kazanç da yok [V]. Bağış, sponsorluk, reklam veya satış girerse durum tamamen değişir: adi ortaklığın vergi kaydı, ortakların gelir vergisi beyanı ve muhtemelen KDV gündeme gelir. **Gelir modeline geçilmeden önce mali müşavir.** |
| "Kâr amacı gütmeyen" ifadesi | Türk hukukunda adi ortaklık için **hukuki bir statü değil**, fiilî bir beyandır. Vergi veya sorumluluk avantajı sağlamaz. Dernek (5253) veya vakıf kurulursa tüzel kişilik + sınırlı sorumluluk + bağış toplama ehliyeti gelir, karşılığında genel kurul/defter/denetim yükü doğar. **Kurucu kararı K1.** |
| Sigorta | Yayıncılık mesleki sorumluluk sigortası Türkiye'de yaygın değil ama mevcut (**Ö**, düşük öncelik). |

## 2.2. Tüketici hakları, e-ticaret, abonelik, ödeme, iptal ve iade

Bu başlığın büyük kısmı **gündeme gelmiyor** ve bunun neden böyle olduğunu kayda geçmek,
sonradan "eksik" sanılmasını önler:

| Konu | Uygulanıyor mu | Gerekçe |
|---|---|---|
| Mesafeli Sözleşmeler Yönetmeliği, ön bilgilendirme formu, 14 gün cayma | **Hayır** | Mal veya hizmet satışı yok; bedel yok. Cayma hakkı bedelli sözleşmeye bağlı. |
| İptal / iade / ücret geri ödeme politikası | **Hayır** | Ödenen bir bedel yok. Yazılması yalnızca yanlış beklenti yaratır. |
| Abonelik şartları, otomatik yenileme, yenileme bildirimi | **Hayır** | Abonelik ve ödeme duvarı "Yapılmayacaklar" listesinde ve kodda yok [D]. |
| Ödeme hizmeti, PSP sözleşmesi, 6493 sayılı Kanun, PCI-DSS | **Hayır** | Ödeme akışı hiç yok; IBAN/fatura/vergi de "Yapılmayacaklar"da. |
| ETBİS kaydı (e-ticaret) | **Hayır** [V] | Elektronik ticaret faaliyeti yok; site bir yayın. Gelir modeli girerse yeniden bakılmalı. |
| 6502 kapsamında "tüketici" sıfatı | **Muhtemelen hayır** [S] | Sağlayıcının "ticari veya mesleki amaçla" hareket etmesi gerekir; kâr amacı gütmeyen, bedelsiz bir yayın bu tanıma zor girer. Kullanım şartları m. 11 şu an tüketici haklarını yine de saklı tutuyor — muhafazakâr ve zararsız. |
| **Üyelik sözleşmesinin niteliği** | **Evet** | Bedelsiz olsa da kullanım şartları bir sözleşmedir: kabul, değişiklik bildirimi, fesih ve hesap kapatma hükümleri gerekir. Hepsi mevcut [D]. |
| **Yetkili mahkeme kaydı** | **Sorunlu** [S] | Kullanım şartları m. 11 ve yazar sözleşmesi m. 15 belirli mahkemeyi yetkili kılıyor. HMK m. 17 yetki sözleşmesini yalnızca **tacirler ve kamu tüzel kişileri** arasında geçerli sayar. İki taraf da tacir değilse bu kayıtlar muhtemelen geçersiz. **Avukat sorusu #8.** |

## 2.3. Kişisel veriler

### 2.3.1. Aydınlatma yükümlülüğü (KVKK m. 10) — **en büyük açık risk**

Canlı metin 1. sürüm, 6 Eylül 2026, beş başlık, hash `e692432a…` [D — 22 Eylül 2026'da
okundu]. Depodaki 2. sürüm (249 satır, on başlık, amaç–hukuki sebep tablosu, saklama
tablosu, aktarım tablosu) **hiç yayınlanmadı** [D].

**Canlı metnin anlatmadığı, ama fiilen işlenen veriler ve akışlar:**

| Canlıda çalışıyor | Canlı metinde | İlk açıklanacağı yer |
|---|---|---|
| Spotify çaları (okur tıklayınca IP + tarayıcı bilgisi Spotify AB'ye) | Yok | §2, §3, §4, §5, §6.2 (depoda hazır) |
| Cloudflare Turnstile (kayıt ve doğrulama formunda IP + tarayıcı sinyalleri) | Yok | §2, §3, §4, §6.2 |
| İletişim formu (ad, e-posta, konu, mesaj → posta kutusu; IP sayaç) | Yok | §2, §3, §4, §7 |
| Özel mesajlar + okundu bilgisi tercihi | Yok | §2, §3, §7 |
| Anonim kutu (alıcıya karşı anonim, hesapla ilişkili saklanır) | Yok | §2, §3, §7 |
| Gönderi/beğeni/yeniden paylaşım/takip/engelleme/topluluk üyeliği | Yok | §2, §3, §7 |
| Ekip avatarı (seçimler + sunucuda üretilen PNG + görünen isim) | Yok | §2, §3, §7 |
| İçerik bildirimi kayıtları | Yok | §2, §3, §7 |
| Aktarım yapılan 5 sağlayıcı ve ülkeleri | Yok | §6.2 |
| Çerezler (`ps_session`, `ps_csrf`) | Yok | §5 |
| Saklama sürelerinin tamamı | Kısmen | §7 |

**Risk:** KVKK m. 10 + Aydınlatma Tebliği ihlali. Kurul'un bu alanda yerleşik kararları
var; örneğin çerez aydınlatma ve açık rıza metinlerinin sunulmaması nedeniyle verilen
23.12.2022 tarihli 2022/1358 sayılı karar [D]. Ayrıca metin, ürünün yaptığından **az**
anlattığı için aynı zamanda eksik/yanlış beyan riski taşıyor.

**Çözüm zaten hazır ve tek adımlık:** `[AÇIK ADRES]` doldurulup metin panelden
yayınlanacak. Bunun dışında kod değişikliği gerekmiyor.

### 2.3.2. Hukuki sebepler — depodaki metnin kalitesi

Depodaki §3 tablosu her amaca m. 5/2 dayanağı gösteriyor ve genel olarak isabetli [D].
İki nokta avukat gözü ister:

- **Spotify çaları → açık rıza (m. 5/1).** Rıza düğmeye basmakla veriliyor, öncesinde
  bilgi notu gösteriliyor, sayfa açılışında Spotify'a hiç istek gitmiyor [D]. Rıza
  mimarisi doğru kurulmuş. Ama **aktarım** tarafında sorun var (aşağıda 2.3.4).
- **Ekip avatarının yayımı → açık rıza.** Metin "yayımlama yalnızca ilgili ekip üyesinin
  onayıyla yapılır" diyor, ancak kodda bu onayı **kaydeden bir mekanizma yok** [D].
  Rıza sözle alınırsa ispatı yoktur. **Ürün görevi Ü7.**

### 2.3.3. Çerezler

| Çerez | Amaç | Rıza gerekir mi |
|---|---|---|
| `ps_session` | Oturum | **Hayır** — kullanıcının açıkça talep ettiği hizmet için kesinlikle gerekli |
| `ps_csrf` | Form sahteciliğine karşı | **Hayır** — aynı gerekçe |
| Spotify'ın kendi çerezleri (çalar açılırsa) | Üçüncü taraf | **Evet** — tıklamayla alınıyor [D] |

KVKK'nın Haziran 2022 tarihli Çerez Uygulamaları Hakkında Rehberi, rıza istisnasını iki
ölçütle sınırlıyor: iletişimin sağlanması veya kullanıcının açıkça talep ettiği hizmet
için kesin gereklilik [D]. İki çerez de ikinci ölçüte giriyor.

**Sonuç:** Çerez banner'ı **gerekmez** ve konmamalı (**Ö** — gereksiz banner, rıza
mimarisini yanlış anlatır). Ama **çerez aydınlatması gerekir** ve canlı metinde hiç
yok. Ayrı bir "Çerez Politikası" sayfası da gerekmez; aydınlatma metninin §5'i yeterli
(**Ö**, gerekçe: tek kaynak ilkesi, ikinci kopya kaçınılmaz olarak ayrışır).

### 2.3.4. Yurt dışına aktarım — **ikinci en büyük risk**

| Sağlayıcı | Hizmet | Verinin fiilî yeri | Aktarılan |
|---|---|---|---|
| Vercel Inc. (ABD) | Barındırma | Almanya (`fra1`) + küresel ağ noktaları | İşlem anındaki tüm veri |
| Neon Inc. (ABD) | Veritabanı | Almanya (AWS `eu-central-1`) | **Tüm veri** |
| Cloudflare, Inc. (ABD) | R2 depolama (AB jurisdiction) + Turnstile (küresel) | AB / küresel | Görseller, sözleşme PDF'leri; Turnstile'da IP + sinyaller |
| Resend, Inc. (ABD) | E-posta gönderimi | **Japonya** (AWS `ap-northeast-1`) | E-posta adresi, ad, mesaj içeriği |
| Spotify AB | Çalma listesi çaları | İsveç | Okur tıklarsa IP + tarayıcı bilgisi |

**Hukuki çerçeve [D]:** 7499 sayılı Kanun'la 1 Haziran 2024'te yürürlüğe giren yeni m. 9
üç kademeli: (1) yeterlilik kararı, (2) uygun güvence (standart sözleşme, bağlayıcı
şirket kuralları, taahhütname, uluslararası sözleşme), (3) istisnai hâller. Açık rıza
artık genel yol değil; yalnızca **arızi** (tek seferlik, süreklilik arz etmeyen)
aktarımlarda kullanılabiliyor ve geçiş dönemi 1 Eylül 2024'te kapandı [D]. Kurul
**henüz hiçbir ülke için yeterlilik kararı ilan etmedi** [D].

**Bunun postscript için anlamı:**

1. Beş sağlayıcının hiçbiri yeterlilik kararı kapsamında değil → **uygun güvence
   zorunlu**. Pratikte Kurul'un yayımladığı **standart sözleşme** imzalanır ve
   **imzaların tamamlanmasından itibaren 5 iş günü içinde** fiziksel olarak, KEP ile
   veya Kurum'un Standart Sözleşme Bildirim Modülü üzerinden Kuruma bildirilir [D].
   Bildirim yükümlülüğü aksi kararlaştırılmadıkça **aktaran tarafta**, yani dergide [D].
   Bildirim yükümlülüğüne uyulmamasının idari para cezası yaptırımı var [D].
2. **Spotify aktarımı sorunlu.** Her okur tıklaması yeni bir aktarım doğuruyor;
   tekrarlanan bir akış "arızi" sayılmaya zor uyar. Depodaki metin dayanağı açık rıza
   olarak gösteriyor. Bu, D-117'de zaten hukukçuya bırakılmış bir soru [D].
   **Muhafazakâr seçenek:** çalar kaldırılıp yerine `open.spotify.com`'a normal bir
   bağlantı konur; bağlantıya tıklayan kullanıcı kendi iradesiyle Spotify'a gider ve
   dergi hiçbir gömme yapmamış olur. **Avukat sorusu #3.**
3. **Ortak veri sorumluluğu** [S]: gömülü içerikte veri toplamaya aracılık eden site de
   sorumlu sayılabilir. D-117'de açık.

**Depodaki metnin §6.2'si bu mekanizmayı olmuş gibi anlatıyor** ("imzalanan ve Kuruma
bildirilen standart sözleşme esas alınarak"). Metin yayınlanmadan önce ya mekanizma
kurulmalı ya da cümle fiilî duruma çekilmeli. **İkisinden biri yapılmadan metin
yayınlanmamalı** — aksi hâlde aydınlatma eksikliği, yanlış beyana dönüşür.

### 2.3.5. Saklama, silme ve anonimleştirme

Kod tarafı iyi tasarlanmış [D]: `DAILY_TASKS` listesi silme talebini 30 günde
anonimleştiriyor, doğrulanmamış hesapları 7 günde temizliyor, trafik kayıtlarını /
gönderileri / mesajları / bildirimleri 1 yılda buduyor, giriş denemelerini 30 günde
siliyor. `audit_log` ve `role_changes` yalnızca eklenir; hem uygulama hem veritabanı
trigger'ı koruyor.

**Ama:** tüm bu işler `GET /api/cron/daily` uca bağlı ve uç, `CRON_SECRET` Vercel'de
tanımlı değilse **her isteği 401 ile reddediyor** [D — kod]. Oturum belleğine göre bu
değişken Vercel'de tanımlı değildi [17 Eylül 2026 kaydı]; dışarıdan doğrulanamıyor
(değişken olsun olmasın yetkisiz istek 401 döner). **Doğrulanması gereken en acil
operasyonel kalem (E3).** Tanımlı değilse:

- KVKK m. 7 kapsamındaki silme talepleri **işlenmiyor**,
- metinde yazan bütün saklama süreleri **fiilen sınırsız**,
- zamanlanmış makaleler yayınlanmıyor.

**Bir tasarım tercihi, bilinçli ve doğru:** Silme talebinde imzalı eser onayları,
sözleşme kayıtları ve kanunen zorunlu trafik kayıtları saklanmaya devam ediyor
(dayanak: KVKK m. 7 + TBK m. 146 + 5651 m. 5). Bu, "her şeyi sil" beklentisini
karşılamaz ama hukuken doğrudur ve metinde açıkça yazıyor [D].

**Trafik kaydı süresi:** Kod 1 yıl tutuyor. Yönetmelik yer sağlayıcı için **en az 1, en
fazla 2 yıl** öngörüyor [D, ikincil kaynak]. 1 yıl alt sınırda; **5187 kapsamına
girilirse içerik kayıtları için 2 yıl gündeme gelir** ve `article_versions`'ın
silinmemesi kuralı (CLAUDE.md) bu yüzden zaten korunuyor [D].

### 2.3.6. VERBİS

Kurul'un 2023/1154 sayılı kararıyla istisna eşiği güncellendi: yıllık çalışan sayısı
**50'den az** ve yıllık mali bilanço toplamı **100 milyon TL'den az** olan, ana faaliyeti
özel nitelikli veri işlemek olmayan veri sorumluları VERBİS kaydından muaf [D].

**Değerlendirme:** postscript her üç ölçütü de rahatça karşılıyor görünüyor [V, E5'e
bağlı] → **VERBİS kaydı gerekmez.** Muafiyet yalnızca sicile kayıttan muafiyettir;
aydınlatma, güvenlik, saklama ve aktarım yükümlülükleri aynen sürer.

### 2.3.7. Pazarlama izinleri

Bugün **hiç pazarlama iletisi gönderilmiyor**; metin de "pazarlama, reklam veya
profilleme amacıyla kişisel veri işlemiyoruz" diyor ve bu doğru [D]. Yazar
sözleşmesinde mecra olarak sayılan **"e-bülten" henüz yok**. Yapılırsa:

- İçerik tamamen editoryal ve ticari amaç taşımıyorsa 6563 kapsamına girmeyebilir [S];
- ama "işletme tanıtımı" niteliği taşıyan her kalem onay + İYS rejimini gündeme getirir [D].
- **Muhafazakâr yol (Ö):** e-bülten kurulacaksa baştan ayrı, opt-in, kaydı tutulan bir
  izinle kurulur ve "ret hakkı" her iletide yer alır. Var olan hesap bildirimleri
  (doğrulama, şifre sıfırlama, duyuru) ticari ileti değildir.

### 2.3.8. Çocukların verileri ve reşit olmayan üyeler — **sessiz ama gerçek risk**

**Fiilî durum [D]:**

- Kayıt formunda doğum tarihi isteniyor ama **alt yaş sınırı yok**; 18 yaş kontrolü
  yalnızca yazar terfisinde (`MINIMUM_WRITER_AGE = 18`), özel mesajlarda ve anonim
  kutuda uygulanıyor (`isAdult` yalnızca `anon-box.ts` ve özel mesaj akışında).
- Yani reşit olmayan bir üye: hesap açabiliyor, kullanıcı adı seçebiliyor, **herkese
  açık gönderi ve yorum paylaşabiliyor**, takip edebiliyor ve edilebiliyor, profil ve
  kapak fotoğrafı yükleyebiliyor.
- Kullanım şartları m. 2: "On sekiz yaşını doldurmamış kişiler okuyucu olabilir, ancak
  yazar olamaz" — yani bu bilinçli bir tercih.

**Hukuki durum [D]:** Türk hukukunda çocuğun açık rızası için kanunda veya Kurul
kararında **belirli bir yaş eşiği yok**; ayırt etme gücüne sahip küçüğün, veli/vasi izni
şartıyla rıza verebileceği kabul ediliyor. GDPR'ın 16 yaş çizgisinin karşılığı Türk
hukukunda bulunmuyor. Buna ek olarak üyelik bir sözleşme olduğu için TMK'daki ehliyet
kuralları gündeme gelir.

**Riskler:** (a) veli izni olmadan küçükle sözleşme kurulması, (b) küçüğün herkese açık
ortamda kişisel veri paylaşması, (c) küçüğe yönelik taciz/zorbalık hâlinde yer
sağlayıcı sorumluluğunun ağırlaşması, (d) itibar.

**Önerilen (Ö, muhafazakâr):** Kayıtta bir alt yaş sınırı belirlenip sunucu tarafında
uygulanmalı; 18 altı üyeler için topluluk yetkileri (gönderi paylaşma, profil fotoğrafı,
takip edilme) ayrıca kararlaştırılmalı. **Kurucu kararı K4 + avukat sorusu #5.**

## 2.4. İçerik mevzuatı

### 2.4.1. 5651 — durum genel olarak iyi

| Yükümlülük | Durum |
|---|---|
| Tanıtıcı bilgiler, ana sayfadan doğrudan erişilebilir (m. 3) | **Kısmen** — `/kunye` var, footer'dan her sayfada bağlı [D]; ama adres "Konak, İzmir" (ilçe, adres değil), telefon ve elektronik tebligat adresi yok |
| Kaldırma başvurusu usulü ve 24 saat cevap (m. 9, 9/A) | **Var ve iyi yazılmış** — künyede başvuru içeriği, süre taahhüdü, ret hâlinde gerekçe ve sulh ceza hâkimliği yolu [D] |
| Yer sağlayıcı olarak trafik bilgisi saklama (m. 5) | **Var** — her yorum/mesaj/gönderi/özel mesaj/anonim mesaj için `traffic_logs`, 1 yıl [D] |
| Bildirilen içeriğin kaldırılması | **Var** — yumuşak silme + `content_reports` kuyruğu, 24 saati geçen bildirimler işaretleniyor [D] |
| **BTK'ya yer sağlayıcı bildirimi** | **Yapılmamış görünüyor [V]** — faaliyet belgesi zorunluluğu kalktı, yerine e-Devlet üzerinden **bildirim** geldi; bildirimde bulunulmaması idari para cezasına bağlanmış [D, ikincil kaynak]. Kâr amacı gütmeyen bir sitenin bu bildirimle yükümlü olup olmadığı **[S] avukat sorusu #2** |
| İçerik sağlayıcı sıfatıyla sorumluluk | Yayımlanan yazıların içeriğinden dergi sorumlu; yazar sözleşmesi m. 3 ve m. 3.6 rücu zeminini kuruyor [D] |

**Not — künye "ticari veya ekonomik amaçlı" kaydı:** D-154'te Yönetmelik m. 5 okunmuş ve
tanıtıcı bilgi yükümlülüğünün "ticari veya ekonomik amaçlı" sağlayıcılara yönelik olduğu
tespit edilmiş; postscript kapsam dışı **olabilir** [D, DECISIONS kaydı]. Bu bir muafiyet
gerekçesi olarak kullanılmadan avukata doğrulatılmalı; künye zaten yayında olduğu için
muhafazakâr durum korunuyor.

### 2.4.2. 5187 Basın Kanunu — planın en büyük bilinmeyeni

7418 sayılı Kanun (13.10.2022) internet haber sitelerini Basın Kanunu kapsamına aldı.
"İnternet haber sitesi", internet ortamında belirli aralıklarla **haber veya yorum
niteliğinde** içerik sunmak üzere kurulan ve işletilen süreli yayın olarak tanımlanıyor
[D, ikincil kaynak].

**Neden gerçek bir soru:** postscript ayda iki sayı çıkaran, kültür-sanat yorumu
yayımlayan bir süreli yayın. "Haber" değil ama "yorum" tanımın içinde. Kapsama girerse
gelen yükümlülükler [D, ikincil kaynak]:

| Yükümlülük | Bugünkü durum |
|---|---|
| Cumhuriyet Başsavcılığına **beyanname** | Yok |
| **Sorumlu müdür** | Yok (editör kadrosu var, sorumlu müdür ataması yok) |
| Künyede: işyeri adresi, ticari unvan, e-posta, **iletişim telefonu**, **elektronik tebligat adresi**, **yer sağlayıcının adı ve adresi** | Kısmen — adres eksik, telefon ve e-tebligat yok; yer sağlayıcı bilgisi "Barındırma" paragrafında var |
| İçerikte **ilk yayın tarihi ve sonraki güncelleme tarihleri**, her erişimde değişmeyecek şekilde | **Eksik** — makale sayfası yalnızca `publishedAt` gösteriyor [D] |
| İçerik kayıtlarını **2 yıl** saklama | `article_versions` hiç silinmiyor (CLAUDE.md kuralı) → fiilen karşılanıyor [D] |
| Düzeltme ve cevap hakkı yayımı | Künyede usul var, ama "cevap hakkı" yayın mekanizması yok |

**Avukat sorusu #1 ve planın en çok değişeceği nokta.** Cevap "evet" ise dört yeni kalem
(beyanname, sorumlu müdür, künye alanları, içerik tarihleri) eklenir. Cevap gelene kadar
muhafazakâr davranıp `article_versions` silinmemeye devam edecek ve içerik tarihleri
eklenecek (zaten ucuz bir ürün işi ve her hâlde iyi uygulama).

## 2.5. Fikri mülkiyet, marka, yazılım lisansları

### 2.5.1. Yazarlarla ilişki — en güçlü taraf

`contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` FSEK'e bilinçli yazılmış [D]:

- İleride vücuda getirilecek eserler için **ruhsat taahhüdü** (m. 50), her eser için
  ruhsat ancak eser yaratıldıktan sonra Eser Onayı ile doğuyor (m. 48/3 uyumu);
- **Basit ruhsat** (m. 56/1), mali haklar yazarda; devir yok;
- Mali haklar **ayrı ayrı** sayılmış (m. 52 şekil şartı), işleme yetkisi üç kaleme
  sınırlanmış; temsil hakkı verilmemiş;
- Ad belirtme (m. 15) ve eserde değişiklik yasağı (m. 16) ayrı maddelerde;
- Fesihte FSEK 50 uyarınca bir yıllık süre, 50/3 hâlleri ayrıca düzenlenmiş;
- Onay anında metnin **SHA-256 özeti**, zaman, IP ve tarayıcı bilgisi kaydediliyor;
  sunucu onay anında metni yeniden render edip hash'i karşılaştırıyor, uyuşmazsa 409
  veriyor [D]. İspat zinciri gerçekten kurulu.

**Üç düzeltme gerekiyor:**

| # | Bulgu | Etki |
|---|---|---|
| IP1 | Sözleşme **PDF Sayı** mecrasını (m. 4.2, 4.3, 9.3) ve **e-bülten**i kapsıyor; ikisi de yok ve PDF sayı "Yapılmayacaklar" listesinde [D] | Hukuken zararsız (verilmiş ama kullanılmayan yetki), ama metin ürünü yanlış anlatıyor. Ya kaldırılır ya "ileride kurulursa" kaydıyla korunur. |
| IP2 | m. 15 yetkili mahkeme kaydı, taraflar tacir değilse HMK m. 17 nedeniyle muhtemelen geçersiz [S] | Uyuşmazlıkta beklenmeyen yerde dava. Avukat sorusu #8. |
| IP3 | Tarafın "adi ortaklık adına ortaklar… her biri tek başına temsile yetkilidir" beyanının **yazılı dayanağı yok** [D] | Ortaklık sözleşmesi yapılmalı; aksi hâlde tek ortağın imzasıyla kurulan sözleşmenin diğer ortağı bağlayıp bağlamadığı tartışılır. |

### 2.5.2. Çizerler — **açık ve realize olmuş boşluk**

4 hesapta çizer işareti var (`users.is_illustrator`), çizimler yayında [D]. Yazar
sözleşmesi yalnızca **yazılı eser** için yazılmış ("Eser: …yazılı metin", m. 2).
Çizimler için:

- imzalı ruhsat yok,
- eser bazlı onay akışı yok,
- ad belirtme tercihi kaydı yok,
- ve **veritabanı ikinci bir sözleşme türünü taşıyamıyor**: `agreement_versions` tek
  doküman varsayımıyla kurulmuş (`is_current` üzerinde kısmi tekil indeks, `kind`
  kolonu yok) [D]. D-084 bunu zaten "sonraki adım" olarak kaydetmiş, yapılmadı.

Bu, telif tarafında bugün var olan **en somut boşluk**: yayında, dayanaksız, ve
düzeltilmesi migration gerektiriyor.

### 2.5.3. Üçüncü taraf görselleri — realize olmuş risk

Ana sayfadaki "sayının filmi / dizisi / kitabı" kartlarında **Black Swan** ve **You**
afişleri ile **Masumiyet Müzesi** kapağı kullanılıyor; hakları yapımcılara ve yayınevine
ait [D, D-120]. Ürün sahibi yayımlanmasını istedi, D-120 bunu FSEK m. 35 (iktibas)
kapsamında kalıp kalmadığı sorusuyla birlikte kayda geçmiş. Görseller **canlıda**.

- Kartlar eseri tanıtan/inceleyen metinlerle birlikte kullanılıyor; bu, iktibas
  tartışmasını güçlendirir ama sonucu garanti etmez. Afiş ve kapak görselinin **tamamının**
  kullanılması, m. 35'in "maksadın haklı göstereceği nispet" ölçütü bakımından zayıf
  noktadır [Ö, değerlendirme].
- **Avukat sorusu #4.** Olumsuz görüşte çözüm hazır: görsel kaldırılır veya lisanslıyla
  değiştirilir, kart metni kalır (D-120'de planlanmış).
- Kategori fotoğrafları için ürün sahibi lisans teyidi verdi (telifsiz kaynaklar veya
  tasarımcının kendi işi) [D, D-115] — ama bu **sözlü bir teyit**; tasarımcıyla yazılı
  bir devir/lisans belgesi yok.
- Avatar saç görsel kanalı (`IMAGE_HAIR`) şu an yalnızca **uygulamanın kendi
  render'ından üretilmiş örnek dosyalar** içeriyor [D] → bugün üçüncü taraf riski yok,
  ama dışarıdan set alınırsa lisansın `DECISIONS.md`'ye yazılması kuralı korunmalı.

### 2.5.4. Marka

"Postscript" adı, logo ve `postscriptmag.com` tescilsiz [V]. Tescil **zorunlu değildir**
(Z değil), ama:

- Tescilsiz ad, aynı sınıfta tescil alan bir üçüncü kişiye karşı zayıftır;
- "Postscript"/"PostScript" adı **başka alanlarda başkalarına ait tescillere konu**
  olabilir (özellikle yazılım/bilişim sınıflarında). Dergi yayıncılığı (Nice 16 ve 41)
  farklı sınıflardır ve karışıklık ihtimali ayrı bir incelemedir.
- **Ö:** Tescile karar verilmeden önce TÜRKPATENT'te 16 ve 41. sınıflarda bir **benzerlik
  araştırması** yapılmalı. Maliyeti düşük, ileride ad değiştirme maliyetini önler.
  **Avukat/marka vekili sorusu #9.**

### 2.5.5. Yazılım lisansları

25 runtime + 20 geliştirme bağımlılığı; Next.js, React, Drizzle, Tailwind, zod,
`@node-rs/argon2`, `pdf-lib`, `unified` ailesi gibi yaygın izinli lisanslı paketler [D].
Gömülü **DejaVu Sans** yazı tipi PDF üretiminde kullanılıyor [D] — DejaVu'nun lisansı
gömmeye izin verir [V, doğrulanması kolay]. Kapalı kaynak dağıtım yapılmadığı ve fork
edilmiş kütüphane olmadığı için copyleft riski görünmüyor [V].

**Ö (düşük öncelik):** `pnpm licenses list` çıktısı bir kez alınıp depoya konmalı; GPL/AGPL
bir geçişli bağımlılık varsa erken görülür.

## 2.6. Kullanıcı etkileşimi, hassas veri ve yapay zekâ

| Konu | Durum |
|---|---|
| **Yapay zekâ** | Üründe **yok**. Öneri sıralaması kural tabanlı (`src/lib/ranking.ts`), ML yok, LLM çağrısı yok, otomatik karar yok [D]. Metin de "münhasıran otomatik sistemlerle verilen karar bulunmamaktadır" diyor ve bu doğru. AB AI Act ve KVKK m. 11'in otomatik karar hükmü **gündeme gelmiyor**. |
| **Özel nitelikli veri** | Toplanmıyor [D]. Kimlik belgesi adımı üründen çıkarılmış (D-047). Avatar oluşturucudaki ten tonu/saç seçimleri bir çizim tercihi; metin bunu açıkça ırk/etnik köken verisi olarak istemediğini yazıyor [D]. **Ö:** Bu ayrımın metinde kalması önemli; avatar seçimleri "gerçek görünüş" olarak konumlandırılırsa özel nitelikli veri tartışması açılır. |
| **Kullanıcı etkileşimi** | Yoğun: yorum, sohbet, gönderi/yanıt/beğeni/yeniden paylaşım, takip, engelleme, topluluklar, **özel mesaj**, **anonim kutu**. Her biri trafik kaydı + kaldırma yolu ile birlikte tasarlanmış [D]. |
| **Anonim kutu** | En riskli modül ve DECISIONS'ta da öyle işaretlenmiş [D]. Tasarım doğru: anonimlik **yalnızca alıcıya karşı**, gönderen hesabı ve trafik kaydı saklanıyor, yayın için gönderenin önceden onayı alınıyor, yaş ve doğrulama şartı var, günlük sınır var. Kullanım şartları yasak kullanımları (teşhir, iftira, taciz, gerçek kişilerin özel hayatı) sayıyor. **Kalan risk:** yayımlanan metinde üçüncü kişinin kişilik hakkı ihlali → dergi bu kez **içerik sağlayıcı** olur, yer sağlayıcı korumasının arkasına sığınamaz. Yayın öncesi editoryal süzgeç bir hukuki zorunluluk değil ama fiilî tek savunma (**Ö**). |
| **Özel mesajlar** | 18+ sınırı, alıcı tercihi, engelleme, yöneticinin okuyamaması [D]. Yöneticinin yalnızca bildirilen mesajı görmesi, gizlilik ile moderasyon arasında doğru dengede. |
| **Moderasyon** | Yasaklı kelime maskeleme + bildirim kuyruğu + yumuşak silme + 24 saat işaretleme [D]. Kullanım şartları bunun bir ön denetim olmadığını açıkça söylüyor — yer sağlayıcı konumunu koruyan doğru bir ifade. |

## 2.7. Risk tablosu

Olasılık ve etki: Y (yüksek) / O (orta) / D (düşük). Öncelik: **P0** derhal, **P1** 30 gün,
**P2** sonraki aşama.

| # | Risk | Olasılık | Etki | Önerilen önlem | Öncelik |
|---|---|---|---|---|---|
| R1 | Canlı aydınlatma metni işlemenin çoğunu anlatmıyor → KVKK m. 10 ihlali, idari para cezası | **Y** | **Y** | Adres/KEP kararı + tam metnin panelden yayınlanması | **P0** |
| R2 | Yurt dışı aktarım için uygun güvence yok; metin var gibi yazıyor | **Y** | **Y** | 5 sağlayıcı için standart sözleşme + 5 iş günü bildirim; olmadan §6.2 cümlesi düzeltilmeden yayınlanmaz | **P0** |
| R3 | `CRON_SECRET` yoksa silme/budama/zamanlı yayın hiç çalışmıyor → m. 7 ihlali + metindeki sürelerin tamamı yanlış | O [E3] | **Y** | Vercel'de değişkeni doğrula/ekle; bir kez elle `pnpm housekeeping` çalıştır | **P0** |
| R4 | Çizerlerin eserleri dayanaksız yayında | **Y** | O | `agreement_versions.kind` migration'ı + çizer sözleşmesi ve eser onayı | **P0** |
| R5 | Editörler yayınlanmamış eserlere ve okur verisine taahhütsüz erişiyor | **Y** | O | Editör gizlilik + veri işleme taahhüdü, panelde onaya bağlanması | **P0** |
| R6 | Afiş/kapak görselleri için hak sahibi uyarısı veya talebi | O | O | FSEK m. 35 görüşü; olumsuzsa kaldır/lisanslı görselle değiştir | **P1** |
| R7 | Reşit olmayan üyelerin herkese açık topluluk kullanımı | O | **Y** (itibar + kişilik hakkı) | Kayıtta yaş alt sınırı; 18 altı için topluluk yetkilerinin kararlaştırılması | **P0/P1** |
| R8 | 5187 kapsamına girildiğinin sonradan anlaşılması | O [S] | O | Avukat görüşü; muhafazakâr olarak içerik tarihleri ve sürüm geçmişi korunur | **P1** |
| R9 | BTK yer sağlayıcı bildirimi yapılmamış | O [S] | O | Görüş sonrası bildirim (e-Devlet, ücretsiz) | **P1** |
| R10 | Künyede adres/telefon/e-tebligat eksik; adresin ilçe düzeyinde kalması | **Y** | O | E1 kararı; KEP alınırsa künyeye ve metne işlenmesi | **P0** |
| R11 | Ortaklık sözleşmesi yok; temsil beyanının dayanağı yok, ortaklar sınırsız sorumlu | O | **Y** | Yazılı adi ortaklık sözleşmesi; yapı değişikliğinin (dernek) değerlendirilmesi | **P1** |
| R12 | Anonim kutuda yayımlanan metin üçüncü kişinin hakkını ihlal ederse dergi içerik sağlayıcı olarak sorumlu | O | **Y** | Yayın öncesi editoryal süzgecin yazılı kural hâline getirilmesi; kaldırma refleksi | **P1** |
| R13 | Aydınlatma metni "hesap ayarlarından veri kopyanızı indirebilirsiniz" diyor, kod bunu sunmuyor | **Y** (yayınlanırsa kesin) | O | Ya self-servis indirme yazılır ya cümle "talep üzerine" olarak düzeltilir | **P0** (yayından önce) |
| R14 | Spotify çaları tekrarlanan aktarım doğuruyor, açık rıza dayanağı zayıf | O | O | Görüş; muhafazakâr seçenek gömmeyi kaldırıp bağlantıya dönmek | **P1** |
| R15 | Ekip avatarının sosyal medyada yayımı için rıza kaydı yok | O | D | Rıza kutusu + kaydı (`team_avatars` yanında sürüm ve zaman) | **P1** |
| R16 | Yetki sözleşmesi kayıtları geçersiz olabilir | O | D | Görüş; gerekirse kayıt "genel yetki kuralları uygulanır"a çevrilir | **P2** |
| R17 | Tasarımcıyla yazılı fikri hak belgesi yok | O | O | Tasarım ve avatar çizimleri için devir/lisans belgesi | **P1** |
| R18 | Marka tescilsiz; ad çakışması | D | O | 16/41. sınıfta benzerlik araştırması, sonra tescil kararı | **P2** |
| R19 | Gelir modeli (bağış/sponsorluk) girerse vergi, ETBİS, tüketici ve İYS rejimi bir anda gündeme gelir | D (bugün) | **Y** | Gelir kararından önce mali müşavir + avukat | **P2** |
| R20 | İki sürücü riski (PGlite/postgres.js) hukuki değil ama silme/budama işlerini üretimde bozabilir | O | O | D-078 kuralına uyum; housekeeping'in üretimde bir kez elle doğrulanması | **P1** |

---

# 3. Gerekli sözleşmeler ve hukuki metinler

## 3.1. Üç şeyin birbirinden ayrılması

Bu ayrım karıştırıldığında hem metin hem kod yanlış kurulur:

| | **Aydınlatma** | **Sözleşme kabulü** | **Açık rıza** |
|---|---|---|---|
| Ne yapar | Bilgilendirir | Karşılıklı borç doğurur | İşlemeyi hukuka uygun kılar |
| Dayanağı | KVKK m. 10 | TBK | KVKK m. 5/1 |
| Onay alınır mı | **Hayır** — "okudum ve anladım" | **Evet** — "kabul ediyorum" | **Evet** — özgür, belirli, bilgilendirilmiş |
| Geri alınabilir mi | İlgisiz | Fesih usulüne göre | **Her zaman**, kolayca |
| Zorunlu tutulabilir mi | — | Hizmet için evet | **Hayır** — hizmet şartına bağlanamaz |
| postscript'te | `/kvkk` (kayıtta bağlantı + "okudum ve anladım") [D — doğru kurulmuş] | `/kullanim-sartlari`, yazar sözleşmesi, Eser Onayı | Spotify çaları; ekip avatarı yayımı |

Kayıt formundaki kutunun "onaylıyorum" yerine **"okudum ve anladım"** olarak düzeltilmiş
olması [D] küçük ama önemli bir doğruluk: aydınlatma onaylanmaz. Aynı disiplinin açık
rıza tarafında da kurulması gerekiyor (Spotify'da kurulmuş, avatarda kurulmamış).

## 3.2. Özet tablo

| # | Belge | Taraflar | Zorunlu mu | Durum | Öncelik |
|---|---|---|---|---|---|
| B1 | KVKK Aydınlatma Metni (tam sürüm) | Dergi → ilgili kişi | **Z** (m. 10) | Depoda hazır, **yayınlanmadı** | **P0** |
| B2 | Künye / tanıtıcı bilgiler | Dergi → kamu | **Z** (5651 m. 3; 5187 koşullu) | Var, **alanlar eksik** | **P0** |
| B3 | Kullanım Şartları | Dergi ↔ üye | İ + sözleşmesel gereklilik | Var, güncelleme gerek | P1 |
| B4 | Çerez bilgilendirmesi | Dergi → ziyaretçi | **Z** (aydınlatmanın parçası) | Depo metni §5'te var, canlıda **yok** | **P0** (B1 ile) |
| B5 | Açık rıza — Spotify çaları | Dergi ↔ üye | **Z** (rıza alınacaksa şekli) | Var, **dayanağı tartışmalı** | P1 |
| B6 | Açık rıza — ekip avatarının yayımı | Dergi ↔ ekip üyesi | **Z** (rızaya dayanıyorsa) | **Yok** | P1 |
| B7 | Yazar Sözleşmesi ve Ruhsat Taahhüdü | Dergi ↔ yazar | **Z** (FSEK m. 52 şekil) | Var, güçlü; 3 düzeltme | P1 |
| B8 | Eser Onayı (eser bazlı ruhsat) | Dergi ↔ yazar | **Z** (FSEK m. 48/3) | Var, işliyor | — |
| B9 | **Çizer Sözleşmesi + Çizim Onayı** | Dergi ↔ çizer | **Z** (FSEK) | **Yok** | **P0** |
| B10 | **Editör Gizlilik ve Veri İşleme Taahhüdü** | Dergi ↔ editör | **Z** (KVKK m. 12) + İ | **Yok** | **P0** |
| B11 | **Yurt dışı aktarım standart sözleşmeleri** (4–5 adet) | Dergi ↔ sağlayıcı | **Z** (m. 9) | **Yok** | **P0** |
| B12 | **Adi ortaklık sözleşmesi** | Ortak ↔ ortak | İ (şekle tabi değil) + **Ö** | **Yok** | P1 |
| B13 | Tasarımcı/serbest çalışan fikri hak belgesi | Dergi ↔ tasarımcı/çizer | İ + **Ö** | **Yok** (sözlü teyit var) | P1 |
| B14 | Anonim kutu yayın onayı metni | Dergi ↔ gönderen | **Z** (FSEK + rıza) | Kodda onay var, **metni derli toplu değil** | P1 |
| B15 | İçerik kaldırma başvuru usulü | Dergi → başvurucu | **Z** (5651 m. 9) | **Var, iyi** | — |
| B16 | Topluluk kuralları | Dergi ↔ üye | İ | Var (Kullanım Şartları m. 3) | — |
| B17 | Sorumlu müdür atama yazısı + beyanname | Dergi → Başsavcılık | **Koşullu Z** (5187) | Yok | **[S]**'ye bağlı |

## 3.3. Belge detayları

Yedi bilgi alanı bir markdown tablosunda okunmaz hâle geldiği için her belge blok
olarak verildi.

---

### B1 — KVKK Aydınlatma Metni (tam sürüm)

- **Amaç / taraflar:** Dergi (veri sorumlusu) → okuyucu, yazar, editör, çizer, iletişim
  formu gönderen. Tek yönlü bilgilendirme; onay alınmaz.
- **Zorunluluk:** **Z** — KVKK m. 10 + Aydınlatma Yükümlülüğünün Yerine Getirilmesinde
  Uyulacak Usul ve Esaslar Hakkında Tebliğ. Koşula bağlı değil.
- **Temel hükümler:** veri sorumlusunun kimliği ve iletişimi · işlenen veri kategorileri
  · **her amaç için ayrı hukuki sebep** · toplama yöntemi · çerezler · yurt içi/yurt dışı
  aktarım ve dayanağı · saklama süreleri · m. 11 hakları · başvuru usulü · sürümleme.
- **Hazırlamak için gerekenler:** E1 (adres veya KEP) · aktarım mekanizmasının gerçek
  durumu (E4) · R13'ün çözümü (self-servis indirme var mı).
- **Nerede gösterilir:** `/kvkk`, herkese açık, oturum arkasında değil · kayıt formundan
  yeni sekmede bağlantı · footer · yeni sürüm yayınlanınca panel üstünde bant.
- **Öncelik:** **P0.** Tek eksik alan doldurulduğunda 30 dakikada yayınlanabilir.
- **Avukat incelemesi gereken noktalar:** §6.2 aktarım dayanağı cümlesi (R2) · Spotify
  satırının hukuki sebebi (R14) · KEP'in yazılı başvuru yolunu karşılayıp karşılamadığı
  (D-154) · veri sorumlusu kimliğinde adi ortaklığın nasıl gösterileceği.

---

### B2 — Künye / tanıtıcı bilgiler

- **Amaç / taraflar:** Dergi → kamu ve yetkili merciler. Kim sorumlu, nereden ulaşılır,
  kaldırma başvurusu nasıl yapılır.
- **Zorunluluk:** **Z** — 5651 m. 3 (Yönetmelik m. 5'in "ticari veya ekonomik amaçlı"
  kaydı tartışmalı, D-154). 5187 kapsamına girilirse **ek alanlar zorunlu** olur.
- **Temel hükümler:** yayıncı kimliği · **yerleşim/işyeri adresi** · e-posta ·
  **telefon** (5187) · **elektronik tebligat adresi / KEP** (5187) · hangi sıfatla
  sorumlu olunduğu · kaldırma ve cevap hakkı usulü + 24 saat · **yer sağlayıcının adı ve
  adresi** (5187).
- **Hazırlamak için gerekenler:** E1, E2. Bilgiler `site_settings`'ten gelir, ikinci kopya
  tutulmaz — bu doğru kurulmuş [D].
- **Nerede:** `/kunye`, her sayfanın footer'ından bağlı, ana sayfadan doğrudan erişilebilir.
- **Öncelik:** **P0** (adres) / P1 (5187 alanları, görüşe bağlı).
- **Avukat:** #1, #2. Ayrıca: adi ortaklıkta "ticari unvan" alanı nasıl doldurulur?

---

### B3 — Kullanım Şartları

- **Amaç / taraflar:** Dergi ↔ kayıtlı üye. Üyelik sözleşmesi + topluluk kuralları.
- **Zorunluluk:** **İ** — kanunen zorunlu tek tip bir metin değil, ama moderasyon,
  askıya alma ve hesap kapatma yetkilerinin dayanağı. Olmadan bu yetkiler tartışmalı.
- **Temel hükümler:** kapsam ve kabul · hesap ve doğruluk · **yaş** · topluluk kuralları ·
  içerikten sorumluluk · trafik kaydı bilgilendirmesi · moderasyon ve bildirim ·
  eserlerin telif durumu · hizmetin sunumu ve kesinti · hesabın sona ermesi · kişisel
  veriler · değişiklik usulü · uygulanacak hukuk.
- **Hazırlamak için gerekenler:** yaş kararı (K4) · yetki kaydı görüşü (#8) · anonim kutu
  ve özel mesaj bölümlerinin koda birebir uyduğunun kontrolü.
- **Nerede:** `/kullanim-sartlari`, footer, kayıt akışında bağlantı. **Esaslı değişiklikte
  duyuru** (m. 10 zaten öyle diyor).
- **Öncelik:** P1.
- **Avukat:** #8 (yetki) · sorumluluk sınırlama kayıtlarının geçerliliği · tek taraflı
  değişiklik kaydının bedelsiz hizmette sınırı.
- **Not:** Bu metin koda göre yazılmış, şablondan değil [D] — nadir ve değerli. Ama
  ürünle birlikte kayması en kolay metin: değiştiğinde aynı adımda güncellenmesi kuralı
  korunmalı.

---

### B4 — Çerez bilgilendirmesi

- **Amaç / taraflar:** Dergi → ziyaretçi.
- **Zorunluluk:** **Z**, ama **ayrı bir belge olarak değil** — aydınlatma metninin
  parçası olarak. İki çerez de zorunlu olduğu için **rıza gerekmez**; bilgilendirme
  gerekir [D, KVKK Çerez Rehberi 2022].
- **Temel hükümler:** çerez adı · amaç · süre · zorunlu olduğu · üçüncü taraf
  çerezlerinin yalnızca Spotify çaları açılırsa devreye girdiği.
- **Nerede:** `/kvkk` §5. **Banner konmamalı** (Ö).
- **Öncelik:** **P0**, B1 ile birlikte çıkar.
- **Neden ayrı "Çerez Politikası" sayfası önerilmiyor:** İki zorunlu çerez için ayrı bir
  sayfa, zamanla aydınlatma metninden ayrışır ve iki farklı beyan doğar. Tek kaynak
  ilkesi (D-084'teki `site_settings` gerekçesinin aynısı).

---

### B5 — Açık rıza: Spotify çaları

- **Amaç / taraflar:** Dergi ↔ üye. Üçüncü taraf gömülü içeriğin yüklenmesi ve bu yolla
  IP/tarayıcı bilgisinin Spotify AB'ye gitmesi.
- **Zorunluluk:** Rızaya dayanılacaksa **Z** (m. 5/1 + zorunlu olmayan üçüncü taraf çerez).
- **Temel hükümler:** ne olacağının **önceden** söylenmesi · rıza olmadan hiçbir isteğin
  gitmemesi · rızanın geri alınabilmesi · aydınlatmaya bağlantı.
- **Durum:** Mimari doğru [D]: sayfa açılışında istek gitmiyor, not düğmenin yanında,
  yalnızca üyelere açık. **Eksik:** rıza kaydı tutulmuyor ve geri alma (çalarları bir daha
  yüklemeyi kapatma) yolu yok.
- **Öncelik:** P1.
- **Avukat:** #3 (aktarım dayanağı — arızi mi?) · ortak veri sorumluluğu.

---

### B6 — Açık rıza: ekip avatarının yayımı

- **Amaç / taraflar:** Dergi ↔ ekip üyesi (yazar/editör/çizer/yönetici). Avatarın site ve
  sosyal medyada ekip tanıtımı için yayımlanması.
- **Zorunluluk:** **Z** — aydınlatma metni dayanağı "yayımlama bakımından açık rıza"
  olarak beyan ediyor [D]; beyan bu olduğu için rızanın alınması ve **ispatlanması**
  gerekir.
- **Temel hükümler:** hangi görselin, hangi mecrada, hangi isimle · geri alma hakkı ve
  sonucu (yayından kaldırma) · rızanın hizmet şartına bağlanmaması.
- **Hazırlamak için:** E8 (hangi mecrada ne paylaşılıyor).
- **Nerede:** avatar oluşturucunun kaydetme adımında ayrı bir kutu (varsayılan **kapalı**).
- **Öncelik:** P1. **Ürün görevi Ü7.**

---

### B7 — Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü

- **Durum:** Var, işliyor, 29 yazarın imzası hash + zaman + IP ile kayıtlı [D].
- **Zorunluluk:** **Z** — FSEK m. 52 mali hak sözleşmelerinin yazılı olmasını ve
  hakların ayrı ayrı gösterilmesini istiyor. Bu şekil şartı sağlanmış.
- **Yapılacak düzeltmeler:** IP1 (PDF Sayı ve e-bülten mecraları) · IP2 (yetki kaydı) ·
  IP3 (ortaklık temsili) · m. 11.1'deki KVKK sürüm atfının canlı sürümle tutarlılığı.
- **Nerede:** yazar terfisi ve başvuru akışında tam metin, kaydırma kilidiyle; her yeni
  sürümde yeniden onay ve o ana kadar panelin kilitlenmesi [D].
- **Öncelik:** P1 (yeni sürüm çıkarılırken).
- **Avukat:** IP2 · m. 4.6'daki "ticari kullanım hariç" ifadesinin sosyal medya
  tanıtımıyla sınırının netliği · m. 9.3'teki PDF geri çağırma kaydının, PDF hiç
  üretilmediği için gereksizleşip gereksizleşmediği.

---

### B9 — Çizer Sözleşmesi ve Çizim Onayı *(yeni — kritik)*

- **Amaç / taraflar:** Dergi ↔ çizer (4 kişi). Çizimler üzerinde basit ruhsat.
- **Zorunluluk:** **Z** — FSEK. Çizim de eserdir; ruhsat yazılı olmalı ve haklar ayrı
  ayrı sayılmalı.
- **Temel hükümler:** eser tanımı (çizim, illüstrasyon, kapak, avatar parçası) · basit
  ruhsat, mali haklar çizerde · ayrı ayrı sayılmış mali haklar · **işleme yetkisinin
  sınırı** (yeniden renklendirme, kırpma, ölçekleme — dijital yayında kaçınılmaz) ·
  mecralar (site, sosyal medya, kapak) · bedelsizlik · ad belirtme tercihi · üçüncü
  kişi hakkı beyanı (referans aldığı görseller!) · geri çekme · fesih · gizlilik.
- **Hazırlamak için:** E7 · çizerin fiilen ne ürettiğinin envanteri (kapak? illüstrasyon?
  avatar parçası? tasarım?).
- **Nerede:** yazar sözleşmesiyle aynı akış: çizer işareti verildiğinde panelde tam metin,
  onay, PDF, ve çizim bazlı onay.
- **Öncelik:** **P0.** **Ön koşul: `agreement_versions.kind` migration'ı (Ü3).**
- **Avukat:** Avatar oluşturucunun ürettiği türev görselin hak durumu · çizerin referans
  aldığı üçüncü taraf görselleri için beyan yeterli mi.

---

### B10 — Editör Gizlilik ve Veri İşleme Taahhüdü *(yeni — kritik)*

- **Amaç / taraflar:** Dergi ↔ editör (6 kişi) ve yönetici (2 kişi). Editör, yayınlanmamış
  eserleri, yazar başvurularını, editör notlarını, moderasyon kuyruğunu ve bildirilen
  içerikleri görüyor; yöneticiler ayrıca kullanıcı verisini, sözleşme PDF'lerini ve
  denetim kayıtlarını görüyor [D].
- **Zorunluluk:** **Z** karakterli — KVKK m. 12 veri güvenliği yükümlülüğü, verilere
  erişen kişilerin yazılı taahhüdünü fiilen gerektirir. Ayrıca FSEK tarafında
  yayınlanmamış eserlerin gizliliği.
- **Temel hükümler:** gizlilik ve süresizlik · veriye yalnızca görev amacıyla erişim ·
  dışarı aktarma ve ekran görüntüsü yasağı · ihlal bildirimi · görev sonunda erişimin
  kesilmesi ve kopyaların iadesi/imhası · moderasyon kararlarının kaydı · **özel
  mesajları okuma yasağı** (kod bunu zaten engelliyor, taahhüt pekiştirir) · yaptırım
  (rol geri alma, fesih).
- **Nerede:** editör rolü verildiğinde panel kilidi ile birlikte onay; kritik duyuru
  mekanizması (`requiresAcknowledgement`) bunun için hazır [D].
- **Öncelik:** **P0.** Ön koşul: aynı migration (Ü3).
- **Avukat:** Gönüllü ilişkide cezai şart konulabilir mi · ihlalde tazminat ve rücu.

---

### B11 — Yurt dışı aktarım standart sözleşmeleri

- **Amaç / taraflar:** Dergi ↔ Vercel / Neon / Cloudflare / Resend (+ Spotify ayrı
  değerlendirilecek).
- **Zorunluluk:** **Z** — KVKK m. 9. Yeterlilik kararı olmadığı için uygun güvence şart;
  standart sözleşme imzalanır ve **5 iş günü içinde Kuruma bildirilir** [D].
- **Temel hükümler:** Kurul'un yayımladığı standart sözleşme modülleri (veri sorumlusundan
  veri işleyene modülü büyük olasılıkla uygun) · taraf bilgileri, imza tarihleri, veri
  kategorileri, aktarım amacı, alıcı grubu, saklama, teknik ve idari tedbirler ekleri.
- **Hazırlamak için:** E4 · her sağlayıcı için hangi veri kaleminin gittiğinin listesi
  (aydınlatma metni §6.2 bunu **zaten** veriyor [D] — hazırlık işinin yarısı yapılmış).
- **Nerede:** üründe gösterilmez; Kuruma bildirilir ve dosyada tutulur. Aydınlatma metni
  §6.2 buna atıf yapar.
- **Öncelik:** **P0** (B1'in yayınıyla bağlı).
- **Avukat:** #3 · sağlayıcı standart sözleşmeyi imzalamazsa alternatif (taahhütname +
  Kurul izni; ya da sağlayıcıyı değiştirmek) · Spotify'da aktaranın dergi mi tarayıcı mı
  olduğu · Turnstile'ın küresel işlemesinin ayrı satır gerektirip gerektirmediği.

---

### B12 — Adi ortaklık sözleşmesi

- **Amaç / taraflar:** İki ortak arasında.
- **Zorunluluk:** **İ/Ö** — şekle tabi değil, kanunen zorunlu değil. Ama yazar
  sözleşmesindeki temsil beyanının dayanağı ve ortaklar arası uyuşmazlığın tek
  panzehiri.
- **Temel hükümler:** amaç ve kâr amacı gütmeme · katkılar · **temsil yetkisi** (tek
  başına mı, birlikte mi — mevcut beyanla uyumlu olmalı) · karar alma · fikri hakların
  kime ait olacağı (logo, tasarım, alan adı, hesaplar) · **alan adı ve hesapların
  mülkiyeti** · gider paylaşımı · çıkma/fesih ve çıkışta arşivin ne olacağı ·
  uyuşmazlık.
- **Hazırlamak için:** E6, E7.
- **Öncelik:** P1.
- **Avukat:** Dernek yapısına geçişin bu sözleşmeyle nasıl bağlanacağı · ortaklığın
  sözleşmelerde nasıl taraf gösterileceği.

---

### B13 — Tasarımcı / serbest çalışan fikri hak belgesi

- **Amaç / taraflar:** Dergi ↔ tasarımcı (ve dışarıdan çizim alınırsa çizer).
- **Zorunluluk:** **İ/Ö** — eser sahipliği kural olarak yaratanda kalır; devir veya
  ruhsat yazılı olmadıkça dergi tasarımı özgürce kullanamaz, değiştiremez, tescil
  ettiremez.
- **Temel hükümler:** hangi işler (461 MB `.ai` dosyaları, logo, kategori fotoğrafları,
  avatar çizimleri) · devir mi ruhsat mı · **kullanılan üçüncü taraf görseller için
  kaynak ve lisans beyanı** (bugün sözlü, D-115) · işleme ve türev üretme yetkisi
  (avatar parçalarının yeniden renklendirilmesi bunu gerektiriyor) · bedel.
- **Öncelik:** P1. Logo tescili düşünülüyorsa **ön koşul**.
- **Avukat:** #4 ile birlikte · sözlü teyidin yazıya dönüştürülmesinin geçmişe etkisi.

---

### B14 — Anonim kutu yayın onayı

- **Amaç / taraflar:** Dergi ↔ gönderen üye. Metnin adsız, kısaltılarak veya düzenlenerek
  dergide yayımlanması.
- **Zorunluluk:** **Z** karakterli — metin bir eser olabilir (FSEK) ve yayın için izin
  gerekir; ayrıca kişisel veri işlemesi rızaya dayanıyor.
- **Temel hükümler:** adsız yayım · kısaltma ve düzenleme yetkisi · yayımlamama hakkının
  dergide olması · anonimliğin **yalnızca okura karşı** olduğu · yetkili merci talebinde
  paylaşım · yasak kullanımlar · yaş ve doğrulama şartı.
- **Durum:** Kod onayı alıyor ve kullanım şartları ile aydınlatma metni anlatıyor [D].
  **Eksik:** onay anında gösterilen metnin **sürümü ve hash'i kaydedilmiyor** (yazar
  sözleşmesinde yapılan şey burada yapılmıyor).
- **Öncelik:** P1. **Ürün görevi Ü8.**

---

### B17 — Sorumlu müdür atama + beyanname *(koşullu)*

Yalnızca **[S] avukat sorusu #1** "evet" ise gerekir. Gerekirse: sorumlu müdür atama
kararı, Cumhuriyet Başsavcılığına beyanname, künye alanlarının tamamlanması. Beyanname
incelemesinde eksiklik çıkarsa iki hafta içinde tamamlama istenir [D, ikincil kaynak].

## 3.4. Gerekmeyen belgeler ve neden gerekmediği

Bunları hazırlamamak bir eksik değil, **doğru karar**. Sonradan "şablonda vardı" diye
eklenmemesi için gerekçeleriyle kayda geçiyor:

| Belge | Neden gerekmez |
|---|---|
| Mesafeli satış sözleşmesi, ön bilgilendirme formu | Satış ve bedel yok |
| İptal / iade / cayma politikası | Ödenen bedel yok; yazılması yanlış beklenti yaratır |
| Abonelik şartları, yenileme bildirimi | Abonelik yok ve "Yapılmayacaklar"da |
| Ödeme hizmeti / PSP sözleşmesi, PCI-DSS | Ödeme akışı yok |
| ETBİS kaydı, e-ticaret bilgilendirmeleri | Elektronik ticaret faaliyeti yok [V] |
| Ayrı "Çerez Politikası" sayfası | İki zorunlu çerez; aydınlatma §5 yeterli, ikinci kopya ayrışır |
| Çerez rıza banner'ı | Her iki çerez de kesinlikle gerekli [D, Çerez Rehberi] |
| GDPR uyum paketi (DPA, SCC, AB temsilcisi, DPO, ROPA) | GDPR yer bakımından uygulanmıyor görünüyor [V, #7'ye bağlı] |
| DSA uyum metinleri, şeffaflık raporu | AB'ye yönelme yok [V] |
| AI kullanım politikası, model şeffaflık beyanı | Üründe AI yok [D] |
| İYS kaydı, ticari elektronik ileti onay metni | Ticari ileti gönderilmiyor; e-bülten kurulursa değişir |
| VERBİS kaydı | İstisna eşiğinin altında [V, E5] |
| İş sözleşmesi, İSG belgeleri, bordro | Çalışan yok; katkılar gönüllü |
| Bağış/sponsorluk sözleşmeleri | Gelir modeli yok; girerse gerekir (R19) |
| Ayrı "Gizlilik Politikası" | Türk hukukunda karşılığı aydınlatma metni; iki ayrı metin tutmak iki farklı beyan üretir |

---

# 4. Üründe uygulanması gerekenler

Metin hazırlamak yetmez; aşağıdakiler somut ürün/operasyon görevleri. "Yok" yazan her
satır bugün canlıda eksik olan bir davranıştır.

| # | Akış | Yapılacak | Neden | Dosya / yer | Öncelik |
|---|---|---|---|---|---|
| Ü1 | **KVKK metni yayını** | `[AÇIK ADRES]` (2 yer) doldurulur, admin "Sistem" sayfasından yeni sürüm yayınlanır | Canlı metin ürünün gerisinde (R1) | `data/kvkk-aydinlatma-metni.md` → `/admin/settings` | **P0** |
| Ü2 | **Günlük iş** | Vercel'de `CRON_SECRET` (≥32 karakter) doğrulanır/eklenir; bir kez elle `pnpm housekeeping` çalıştırılıp çıktısı kaydedilir | Silme, budama, zamanlı yayın buna bağlı (R3) | Vercel env · `src/services/housekeeping.ts` | **P0** |
| Ü3 | **Sözleşme altyapısı** | `agreement_versions`'a `kind` kolonu + tekil indekslerin `kind` ile birleştirilmesi; `agreement_acceptances` çoklu türü desteklemeli | Çizer sözleşmesi ve editör taahhüdü (B9, B10) bugün **teknik olarak imkânsız** | `src/db/schema.ts:633` → `pnpm db:generate` | **P0** |
| Ü4 | **Kayıt** | Yaş alt sınırı sunucu tarafında uygulanır; sınır altı kayıt reddedilir ve gerekçesi gösterilir | R7; küçüklerle sözleşme ve veri işleme | `src/services/auth.ts`, `src/lib/age.ts` | **P0/P1** |
| Ü5 | **Kayıt / aydınlatma kaydı** | `kvkkConsentVersion` **karşılaştırılıyor** (sürüm bandı var [D]) — ek olarak "okundu" kaydının **sürüm + zaman + metin hash'i** ile tutulması | İspat: hangi kişiye hangi metnin gösterildiği | `account/actions.ts:298`, `kvkk_versions` | P1 |
| Ü6 | **Veri talepleri** | Ya self-servis "verilerimi indir" yazılır ya aydınlatma §8'deki cümle "talep üzerine" olarak düzeltilir | Metin var olmayan bir özelliği anlatıyor (R13) | `src/app/account/` · `services/users.ts:1010` (admin tarafı hazır) | **P0** (Ü1'den önce) |
| Ü7 | **Ekip avatarı** | Kaydetme adımına "site ve sosyal medyada yayımlanmasına izin veriyorum" kutusu (varsayılan kapalı) + rıza sürümü ve zamanının kaydı; geri alma | Rıza beyan edildi, ispatı yok (R15, B6) | `src/app/team/avatar/`, `team_avatars` | P1 |
| Ü8 | **Anonim kutu** | Onay anında gösterilen metnin sürümü ve hash'i kaydedilir | Yazar sözleşmesindeki ispat disiplininin aynısı (B14) | `src/services/anon-box.ts` | P1 |
| Ü9 | **Makale sayfası** | İlk yayın tarihi **ve güncelleme tarihi** içerik üzerinde gösterilir | 5187 koşullu zorunluluk + her hâlde iyi uygulama | `src/app/magazine/articles/[slug]/page.tsx:89` | P1 |
| Ü10 | **Künye** | Adres/KEP, telefon ve elektronik tebligat alanları `site_settings`'e eklenir; künye kendiliğinden düzelir | B2, R10 | `/admin/settings`, `src/lib/legal.ts` | **P0/P1** |
| Ü11 | **Kaldırma başvuruları** | Başvuruların ve 24 saatlik cevap süresinin **kayda geçtiği** bir yer: bugün başvuru e-postayla geliyor, sistemde izi yok | 5651 m. 9 uyumunun ispatı; bildirim kuyruğu yalnızca site içi "Bildir" için var | yeni: `takedown_requests` veya mevcut `content_reports`'a dış başvuru türü | P1 |
| Ü12 | **Spotify** | Rıza kaydı + "bir daha yükleme" tercihi; ya da (görüşe göre) gömme kaldırılıp bağlantıya dönülür | R14, B5 | `src/components/spotify-player.tsx` | P1 |
| Ü13 | **Hesap silme** | Silme talebinin **ne silineceğini ve neyin kalacağını** onay ekranında tek tek göstermesi | Şeffaflık; metin bunu anlatıyor, ekran anlatmıyor | `account/actions.ts:171` | P1 |
| Ü14 | **Sürümleme** | Kullanım şartlarının da sürümlenmesi (bugün React sayfası, git'te sürümlü ama kullanıcıya gösterilen sürüm kaydı yok) | Esaslı değişiklikte hangi sürümün kabul edildiğinin ispatı | `/kullanim-sartlari` | P2 |
| Ü15 | **18 altı topluluk** | Karar sonrası: 18 altı üyeler için gönderi/profil fotoğrafı/takip edilme yetkilerinin kapatılması | R7 | `services/posts.ts`, `profile-images.ts`, `social.ts` | P1 |
| Ü16 | **Rıza envanteri** | Tek bir yerde "hangi rıza, hangi sürüm, hangi zaman, geri alındı mı" tablosu | Bugün rızalar dağınık (kayıt, avatar, anonim kutu, Spotify) | yeni: `consents` tablosu | P2 |
| Ü17 | **Denetim** | `pnpm licenses list` çıktısının depoya alınması | Yazılım lisansı riski erken görülür | `panel/` | P2 |

**Kabul kayıtları, sürümler ve ispat — mevcut durumun değerlendirmesi:**

Bu konuda ürün beklenenin üstünde. Yazar sözleşmesinde onay anında **metin yeniden
render edilip hash karşılaştırılıyor**, uyuşmazsa 409 dönüyor; kabul edilen metnin tam
hâli (`rendered_markdown`), hash'i, zamanı, IP'si ve tarayıcı bilgisi saklanıyor ve PDF
üretiliyor [D]. KVKK metni `kvkk_versions` tablosunda sürümlü ve sayfada sürüm + tarih +
hash gösteriliyor [D]. Bu disiplin **üç yerde eksik**: ekip avatarı rızası (Ü7), anonim
kutu onayı (Ü8) ve kullanım şartları sürümü (Ü14). Aynı kalıbın oralara taşınması
yeterli — yeni bir mimari gerekmiyor.

---

# 5. Mevcut durum ve eksik analizi

İncelenen belge ve ekranlar: `panel/data/kvkk-aydinlatma-metni.md`,
`panel/contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`, `doc/01-…`, `doc/02-…`,
`doc/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`, `src/app/kunye/page.tsx`,
`src/app/kullanim-sartlari/page.tsx`, `src/app/kvkk/page.tsx`, `src/app/iletisim/page.tsx`,
`src/db/schema.ts`, `src/services/*`, `panel/DECISIONS.md` (ilgili kararlar),
`panel/README.md`, `panel/TEKNOLOJI-RAPORU.md` ve **canlı** `postscriptmag.com/kvkk` ile
`/kunye` (22 Eylül 2026).

**İncelenmeyenler — incelenmiş gibi davranılmadı:** Vercel/Neon/Cloudflare/Resend hesap
ayarları ve bu sağlayıcılarla hâlihazırda kabul edilmiş şartlar (erişim yok), canlı
veritabanı içeriği (`run_sql` üretim okumaları izin sistemi tarafından reddediliyor),
derginin sosyal medya hesaplarında fiilen paylaşılan içerik, `postscriptui/` tasarım
dosyalarının kaynak bilgisi, resmî `mevzuat.gov.tr` metinleri (TLS hatası — bkz. §9).

## 5.1. Var olanlar

| Belge / ekran | Yer | Değerlendirme |
|---|---|---|
| Künye (5651) | canlı `/kunye` | **İyi.** Sıfat ayrımı, başvuru usulü, 24 saat taahhüdü, barındırma bilgisi doğru ve açık |
| Kullanım Şartları | canlı `/kullanim-sartlari` | **İyi.** Koda göre yazılmış; özel mesaj, anonim kutu, moderasyon bölümleri ürünü doğru anlatıyor |
| KVKK Aydınlatma Metni (tam) | `data/kvkk-aydinlatma-metni.md` | **Çok iyi ama yayınlanmadı.** On başlık, amaç–hukuki sebep eşlemesi, saklama ve aktarım tabloları; her satır koda bakılarak yazılmış |
| Yazar Sözleşmesi + Eser Onayı | `contracts/…md` + panel akışı | **Çok iyi.** FSEK m. 48/3, 50, 52, 56 bilinçli uygulanmış; ispat zinciri kurulu |
| Kaldırma / bildirim usulü | künye + `content_reports` | **İyi.** 24 saat işaretlemesi kodda |
| Trafik kaydı | `traffic_logs` | **Var.** Her yorum/mesaj/gönderi/DM/anonim mesaj, 1 yıl |
| Saklama/silme işleri | `housekeeping.ts` | **Var** ama üretimde çalıştığı doğrulanmamış (E3) |
| Denetim kaydı | `audit_log` | **Var**, yalnızca eklenir, trigger korumalı |
| Güvenlik | 2FA zorunlu, argon2id, DB tabanlı oturum, CSP/başlıklar, Turnstile, hız sınırları | **KVKK m. 12 açısından güçlü** |
| Public API veri minimizasyonu | `services/public.ts` | **İyi.** E-posta, gerçek ad, doğum tarihi hiçbir zaman dönmüyor |

## 5.2. Eksik olanlar

| # | Eksik | Kaynak |
|---|---|---|
| X1 | Canlı aydınlatma metni tam sürüme çıkmadı; 7 özellik anlatılmıyor | canlı `/kvkk` (v1, 6 Eyl 2026) vs `data/kvkk-aydinlatma-metni.md` |
| X2 | Yurt dışı aktarım için standart sözleşme / bildirim yok | `data/…md` §6.2 iddia ediyor; D-083 "yayınlanmadan önce doğru olması gerekenler" listesinde bekliyor |
| X3 | Çizer sözleşmesi ve çizim onayı yok | `users.is_illustrator` (4 hesap) vs `contracts/` |
| X4 | Editör gizlilik ve veri işleme taahhüdü yok | 6 editör vs `contracts/` |
| X5 | `agreement_versions` ikinci doküman türünü taşıyamıyor | `schema.ts:633` — `kind` kolonu yok, `is_current` tekil |
| X6 | Adi ortaklık sözleşmesi yok | depo genelinde yok |
| X7 | Kayıtta yaş alt sınırı yok; 18 altı herkese açık gönderi paylaşabiliyor | `register/page.tsx`, `isAdult` yalnızca DM ve anonim kutuda |
| X8 | Self-servis veri indirme yok (metin var diyor) | `account/actions.ts` — export action yok; yalnızca `admin/actions.ts:411` |
| X9 | Künyede adres, telefon, elektronik tebligat adresi yok | canlı `/kunye`: "Tebligat adresi: Konak, İzmir" |
| X10 | Makale sayfasında güncelleme tarihi gösterilmiyor | `magazine/articles/[slug]/page.tsx:89` |
| X11 | Dış kaldırma başvuruları sistemde kayıtlı değil | yalnızca e-posta; `content_reports` site içi bildirimler için |
| X12 | Ekip avatarı yayın rızası kaydı yok | `team_avatars` şemasında rıza alanı yok |
| X13 | Anonim kutu onayında metin sürümü/hash'i kaydedilmiyor | `services/anon-box.ts` |
| X14 | Spotify rıza kaydı ve geri alma yolu yok | `spotify-player.tsx` |
| X15 | Tasarımcı fikri hak belgesi yok (sözlü teyit var) | D-115 |
| X16 | Afiş/kapak görselleri için FSEK m. 35 görüşü alınmadı, görseller yayında | D-120 |
| X17 | BTK yer sağlayıcı bildirimi yapılmamış görünüyor | [V] — doğrulanması kurucuda |

## 5.3. Çelişkiler ve düzeltilmesi gereken maddeler

| # | Çelişki | Nerede | Hangisi doğru |
|---|---|---|---|
| Ç1 | Aydınlatma §8: "hesap ayarlarınızdan … makine tarafından okunabilir bir kopyasını indirebilir" | `data/kvkk-aydinlatma-metni.md` §8 vs `src/app/account/actions.ts` | **Kod doğru** — böyle bir özellik yok. Metin yayınlanmadan düzeltilmeli (Ü6) |
| Ç2 | `README.md`: "Okundu bilgisi yoktur" — ama D-188 ile okundu bilgisi ve tercihi eklendi; kullanım şartları ve aydınlatma metni okundu bilgisini anlatıyor | `README.md` (özel mesajlar bölümü) vs `social.ts:157`, `/kullanim-sartlari` | **Kod ve metinler doğru**, README eski |
| Ç3 | Künye "Tebligat adresi: Konak, İzmir" — D-154 tebligatın UETS'e alınmasına karar verdi, künye bunu yansıtmıyor | canlı `/kunye` vs D-154 | **Karar doğru, ekran geride.** Ayrıca ilçe adı 5651 anlamında adres değil (D-085 bunu kendisi kaydediyor) |
| Ç4 | Yazar sözleşmesi PDF Sayı ve e-bülten mecralarını kapsıyor; ikisi de yok, PDF sayı "Yapılmayacaklar"da | `contracts/…md` m. 4.2/4.3/9.3 vs `CLAUDE.md` | **Ürün doğru.** Sözleşme fazla yetki alıyor; zararsız ama yanıltıcı |
| Ç5 | Kullanım şartları m. 7 "kâr amacı gütmez" derken m. 11 tüketici haklarını saklı tutuyor | `/kullanim-sartlari` | İkisi de savunulabilir; muhafazakâr. Tutulmasında sakınca yok, ama tüketici sıfatı görüşüyle (#6) birlikte gözden geçirilmeli |
| Ç6 | Aydınlatma §6.2 aktarımın standart sözleşmeye dayandığını söylüyor | `data/…md` §6.2 vs fiilî durum | **Fiilî durum doğru** — sözleşme yok. Yayından önce ya sözleşme ya cümle değişir |
| Ç7 | `CLAUDE.md` yığını "Tailwind + shadcn/ui" diyor, bileşenler elle yazılmış | `CLAUDE.md` vs `src/components/ui.tsx` | Hukuki sonucu yok; `TEKNOLOJI-RAPORU.md` §5'te zaten kayıtlı |
| Ç8 | Kod içinde 119 `§` atfı var olmayan bir belgeye işaret ediyor (D-077) | `src/**` | Hukuki sonucu yok ama hukuki metin yazarken yanlış yere baktırır |

---

# 6. Uygulama planı

**Önemli çerçeve düzeltmesi:** Ürün **6 Eylül 2026'dan beri canlı** ve bütün özellikler
yayında (`main` = `origin/main` [D]). Bu yüzden "lansmandan önce" diye bir faz yok;
karşılığı **"Faz 0 — derhal: canlıda açık olan uyumsuzluklar"**. Bu bir sunum farkı
değil; risk sıralamasını değiştirir, çünkü bu kalemler gelecekte oluşacak riskler değil
**bugün işleyen** risklerdir.

Takvim geçicidir: ortaklığın aşaması, avukat erişimi ve kurucunun ayırabileceği zaman
bilinmiyor. Süreler **kurucunun kendi işi** ile **avukat/üçüncü taraf bekleme süresi**
ayrı gösterildi.

## Faz 0 — Derhal (hedef: 1 hafta içinde kurucu işi tamamlanır)

| # | İş | Sorumlu | Bağımlılık | İş yükü | Tamamlanma kriteri |
|---|---|---|---|---|---|
| 0.1 | `CRON_SECRET` doğrula / ekle, `housekeeping`'i bir kez elle çalıştır | Kurucu | — | 30 dk | Cron çalışmasının Vercel'de "success" göründüğü ve çıktının kaydedildiği |
| 0.2 | Adres/KEP kararı: açık adres mi, KEP mi, ikisi mi | Kurucu | — | 1 gün (karar) | `site_settings` ve metin için tek bir değer yazılı hâle geldi |
| 0.3 | Aydınlatma §8'deki self-servis indirme cümlesini düzelt (veya özelliği yaz) | Geliştirme | — | 15 dk (düzeltme) / 1 gün (özellik) | Metindeki her cümlenin koddaki bir karşılığı var |
| 0.4 | Aydınlatma §6.2'yi fiilî duruma çek **veya** 0.6'yı bekle | Kurucu + avukat | 0.6 | 30 dk | §6.2 ile gerçek durum arasında fark yok |
| 0.5 | **Tam metni yeni sürüm olarak yayınla** | Kurucu (panel) | 0.2, 0.3, 0.4 | 30 dk | `/kvkk` sürüm ≥ 2 ve Spotify/Cloudflare/Resend/Vercel/Neon/çerez/iletişim formu satırları canlıda |
| 0.6 | Standart sözleşme sürecini başlat (4 sağlayıcı) | Kurucu + avukat | avukat | 2–4 hafta (bekleme) | İmzalı sözleşmeler + 5 iş günü içinde Kuruma bildirim kaydı |
| 0.7 | `agreement_versions.kind` migration'ı | Geliştirme | — | 0,5 gün | Migration üretildi, testler geçti, üretime **snapshot alınarak** uygulandı (D-079) |
| 0.8 | Kayıtta yaş alt sınırı (karar + kod) | Kurucu + geliştirme | K4 | 1 gün | Sınır altı kayıt sunucu tarafında reddediliyor, e2e testi var |
| 0.9 | Avukata ilk soru setini gönder (§7.2 #1–#5) | Kurucu | — | 2 saat | Sorular yazılı gönderildi |

**Faz 0'ı bloke eden tek şey:** 0.2 (adres/KEP kararı). Diğer her şey ona paralel yürür.

## Faz 1 — İlk 30 gün

| # | İş | Sorumlu | Bağımlılık | İş yükü | Tamamlanma kriteri |
|---|---|---|---|---|---|
| 1.1 | Editör gizlilik ve veri işleme taahhüdü (B10): metin + panel akışı | Avukat + geliştirme | 0.7 | 1 gün kod + görüş | 6 editörün ve 2 yöneticinin onayı kayıtlı, onaysız panel kilitli |
| 1.2 | Çizer sözleşmesi + çizim onayı (B9) | Avukat + geliştirme | 0.7 | 2 gün kod + görüş | 4 çizerin onayı kayıtlı; onaysız çizim yayınlanamıyor |
| 1.3 | Künyeye adres/KEP + telefon + e-tebligat alanları | Geliştirme + kurucu | 0.2 | 0,5 gün | Künyede admin uyarısı kalmadı |
| 1.4 | Makalelerde ilk yayın + güncelleme tarihi | Geliştirme | — | 0,5 gün | Her yayınlanmış yazıda iki tarih görünüyor |
| 1.5 | Dış kaldırma başvurularının kaydı ve 24 saat sayacı (Ü11) | Geliştirme | — | 1 gün | Başvuru → kayıt → cevap süresi raporlanabiliyor |
| 1.6 | Ekip avatarı yayın rızası (Ü7) | Geliştirme | — | 0,5 gün | Rıza kutusu, kaydı ve geri alma var |
| 1.7 | Anonim kutu onayında sürüm + hash (Ü8) | Geliştirme | — | 0,5 gün | Onay kaydı hangi metnin kabul edildiğini gösteriyor |
| 1.8 | Adi ortaklık sözleşmesi (B12) | Avukat + ortaklar | E6 | görüş + 1 gün | İki ortak imzaladı; temsil yetkisi yazar sözleşmesindeki beyanla uyumlu |
| 1.9 | Tasarımcı fikri hak belgesi (B13) | Avukat + kurucu | E7 | görüş + 1 gün | İmzalı; kullanılan üçüncü taraf görseller listelendi |
| 1.10 | Afiş/kapak görselleri kararı (#4 sonucu) | Kurucu | avukat | 0,5 gün | Görseller ya kaldı ya kaldırıldı ya lisanslıyla değişti; karar `DECISIONS.md`'de |
| 1.11 | BTK yer sağlayıcı bildirimi (#2 "evet" ise) | Kurucu | avukat | 1 saat | e-Devlet üzerinden bildirim tamamlandı |
| 1.12 | Kullanım şartlarının yaş, yetki ve tüketici kayıtlarının güncellenmesi | Avukat + geliştirme | #5, #6, #8 | 0,5 gün | Metin koda ve görüşe uygun |
| 1.13 | Spotify kararı (#3 sonucu): rıza kaydı mı, bağlantıya dönüş mü | Kurucu + geliştirme | avukat | 0,5 gün | Karar uygulandı ve aydınlatma metni buna uygun |
| 1.14 | 18 altı üyelerin topluluk yetkileri (K4 sonucu) | Geliştirme | 0.8 | 1 gün | Sunucu tarafında uygulanıyor, testi var |

## Faz 2 — Sonraki aşama (lansmanı engellemeyen iyileştirmeler)

| # | İş | Sorumlu | İş yükü | Tamamlanma kriteri |
|---|---|---|---|---|
| 2.1 | Hukuki yapı kararı: adi ortaklık mı, dernek mi (K1) | Kurucu + avukat/mali müşavir | 1–2 hafta değerlendirme | Karar ve gerekçesi `DECISIONS.md`'de |
| 2.2 | Marka: 16/41. sınıf benzerlik araştırması, sonra tescil kararı | Marka vekili | 1–2 hafta | Araştırma raporu; tescil kararı |
| 2.3 | Kullanım şartlarının sürümlenmesi ve kabul kaydı (Ü14) | Geliştirme | 1 gün | Hangi üyenin hangi sürümü kabul ettiği görülüyor |
| 2.4 | Tek `consents` tablosu / rıza envanteri (Ü16) | Geliştirme | 1–2 gün | Bütün rızalar tek yerden raporlanabiliyor |
| 2.5 | Yazar sözleşmesi v2: IP1–IP3 düzeltmeleri | Avukat + geliştirme | görüş + 0,5 gün | Yeni sürüm yayınlandı, yazarlar yeniden onayladı |
| 2.6 | Yazılım lisansı envanteri (Ü17) | Geliştirme | 1 saat | Çıktı depoda |
| 2.7 | Veri işleme envanteri (kişisel veri işleme kayıt tablosu) | Kurucu | 1 gün | VERBİS'e kayıt gerekmese de iç envanter var (İ) |
| 2.8 | E-bülten kararı; kurulacaksa opt-in + 6563/İYS değerlendirmesi | Kurucu + avukat | — | Karar `DECISIONS.md`'de |
| 2.9 | Gelir modeli değerlendirmesi (bağış/sponsorluk) ve doğuracağı yükümlülükler | Kurucu + mali müşavir | — | Karar ve etki analizi yazılı |
| 2.10 | `README.md` ve `CLAUDE.md`'deki eski beyanların düzeltilmesi (Ç2, Ç7, Ç8) | Geliştirme | 2 saat | Belgeler koda uyuyor |

## 6.1. Lansmanı engelleyen / engellemeyen ayrımı

Ürün canlı olduğu için "engelleyen" yerine **"canlıda açık risk"** okunmalı:

**Bugün açık ve kapatılması gereken (Faz 0):** aydınlatma metninin yayını, aktarım
mekanizması, cron, yaş sınırı, sözleşme altyapısı migration'ı, metindeki yanlış cümle.

**Sonradan tamamlanabilir (Faz 1–2):** ortaklık sözleşmesi, marka, kullanım şartlarının
sürümlenmesi, rıza envanteri, tasarımcı belgesi, 5187 kalemleri (görüşe bağlı), gelir
modeli hazırlığı.

---

# 7. Kararlar ve açık sorular

## 7.1. Kurucunun vermesi gereken kararlar

Planı en çok değiştirenler önce.

| # | Karar | Neden şimdi | Seçenekler ve sonuçları |
|---|---|---|---|
| **K1** | **Tebligat ve başvuru adresi: açık adres, KEP, yoksa ikisi birden?** | Hazır bir metnin yayınını, künyeyi ve iki kanunu birden bloke ediyor. **Tek en yüksek etkili karar.** | (a) Ev adresi → yayımlanır, gizlilik kaybı; (b) **KEP + UETS** → fiziksel adres yayımlanmaz, D-154'ün önerdiği yol, aydınlatmada yazılı başvuru yolunu karşılayıp karşılamadığı avukat sorusu #10; (c) sanal ofis/işyeri adresi → ek maliyet, 5187 "işyeri adresi" alanını da karşılar |
| **K2** | **Hukuki yapı: adi ortaklık devam mı, dernek mi?** | Sorumluluk sınırsız; bağış/sponsorluk düşünülüyorsa yapı önce gelir | (a) Adi ortaklık + yazılı sözleşme → hızlı, ucuz, sınırsız sorumluluk; (b) Dernek → tüzel kişilik, sınırlı sorumluluk, bağış ehliyeti, karşılığında defter/genel kurul/denetim yükü |
| **K3** | **Spotify çaları kalsın mı?** | Aktarım dayanağı zayıf; alternatif bir satırlık | (a) Kalsın + rıza kaydı + görüş; (b) **Gömme kaldırılsın, "Spotify'da dinle" bağlantısı** → aktarım tamamen ortadan kalkar, çalma listesi kaybolmaz |
| **K4** | **Kayıtta yaş alt sınırı kaç? 18 altı üye ne yapabilir?** | Bugün sınır yok; küçükler herkese açık paylaşım yapabiliyor | (a) 18+ zorunlu → en basit ve en güvenli, okur kitlesini daraltır; (b) alt sınır (örn. 13/16) + veli onayı + kısıtlı topluluk yetkisi → daha kapsayıcı, daha karmaşık; (c) mevcut durum → tavsiye edilmiyor |
| **K5** | **Görseller: afiş ve kapak görselleri kalsın mı?** | Canlıda ve hak sahipleri belirli | (a) Görüş gelene kadar kalsın (mevcut durum); (b) **şimdi kaldırılıp metin bırakılsın** → risk sıfırlanır, tasarımdan sapılır; (c) lisanslı görselle değiştirilsin |
| **K6** | **Editörlerle ve çizerlerle imzalı belge düzenine geçilsin mi?** | Panel kilidi düzeni kurulacaksa ekibe önceden söylenmeli | (a) Evet, yazarlarla aynı düzen (önerilen); (b) yalnızca e-posta ile teyit → ispat zayıf |
| **K7** | **E-bülten kurulacak mı?** | Yazar sözleşmesi mecra olarak sayıyor ama yok | (a) Kurulmayacak → sözleşmeden çıkar; (b) kurulacak → opt-in + 6563 değerlendirmesi |
| **K8** | **Gelir modeli (bağış/sponsorluk) düşünülüyor mu?** | Cevap "evet" ise vergi, tüketici, İYS, ETBİS başlıkları açılır ve plan büyür | (a) Hayır (mevcut varsayım); (b) evet → K2 ile birlikte karara bağlanmalı |
| **K9** | **Marka tescili yapılacak mı?** | Ad ve logo kullanımı arttıkça maliyet artar | (a) Önce benzerlik araştırması (önerilen); (b) doğrudan başvuru; (c) yapılmasın |

## 7.2. Avukata yöneltilecek sorular

Planı en çok değiştirenler önce. Her soruya, sorunun neden sorulduğunu gösteren
bağlam eklendi; avukatın koda bakması gerekmez.

**En kritik dört soru (cevabı planı değiştirir):**

1. **Postscript, 5187 sayılı Kanun anlamında "internet haber sitesi" midir?**
   Ayda iki sayı çıkan, kültür-sanat ağırlıklı **yorum** içeriği yayımlayan, kâr amacı
   gütmeyen, ücretsiz bir e-dergi. Cevap "evet" ise beyanname, sorumlu müdür, genişletilmiş
   künye (telefon + elektronik tebligat + yer sağlayıcı adresi), her içerikte ilk yayın ve
   güncelleme tarihi ve 2 yıllık içerik saklama gündeme gelir. **Etkisi: plana 4–6 kalem.**
2. **Yurt dışına aktarımda hangi güvence yolu izlenmeli ve Spotify çaları bu çerçevede
   nasıl konumlanır?** Barındırma (Vercel/Almanya), veritabanı (Neon/Almanya), depolama
   (Cloudflare R2/AB) ve e-posta (Resend/Japonya) sürekli aktarım; Spotify çaları ise
   okurun tarayıcısından doğrudan, her tıklamada yeniden gerçekleşiyor. (a) Dört sağlayıcı
   için standart sözleşme + 5 iş günü bildirim doğru yol mu? (b) Spotify aktarımı "arızi"
   sayılabilir mi, yoksa açık rıza dayanağı geçersiz mi? (c) Gömülü içerikte **ortak veri
   sorumluluğu** doğar mı? **Etkisi: metnin yayınlanabilirliği ve çaların kaderi.**
3. **BTK'ya yer sağlayıcı bildirimi yapılmalı mı?** Dergi kendi okurlarının yorum,
   gönderi, sohbet, özel mesaj ve anonim mesajlarını barındırıyor; hosting hizmeti
   satmıyor. 5651 m. 5 kapsamındaki bildirim yükümlülüğü, "ticari veya ekonomik amaçlı"
   olmayan bir yayıncıyı da kapsar mı? **Etkisi: yapılacak/yapılmayacak bir formalite.**
4. **Ana sayfadaki kartlarda film afişi ve kitap kapağının tam hâlde kullanımı FSEK m. 35
   iktibas serbestisi içinde midir?** Görseller *Black Swan* ve *You* afişleri ile
   *Masumiyet Müzesi* kapağı; eseri tanıtan ve değerlendiren metinlerle birlikte
   kullanılıyor, ticari kullanım yok. **Etkisi: canlıdaki üç görselin kalıp kalmayacağı.**

**Devamı:**

5. **Reşit olmayan üyelerle üyelik sözleşmesi ve veri işleme.** 18 yaş altı okur
   olabiliyor, kullanıcı adı alıp herkese açık gönderi paylaşabiliyor; özel mesaj ve
   anonim kutu 18+ ile sınırlı. (a) Bir alt yaş sınırı konmalı mı, kaç? (b) Veli/vasi
   onayı hangi işlemler için aranmalı ve nasıl ispatlanmalı? (c) 18 altı için hangi
   topluluk yetkileri kapatılmalı?
6. **Bedelsiz ve kâr amacı gütmeyen bir üyelikte kullanıcı "tüketici" sayılır mı?**
   Kullanım şartları m. 11 tüketici haklarını saklı tutuyor; bu ifade yerinde mi, yoksa
   yanlış bir beklenti mi yaratıyor?
7. **GDPR yer bakımından uygulanır mı?** Site Türkçe, ödeme yok, AB'ye yönelme yok; ancak
   veriler fiilen AB'deki sunucularda (Frankfurt) işleniyor. İşleyicinin AB'de olması veri
   sorumlusunu GDPR'a tabi kılar mı? AB'de yaşayan Türkçe konuşan okurlar sonucu değiştirir
   mi?
8. **Yetki sözleşmesi kayıtları.** Kullanım şartları m. 11 ve yazar sözleşmesi m. 15
   belirli mahkemeleri yetkili kılıyor. Taraflar tacir olmadığına göre HMK m. 17 karşısında
   bu kayıtlar geçerli mi; geçersizse metinden çıkarılmalı mı?
9. **Adi ortaklığın taraf gösterilmesi ve temsil.** Yazar sözleşmesi "ortaklardan her biri
   tek başına temsile yetkilidir" diyor. Yazılı ortaklık sözleşmesi olmadan bu beyan
   bağlayıcı mı? Tek ortağın imzasıyla kurulan sözleşme diğer ortağı da bağlar mı?
10. **KEP + UETS + e-posta üçlüsü yeterli mi?** Veri Sorumlusuna Başvuru Usul ve Esasları
    Tebliği'ndeki yazılı başvuru yolu için fiziksel adres yerine KEP gösterilebilir mi;
    aydınlatma metninden "ıslak imzalı dilekçe ile [adres]" satırı çıkarılabilir mi?
    (D-154'te açık bırakılmış.)
11. **Anonim kutuda yayımlanan metinlerde sorumluluk.** Dergi bu metinleri seçip
    yayımladığında **içerik sağlayıcı** olarak sorumlu olur. Yayın öncesi kişi adlarının
    çıkarılması ve tanınır ayrıntıların silinmesi yeterli bir özen midir? Yazılı bir
    editoryal süzgeç kuralı önerilir mi?
12. **Editör ve çizerlerin gönüllü statüsü.** Bu ilişkinin iş sözleşmesi sayılma riski var
    mı (süreklilik, talimat, panel üzerinden görev atama)? Gizlilik taahhüdüne cezai şart
    konulabilir mi?
13. **Hesap silmede saklanan kayıtlar.** İmzalı eser onayları, sözleşme kayıtları ve
    trafik kayıtları KVKK m. 7 karşısında hangi dayanakla ve ne kadar saklanabilir?
    Metindeki 10 yıl (TBK m. 146) ve 1 yıl (5651 m. 5) süreleri doğru mu?
14. **Aydınlatma metninin sürümlenmesi ve "okudum" kaydı.** Yeni sürümde mevcut
    kullanıcılara bant gösterilip onay istenmemesi (yalnızca bilgilendirme) doğru
    yaklaşım mı?
15. **Marka.** "Postscript" adı ve logo için 16 ve 41. sınıflarda tescil önerilir mi;
    aynı/benzer adın başka sınıflardaki tescilleri dergi yayıncılığı için risk yaratır mı?

---

# 8. Önceliklendirilmiş tek iş listesi

Sırayla yapılacak. "Bloke" işareti, kendisi bitmeden sonraki hukuki adımın anlamsız
kaldığını gösterir.

| Sıra | İş | Sorumlu | Öncelik | Not |
|---|---|---|---|---|
| 1 | Vercel'de `CRON_SECRET` doğrula/ekle; `housekeeping`'i bir kez çalıştır | Kurucu | P0 | 30 dk; metindeki bütün saklama süreleri buna bağlı |
| 2 | **Adres/KEP kararını ver (K1)** | Kurucu | P0 | **Bloke** — 3, 6, 9 numaralı işleri açar |
| 3 | Aydınlatma §8 (self-servis indirme) ve §6.2 (aktarım) cümlelerini fiilî duruma çek | Geliştirme | P0 | Ç1, Ç6 |
| 4 | Avukata soru seti #1–#5'i gönder | Kurucu | P0 | Bekleme süresi erken başlasın |
| 5 | `agreement_versions.kind` migration'ı (üretimde snapshot alarak) | Geliştirme | P0 | **Bloke** — 10 ve 11'i açar |
| 6 | **KVKK tam metnini yeni sürüm olarak yayınla** | Kurucu | P0 | 2 ve 3'e bağlı; en yüksek fayda |
| 7 | Yaş alt sınırı kararı (K4) + sunucu tarafında uygulanması | Kurucu + geliştirme | P0 | R7 |
| 8 | Yurt dışı aktarım standart sözleşmelerini başlat (4 sağlayıcı) + 5 iş günü bildirim | Kurucu + avukat | P0 | 2–4 hafta bekleme; #2'ye bağlı |
| 9 | Künyeye adres/KEP, telefon, elektronik tebligat alanları | Geliştirme + kurucu | P0 | 2'ye bağlı |
| 10 | Editör gizlilik ve veri işleme taahhüdü + panel akışı | Avukat + geliştirme | P0 | 5'e bağlı |
| 11 | Çizer sözleşmesi + çizim onayı akışı | Avukat + geliştirme | P0 | 5'e bağlı |
| 12 | Makalelerde ilk yayın + güncelleme tarihi | Geliştirme | P1 | Ü9; #1'den bağımsız olarak iyi uygulama |
| 13 | Dış kaldırma başvurularının kaydı ve 24 saat sayacı | Geliştirme | P1 | Ü11 |
| 14 | Ekip avatarı yayın rızası (kutu + kayıt + geri alma) | Geliştirme | P1 | Ü7 |
| 15 | Anonim kutu onayında metin sürümü + hash | Geliştirme | P1 | Ü8 |
| 16 | Afiş/kapak görselleri kararı (#4 sonucu) | Kurucu | P1 | K5 |
| 17 | BTK yer sağlayıcı bildirimi (#3 "evet" ise) | Kurucu | P1 | 1 saat |
| 18 | Adi ortaklık sözleşmesi | Avukat + ortaklar | P1 | #9 |
| 19 | Tasarımcı fikri hak belgesi | Avukat + kurucu | P1 | B13 |
| 20 | Spotify kararı ve uygulanması (K3, #2b) | Kurucu + geliştirme | P1 | Aydınlatma metniyle uyumlu kalmalı |
| 21 | Kullanım şartlarının güncellenmesi (yaş, yetki, tüketici) | Avukat + geliştirme | P1 | #5, #6, #8 |
| 22 | 18 altı üyelerin topluluk yetkileri | Geliştirme | P1 | 7'ye bağlı |
| 23 | 5187 kalemleri (beyanname, sorumlu müdür, künye) — #1 "evet" ise | Kurucu + avukat | P1/P2 | #1'e bağlı |
| 24 | Hukuki yapı kararı: adi ortaklık / dernek (K2) | Kurucu + avukat | P2 | Gelir modeliyle birlikte |
| 25 | Marka benzerlik araştırması, sonra tescil kararı | Marka vekili | P2 | K9 |
| 26 | Kullanım şartlarının sürümlenmesi ve kabul kaydı | Geliştirme | P2 | Ü14 |
| 27 | Tek rıza envanteri (`consents`) | Geliştirme | P2 | Ü16 |
| 28 | Yazar sözleşmesi v2 (IP1–IP3) | Avukat + geliştirme | P2 | Yeni sürüm tüm yazarlarda yeniden onay ister |
| 29 | Veri işleme envanteri (iç kayıt) | Kurucu | P2 | VERBİS gerekmese de iyi uygulama |
| 30 | Yazılım lisansı envanteri; `README`/`CLAUDE.md` düzeltmeleri (Ç2, Ç7, Ç8) | Geliştirme | P2 | Temizlik |

---

# 9. Kaynaklar ve yöntem notu

**Araştırma tarihi: 22 Eylül 2026.** Aşağıdaki bağlantılar bu tarihte açıldı. Erişilen
resmî kaynaklar ile ikincil kaynaklar ayrı işaretlendi; hiçbir kaynağın güncelliği,
açılmadığı hâlde doğrulanmış gibi gösterilmedi.

**Resmî kaynaklar (bu oturumda erişildi):**

- Kişisel Verileri Koruma Kurumu — [Standart Sözleşme Bildirim Modülü Hakkında Kamuoyu Duyurusu](https://www.kvkk.gov.tr/Icerik/8043/Standart-Sozlesme-Bildirim-Modulu-Hakkinda-Kamuoyu-Duyurusu)
- Kişisel Verileri Koruma Kurumu — [Yurt Dışına Kişisel Veri Aktarımında Kullanılacak Standart Sözleşmelerde Dikkat Edilmesi Gereken Hususlar](https://www.kvkk.gov.tr/Icerik/8170/Yurt-Disina-Kisisel-Veri-Aktariminda-Kullanilacak-Standart-Sozlesmelerde-Dikkat-Edilmesi-Gereken-Hususlara-Iliskin-Kamuoyu-Duyurusu)
- Kişisel Verileri Koruma Kurumu — [Kişisel Verilerin Yurt Dışına Aktarılması Rehberi (Yayın No. 48)](https://www.kvkk.gov.tr/Icerik/8142/Kisisel-Verilerin-Yurt-Disina-Aktarilmasi-Rehberi) ve [Yurt Dışına Aktarım sayfası](https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim)
- Kişisel Verileri Koruma Kurumu — [Çerez Uygulamaları Hakkında Rehber (PDF)](https://www.kvkk.gov.tr/SharedFolderServer/CMSFiles/fb193dbb-b159-4221-8a7b-3addc083d33f.pdf)
- Kişisel Verileri Koruma Kurulu — [23.12.2022 tarihli 2022/1358 sayılı karar özeti (çerez aydınlatma ve açık rıza metinlerinin sunulmaması)](https://www.kvkk.gov.tr/Icerik/7595/2022-1358)
- Kişisel Verileri Koruma Kurumu — [VERBİS istisna kriterinde değişiklik kamuoyu duyurusu](https://www.kvkk.gov.tr/Icerik/7646/Kamuoyu-Duyurusu-Veri-Sorumlulari-Siciline-Kayit-Yukumlulugune-Iliskin-Istisna-Kriterinde-Degisiklik-Yapilmasi-Hakkinda-)
- Kişisel Verileri Koruma Kurumu — [Çocukların Kişisel Verilerinin Korunması Bakımından Dikkat Edilmesi Gerekenler](https://www.kvkk.gov.tr/Icerik/6737/Cocuklarin-Kisisel-Verilerinin-Korunmasi-Bakimindan-Dikkat-Edilmesi-Gerekenler)
- BTK — [Yer Sağlayıcılığı Bildirim Arayüzü](https://yersaglayici.btk.gov.tr/) ve [Yer Sağlayıcılık Bildiriminde Bulunanlar listesi](https://internet.btk.gov.tr/yer-saglayici-listesi)
- EDPB — [Guidelines 3/2018 on the territorial scope of the GDPR (Article 3)](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf) *(belge indirildi, ilgili paragraf metin olarak açılamadı — çerçeve olarak kullanıldı, tek cümle alıntı yapılmadı)*

**İkincil kaynaklar (kanun metinlerine erişilemediği için kullanıldı):**

- 6698/7499 değişikliği ve kademeli aktarım sistemi: [Güneş Partners](https://www.gunespartners.com/makale/yurt-disina-veri-aktarimi-7499-sayili-kanun), [GSG Hukuk](https://www.gsghukuk.com/tr/bultenler-yayinlar/duyurular/kisisel-verilerin-yurt-disina-aktarilmasina-iliskin-usul-ve-esaslar-hakkinda-yonetmelik-yururluge-girdi.html)
- VERBİS istisna eşiği (2023/1154): [Erdem&Erdem](https://www.erdem-erdem.av.tr/bilgi-bankasi/verbis-kayit-yukumlulugune-iliskin-istisna-kriteri-degistirildi)
- 5651 yer sağlayıcı bildirimi, trafik saklama süresi (1–2 yıl) ve "ticari veya ekonomik amaçlı" kaydı: [Universal Hukuk](https://www.universalhukuk.com/yer-saglayici-ile-icerik-saglayici-kavramlari-ve-yukumlulukleri), [GRC Legal — Sağlayıcılar (PDF)](https://www.grc-legal.com/wp-content/uploads/2024/04/Saglayicilar.pdf)
- 5187/7418 internet haber sitesi tanımı, künye, beyanname, sorumlu müdür, 2 yıl saklama: [Ozay Law](https://ozay.av.tr/publication/7418-sayili-basin-kanunu-ile-bazi-kanunlarda-degisiklik-yapilmasina-dair-kanun-ile-getirilen-degisiklikler), [Jurix](https://www.jurix.com.tr/article/34579?u=0&c=0)
- 6563/İYS kapsamı ve ticari elektronik ileti tanımı: [Güneş Partners — İYS](https://www.gunespartners.com/makale/iys-nedir)

**Yöntem ve sınırlar:**

- **`mevzuat.gov.tr` bu oturumda açılamadı** (TLS sertifika doğrulama hatası). Bu nedenle
  **6698, 5651, 5187, 5846, 6098 ve 6563 sayılı kanunların resmî metinleri doğrudan
  okunamadı.** Bu kanunlara ilişkin madde içerikleri yukarıdaki resmî kurum
  duyuruları/rehberleri ile ikincil kaynaklardan alındı. Nihai metin kontrolü avukat
  tarafından resmî metin üzerinden yapılmalıdır.
- Ürün tarafındaki her olgu koddan, şemadan, `DECISIONS.md`'den veya canlı sayfadan
  okundu. Canlı doğrulamalar: `postscriptmag.com/kvkk` ve `/kunye` (22 Eylül 2026).
- Erişilemeyen hiçbir belge incelenmiş gibi gösterilmedi (bkz. §5 giriş paragrafı).
- Kesinleşmemiş konular **[S]** ile işaretlendi ve plana koşullu olarak bağlandı.

---

<p align="center">
  <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">Designed by Elif Yaren Çekiç</a>
</p>
