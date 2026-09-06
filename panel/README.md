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
pnpm seed                     # ilk admin, örnek kullanıcılar ve içerik
pnpm dev                      # http://localhost:3001
```

Seed'in oluşturduğu hesaplar:

| Rol | E-posta | Şifre |
|---|---|---|
| admin | `.env` içindeki `SEED_ADMIN_EMAIL` | `.env` içindeki `SEED_ADMIN_PASSWORD` |
| editor | `editor@postscript.local` | `Editor!Parola2026` |
| writer | `yazar@postscript.local` | `Yazar!Parola2026` |
| user | `okur@postscript.local` | `Okur!Parola2026` |
| user (17 yaşında) | `genc@postscript.local` | `Genc!Parola2026` |

> İki adımlı doğrulama şu anda **kapalıdır** ve yayın öncesi yeniden
> tasarlanacaktır (D-033). Tüm roller yalnızca e-posta ve şifreyle girer.

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
| `S3_*` | Nesne depolama. `S3_IDENTITY_BUCKET` kimlik belgeleri için ayrıdır. |
| `REVALIDATE_WEBHOOK_URL` / `_SECRET` | Yayın ve geri çekme sonrası ön yüz önbelleğini tazeler; gövde HMAC-SHA256 ile imzalanır (`x-postscript-signature`). |
| `PASSWORD_HIBP_CHECK=true` | Şifreleri HIBP k-anonymity ile de kontrol eder (varsayılan kapalı) |

Gizli değerler yalnızca ortam değişkenlerinden okunur; loglara şifre, jeton,
oturum kimliği veya kimlik belgesi yolu yazılmaz.

---

## Rol modeli

Roller sıralıdır: her rol bir öncekinin yetkilerini kapsar.

| Rol | Kapsam |
|---|---|
| `user` | Kayıtlı okuyucu. Panele erişemez; profilini ve oturumlarını yönetir. |
| `writer` | Duyurular, sözleşme onayı, Eser Onayları, kendine atanan makaleler (salt okunur), teslim takvimi. |
| `editor` | Tüm makaleler, sayı planlama, duyuru yayını, medya kütüphanesi, yazar atama. Sözleşme ve Eser Onayı PDF'lerini ve kullanıcı yönetimini **göremez**. |
| `admin` | Her şey. Rol değişikliği yalnızca admin yapar. |

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
8. `audit_log` ve `role_changes` yalnızca eklenir; hem uygulama katmanında hem de
   veritabanı trigger'ıyla korunur.
9. Onaylanmış bir Eser Onayı olmadan hiçbir makale `scheduled` veya `published`
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
`media/` ve `identity/`.

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
mc mirror --overwrite ./backups/<zaman-damgası>/identity  restore/postscript-identity

# 4. Bekleyen migration varsa uygulayın
DATABASE_URL=postgres://…/postscript_restore pnpm db:migrate
```

Notlar:

- `SESSION_SECRET` yedekte değildir ve olmamalıdır. Aynı değer kullanılmazsa
  geri yüklenen sistemde oturumlar ve bekleyen doğrulama bağlantıları geçersiz
  olur; kullanıcılar yeniden giriş yapar.
- `identity/` kişisel veridir. Geri yükleme gerçekten gerekmedikçe bu dizini
  atlayın; `identity_verified_at` bilgisi veritabanında zaten durur.
- Geri yükleme sonrası bir kez `pnpm purge-identity-documents` çalıştırın:
  saklama süresi dolmuş belgeler tekrar canlanmasın.

---

## Test

```bash
pnpm test        # 153 birim + entegrasyon testi
pnpm test:e2e    # 17 uçtan uca senaryo
```

Birim ve entegrasyon testleri süreç içi PostgreSQL (PGlite) üzerinde çalışır:
aynı migration'lar, aynı enum'lar, aynı kısmi index'ler ve aynı trigger'lar.
Docker gerekmez.

Uçtan uca testler kendi veri dizinini (`.e2e/`) her çalıştırmada siler, yeniden
seed'ler, üretim derlemesi alır ve gerçek bir tarayıcıyla sürer. Kapsanan
senaryolar §13.2'dekilerdir:

- kayıt → e-posta doğrulama → giriş; yaygın şifre reddi; hatalı şifre ile
  bilinmeyen hesabın aynı yanıtı vermesi
- `user` rolüyle `/writer`, `/editor`, `/admin` ve iç sayfalarına erişim → 403
- 17 yaşındaki kullanıcıyı yazar yapma denemesi → reddedilir, gerekçe gösterilir
- terfi → sözleşme onayı → `writer_status = active`
- makale `accepted` → Eser Onayı açılır → onaysız `scheduled` denemesi
  reddedilir → onay → `scheduled` → `published`
- editör "içerik değişikliği" ile kaydeder → onay iptal olur, yenisi açılır
- geri çekilen makale public API'de 410, hiç yayınlanmamış olan 404
- yüklenen dosyanın türü içeriğinden doğrulanır; lisans bilgisi kaydedilir ve
  kullanıldığı makale sayısı raporlanır
- yeni sözleşme sürümü → aktif yazarlar `pending_agreement` durumuna düşer ve
  yeniden onaylayana kadar iç sayfalar kilitlenir

---

<p align="center">
  <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">Designed by Elif Yaren Çekiç & Tuanna Demir</a>
</p>
