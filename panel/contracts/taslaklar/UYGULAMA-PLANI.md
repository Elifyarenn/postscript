# Uygulama notları

**23 Eylül 2026** (veri bugün yeniden okundu). Süreç adımları için `YAYIN-ONCESI-KONTROL-LISTESI.md`; avukata
gidecek sorular için `avukata-inceleme-mesaji.md`. Bu dosya yalnızca o ikisinde
olmayanı tutar: doğrulanan durum ve sınırı, sürüm 2 geçiş adımları, depo notu.

> **Bu turda hiçbir şey uygulanmadı.** Sürüm 2 yayımlanmadı, kod değişmedi,
> roller ve `writer_status` değerleri değişmedi, kabul kayıtlarına
> dokunulmadı, üretim verisi değişmedi, mesaj gönderilmedi. Veritabanına yalnızca
> **salt okunur** sorgu yapıldı.

---

## 1. Doğrulanan durum ve bulgunun sınırı

Üretim veritabanına salt okunur SQL ile bakıldı:

| Ölçü | 22 Eylül | **23 Eylül** |
|---|---|---|
| Canlı makale | 32 | **34** (`in_review` 13, `pending_admin_approval` 21) |
| Yumuşak silinmiş makale | 2 | 2 |
| `published_at` dolu olan makale | 0 | **0** |
| Yayımlanmış sayı | 0 | **0** |
| Eser Onayı kaydı (`rights_grants`) | 0 | **0** |
| Sözleşme sürümü / kabul kaydı | 1 / 1 | **1 / 1** |
| Yazısı olan yazar | — | **26** |

İki gün arasındaki fark (32 → 34), panelde çalışmanın sürdüğünü gösteriyor ve
aşağıdaki "anlık görüntü" uyarısının somut karşılığıdır.

**Destekleyici olgu:** kod, `published_at` alanını yayında bir kez yazıyor ve
geri çekmede **temizlemiyor** (`src/services/articles.ts:750`). Yani bir makale
bir kez yayımlanmış olsaydı bu alan hâlâ dolu olurdu. Denetim kaydı
(`audit_log`) da yalnızca eklenir ve veritabanı trigger'ıyla korunur; orada
`published` veya `scheduled` hedefli tek bir durum değişikliği yok.

**Bulgunun sınırı — bu, "geçmişte hiç yayın yapılmadı"nın kesin ispatı
değildir:**

- 22 Eylül'de `article.created_by_author` denetim kaydı **35**, makale satırı
  **34**'tü; bir satır sayıca eksikti ve nedeni belirlenmedi.
- Panel dışından doğrudan SQL ile yapılan işlemler denetim kaydı bırakmak zorunda
  değil. D-110'daki yumuşak silme panel dışından yapılmış ve denetim satırları
  elle yazılmış.
- Sorgular tek bir ana ait anlık görüntüdür.

**Sonuç olarak:** eldeki bütün kayıtlar hiçbir yazının yayımlanmadığını
gösteriyor; bu güçlü bir göstergedir, kesin bir ispat değildir. Süreç bu
göstergeye göre kurulabilir, ama "hiç yayın olmadı" diye bir beyan verilmemeli.

---

## 2. Sürüm 2 geçiş adımları — yazıldı, uygulanmadı

**Sürüm 2, metin kesinleşmeden yayımlanmaz.**

> **En küçük değişiklik.** Belgeler kesinleşince panel kayıtlarının imzalı
> belgeyle aynı sürümü göstermesi için gereken tek şey **sıralamadır**: sürüm 2
> panelde yayımlanır, **ancak ondan sonra** editörler makaleleri "kabul edildi"
> yapar. Kod değişikliği, veri düzeltmesi veya kayıt güncellemesi gerekmez.
> Sıra kaçırılırsa da veri elle düzeltilmez (aşağıya bakın).

Sıra şöyle olmalı:

1. **Metin kesinleşir:** avukat incelemesi tamamlanır ve belgedeki üç
   `[[DOLDURULACAK]]` alan gerçek değerle kapatılır.
2. **Yer tutucular çözülür:** `[[DOLDURULACAK]]` alanları gerçek değerle ya da
   şablonun tanıdığı bir yer tutucuyla değiştirilir. Şablon gövdesinde köşeli
   parantezli hiçbir metin kalmadığı kontrol edilir — böyle bir metin hata
   vermez, **olduğu gibi yayımlanır**.
3. **`site_settings` doldurulur:** `{{dergi.adres}}` zorunlu bir alandır; boşsa
   render "Sözleşme ayarları eksik" hatası verir ve hiçbir yazar sözleşmeyi
   göremez. Yalnızca `yazar.mahlas` boş kalabilir.
4. **Dosya yerine konur:** taslağın not bloğu silinir, metin
   `panel/contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` üzerine yazılır.
5. **Sürüm 2 panelde yayımlanır** (`/admin/agreements` → şablondan sürüm
   oluştur → yayınla).
6. **Ancak bundan sonra** editörler makaleleri "kabul edildi" yapar. Sıra bu
   yüzden önemli: panel bir makale kabul edildiğinde açtığı Eser Onayı kaydına
   **o anda güncel olan** sözleşme sürümünü yazıyor
   (`rights_grants.agreement_version_id`). Sürüm 2 yayımlanmadan bir makale kabul
   edilirse kayıt sürüm 1'i gösterir, imzalı belge ise sürüm 2 olur.

**Yayımlamanın bilinen etkileri:** önceki kabuller `superseded_at` ile
işaretlenir; roller ve `writer_status` **değişmez**; kimse kilitlenmez; kilit
e-postası gitmez. Mevcut tek kabul kaydı silinmez ve değiştirilmez.

**Sıra kaçırılırsa:** o Eser Onayı kaydının sürümü v1 kalır. Kaydı elle
değiştirmek yerine imzalı belgedeki sürüm esas alınır ve takip tablosunun Not
kolonuna yazılır.

**Bir şey yayımlamak çözmez:** `/writer/agreement` bugün boş bir yer tutucudur
(metni okumaz, onay düğmesi yok), bu yüzden sürüm 2 yayımlansa da yazarlar
panelde kabul edemez. İmzalar her hâlde kâğıt veya e-imza ile toplanır. Panelde
sözleşme akışını yeniden açmak ayrı bir ürün işidir ve bu sürecin ön koşulu
değildir.

---

## 3. Son metin özetini panel beklemeden üretmek

Özet zorunlu değil. İstenirse panelin kullandığı normalleştirmenin aynısı
uygulanmalı (`src/lib/agreement/normalise.ts`): satır sonları `\n`'e indirilir,
her satır sonundaki boşluk ve sekmeler silinir, baştaki ve sondaki boş satırlar
atılır, sonra UTF-8 metnin SHA-256'sı alınır. Girdi makalenin **markdown
gövdesi** olmalı, ekrandaki HTML değil:

```bash
node -e "const fs=require('fs'),c=require('crypto');const t=fs.readFileSync(process.argv[1],'utf8').replace(/\r\n?/g,'\n').split('\n').map(l=>l.replace(/[ \t]+$/,'')).join('\n').trim();console.log(c.createHash('sha256').update(t,'utf8').digest('hex'))" son-metin-<slug>-v<N>.md
```

Editöre özeti gösteren bir panel ekranı yok; bu yüzden eser ekinde bağlayıcı olan,
her yazının EK bölümündeki metnin kendisidir.

---

## 4. Depo herkese açık — bulgular

`gh repo view` → `"visibility": "PUBLIC"` (`github.com/Elifyarenn/postscript`).
Taslaklar başka bir oturumun commit'leriyle `main`'e push edilmiş durumda.

**Bu, yürürlükteki sözleşmenin yayımlanması değildir.** Yürürlükteki metin
veritabanındaki `agreement_versions` tablosundan gelir ve orada tek sürüm
(sürüm 1) vardır. Bir taslağın depoda bulunması onu yürürlüğe sokmaz, hiçbir
yazara göstermez ve hiçbir kabul kaydı yaratmaz.

**Depo dışındaki konum.** Kişiye özel paketler, dolu takip listesi ve üretici
betik `C:\Users\USER\Project\postscript-sozlesmeler\` altındadır — bu klasör
hiçbir git deposunun içinde değil (doğrulandı). Depoda yalnızca kişisel veri
içermeyen şablonlar, kontrol listesi ve mesaj taslakları durur.

**Taramada bulunanlar** (değerler burada tekrarlanmadı; yalnızca yer ve tür):

| Yer | Ne | Değerlendirme |
|---|---|---|
| `panel/DECISIONS.md` — 2 satır | Serbest sağlayıcı (gmail vb.) **kişisel e-posta adresi** | Kişisel veri, herkese açık depoda. Gözden geçirilmeli |
| `panel/DECISIONS.md` — 2 satır | Nesne depolama uç adresi (hesap tanımlayıcısı içeriyor) | Altyapı tanımlayıcısı |
| `panel/DECISIONS.md` — 6 satır | Yönetilen veritabanı dal ve uç tanımlayıcıları | Altyapı tanımlayıcısı |
| `panel/README.md` — 6 satır | Demo/seed hesap şifreleri | Belgede "yalnızca yerel" olduğu yazılı ve bilinçli bir tercih; yine de herkese açık |
| `panel/README.md` — 7 satır, `panel/data/kvkk-aydinlatma-metni.md` — 2 satır | Demo `@postscript.local` adresleri ve derginin kendi iletişim adresi | Sorun değil; dergi adresi zaten künyede kamuya açık |
| `panel/HUKUK-RAPORU.md` — 3 satır | Künyedeki ilçe düzeyindeki adres değeri | Zaten kamuya açık künyede duruyor |
| Bu klasördeki taslaklar | Yazar kişisel verisi **yok**; ortak adları yalnızca yer tutucu; gerçek adres **yok** | Önceki turda taslakta geçen ilçe düzeyindeki adres değeri bu turda kaldırıldı |

**Önemli sınır:** geçmiş zaten push edilmiş olduğu için bugün bir değeri
dosyadan çıkarmak onu depo geçmişinden silmez. Hiçbir dosya silinmedi,
taşınmadı; depo görünürlüğü değiştirilmedi, Git geçmişi yeniden yazılmadı,
commit/push yapılmadı. **Ne yapılacağı kurucunun kararı.**

---

## 5. Kaynak notu

Resmî mevzuat metinlerine erişilemedi: `mevzuat.gov.tr` ve
`resmigazete.gov.tr` bu oturumda da TLS sertifikası doğrulanamadığı için
açılmadı. FSEK m. 52 lafzı ve yazılı şeklin bir geçerlilik şartı olduğu
değerlendirmesi ikincil kaynaklara dayanıyor
([Tokar Hukuk](https://mehmettokar.av.tr/fsek-madde/madde-52/),
[Erdem&Erdem](https://www.erdem-erdem.av.tr/bilgi-bankasi/eser-sahibinin-mali-haklarinin-devri));
5070 s. K. m. 5 için de aynı durum
([LEXPERA](https://www.lexpera.com.tr/mevzuat/kanunlar/elektronik-imza-kanunu-5070)).

**Doğrulanamayan üç nokta** — taslaklarda hüküm olarak yazılmadı, avukat
sorularına dönüştürüldü: bir onay kutusunun yazılı şekli karşılayıp
karşılamadığı; taramanın şekil ve ispat bakımından imzalı nüshanın yerine geçip
geçmediği; FSEK m. 52'deki yazılı şeklin güvenli elektronik imzayla
karşılanabilir olup olmadığı.

**Ürün tarafında doğrulananlar:** şablon yükleyici ve yer tutucu doğrulaması
(`src/lib/agreement/template.ts`, `render.ts`), sürüm yayınlama davranışı
(`src/services/agreements.ts`), `/writer/agreement`'ın boş yer tutucu olması,
onay ekranındaki arayüz kilidi (`src/app/writer/approvals/page.tsx`), sunucu
tarafı imza kontrolünün sözleşmeye bakmaması (`src/lib/auth/rbac.ts`),
`published_at`'in geri çekmede temizlenmemesi (`src/services/articles.ts:750`),
hash normalleştirmesi (`src/lib/agreement/normalise.ts`), üretim verisi (§1).
