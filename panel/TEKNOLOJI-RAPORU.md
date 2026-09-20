# postscript — Teknoloji Yığını Raporu

**Tarih:** 20 Eylül 2026 · **Kapsam:** `panel/` (Next.js uygulaması) ve depo kökü
**Kaynak:** `package.json`, `node_modules` içindeki kurulu sürümler ve kodun kendisi — beyan değil, fiilî durum.
**Depo durumu:** 220 commit, son commit 20 Eylül 2026 (`step 129`), `panel/DECISIONS.md` içinde 205 karar (en yüksek numara D-208).

---

## 1. Özet

Tek bir Next.js App Router uygulaması hem dergiyi hem paneli sunuyor; ayrı bir
frontend yok. Sunucu ağırlıklı bir mimari: 80 sayfanın yanında yalnızca 20
dosya `"use client"` taşıyor, mutasyonlar server action'larda, route handler'lar
(11 adet) yalnızca public API, cron ve medya için. İş kuralı `src/services/*`
(33 servis) altında toplanmış.

| Ölçü | Değer |
|---|---|
| `src/` altındaki TypeScript dosyası | 263 |
| `src/` satır sayısı | ~40.300 |
| Sayfa (`page.tsx`) | 80 |
| Route handler (`route.ts`) | 11 |
| Servis modülü | 33 |
| Veritabanı tablosu | 45 (`src/db/schema.ts`, 1.519 satır) |
| Migration | 40 |
| Bağımlılık | 25 runtime + 20 geliştirme |

---

## 2. Katmanlar ve sürümler

### Çalışma zamanı ve çatı

| Teknoloji | Sürüm | Not |
|---|---|---|
| Node.js | 24.18.0 (yerel), `node:24-alpine` (Dockerfile) | |
| pnpm | 12.3.4 (`packageManager` ile sabit) | |
| Next.js | 16.3.4 | Yalnızca App Router; Pages Router yok |
| React / React DOM | 19.2.8 | |
| TypeScript | 6.0.3 | `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` açık; `ignoreBuildErrors: false` |

### Veri

| Teknoloji | Sürüm | Not |
|---|---|---|
| PostgreSQL | üretimde Neon | |
| Drizzle ORM | 0.45.2 | Şema tek dosyada, 45 tablo |
| drizzle-kit | 0.31.10 | Migration elle yazılmıyor, üretiliyor |
| postgres.js | 3.4.9 | Üretim sürücüsü |
| PGlite | 0.5.8 | İkinci sürücü: testler, demo ve Docker'sız yerel çalışma |

`src/db/connect.ts` sürücüyü `DATABASE_URL`'in şemasından seçiyor
(`postgres://` → postgres.js, `pglite://` → PGlite) ve ikisini de aynı Drizzle
arayüzü olarak döndürüyor; uygulamanın geri kalanı hangisinin canlı olduğunu
bilmiyor.

### Arayüz

| Teknoloji | Sürüm | Not |
|---|---|---|
| Tailwind CSS | 4.3.3 | `@tailwindcss/postcss` üzerinden |
| lucide-react | 1.41.0 | İkonlar |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.6.0 | `cn` yardımcısı ve varyantlar |

Bileşenler (32 dosya) elle yazılmış. **shadcn/ui kurulu değil** — `CLAUDE.md`
ve `README.md` yığını "Tailwind + shadcn/ui" diye anlatıyor; kodda ise
`src/components/ui.tsx`'in kendi yorumu bunu "shadcn/ui *tarzında* elle
yazıldı" diye düzeltiyor. `components/ui/` dizini, `components.json` veya Radix
bağımlılığı yok.

### Metin ve belge

| Teknoloji | Sürüm | Kullanım |
|---|---|---|
| unified + remark-parse + remark-gfm + remark-rehype + rehype-sanitize + rehype-stringify | 11.0.5 / 11.0.0 / 4.0.1 / 11.1.2 / 6.0.0 / 10.0.1 | Makale markdown'ı; çıktı her zaman sanitize ediliyor |
| pdf-lib + @pdf-lib/fontkit | 1.17.1 / 1.1.1 | Yalnızca yazar sözleşmesi/ruhsat PDF'i (D-011); gömülü DejaVu Sans, çünkü yerleşik fontlar "ş, ğ, ı" harflerinde patlıyor |
| qrcode | 1.5.4 | TOTP kurulum karekodu |

### Kimlik, oturum, güvenlik

| Teknoloji | Sürüm | Kullanım |
|---|---|---|
| @node-rs/argon2 | 2.2.0 | argon2id şifre özeti; `serverExternalPackages` ile sunucu bundle'ı dışında |
| otplib | 13.5.0 | `editor`/`admin` için zorunlu TOTP |
| zod | 4.5.4 | Tüm girdi doğrulaması ve `env` şeması |
| Cloudflare Turnstile | (harici servis) | Kayıt ve doğrulama e-postası formlarında bot koruması (D-111) |

Bunların yanında kütüphanesiz, elle yazılmış katmanlar var: `src/lib/csrf.ts`,
`rate-limit.ts`, `crypto.ts`, `password-rules.ts`, `auth/rbac.ts` (saf yetki
fonksiyonları) ve veritabanı tabanlı oturum. JWT yok.

`next.config.ts` her yanıta CSP, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` ve `X-Content-Type-Options` başlıklarını basıyor;
`poweredByHeader` kapalı. CSP'de `frame-src` yalnızca Turnstile ve Spotify.

### Altyapı ve iletişim

| Teknoloji | Sürüm | Kullanım |
|---|---|---|
| @aws-sdk/client-s3 + s3-request-presigner | 3.1127.0 | Tek kova: makale medyası ve sözleşme PDF'leri; lokalde MinIO |
| nodemailer | 10.0.0 | SMTP; yerelde dosyaya yazan taşıma (`MAIL_TRANSPORT`, `.mail/`) |
| Vercel | — | `fra1` bölgesi, günlük cron `/api/cron/daily` (03:00) |
| Docker Compose | — | Yerelde postgres + MinIO (bu makinede kullanılmıyor; PGlite yeterli) |

### Test

| Teknoloji | Sürüm | Kapsam |
|---|---|---|
| Vitest | 5.0.0 | 29 birim + 40 entegrasyon dosyası, PGlite üzerinde |
| Playwright | 1.63.0 | 11 uçtan uca senaryo dosyası (`tests/e2e/`) |
| ESLint | 9.39.5 (`eslint-config-next`) | |

---

## 3. Dış servisler (KVKK açısından bakılması gerekenler)

Koddan çıkan; dışarıya istek giden veya dışarıdan kaynak yüklenen noktalar:

| Servis | Nerede | Dışarı ne gidiyor |
|---|---|---|
| Neon (PostgreSQL) | `DATABASE_URL` | Tüm veritabanı — asıl aktarım burası |
| Vercel | barındırma | İstek/erişim kayıtları |
| Cloudflare Turnstile | `src/lib/turnstile.ts` + tarayıcıdaki iframe | Token doğrulaması; ziyaretçi IP'si Cloudflare'e |
| Spotify | `src/components/spotify-player.tsx` iframe | Ana sayfayı açan okuyucunun tarayıcısı Spotify'a bağlanıyor |
| SMTP sağlayıcısı | `nodemailer` | Alıcı e-posta adresi ve mesaj içeriği |
| S3 uyumlu depolama | `src/lib/storage.ts` | Yüklenen görseller, sözleşme PDF'leri |
| Have I Been Pwned | `src/lib/password.ts` | Şifre sha1 özetinin yalnızca ilk 5 hanesi (k-anonymity), sadece `PASSWORD_HIBP_CHECK=true` iken |

Sosyal medya adresleri (x.com, instagram, tiktok, pinterest) yalnızca link;
gömülü izleyici yok. Analitik yok. Yabancı font CDN'i yok (`font-src 'self' data:`).

---

## 4. "Yapılmayacaklar" listesi — fiilî durum

| Kural | Durum |
|---|---|
| Ödeme / IBAN / fatura | Yok — ödeme kütüphanesi hiç yok |
| Yazar tarafından makale gönderimi | Yok — `writer-application` var, gönderim yok |
| Sosyal giriş | Yok — OAuth bağımlılığı yok |
| Abonelik / ödeme duvarı | Yok |
| X API entegrasyonu | Yok — yalnızca link |
| PDF sayı üretimi | Yok — `pdf-lib` sadece sözleşme için |
| ML tabanlı öneri | Yok — `src/lib/ranking.ts` kural tabanlı |
| localStorage dışı client depolama | Temiz — kodda `sessionStorage`/`indexedDB` geçmiyor |

---

## 5. Bulgular

1. **`shadcn/ui` beyanı gerçeği yansıtmıyor.** `CLAUDE.md` "Yığın" başlığı ve
   `README.md` satır 383 kurulu bir bileşen kütüphanesi varmış gibi anlatıyor;
   bileşenler elle yazılmış. D-077'deki `SPEC.md` durumunun aynısı: belge
   koddan ileri konuşuyor.
2. **`.env.example` eksik.** `src/lib/env.ts` şemasında olan `SITE_URL`,
   `TURNSTILE_SITE_KEY` ve `TURNSTILE_SECRET_KEY` örnek dosyada yok. Yeni bir
   kurulum bu değişkenleri ancak koddan okuyarak öğrenir.
3. **Üç değişken `env.ts`'i atlıyor.** `MAIL_TRANSPORT`, `MAIL_DIR` ve
   `PASSWORD_HIBP_CHECK` doğrudan `process.env`'den okunuyor; oysa `env.ts`'in
   başındaki yorum "her değişken buradan girer" diyor. Yanlış yazılan bir değer
   açılışta değil, ilk kullanımda sessizce yanlış davranır.
4. **`README.md` test sayıları eski.** Dosya "292 birim + entegrasyon testi,
   19 uçtan uca senaryo" diyor; gerçek sayı için bkz. bölüm 6.
5. **Kodda 119 adet `§` atıfı duruyor.** `CLAUDE.md` bu atıfların var olmayan
   bir belgeye işaret ettiğini söylüyor (D-077), ama mevcut yorumlar
   temizlenmemiş; kodu yeni okuyan biri olmayan bir belgeyi arıyor.
6. **İki sürücü riski sürüyor (D-078).** Testler PGlite'te, üretim
   postgres.js'te. Sürücüye duyarlı SQL yerelde geçip üretimde patlayabilir;
   bu yapısal bir durum, bir hata değil — ama raporun en büyük riski bu.
7. **Migration 0022 yok**; `drizzle/meta/_journal.json` da onu tanımıyor, yani
   numara atlanmış, kayıp bir dosya yok. Sorun değil.

---

## 6. Sağlık kontrolü

Rapor üretilirken çalıştırıldı (20 Eylül 2026, yerel PGlite):

| Kapı | Sonuç |
|---|---|
| `pnpm typecheck` | temiz (çıkış 0) |
| `pnpm lint` | temiz (çıkış 0) |
| `pnpm test` | **69 dosya / 685 test, hepsi geçti** (361 sn) |
| `pnpm test:e2e` | çalıştırılmadı (Playwright sunucu ayağa kaldırır; bu raporun kapsamı dışı) |

Gerçek sayı 685; `README.md` hâlâ 292 diyor (bkz. bulgu 4).

---

## 7. Yetkili kişiler

Canlı paneldeki (`postscriptmag.com/admin/users`) sayılar, 20 Eylül 2026.
**Kişi adı, e-posta ve doğum tarihi bilerek bu rapora yazılmadı**; yalnızca
sayılar. Toplam **41 hesap** var.

### Role göre (bir hesabın tek rolü olur)

| Rol | Kişi | Not |
|---|---|---|
| Yönetici (`admin`) | 2 | Sabit iki hesap; yenisi açılmıyor |
| Editör (`editor`) | 6 | 1'i ana editör; 6'sında da 2FA açık |
| Yazar (`writer`) | 29 | Hepsi "Aktif" durumda |
| Rolsüz hesap (`user`) | 4 | |
| **Toplam** | **41** | |

### Çizerlik ayrı bir işaret, rol değil

`users.is_illustrator` (D-151) rolün yanında duran bir bayrak: dergide hem
yazan hem çizen kişiler olduğu için çizerlik `role`'ün içine konmadı. Bu yüzden
"çizer" sayısı yukarıdaki tabloya **eklenmez**, onunla kesişir.

| Kesişim | Kişi |
|---|---|
| Çizer işareti olan hesap | 4 |
| — hem yazar hem çizer (`writer` + çizer) | 2 |
| — yalnızca çizer (rolsüz hesap + çizer) | 2 |
| — editör veya yönetici olup aynı zamanda çizen | 0 |

### Görevi olan kişi sayısı (mükerrer saymadan)

| Ölçü | Kişi |
|---|---|
| Panele girebilen (yazar + editör + yönetici) | **37** |
| Dergiye emek veren toplam kişi (37 + yalnızca çizen 2) | **39** |
| Hiçbir görevi olmayan okuyucu hesabı | 2 |

Çift görev bugün yalnızca "yazar + çizer" biçiminde var (2 kişi); "editör +
yazar" kombinasyonu koda açık (`/admin/users/writers` sayfası bu hesapları da
listeler) ama canlıda şu an böyle bir hesap yok — yazar listesindeki 29 kişinin
hepsinin rolü `writer`.
