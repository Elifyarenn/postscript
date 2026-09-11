# postscript — Yönetim Paneli

Kâr amacı gütmeyen bir e-derginin yazı işleri paneli: kullanıcı ve rol yönetimi,
yazar sözleşmesi onayı, eser bazlı kullanım ruhsatı (Eser Onayı), makale durum
makinesi, sayı planlama ve ön yüz için salt okunur bir public API.

Ürün tanımı `dergi-panel-agent-prompt.md`, sözleşme akışı
`doc/sozlesme-render-agent-prompt.md` dosyalarındadır. Spesifikasyonda karara
bağlanmamış her konu, gerekçesiyle birlikte [`DECISIONS.md`](./DECISIONS.md)
içinde kayıtlıdır.

---

## İçindekiler

- [Hızlı başlangıç](#hızlı-başlangıç)
- [Docker olmadan geliştirme](#docker-olmadan-geliştirme)
- [Komutlar](#komutlar)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Rol modeli](#rol-modeli)
- [Mimari](#mimari)
- [Zamanlanmış işler](#zamanlanmış-işler)
- [Yedekleme ve geri yükleme](#yedekleme-ve-geri-yükleme)
- [Yayına alma](#yayına-alma-vercel--neon)
- [Test](#test)

---

## Hızlı başlangıç

Gerekenler: Node.js 24+, pnpm 12+, Docker.

```bash
cd panel
cp .env.example .env

# SESSION_SECRET üretin ve .env içine yazın
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

pnpm install
docker compose up -d          # PostgreSQL + MinIO + Mailpit
pnpm db:migrate
pnpm seed                     # ilk admin (varsayılan: demo kullanıcı yok)
pnpm dev                      # http://localhost:3001
```

`pnpm seed` varsayılan olarak yalnızca ilk admini, KVKK metnini, yayınlanmış
çerçeve sözleşmeyi ve yayıncı bilgilerini oluşturur. Geliştirme/e2e için demo
hesapları isterseniz `SEED_DEMO_USERS=1` ile çalıştırın:

```bash
SEED_DEMO_USERS=1 pnpm seed
```

`SEED_DEMO_USERS=1` ile oluşan hesaplar:

| Rol | E-posta | Şifre |
|---|---|---|
| admin | `.env` içindeki `SEED_ADMIN_EMAIL` | `.env` içindeki `SEED_ADMIN_PASSWORD` |
| editor | `editor@postscript.local` | `Editor!Parola2026` |
| writer | `yazar@postscript.local` | `Yazar!Parola2026` |
| user | `okur@postscript.local` | `Okur!Parola2026` |
| user (başvuru) | `aday@postscript.local` | `Aday!Parola2026` |
| user (17 yaşında) | `genc@postscript.local` | `Genc!Parola2026` |

> Demo hesapları bilinen, depoda yazılı şifrelerle çalışır — üretimde yalnızca
> admin CLI ile oluşturulur (D-038).

> İki adımlı doğrulama (TOTP) **editör ve yönetici için zorunludur** (D-048):
> bu rollerdeki bir hesap 2FA kurmadan panele giremez — ilk girişte
> `/account?twoFactor=1` kurulum ekranı açılır. Kurulum sırasında tüm mevcut
> oturumlar iptal edilir ve yeniden girişte kimlik doğrulayıcı kodu istenir.
> E2E koşusu `SEED_TOTP_SECRET` ile 2FA'lı personel hesapları üretir; yerel
> geliştirmede 2FA, ilk girişte kurulur.

Yardımcı adresler: Mailpit gelen kutusu `http://localhost:8025`, MinIO konsolu
`http://localhost:9001`.

İlk admin arayüzden yaratılamaz (§3 kural 6). Seed dışında CLI ile de
oluşturulabilir:

```bash
pnpm create-admin -- --email admin@example.com --name "Ad Soyad" --password "…"
pnpm create-admin -- --email mevcut@example.com --promote
```

---

## Docker olmadan geliştirme

Makinede Docker yoksa uygulama süreç içi bir PostgreSQL (PGlite), yerel diske
yazan bir depolama ve dosyaya yazan bir e-posta adapteriyle çalışır. Üretim için
değildir; sözleşme metinleri, PDF üretimi ve migration'lar aynı motorda
doğrulanır (bkz. D-002, D-003).

```bash
cd panel
cp .env.example .env

# .env içinde şu üç satırı değiştirin
#   DATABASE_URL=pglite://.pglite
#   S3_ENDPOINT=file://.storage
#   MAIL_TRANSPORT=file        (gönderilen postalar .mail/ altına JSON olarak düşer)

pnpm install
pnpm seed
pnpm dev
```

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Geliştirme sunucusu (3001) |
| `pnpm build` / `pnpm start` | Üretim derlemesi ve sunucusu |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (birim + entegrasyon) |
| `pnpm test:e2e` | Playwright (§13.2 senaryoları) |
| `pnpm db:generate` | Şemadan migration üretir |
| `pnpm db:migrate` | Bekleyen migration'ları uygular |
| `pnpm seed` | İlk admin ve örnek veri |
| `pnpm create-admin` | CLI ile admin oluşturur veya terfi ettirir |
| `pnpm publish-scheduled` | Zamanı gelen makaleleri yayınlar |
| `pnpm send-reminders` | Bekleyen devir formları için hatırlatma |
| `pnpm process-deletions` | 30 günü dolan hesap silme taleplerini işler |

Migration'lar elle düzenlenmez: şema `src/db/schema.ts` içinde değiştirilir ve
`pnpm db:generate` çalıştırılır.

---

## Ortam değişkenleri

Tam liste `.env.example` içindedir. Kritik olanlar:

| Değişken | Açıklama |
|---|---|
| `APP_URL` | Panelin dış adresi. CSRF origin kontrolü ve e-posta bağlantıları bunu kullanır. |
| `DATABASE_URL` | `postgres://…` veya `pglite://<dizin>` |
| `SESSION_SECRET` | Oturum jetonu ve e-posta jetonu özetlerine karışan gizli değer (pepper). En az 16 karakter; 32 baytlık rastgele hex önerilir. **Değiştirilirse tüm oturumlar ve bekleyen doğrulama bağlantıları geçersiz olur.** |
| `SESSION_MAX_AGE_DAYS` / `SESSION_IDLE_DAYS` | Oturum ömrü (30) ve hareketsizlik sınırı (7) |
| `SMTP_*`, `MAIL_FROM` | E-posta gönderimi |
| `MAIL_TRANSPORT=file`, `MAIL_DIR` | SMTP yerine dosyaya yazar (yalnızca geliştirme) |
| `S3_*` | Nesne depolama (medya ve sözleşme PDF'leri). |
| `REVALIDATE_WEBHOOK_URL` / `_SECRET` | Yayın ve geri çekme sonrası ön yüz önbelleğini tazeler; gövde HMAC-SHA256 ile imzalanır (`x-postscript-signature`). |
| `PASSWORD_HIBP_CHECK=true` | Şifreleri HIBP k-anonymity ile de kontrol eder (varsayılan kapalı) |

Gizli değerler yalnızca ortam değişkenlerinden okunur; loglara şifre, jeton,
oturum kimliği veya kimlik belgesi yolu yazılmaz.

---

## Rol modeli

Roller sıralıdır: her rol bir öncekinin yetkilerini kapsar.

| Rol | Kapsam |
|---|---|
| `user` | Kayıtlı okuyucu. Yönetim panellerine erişemez; dergiyi okur (`/magazine`), profilini ve oturumlarını yönetir. |
| `writer` | Duyurular, sözleşme onayı, Eser Onayları, kendine atanan makaleler (salt okunur), teslim takvimi. |
| `editor` | Tüm makaleler, sayı planlama, duyuru yayını, medya kütüphanesi, yazar atama. Sözleşme ve Eser Onayı PDF'lerini ve kullanıcı yönetimini **göremez**. |
| `admin` | Her şey. Rol değişikliği yalnızca admin yapar. |

Giriş tek kapıdır: herkes aynı formdan girer, panel yoktur diye ayrı bir adres
yoktur. Girişten sonra kök adres (`/`) hesabın rolüne göre yönlendirir:
admin → `/admin`, editör → `/editor`, yazar → `/writer`, okuyucu →
`/magazine`. Okuyucunun gördüğü tek şey dergi ve hesap sayfasıdır (D-035).

Değişmez kurallar:

1. Yetki kontrolü her server action ve route handler'da sunucu tarafındadır.
   Menü gizlemek yetki değildir.
2. Kayıt endpoint'i `role` alanını kabul etmez; sunucu her zaman `user` atar.
3. Hiçbir rol değişikliği `role_changes` kaydı olmadan gerçekleşmez.
4. `writer` terfisi altı ön koşulu ister (aşağıda ayrıntılı). Eksik varsa terfi
   reddedilir ve eksikler yöneticiye tek tek gösterilir.
5. `writer_status = active` olmadan yazar panelinde yalnızca duyurular ve
   sözleşme sayfası açıktır.
6. İlk admin yalnızca seed veya CLI ile oluşturulur.
7. İki adımlı doğrulama şu anda yok; §5.2'nin zorunlu kıldığı bu kontrol yayın
   öncesi geri eklenecek (D-033).
8. E-posta adresi doğrulanmamış hesap hiçbir sayfayı açamaz ve hiçbir mutasyonu
   çalıştıramaz; yalnızca yeni bağlantı isteyebilir veya çıkış yapabilir. §5.1
   doğrulanmamış hesabın profilini kullanabilmesini öngörüyordu, bilerek
   sapıldı (D-034).
9. `audit_log` ve `role_changes` yalnızca eklenir; hem uygulama katmanında hem de
   veritabanı trigger'ıyla korunur.
10. Onaylanmış bir Eser Onayı olmadan hiçbir makale `scheduled` veya `published`
    olamaz; lisans bilgisi eksik medya bağlıysa da olamaz. Kontrol durum geçiş
    fonksiyonundadır.

### Sözleşme ve Eser Onayı

Sözleşme metni depoda: `contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`.
Panelde metin yazılmaz; yönetici "şablondan sürüm oluştur" der, sistem dosyayı
okur ve ham metnin SHA-256'sını sürümün `body_hash`'i olarak saklar (D-028).

Yazar terfisi altı ön koşula bağlıdır: e-posta doğrulanmış, doğum tarihi ve
≥ 18 yaş, KVKK onayı, yasaklı değil, yayınlanmış bir sözleşme sürümü var, ve
sözleşme **bu kullanıcı için render edilebiliyor**. Sonuncusu eksik yayıncı
bilgisini adıyla söyler: "Sözleşme ayarları eksik: dergi.ortak_2".

Yazar sözleşmeyi okurken metin kendi verileriyle doldurulmuş hâlde gösterilir;
son paragraf ekranda görününceye kadar onay kutusu açılmaz. Onayda sunucu metni
yeniden render eder, hash'i karşılaştırır, uyuşmazsa 409 verir; uyuşuyorsa onay
anı ve IP metne işlenir, `rendered_markdown` olarak saklanır ve PDF üretilir.

Her makale için ruhsat, editör makaleyi kabul ettiğinde açılan **Eser Onayı** ile
doğar. Kapsam sözleşmenin 4. maddesinde sabittir ve eser başına
değiştirilemez: basit ruhsat, dört mali hak (işleme yalnızca m. 4.2'deki
işlemlerle sınırlı), dört mecra, dünya geneli, süresiz, bedelsiz, ticari
kullanım hariç. Yazar onaylarken kabul edilen metnin özetini, sözleşme sürümünü
ve adının nasıl görüneceğini görür.

Editör kaydederken değişikliğin türünü seçer: **düzeltme** onayı korur,
**içerik değişikliği** onayı iptal eder ve yeni onay ister. Yayımlanmış bir
eserin içeriği yerinde değiştirilemez; önce geri çekilmesi gerekir (D-030).

### Şifre kuralları

En az 8 karakter, büyük ve küçük harf, en az bir rakam (D-026). Kayıt, şifre
sıfırlama ve şifre değiştirme formlarında kurallar yazarken canlı olarak
işaretlenir; üçü de sağlanmadan düğme açılmaz. Sunucu aynı fonksiyonları
(`src/lib/password-rules.ts`) yeniden çalıştırır ve ayrıca gömülü 10.000 yaygın
şifre listesine bakar.

### E-posta değiştirme

Kullanıcı hesap sayfasından yeni bir adres isteyebilir. Yeni adrese bir doğrulama
bağlantısı gider ve adres yalnızca bağlantı tıklanınca değişir; o ana kadar mevcut
doğrulanmış adres canlı kalır, böylece istek asla sahibini hesaptan kilitleyemez.
Onayda eski oturumların tümü kapatılır (D-036).

### Yazar başvuru süreci

Kayıtlı okuyucu, hesap sayfasındaki "Yazar Olma İsteği Gönder" butonuyla
başvurur; örnek bir eser dosyası (PDF/DOCX, en fazla 20 MB) yükler. Butonun
etkin olması için e-posta doğrulanmış, doğum tarihi girilmiş ve ≥ 18 yaş, KVKK
onayı verilmiş olmalıdır; eksikler butonun yanında listelenir. Başvuru sayısı
son 30 günde birdir (her sonuca karşı bekleme süresi aynıdır).

Süreç sırayla ilerler ve durum makinesi dışı geçiş 409 verir:

1. **Editör onayı** (`/editor/applications`) — onaylanan başvuru yönetime gider.
2. **Yönetim onayı** (`/admin/applications`) — onayda o anki güncel sözleşme
   sürümü başvuruya tanımlanır.
3. **Sözleşme imzası** — başvuru sahibine giden bağlantı, çerçeve sözleşmeyi
   gösterir; imzalandığında onay kaydı tutulur, başvuru kapanır ve hesap
   **otomatik olarak aktif yazar** rolüne geçer (`role_changes` kaydıyla).

Örnek eser dosyası medya bucket'ında saklanır, hiçbir zaman genel erişime
açılmaz; yalnızca başvuru sahibi, editör ve yönetici okuyabilir (D-037).

### Görev dondurma ve hesap silme

Yazar ve editörler Hesabım sayfasından **görevlerini dondurur**: panel kapanır,
rol ve tüm kayıtlar (imzalı sözleşmeler, hak devirleri) korunur; yeniden
aktifleştirme yönetici gerektirir. Yönetici, kullanıcı sayfasından yazarı
(`writer_status = suspended`) veya editörü (`editor_status = suspended`)
dondurabilir/açabilir; görevden çıkarma ise rol değişimiyle yapılır ve her rol
değişimi `role_changes` kaydıyla güvenceye alınır.

Hesap silme talebi tüm roller için Hesabım sayfasındadır: 30 gün bekleme sonrası
kişisel veriler anonimleştirilir, imzalı hak devri kayıtları ve imza kanıtları
hukuki dayanak gereği saklanır (D-039).

### Topluluk (yorumlar, sohbet, moderasyon)

Kayıtlı okuyucular yayınlanmış yazılara **yorum** yapabilir ve **Topluluk
sohbetinde** mesaj atabilir (alıntılı mesajlar dahil). Mesajlarda yazar adının
yanında rol rozeti görünür (Kullanıcı / Yazar / Editör / Yönetici).

Her mesaj yazılırken **yasaklı kelime listesinden** geçer: listedeki kelimeler
otomatik yıldızlanır (ilk harf kalır), böylece kayıtlarda temiz hâli durur.
Liste admin tarafından yönetilir; eşleştirme büyük/küçük harfe duyarsız ve ek
almış biçimleri yakalar (D-040).

Yönetici panelindeki **"Topluluk yönetimi"** sekmesinde tüm yorumlar, sohbet
mesajları ve yasaklı kelimeler yönetilir; kaldırma yumuşak silmedir
(kayıt geçmişte kalır).

### Kayıt ve roller

Herkese açık tek kayıt **okuyucu kaydı**dır (`/register`): ad soyad,
doğum tarihi, e-posta, şifre ve KVKK onayı. Yeni hesaba sunucu her zaman `user` (okuyucu)
rolü atar; e-posta doğrulaması kimseyi yükseltmez. Yazar ve editör rolleri
yalnızca yönetici panelinden verilir (`/admin/users` → terfi / rol değişimi /
"Editor & Yazar" hibriti) veya yazar başvurusu pipeline'ından
(`/admin/applications`) admin onayıyla geçer. (D-063, D-064)

### İç duyurular ve okundu onayı

Yönetici panelindeki **Duyurular** sekmesi, yazarlara / editörlere / tüm ekibe
hedefli duyuru yayınlar. Her duyurunun **önem seviyesi** vardır
(Bilgilendirme / Önemli / Kritik); **kritik** duyurular her zaman onay
gerektirir — onaylanmadan yazar paneli kilitlenir. Yazar ve editör panellerinde
"Duyurular" sekmesi duyuruları seviye rozetiyle gösterir; okuma sayfayı açmakla,
onay düğmeyle kaydedilir. Yayınlanmış her duyurunun "Okunma raporu" yönetici ve
editör panelinden açılır: hedef kitlenin kimin okuduğunu, kimin onayladığını,
kimin beklemede olduğunu listeler (D-042).

### Güvenlik başlıkları

`next.config.ts` her yanıta `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Content-Security-Policy` ve `X-Permitted-Cross-Domain-Policies`
ekler ve `X-Powered-By` üstbilgisini kapatır (`poweredByHeader: false`).

---

## Mimari

```
contracts/             Sözleşme şablonu (yer tutucularla)
src/
  app/                 Next.js App Router: sayfalar, server action'lar, route handler'lar
  components/          Panelin küçük bileşen seti (Tailwind, shadcn/ui tarzı)
  db/                  Drizzle şeması, sürücü seçimi, migration
  lib/                 Kripto, oturum, yetki, CSRF, hız sınırı, PDF, markdown, depolama, e-posta
  lib/agreement/       Şablon okuma, yer tutucu sözlüğü, render ve hash normalizasyonu
  services/            İş kuralları. Tek doğruluk kaynağı burasıdır.
emails/                E-posta şablonları (saf fonksiyonlar)
drizzle/               Üretilmiş SQL migration'ları
scripts/               Seed, CLI ve cron işleri
tests/                 unit / integration (Vitest) ve e2e (Playwright)
```

Katman kuralı: server action ve route handler yalnızca **doğrulama → servis
çağrısı → yanıt** yapar. İş kuralı servis katmanındadır, tek yerde. Durum
makinesi `src/lib/article-status.ts` içinde saf bir modüldür; geçiş tablosu veri
olarak tanımlıdır.

Kimlik doğrulama veritabanı tabanlıdır (JWT yok): çerezde 256 bitlik rastgele bir
jeton taşınır, veritabanında yalnızca `sha256(jeton + SESSION_SECRET)` saklanır.
Bu sayede oturumlar anında iptal edilebilir.

Okuma alanı (`/magazine`) oturum ister ama rol istemez: yazar, editör ve admin
de dergiyi okuyucuyla aynı ekrandan okur. Sayfalar public read model'leri
(`src/services/public.ts`) kullanır, yani okuyucu ekranı ile public API aynı
veriyi görür; ikisi de yazarın e-postasını, gerçek adını veya doğum tarihini
göstermez.

Public API (`/api/public/*`) oturum istemez, `Cache-Control` ve `ETag` döner ve
yazarın e-postasını, gerçek adını veya doğum tarihini **hiçbir zaman** döndürmez.
Geri çekilmiş yazı 410, yayında olmayan her şey 404 verir.

---

## Zamanlanmış işler

Uygulama içinde zamanlayıcı yoktur; işler dışarıdan tetiklenir ve idempotenttir
(D-009, D-010). Örnek crontab:

```cron
*/5 * * * *  cd /app && pnpm publish-scheduled
0    6 * * *  cd /app && pnpm send-reminders
0    4 * * *  cd /app && pnpm process-deletions
```

---

## Yedekleme ve geri yükleme

```bash
./scripts/backup.sh ./backups
```

Bir zaman damgalı dizin oluşturur: `postscript.dump` (PostgreSQL custom format),
`media/`.

**Geri yükleme:**

```bash
# 1. Boş bir veritabanı
createdb -U postscript postscript_restore

# 2. Dökümü yükleyin
pg_restore --no-owner --no-privileges \
  --dbname=postgres://postscript:postscript@localhost:5432/postscript_restore \
  ./backups/<zaman-damgası>/postscript.dump

# 3. Nesne depolamayı geri yükleyin
mc alias set restore http://localhost:9000 postscript postscript
mc mirror --overwrite ./backups/<zaman-damgası>/media     restore/postscript

# 4. Bekleyen migration varsa uygulayın
DATABASE_URL=postgres://…/postscript_restore pnpm db:migrate
```

Notlar:

- `SESSION_SECRET` yedekte değildir ve olmamalıdır. Aynı değer kullanılmazsa
  geri yüklenen sistemde oturumlar ve bekleyen doğrulama bağlantıları geçersiz
  olur; kullanıcılar yeniden giriş yapar.

---

## Yayına alma (Vercel + Neon)

Panel `panel/` alt dizinindedir; deponun kökü ayrı bir statik "çok yakında"
sayfasıdır. Bu yüzden Vercel'de **panel kendi projesi olarak** kurulur.

1. **Veritabanı.** Neon'da (veya başka bir yönetilen PostgreSQL'de) bir veritabanı
   açın ve *pooled* bağlantı adresini alın: `postgres://…?sslmode=require`.

2. **Vercel projesi.** New Project → depoyu seçin → **Root Directory: `panel`**.
   **Framework Preset `Next.js` olmalı.** Var olan bir projeyi panele
   çeviriyorsanız bu ayar `Other` kalır: Vercel derlemeyi hiç çalıştırmaz,
   deploy "Ready" görünür ama her adres 404 verir.

3. **Ortam değişkenleri.** İlk derlemeden **önce** girilmelidir; derleme
   sırasında da okunurlar.

   | Değişken | Değer |
   |---|---|
   | `APP_URL` | `https://<proje>.vercel.app` — yanlışsa bütün formlar 403 verir |
   | `DATABASE_URL` | Neon bağlantı adresi |
   | `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SMTP_*`, `MAIL_FROM` | Gerçek bir SMTP sağlayıcısı |
   | `S3_*` | Gerçek bir nesne deposu (S3, R2, MinIO) |

4. **Migration** (bir kez, kendi makinenizden):

   ```bash
   DATABASE_URL="postgres://…" pnpm db:migrate
   ```

5. **İlk admin** (aynı şekilde, şifreyi siz seçersiniz):

   ```bash
   DATABASE_URL="postgres://…" pnpm create-admin -- --email … --password "…"
   ```

   `pnpm seed` **üretimde çalıştırılmaz**: oluşturduğu örnek hesapların şifreleri
   depoda yazılıdır.

Vercel'in dosya sistemi salt okunur ve geçicidir. Geliştirmedeki üç kısayol
orada çalışmaz ve çalıştıkları sanılırsa veri sessizce kaybolur:

- `DATABASE_URL=pglite://…` — veri sunucunun geçici diskinde kalır
- `S3_ENDPOINT=file://…` — medya yükleme hata verir
- `MAIL_TRANSPORT=file` — `.mail/` dizinine yazılamaz. Teslim hatası işlemi geri
  almaz (`sendMail` hatayı yutar ve loglar), ama posta hiçbir yere ulaşmaz.
  E-posta doğrulaması zorunlu olduğu için (D-034), SMTP kurulmadan **yeni
  kullanıcı kaydı tamamlanamaz**; CLI ile oluşturulan admin doğrulanmış sayılır
  ve girebilir.

Zamanlanmış işler Vercel'de crontab ile çalışmaz; Vercel Cron veya dış bir
tetikleyici gerekir (bkz. [Zamanlanmış işler](#zamanlanmış-işler)).

Tek parça bir sunucu tercih edilirse depodaki `Dockerfile` üretim imajını üretir
ve `docker compose --profile app up -d --build` aynı yığını (PostgreSQL, MinIO,
panel) tek makinede ayağa kaldırır.

---

## Test

```bash
pnpm test        # 241 birim + entegrasyon testi
pnpm test:e2e    # 19 uçtan uca senaryo
```

Birim ve entegrasyon testleri süreç içi PostgreSQL (PGlite) üzerinde çalışır:
aynı migration'lar, aynı enum'lar, aynı kısmi index'ler ve aynı trigger'lar.
Docker gerekmez.

Uçtan uca testler kendi veri dizinini (`.e2e/`) her çalıştırmada siler, yeniden
seed'ler, üretim derlemesi alır ve gerçek bir tarayıcıyla sürer. Kapsanan
senaryolar §13.2'dekilerdir:

- kayıt → doğrulama bekleme kapısı → e-posta doğrulama → giriş; doğrulanmamış
  hesabın her sayfadan kapıya geri gönderilmesi; yaygın şifre reddi; hatalı
  şifre ile bilinmeyen hesabın aynı yanıtı vermesi
- `user` rolüyle `/writer`, `/editor`, `/admin` ve iç sayfalarına erişim → 403
- 17 yaşındaki kullanıcıyı yazar yapma denemesi → reddedilir, gerekçe gösterilir
- terfi → sözleşme onayı → `writer_status = active`
- makale `accepted` → Eser Onayı açılır → onaysız `scheduled` denemesi
  reddedilir → onay → `scheduled` → `published`
- editör "içerik değişikliği" ile kaydeder → onay iptal olur, yenisi açılır
- geri çekilen makale public API'de 410, hiç yayınlanmamış olan 404
- yüklenen dosyanın türü içeriğinden doğrulanır; lisans bilgisi kaydedilir ve
  kullanıldığı makale sayısı raporlanır
- yayınlanan yazıyı okuyucu `/magazine` üzerinden okur; okuyucunun menüsünde
  editör bağlantısı yoktur
- yeni sözleşme sürümü → aktif yazarlar `pending_agreement` durumuna düşer ve
  yeniden onaylayana kadar iç sayfalar kilitlenir

---

<p align="center">
  <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">Designed by Elif Yaren Çekiç & Tuanna Demir</a>
</p>
