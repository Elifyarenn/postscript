# GÖREV: E-Dergi Yönetim Paneli ve Kullanıcı Sistemi

Sen kıdemli bir full-stack mühendissin. Aşağıdaki spesifikasyona göre çalışan, test edilmiş, üretime alınabilir bir uygulama üreteceksin. Belirsizlik gördüğün yerde soru sorma; bu belgede karar verilmemiş bir konu varsa en muhafazakâr güvenli seçeneği uygula ve kararını `DECISIONS.md` dosyasına gerekçesiyle yaz.

---

## 1. Bağlam

- Ürün: kâr amacı gütmeyen bir e-dergi. Sayı bazlı yayın yapar.
- Bu aşamada yazı gönderimi site üzerinden YAPILMAZ. Yazılar dışarıdan gelir; editör panelde makale kaydını açar.
- Ödeme, IBAN, vergi, fatura modülü YOKTUR. Bunları uygulama.
- Herkes siteye "normal kullanıcı" olarak kayıt olur. Yalnızca admin bir kullanıcıyı "yazar" rolüne yükseltir. Kendi kendine yazar olma yolu yoktur.
- 18 yaş altı yazar kabul edilmez. Bu kural kodda zorunludur.
- Hukuki zemin: Türkiye, 5846 sayılı FSEK. Eser bazlı hak devri formu ve çerçeve sözleşme onayı panelde toplanır; onaylar ispat edilebilir şekilde kayıt altına alınır.

---

## 2. Teknoloji Yığını

Aşağıdaki yığını kullan. Değiştirmen gereken bir şey varsa `DECISIONS.md`'ye yaz.

- **Framework:** Next.js (App Router), TypeScript strict mode
- **Veritabanı:** PostgreSQL
- **ORM:** Drizzle ORM, migration dosyaları repoda
- **Kimlik doğrulama:** Kendi oturum sistemi (veritabanı tabanlı session, httpOnly + Secure + SameSite=Lax cookie). Üçüncü parti auth kütüphanesi kullanacaksan Auth.js kabul edilir; JWT'yi oturum mekanizması olarak kullanma.
- **Şifre:** argon2id
- **E-posta:** SMTP üzerinden, adapter arkasında (Resend/SES/Nodemailer değiştirilebilir)
- **Dosya depolama:** S3 uyumlu (MinIO ile lokal geliştirme). Sözleşme PDF'leri ve görseller buraya.
- **Doğrulama:** zod, tüm API girdilerinde
- **UI:** Tailwind CSS + shadcn/ui. Panel arayüzü sade, işlevsel; pazarlama sitesi değil.
- **Test:** Vitest (birim), Playwright (uçtan uca kritik akışlar)
- **Konteyner:** `docker-compose.yml` ile Postgres + MinIO + uygulama tek komutla ayağa kalkar.

---

## 3. Roller ve Yetki Modeli

Roller sıralıdır ve her rol bir öncekinin yetkilerini kapsar:

| Rol | Kapsam |
|---|---|
| `user` | Kayıt olmuş okuyucu. Panele erişimi yok. Profilini düzenler, oturumunu yönetir. |
| `writer` | Yazar paneline erişir: duyurular, sözleşme onayı, hak devri formları, kendine atanan makaleler (salt okunur), teslim takvimi. |
| `editor` | Tüm makaleleri görür ve yönetir, sayı planlar, duyuru yayınlar, medya kütüphanesini yönetir, yazarlara makale atar. Sözleşme PDF'lerini, kimlik belgelerini ve kullanıcı yönetimini GÖREMEZ. |
| `admin` | Her şey. Rol değiştirme yalnızca admin yapar. |

**Zorunlu kurallar:**

1. Yetki kontrolü HER endpoint'te ve HER server action'da sunucu tarafında yapılır. Ön yüzde menü gizlemek yetki sayılmaz.
2. `role` alanı kayıt endpoint'inde kabul edilmez; sunucu her zaman `user` atar.
3. Rol değişikliği `role_changes` tablosuna kayıt oluşturmadan gerçekleşemez.
4. `writer` rolüne terfi için ön koşullar (bkz. §6) sunucu tarafında kontrol edilir; sağlanmıyorsa terfi reddedilir ve eksikler döndürülür.
5. Yazar, `writer_status = active` olmadan yazar panelinin duyuru ve sözleşme sayfası dışındaki hiçbir sayfasına erişemez.
6. İlk admin hesabı yalnızca seed script veya CLI komutu ile oluşturulur; arayüzden admin yaratılamaz. Sonraki adminleri mevcut admin atar.

---

## 4. Veri Modeli

Tüm tablolarda `id` (uuid), `created_at`, `updated_at`. Silme işlemleri soft delete (`deleted_at`); istisna: `sessions`, `email_tokens`.

### users
- `email` (unique, lowercase normalize), `email_verified_at`
- `password_hash`
- `display_name`
- `pen_name` (mahlas, nullable) — yayında bu görünür
- `bio`, `avatar_media_id`, `social_links` (jsonb)
- `birth_date` (date, nullable) — yazar terfisinde zorunlu
- `identity_verified_at` (nullable), `identity_verified_by` (admin user_id)
- `role` enum: `user | writer | editor | admin`
- `writer_status` enum, nullable: `pending_agreement | active | suspended`
- `kvkk_consent_at`, `kvkk_consent_version`
- `is_banned`, `banned_reason`

### sessions
- `user_id`, `token_hash`, `ip`, `user_agent`, `expires_at`, `last_seen_at`

### email_tokens
- `user_id`, `type` enum: `verify_email | reset_password`, `token_hash`, `expires_at`, `used_at`

### role_changes
- `user_id`, `old_role`, `new_role`, `changed_by`, `note`
- Bu tablo güncellenemez ve silinemez (uygulama katmanında engelle).

### agreement_versions
Çerçeve sözleşme metninin sürümleri.
- `version` (int, artan), `title`, `body_markdown`, `body_hash` (sha256), `pdf_media_id`
- `published_at`, `published_by`, `is_current` (aynı anda yalnızca bir tanesi true)
- Yayınlanmış sürüm düzenlenemez; değişiklik yeni sürüm demektir.

### agreement_acceptances
- `user_id`, `agreement_version_id`, `accepted_at`, `ip`, `user_agent`, `body_hash_at_acceptance`
- `superseded_at` — yeni sürüm yayınlanınca doldurulur, kayıt silinmez.
- Unique: (`user_id`, `agreement_version_id`)

### announcements
- `title`, `body_markdown`, `audience` enum: `writers | editors | all_staff`
- `requires_acknowledgement` (bool), `published_at`, `published_by`, `pinned`

### announcement_reads
- `announcement_id`, `user_id`, `read_at`, `acknowledged_at` (nullable)

### issues
- `number` (int, unique), `title`, `theme`, `cover_media_id`
- `status` enum: `planning | in_production | published | archived`
- `planned_publish_date`, `published_at`

### articles
- `issue_id` (nullable), `title`, `slug` (unique), `summary`
- `body_markdown` — editör yapıştırır; bu aşamada yazar gönderimi yok
- `author_id` (users.id, role ≥ writer), `co_author_ids` (uuid[])
- `category`, `tags` (text[])
- `status` enum: `draft | in_review | revision_requested | accepted | awaiting_rights | scheduled | published | archived | withdrawn`
- `due_date`, `scheduled_at`, `published_at`, `withdrawn_at`, `withdrawn_reason`
- `order_in_issue` (int)
- `plagiarism_check_status` enum: `not_run | clean | flagged`, `plagiarism_note`

### article_versions
- `article_id`, `version` (int), `body_markdown`, `changed_by`, `change_note`

### article_comments
Editöryal notlar; makale üzerinde iç yazışma.
- `article_id`, `author_id`, `body`, `resolved_at`

### rights_grants
Eser bazlı mali hak devri formu. FSEK 52 gereği haklar TEK TEK sayılır.
- `article_id` (unique — bir makaleye bir aktif form), `grantor_id` (yazar)
- `grant_type` enum: `assignment | exclusive_license | non_exclusive_license`
- `right_adaptation` (bool) — işleme, m.21
- `right_reproduction` (bool) — çoğaltma, m.22
- `right_distribution` (bool) — yayma, m.23
- `right_communication_to_public` (bool) — umuma iletim, m.25
- `channels` (text[]): `web | pdf_issue | social | newsletter | future_channels`
- `exclusivity_months` (int, nullable)
- `territory` (default: `worldwide`)
- `consideration` enum: `none` (bu aşamada tek değer; alan gelecekte genişler)
- `commercial_use_included` (bool)
- `form_text_hash` (sha256, formun yazara gösterilen tam metni)
- `form_pdf_media_id`
- `status` enum: `pending | signed | declined | revoked`
- `signed_at`, `signed_ip`, `signed_user_agent`, `declined_at`, `declined_reason`, `revoked_at`, `revoked_by`

### media
- `storage_key`, `mime`, `size`, `width`, `height`, `uploaded_by`
- `license_type` enum: `own_work | cc0 | cc_by | stock_licensed | permission_letter | contract_pdf | other`
- `license_source` (url veya açıklama), `license_evidence_media_id` (izin belgesi)
- `alt_text`
- Kural: `license_type` boş olan medya makaleye eklenemez.

### audit_log
- `actor_id` (nullable, sistem eylemleri için), `action` (string), `entity_type`, `entity_id`, `before` (jsonb), `after` (jsonb), `ip`
- Eklenebilir, güncellenemez, silinemez.

---

## 5. Kullanıcı Sistemi

### 5.1 Kayıt
- E-posta + şifre. Şifre politikası: min 10 karakter, yaygın şifre listesiyle karşılaştır (HIBP k-anonymity isteğe bağlı; en azından ilk 10.000 yaygın şifre listesi gömülü).
- Kayıtta zorunlu: `display_name`, `kvkk_consent` onay kutusu (sürüm numarasıyla kaydedilir).
- Doğrulama e-postası gönderilir. `email_verified_at` boşsa oturum açılır ama profil dışındaki hiçbir işlem yapılamaz.
- Rate limit: aynı IP'den 10 dk içinde en fazla 5 kayıt.

### 5.2 Giriş
- E-posta + şifre. Başarısız denemelerde artan gecikme; 10 başarısızlıktan sonra 15 dk kilit (hesap bazlı ve IP bazlı ayrı sayaç).
- Oturum süresi 30 gün, her istekte `last_seen_at` güncellenir; 7 gün hareketsizlikte düşer.
- `editor` ve `admin` için TOTP tabanlı 2FA ZORUNLU. 2FA kurulmadan panele giriş yok. `writer` için isteğe bağlı.
- Kullanıcı aktif oturumlarını görür ve tek tek veya tümünü sonlandırabilir.

### 5.3 Şifre sıfırlama
- Token 30 dk geçerli, tek kullanımlık. Sıfırlama tüm aktif oturumları düşürür.

### 5.4 Profil
- `display_name`, `pen_name`, `bio`, avatar, sosyal linkler, `birth_date`.
- `birth_date` bir kez kaydedildikten sonra kullanıcı tarafından değiştirilemez; yalnızca admin değiştirir (audit ile).
- Kullanıcı hesabını silme talebi verebilir; 30 gün sonra soft delete. Yazar ise ve imzalı `rights_grants` varsa kişisel veriler anonimleştirilir ama devir kayıtları ve imza kanıtları saklanır (sözleşme ispatı hukuki dayanak).

---

## 6. Yazar Terfi Akışı

Admin, kullanıcı listesinden bir kullanıcıyı seçip "Yazar yap" der. Sunucu şu kontrolleri yapar; herhangi biri sağlanmazsa terfi reddedilir ve eksikler admin'e gösterilir:

1. `email_verified_at` dolu
2. `birth_date` dolu ve bugün itibarıyla ≥ 18 yaş
3. `identity_verified_at` dolu (admin, kimlik ön yüzü belgesini gördükten sonra panelden "doğrulandı" işaretler; belge `media` olarak yüklenir, yalnızca admin görebilir; 90 gün sonra otomatik silinir, `identity_verified_at` kalır)
4. `kvkk_consent_at` dolu
5. `is_banned = false`

Terfi başarılıysa:
- `role = writer`, `writer_status = pending_agreement`
- `role_changes` kaydı
- Yazara e-posta: yazar paneline giriş ve sözleşmeyi onaylama çağrısı
- Yazar, güncel `agreement_versions.is_current` sürümünü onaylayınca `writer_status = active`

Yazarı askıya alma: `writer_status = suspended`; panel erişimi kapanır, mevcut devir kayıtları etkilenmez.

Rolü geri alma: `role = user`, `writer_status = null`, `role_changes` kaydı, imzalı belgeler saklanır.

---

## 7. Sözleşme Onay Mekanizması

### 7.1 Çerçeve sözleşme
- Admin, markdown olarak yeni sürüm oluşturur; yayınlarken sistem `body_hash` üretir ve PDF render eder (PDF içinde sürüm no ve hash dipnotta).
- Yeni sürüm yayınlanınca: önceki `is_current = false`; tüm aktif yazarların `agreement_acceptances` kayıtlarına `superseded_at` yazılır; `writer_status = pending_agreement`; yazarlara bildirim gider.
- Yazar onay ekranı: tam metin scroll ile gösterilir; en alta inmeden onay butonu aktif olmaz; "Okudum, anladım, kabul ediyorum" kutucuğu + buton. Sunucu, `body_hash_at_acceptance` olarak o an gösterilen metnin hash'ini kaydeder; `ip`, `user_agent`, `accepted_at`.
- Yazar istediği zaman onayladığı sürümün PDF'ini indirir.

### 7.2 Eser bazlı hak devri formu
- Editör makaleyi `accepted` yapınca sistem otomatik olarak `rights_grants` kaydı oluşturur (`status = pending`). Form alanlarının varsayılanı admin tarafından "form şablonu" ayarından belirlenir (ör. `exclusive_license`, dört hak işaretli, `channels = [web, pdf_issue, social, newsletter]`, `exclusivity_months = 12`, `commercial_use_included = false`). Editör, makale bazında varsayılanı değiştirebilir; değişiklik audit'e düşer.
- Makale durumu otomatik `awaiting_rights` olur.
- Yazar panelinde "Onay bekleyen devir formu" görünür. Form, insan tarafından okunabilir tam metin olarak render edilir: makale başlığı, devredilen/lisanslanan hakların her biri ayrı satırda, tür, süre, mecralar, bedel (`Bedel: Yok`), ticari kullanım durumu. Yazar `İmzala` veya `Reddet` (gerekçeli) der.
- İmzada: `form_text_hash`, `signed_at`, `signed_ip`, `signed_user_agent` kaydedilir; PDF üretilip depolanır; yazara e-posta ile kopya gider.
- **Zorunlu kural:** `rights_grants.status = signed` olmadan makale `scheduled` veya `published` durumuna GEÇEMEZ. Bu kontrol durum geçiş fonksiyonunda sunucu tarafında yapılır; UI'da buton gizlemek yeterli değildir.
- Reddedilen formda makale `revision_requested` durumuna döner ve editöre bildirim gider.
- Form imzalandıktan sonra form içeriği değiştirilemez; değişiklik gerekiyorsa mevcut form `revoked`, yeni form `pending`.

---

## 8. Makale Durum Makinesi

Geçişler yalnızca aşağıdaki gibi olabilir; başka geçiş denemesi 409 döndürür.

```
draft               -> in_review, archived
in_review           -> revision_requested, accepted, draft
revision_requested  -> in_review, draft
accepted            -> awaiting_rights (otomatik), draft
awaiting_rights     -> scheduled (yalnızca rights_grants.signed), revision_requested (yalnızca rights_grants.declined)
scheduled           -> published (zamanlanmış görev veya manuel), awaiting_rights (planı iptal)
published           -> archived, withdrawn
archived            -> published
withdrawn           -> (terminal)
```

- Her geçiş `audit_log`'a düşer.
- `published` olurken `published_at` set edilir, `article_versions`'a "published" işaretli sürüm yazılır.
- `withdrawn`: yazının public URL'si 410 Gone döner; veritabanından silinmez; `withdrawn_reason` zorunlu.
- Makaleye bağlı her `media` için `license_type` dolu olmalı; aksi halde `scheduled` geçişi reddedilir.

---

## 9. Panel Ekranları

### 9.1 Yazar paneli (`/writer`)
- **Duyurular:** liste; `requires_acknowledgement` olanlar en üstte ve onaylanmadan diğer sayfalar kilitli (sözleşme sayfası hariç).
- **Sözleşme:** güncel sürüm, onay durumu, geçmiş onayların PDF'leri.
- **Devir formları:** bekleyen / imzalanmış / reddedilmiş sekmeleri.
- **Makalelerim:** kendine atanan makaleler, durumu, editör notları (salt okunur), teslim tarihi.
- **Profil ve güvenlik:** profil alanları, şifre, 2FA, aktif oturumlar.

### 9.2 Editör paneli (`/editor`)
- **Makaleler:** filtreli liste (durum, sayı, yazar), makale oluştur/düzenle (markdown editör + önizleme), yazar ata, durum geçişi, sürüm geçmişi, yorum/not, intihal durumu işaretleme.
- **Sayılar:** sayı oluştur, makaleleri sürükle-bırak sırala, kapak ata, yayın tarihi planla.
- **Medya kütüphanesi:** yükleme, lisans alanları zorunlu, kullanıldığı makaleler.
- **Duyurular:** oluştur/yayınla, okunma raporu.
- **Devir formu takibi:** bekleyen formlar listesi, yazara hatırlatma gönder.

### 9.3 Admin paneli (`/admin`)
- Editör panelinin tamamı +
- **Kullanıcılar:** arama, filtre, rol değiştir (terfi kontrolleri ile), kimlik belgesi görüntüle/doğrula, askıya al, yasakla, oturumları düşür.
- **Sözleşme sürümleri:** oluştur, yayınla, onay raporu (kim onayladı, kim bekliyor).
- **Devir formu şablonu:** varsayılan alanlar.
- **Audit log:** filtreli görüntüleme, CSV dışa aktarma.
- **Sistem:** e-posta şablonları, KVKK aydınlatma metni sürümleri.

---

## 10. Public API (ön yüz için)

Ön yüz ayrı deploy edilebilir; panel yalnızca aşağıdakileri dışa açar:

- `GET /api/public/issues` — `published` sayılar
- `GET /api/public/issues/:number` — sayı + sıralı makale listesi
- `GET /api/public/articles/:slug` — yalnızca `published`; `withdrawn` için 410, diğerleri 404
- `GET /api/public/authors/:penNameSlug` — yazar public profili (pen_name, bio, avatar, sosyal linkler; e-posta, gerçek ad, doğum tarihi ASLA dönmez)

Tüm public yanıtlar cache'lenebilir (`Cache-Control`, ETag). Yayınlama/geri çekme işlemlerinde webhook ile ön yüz revalidate tetiklenir (`REVALIDATE_WEBHOOK_URL` env).

---

## 11. Güvenlik ve Uyum

- CSRF: server action ve mutasyon endpoint'lerinde origin kontrolü + token.
- Tüm girdiler zod ile doğrulanır; markdown render'da HTML sanitize (rehype-sanitize).
- Dosya yükleme: MIME + magic bytes kontrolü, boyut limiti (görsel 10 MB, PDF 20 MB), dosya adları sunucuda yeniden üretilir.
- Kimlik belgeleri: ayrı bucket/prefix, yalnızca admin için imzalı URL (5 dk), 90 gün sonra otomatik silme job'ı.
- Gizli değerler yalnızca env; `.env.example` eksiksiz.
- Loglarda şifre, token, kimlik belgesi yolu bulunmaz.
- KVKK: aydınlatma metni sürümlenir; kullanıcı verilerini JSON olarak dışa aktarma (veri taşınabilirliği) admin panelinden yapılabilir.
- Yedekleme: `scripts/backup.sh` ile Postgres dump + S3 sync; README'de geri yükleme adımları.

---

## 12. Bildirimler (e-posta)

Şablonlar `emails/` altında, adapter arkasında:
- E-posta doğrulama, şifre sıfırlama
- Yazar terfisi
- Yeni sözleşme sürümü (onay gerekli)
- Yeni devir formu bekliyor / hatırlatma (3 gün sonra otomatik)
- Devir formu imzalandı (yazara kopya)
- Makale durumu değişti (yazara: revision_requested, published, withdrawn)
- Zorunlu duyuru

---

## 13. Teslim Kriterleri

Aşağıdakiler sağlanmadan iş bitmiş sayılmaz:

1. `docker compose up` ile sistem ayağa kalkar; `pnpm seed` ilk admin'i ve örnek verileri oluşturur.
2. Playwright testleri geçer:
   - Kayıt → e-posta doğrulama → giriş
   - `user` rolüyle `/writer`, `/editor`, `/admin` erişim denemesi → 403
   - Admin'in 17 yaşındaki kullanıcıyı yazar yapma denemesi → reddedilir, gerekçe gösterilir
   - Terfi → sözleşme onayı → `writer_status = active`
   - Yeni sözleşme sürümü → yazar `pending_agreement`'a düşer
   - Makale `accepted` → `rights_grants` oluşur → imza olmadan `scheduled` denemesi 409 → imza → `scheduled` → `published`
   - `withdrawn` makale public API'de 410
   - Lisanssız medya bağlı makale `scheduled` olamaz
3. Birim testleri: durum makinesi, yaş hesaplama (artık yıl dahil), yetki kontrol fonksiyonları, hash üretimi.
4. `README.md`: kurulum, env değişkenleri, rol modeli özeti, yedekleme/geri yükleme.
5. `DECISIONS.md`: bu belgede karar verilmemiş her konuda verdiğin karar ve gerekçesi.
6. `pnpm typecheck` ve `pnpm lint` hatasız.

---

## 14. Yapmayacakların

- Ödeme, IBAN, fatura, vergi hesaplama
- Yazar tarafından makale gönderimi (yalnızca editör makale oluşturur)
- Sosyal login
- Yorum sistemi (okuyucu yorumları)
- Abonelik / ödeme duvarı
- Kendi kendine yazar başvuru formu
- JWT tabanlı stateless oturum
- Rol bilgisini client'tan güvenilir kabul eden herhangi bir kod yolu

---

## 15. Çalışma Düzeni

1. Önce `DECISIONS.md` iskeletini ve veri modelini (Drizzle şeması + migration) yaz.
2. Kimlik doğrulama ve rol/yetki katmanını tamamla, testlerini yaz.
3. Terfi akışı ve sözleşme onayı.
4. Makale durum makinesi ve devir formu.
5. Panel ekranları.
6. Public API ve webhook.
7. Uçtan uca testler, README.

Her adımda çalışan bir commit bırak. Bir adımın testleri geçmeden sonrakine geçme.
