# Yazar sözleşmeleri ve eser izinleri — uygulama planı

**Tarih:** 22 Eylül 2026 · **Durum:** taslak süreç önerisi, avukat onayına tabi
**İlgili taslaklar:** `yazar-sozlesmesi-ve-ruhsat-taahhudu-v2-TASLAK.md`,
`eser-bazli-yayin-izni-ve-son-metin-onayi-TASLAK.md`

> Bu plan **panel geliştirmesini ön koşul saymaz.** Aşağıdaki adımların tamamı,
> bugünkü panel ve e-posta ile yürütülebilir. Panel iyileştirmeleri §6'da ayrı
> tutuldu; hiçbiri belgelerin hazırlanmasını veya imzalanmasını beklemez.

---

## 1. Doğru sıra

Her eser için sıra **değişmez**:

```
1. ÇERÇEVE SÖZLEŞME        Yazar, sürüm 2'yi imzalar (ıslak veya e-imza)
        ↓                   → bir kez; her eser için tekrarlanmaz
2. SON METİN DONDURMA      Editör metni son hâle getirir, başka düzenleme yapmaz
        ↓                   → sürüm no + SHA-256 özeti sabitlenir
3. ESER İZNİ               Belge doldurulur, EK-1'e son metin konur, Yazar imzalar
        ↓                   → her eser için ayrı
4. İMZALI KOPYA ULAŞIR     Dergi belgeyi teslim alır ve arşivler
        ↓
5. YAYIN                   Editör eseri yayımlar
```

**İki kural:**

- **Adım 1 olmadan adım 3 olmaz.** Çerçeve sözleşmeyi imzalamamış bir yazardan
  eser izni istenmez; izin belgesi dayanak sözleşmeye atıf yapıyor.
- **Adım 4 olmadan adım 5 olmaz.** Eserin teslim edilmiş, panelde "kabul edildi"
  görünmesi veya bir sayıya yerleştirilmiş olması yayın izni değildir.

**Adım 2 neden ayrı bir adım:** Bugün paneldeki onay ekranı yazara yalnızca
metnin SHA-256 özetini gösteriyor, metni göstermiyor
(`src/app/writer/approvals/approval-row.tsx`). İmza atılacak belgede metnin
kendisi EK-1 olarak yer alacağı için metnin **imzadan önce dondurulması**
gerekiyor. Adım 3 başladıktan sonra yapılan her esaslı değişiklik belgeyi
hükümsüz kılar ve baştan imza gerektirir.

---

## 2. Yazar grupları ve her biri için işlem

### Grup A — Sürüm 1'i panelde onaylamış aktif yazarlar

**Kim:** 20 Eylül 2026 itibarıyla **29 yazar**, hepsi "Aktif"
(`panel/TEKNOLOJI-RAPORU.md` §7). Bu hesaplar yazar terfisi sırasında sürüm 1'i
panelde onay kutusuyla kabul etmiş; onay kaydı, metin özeti, tarih ve IP
`agreement_acceptances` tablosunda duruyor.

**İşlem:**

1. Yazarlara duyuru + `yazarlara-mesaj.md`'deki mesaj gönderilir (henüz sürüm 2
   yayınlanmadan).
2. Sürüm 2, admin "Sistem" sayfasından yayınlanır.
3. Her yazar sürüm 2'yi **hem** panelde onaylar (delil kaydı + panel kilidinin
   açılması için) **hem** imzalı kopyasını gönderir.
4. İmzalı kopya ulaşana kadar o yazardan eser izni istenmez.

> **Zamanlamayı bilerek yapın:** Sürüm 2 yayınlandığı anda **29 aktif yazarın
> tamamı `pending_agreement` durumuna düşer ve yazar panelleri kilitlenir**;
> yeni sürümü onaylayana kadar bekleyen eser onaylarını da veremezler
> (`panel/README.md`, e2e senaryosu; `src/app/writer/approvals/page.tsx:40`).
> Bu beklenen davranıştır, arıza değil — ama önce haber vermezseniz 29 kişi aynı
> anda kilitli panelle karşılaşır. **Bu yüzden mesaj sürümden önce gider.**

### Grup B — Henüz sözleşme kabul etmemişler

**Kim:** Yazar olmayan kayıtlı hesaplar (20 Eylül itibarıyla 4 rolsüz hesap) ve
bundan sonra yazar olacaklar.

**İşlem:** Mevcut akış korunur — yazar terfisi zaten yayınlanmış bir sözleşme
sürümünün onayını şart koşuyor. Buna **imzalı kopya** eklenir:

1. Terfi/başvuru akışı tamamlanır, sürüm 2 panelde onaylanır.
2. İmzalı kopya gönderilir.
3. İkisi tamamlanmadan yazara eser atanmaz.

### Grup C — Yayımlanmış yazılar

**Doğrulanan durum (22 Eylül 2026):** `https://www.postscriptmag.com/api/public/issues`
**boş dönüyor** (`{"issues":[]}`) — yani herkese açık yayında **hiçbir sayı ve
dolayısıyla hiçbir yazı yok.** D-110'da canlıdaki iki yazı yumuşak silinmiş.

**Bunun anlamı:** Ruhsat zinciri, ilk yayından **önce** tamamlanabilir. Bu, bu
işin en büyük şansı: geçmişi düzeltmek yerine doğru sırayı baştan kurmak
mümkün.

**Yine de kontrol edilmesi gereken (canlı veritabanı okunamadı, izin sistemi
üretim okumalarını reddediyor):** Editör panelinden `/editor/articles` açılıp
durumu `published`, `scheduled` veya `archived` olan makale var mı bakılır.

- **Yoksa:** Grup C boştur, yapılacak bir şey yok.
- **Varsa,** her biri için iki seçenek:
  - **(a) Muhafazakâr:** Eser yayından geri çekilir, imzalı eser izni alınır,
    sonra yeniden yayımlanır.
  - **(b) Hızlı:** Eser yayında kalır, imzalı eser izni **bugünün tarihiyle**
    alınır ve belgeye, eserin daha önce yayımlandığını teyit eden bir satır
    eklenir. **Geriye dönük tarihli belge düzenlenmez.**
  - Hangisinin seçileceği avukata sorulacak (§5, soru 5). Görüş gelene kadar
    muhafazakâr olan (a) uygulanır.

---

## 3. Adım adım işletme usulü (panel geliştirmesi olmadan)

### 3.1. Çerçeve sözleşme (bir kez, yazar başına)

| # | Kim | Ne yapar |
|---|---|---|
| 1 | Kurucu | `{{dergi.adres}}` değerine karar verir ve `/admin/settings`'e yazar. Bu olmadan sözleşme eksik adresle imzalanır |
| 2 | Kurucu | v2 taslağındaki "TASLAK NOTU" bloğunu siler, metni `panel/contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` üzerine yazar |
| 3 | Kurucu | Yazarlara `yazarlara-mesaj.md`'deki mesajı gönderir (panel duyurusu + e-posta) |
| 4 | Kurucu | `/admin/agreements` → "şablondan sürüm oluştur" → sürüm 2 yayınlanır |
| 5 | Yazar | Panelde sürüm 2'yi okur ve onaylar → panel kilidi açılır, delil kaydı ve PDF oluşur |
| 6 | Yazar | Panelin ürettiği PDF'i indirir, imzalar (ıslak veya e-imza), Dergi'ye e-posta ile gönderir |
| 7 | Kurucu | İmzalı kopyayı arşive koyar, takip tablosuna işler |

**Not:** 6. adımda panelin ürettiği PDF kullanılabilir; içeriği imzalanacak metinle
aynıdır ve metin özetini (SHA-256) taşır. Ayrı bir belge hazırlamak gerekmez.

### 3.2. Eser izni (her yazı için)

| # | Kim | Ne yapar |
|---|---|---|
| 1 | Editör | Metni son hâle getirir ve **düzenlemeyi durdurur** |
| 2 | Editör | Makaleyi "kabul edildi" olarak işaretler → panel Eser Onayı kaydını açar ve yazara bildirim gider |
| 3 | Editör | Panelden değerleri okur: başlık, sürüm no, SHA-256 özeti, görsel sayısı ve lisansları, sözleşme sürümü ve özeti |
| 4 | Editör | `eser-bazli-yayin-izni-ve-son-metin-onayi-TASLAK.md`'yi doldurur, **EK-1'e son metni koyar**, PDF'e çevirir |
| 5 | Editör | Belgeyi yazara e-posta ile gönderir |
| 6 | Yazar | EK-1'i okur, ad/mahlas tercihini ve varsa ek izin kutusunu işaretler, imzalar, geri gönderir |
| 7 | Yazar | Ayrıca panelde Eser Onayı'nı verir (delil kaydı + panelin durum makinesinin ilerlemesi için) |
| 8 | Editör | İmzalı kopyayı arşive koyar, takip tablosuna işler |
| 9 | Editör | Eseri yayımlar |

**7. adım neden gerekli:** Panelin durum makinesi, onaylanmış bir Eser Onayı
olmadan makaleyi `scheduled`/`published` yapmıyor — bu bir güvenlik kuralı ve
değiştirilmiyor. Yani panel onayı **teknik ön koşul**, imzalı belge **hukuki
dayanak**. İkisi birbirinin yerine geçmez.

**Metin 5. adımdan sonra değişirse:** Belge hükümsüzdür. Editör metni düzeltir,
3. adımdan yeniden başlar; panel tarafında da onay iptal olur ve yenisi açılır
(esaslı değişiklik kaydedildiğinde panel bunu kendiliğinden yapıyor).

### 3.3. İmzalı belgelerin arşivlenmesi

- İmzalı PDF'ler tek bir yerde, yazar adı ve eser başlığıyla adlandırılarak
  tutulur: `yazar-<ad>-sozlesme-v2.pdf`, `eser-izni-<eser-slug>-<yazar>.pdf`.
- Bu belgeler kişisel veri içerir (ad, doğum tarihi, e-posta, imza). Aydınlatma
  metni saklama süresini "sözleşme ilişkisi sona erdikten sonra 10 yıl (TBK
  m. 146)" olarak açıklıyor; aynı süre uygulanır.
- Belgeler herkese açık bir yere konmaz; panelde sözleşme PDF'lerini yalnızca
  admin görebiliyor (editör göremiyor) — aynı ayrım arşivde de korunur.

---

## 4. Yapılmaması gerekenler

| Yapılmaz | Neden |
|---|---|
| Geriye dönük tarihli izin belgesi | Belgenin tarihi imzanın fiilen atıldığı tarihtir. Geriye dönük tarih, belgenin tamamının güvenilirliğini yitirmesine yol açar |
| "Yazı gönderdi, demek ki izin verdi" varsayımı | Teslim izin değildir; her iki taslakta da açıkça yazılı |
| Panel onayını imzalı belgenin yerine koymak | Panel onayı delil kaydıdır; FSEK m. 52'deki yazılı şekli karşıladığı tartışmalıdır (§5, soru 1) |
| Mevcut panel onaylarını "geçersiz" ilan edip sıfırdan başlamak | Geçerlilik konusunda karar vermek avukatın işi. Taslaklar geçmişi teyit yoluyla yazılı zemine alıyor (v2 Madde 16.6) |
| Sürüm 2'yi yazarlara haber vermeden yayınlamak | 29 aktif yazarın paneli aynı anda kilitlenir |
| İmzalı kopya beklemeden yayımlamak | Zincirin tek anlamı bu; aksi hâlde belge düzeni kâğıt üstünde kalır |
| Eksik doldurulmuş belgeyi imzaya göndermek | Boş `[...]` alanı kalan belge imzalanmaz |

---

## 5. Avukat kontrolü gereken noktalar

Her iki taslağın sonunda belge bazlı sorular var. Bunların üstünde, **süreci
bütün olarak etkileyen** ve önce cevaplanması gerekenler:

1. **Paneldeki onay kutusu FSEK m. 52'deki yazılı şekli karşılar mı?**
   FSEK m. 52 doğrudan resmî metinden okunamadı (bkz. §7); ikincil kaynaklara
   göre hüküm "Mali haklara dair sözleşme ve tasarrufların yazılı olması ve
   konuları olan hakların ayrı ayrı gösterilmesi şarttır" biçiminde ve yazılı
   şekil bir **geçerlilik** şartı olarak niteleniyor. Bir onay kutusunun bu
   şartı karşıladığına dair kaynak bulunamadı. **Cevaba göre bütün süreç
   değişir:** karşılıyorsa imza toplamaya gerek yok; karşılamıyorsa ıslak/e-imza
   zorunlu.
2. **Güvenli elektronik imza bu sözleşme için kullanılabilir mi?** 5070 sayılı
   Kanun m. 5, güvenli elektronik imzanın elle atılan imza ile aynı hukuki
   sonucu doğurduğunu, ancak kanunların **resmî şekle veya özel bir merasime**
   tabi tuttuğu işlemlerde kullanılamayacağını söylüyor. FSEK m. 52'deki yazılı
   şekil "adi yazılı şekil" mi, yoksa özel merasim mi? Adi yazılı şekilse e-imza
   yeterlidir.
3. **Mevcut 29 onayın durumu.** v2 Madde 16.6'daki teyit ifadesi, geçmişi
   geçerli/geçersiz ilan etmeden yazılı zemine almayı amaçlıyor. Bu yeterli mi,
   yoksa her yazar için ayrı bir teyit belgesi mi gerekir?
4. **İki belgeli düzen mi, tek belge mi?** Çerçeve sözleşme + eser bazlı izin
   yapısı korunmalı mı, yoksa her eser için kendi kendine yeten tek bir sözleşme
   daha güvenli mi?
5. **Yayımlanmış eser varsa** (Grup C): geri çekip imza almak mı, yayında
   bırakıp bugünün tarihiyle imza almak mı?
6. **EK-1 zorunlu mu?** Son metnin belgeye eklenmesi mi gerekir, SHA-256 özetiyle
   tanımlamak yeterli mi? Cevap "özet yeterli" ise belgeler çok kısalır ve süreç
   hızlanır.
7. **Dergi tarafında kaç imza?** Adi ortaklıkta yazılı ortaklık sözleşmesi
   olmadığı için tek ortağın imzası yeterli mi, iki imza mı gerekir?
8. **Çizerler.** Bu plan yalnızca yazılı eserleri kapsıyor. 4 çizer hesabı var ve
   çizimler için hiçbir belge yok; çizer sözleşmesi ayrı bir iş olarak
   sıralanmalı (bkz. `panel/HUKUK-RAPORU.md` B9).

---

## 6. Panel iyileştirmeleri (bu işin ön koşulu değil)

Aşağıdakiler süreci kolaylaştırır; **hiçbiri belge hazırlığını veya imza
toplamayı beklemez.** Öncelikleri ayrı değerlendirilir.

| # | İyileştirme | Bugünkü durum | Kazanç |
|---|---|---|---|
| P1 | Onay ekranında **son metnin kendisi** gösterilsin | Yalnızca SHA-256 özeti gösteriliyor | Yazar imzaladığı metni aynı ekranda görür |
| P2 | Eser İzni belgesi panelde **otomatik doldurulup PDF üretilsin** (EK-1 dahil) | Panel PDF'i metni ve hak listesini içermiyor | Elle doldurma ortadan kalkar |
| P3 | **İmzalı belge yükleme alanı** (yazar veya editör yükler, durum "izin alındı") | Yükleme yolu yok; e-posta kullanılıyor | Zincirin kanıtı panelde tek yerde toplanır |
| P4 | Onay PDF'ine **verilen hakların ve mecraların listesi** yazılsın | "Sözleşme'nin 4. maddesi"ne atıf var | Belge kendi kendine yeter |
| P5 | Takip tablosunun panel raporu hâline getirilmesi | Tablo elle tutulacak | 29 yazar × n eser elle takip edilmez |

---

## 7. Kaynak ve doğrulama notu

- **Resmî mevzuat metinlerine erişilemedi:** `mevzuat.gov.tr` ve
  `resmigazete.gov.tr` bu oturumda TLS sertifikası doğrulanamadığı için
  açılamadı. FSEK m. 52'nin lafzı ikincil bir kaynaktan alındı
  ([Tokar Hukuk — FSEK m. 52](https://mehmettokar.av.tr/fsek-madde/madde-52/)):
  *"Mali haklara dair sözleşme ve tasarrufların yazılı olması ve konuları olan
  hakların ayrı ayrı gösterilmesi şarttır."* **Madde metinleri ve numaraları
  avukat tarafından resmî metinden teyit edilmelidir.**
- Yazılı şeklin bir **geçerlilik şartı** olduğu ve ruhsatları da kapsadığı
  yönündeki değerlendirme ikincil kaynaklara dayanıyor
  ([Erdem&Erdem](https://www.erdem-erdem.av.tr/bilgi-bankasi/eser-sahibinin-mali-haklarinin-devri),
  [Öngören & Karali](https://ongoren.av.tr/fikir-ve-sanat-eserleri-uzerindeki-haklarin-devri/)).
  Bir onay kutusunun bu şartı karşılayıp karşılamadığına dair kaynak
  **bulunamadı**; bu nedenle §5 soru 1 açık bırakıldı.
- 5070 sayılı Kanun m. 5'in lafzı da resmî metinden okunamadı; ikincil kaynağa
  dayanıyor ([LEXPERA konsolide metin](https://www.lexpera.com.tr/mevzuat/kanunlar/elektronik-imza-kanunu-5070)).
- **Ürün tarafındaki her olgu koddan ve canlı uçtan doğrulandı:** şablon
  yükleyicisi (`src/lib/agreement/template.ts:14`), yer tutucu sözlüğü ve hata
  davranışı (`src/lib/agreement/render.ts:180`), sabit ruhsat kapsamı
  (`src/services/rights.ts` `LICENCE_TERMS`), onay ekranı içeriği
  (`src/app/writer/approvals/approval-row.tsx`), onay PDF'inin içeriği
  (`src/services/rights.ts`), `rights_grants` şeması, yayımlanmış sayı olmadığı
  (`/api/public/issues` → `{"issues":[]}`, 22 Eylül 2026).
- **Okunamayanlar:** canlı veritabanı (üretim okumaları izin sistemi tarafından
  reddediliyor), dolayısıyla makalelerin bugünkü durumları, hangi yazarın hangi
  sözleşme sürümünü kabul ettiği ve bekleyen eser onayları. Bunlar editör/admin
  panelinden okunmalı.
- `panel/HUKUK-RAPORU.md`'deki değerlendirmeler **doğrulanmış hukuki sonuç
  değildir**; bu plan o raporu kaynak değil, başlangıç noktası olarak kullandı ve
  sözleşmeye ilişkin her tespiti dosyalardan yeniden okudu.
