# postscript — Claude Code Yönergeleri

Bu dosya her oturumda okunur. `SPEC.md` ürünün tam tanımıdır; çelişki varsa `SPEC.md` kazanır. Karar verilmemiş her konu `DECISIONS.md`'ye gerekçesiyle yazılır. Soru sorma; muhafazakâr güvenli seçeneği uygula ve kaydet.

## Proje

Kâr amacı gütmeyen e-dergi. Ayda iki sayı, yalnızca web. Kayıtlı okuyucu: kaldığı yerden okuma, kaydetme, takip, bildirim. Yazarlar admin tarafından `user` rolünden terfi ettirilir; site üzerinden yazı gönderimi yok, editör makale oluşturur.

## Yığın

Next.js App Router, TypeScript strict, PostgreSQL, Drizzle ORM, Tailwind + shadcn/ui, zod, Vitest, Playwright, S3 uyumlu depolama (lokalde MinIO), argon2id, veritabanı tabanlı oturum (httpOnly cookie). Pages Router yok. JWT oturum yok.

## Komutlar

```
pnpm dev              # geliştirme
pnpm typecheck        # tsc --noEmit
pnpm lint
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm db:generate      # drizzle migration üret
pnpm db:migrate
pnpm seed             # ilk admin + örnek veri
docker compose up -d  # postgres + minio
```

## Çalışma kuralları

- Her adımın sonunda `pnpm typecheck && pnpm lint && pnpm test` çalıştır. Geçmeden sonraki adıma geçme. "Testleri yazdım" yetmez; çalıştır ve çıktıyı göster.
- Her adım tek commit. Mesaj: `step N: <kısa açıklama>`.
- Var olan bir dosyayı düzenlemeden önce oku. Tahminle `str_replace` yapma.
- Bir kütüphane eklemeden önce zaten kullanılan bir çözüm var mı bak. Aynı işi yapan ikinci kütüphane yok.
- Migration'ı elle düzenleme; şemayı değiştir, `pnpm db:generate` çalıştır.
- Hata durumunda üç denemeden sonra durup durumu özetle; sonsuz düzeltme döngüsüne girme.
- `SPEC.md` §15 sırasını izle. Sıra dışına çıkma.

## Güvenlik kuralları (ihlal edilemez)

- Yetki kontrolü her server action ve route handler'da sunucu tarafında. Ön yüzde gizlemek yetki değildir.
- `role` alanı client'tan asla kabul edilmez. Kayıt endpoint'i her zaman `user` atar.
- Rol değişikliği `role_changes` kaydı olmadan gerçekleşmez.
- `writer` terfisi için: e-posta doğrulanmış, doğum tarihi ≥ 18, KVKK onayı, yasaklı değil. Eksikse reddet, eksikleri döndür.
- Makale `scheduled`/`published` olamaz: imzalı `rights_grants` yoksa veya bağlı bir medyanın `license_type` boşsa. Kontrol durum geçiş fonksiyonunda.
- Durum makinesi dışı geçiş → 409.
- `audit_log` ve `role_changes` yalnızca eklenir; güncelleme ve silme kodu yazma.
- `editor` ve `admin` için TOTP 2FA zorunlu.
- Tüm girdiler zod ile doğrulanır. Markdown çıktısı `rehype-sanitize` ile temizlenir.
- Loglara şifre, token, oturum kimliği, kimlik belgesi yolu yazılmaz.
- Public API kullanıcı e-postası, gerçek ad, doğum tarihi döndürmez.
- `withdrawn` makale public'te 410, yayında olmayan her şey 404.

## Yapılmayacaklar

- Ödeme, IBAN, fatura, vergi
- Yazar tarafından makale gönderimi
- Sosyal giriş
- Okuyucu yorum sistemi
- Abonelik / ödeme duvarı
- X API entegrasyonu (OG görseli + elle paylaşım yeter)
- PDF sayı üretimi
- ML tabanlı öneri (kural tabanlı sıralama: aynı yazar → aynı kategori → son 30 gün popüler)
- localStorage dışında client-side kalıcı depolama

## Kod stili

- Server action'lar mutasyon için; route handler'lar yalnızca public API, webhook, OG görseli.
- Servis katmanı `src/services/*`; server action ve route handler yalnızca doğrulama + servis çağrısı + yanıt. İş kuralı servis katmanında, tek yerde.
- Durum makinesi `src/services/articles/transitions.ts` tek dosyada; geçiş tablosu veri olarak tanımlı, kodda if-zinciri yok.
- Yetki kontrolü `src/lib/authz.ts`'te `requireRole(session, "editor")` gibi yardımcılarla; her yerde aynı fonksiyon.
- Hata yanıtları tutarlı: `{ error: { code, message, fields? } }`.
- Dosya adları kebab-case, bileşenler PascalCase, veritabanı kolonları snake_case.
- Türkçe kullanıcı arayüzü metinleri `src/i18n/tr.ts`'de; JSX içinde gömülü Türkçe metin yok.
- Yorum satırı yalnızca "neden"i açıklar; "ne"yi kod açıklar.

## Test beklentileri

Birim: durum makinesi, yaş hesabı (artık yıl dahil), `authz` yardımcıları, hash üretimi, öneri sıralaması.
E2E: `SPEC.md` §13'teki senaryolar. Her senaryo bağımsız; test verisi seed'den, testler arası paylaşım yok.

## Oturum hijyeni

Her ana adım bitince bağlamı temizle ve `SPEC.md`, `DECISIONS.md`, son commit mesajı ile devam et. Uzun oturumda spesifikasyondan sapma artar; bu dosya sapmayı önlemek için var.
