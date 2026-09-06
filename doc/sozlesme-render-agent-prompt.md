# GÖREV: Yazar Sözleşmesi Şablon Doldurma, Onay ve Eser Onayı Akışı

Bu görev `dergi-panel-agent-prompt.md` ana spesifikasyonunun üzerine eklenir. Oradaki teknoloji yığını, rol modeli, veri modeli ve kurallar aynen geçerlidir. Çelişki olursa bu belge kazanır; kararı `DECISIONS.md`'ye yaz.

Belirsizlik gördüğün yerde soru sorma; en muhafazakâr güvenli seçeneği uygula ve gerekçesiyle `DECISIONS.md`'ye yaz.

---

## 1. Amaç

Admin bir kullanıcıyı `writer` rolüne yükselttiğinde sistem, güncel sözleşme şablonunu (`agreement_versions.is_current = true`) o kullanıcının verileriyle doldurup yazara gösterir; yazar tam metni okuyup onaylar; sistem onayı ispat edilebilir biçimde kaydeder ve PDF üretir. Sonrasında her makale için tek tıklık Eser Onayı alınır.

Sözleşme metni repoda `contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md` dosyasındadır. Bu dosya şablondur; içindeki `{{...}}` yer tutucuları çalışma anında doldurulur. Şablon metnini değiştirme; yalnızca yer tutucuları doldur.

---

## 2. Ana Spesifikasyonda Değişen Noktalar

1. `rights_grants` artık "form" değil "Eser Onayı" kaydıdır. Admin'in "form şablonu" ayarı **kaldırılır**; ruhsat kapsamı sözleşme metninde sabittir (Madde 4). `rights_grants` alanları (`grant_type`, `right_*`, `channels`, `territory`, `consideration`, `commercial_use_included`) sözleşme sürümünün sabit değerleriyle otomatik doldurulur ve editör tarafından değiştirilemez.
2. Eser başına PDF form üretilmez. Eser Onayı'nda yalnızca kısa bir "onay kaydı" PDF'i üretilir (bkz. §7).
3. `co_author_ids` kaldırılmıştır. `identity_verified_at`, `identity_verified_by` ve kimlik belgesi akışı kaldırılmıştır. Terfi ön koşullarından "kimlik doğrulama" çıkar; yaş kontrolü `birth_date` beyanına dayanır.
4. Yazar paneli "Devir formları" sekmesi "Eser Onayları" olur.

---

## 3. Yer Tutucu Sözlüğü

Şablondaki her yer tutucu aşağıdaki kaynaktan doldurulur. Sözlükte olmayan bir yer tutucu şablonda geçiyorsa render **başarısız olur** (hata fırlatılır, sözleşme gösterilmez, olay `audit_log`'a düşer). Sessizce boş bırakma.

| Yer tutucu | Kaynak | Not |
|---|---|---|
| `{{agreement.version}}` | `agreement_versions.version` | |
| `{{agreement.published_at}}` | `agreement_versions.published_at` | `GG.AA.YYYY` |
| `{{agreement.body_hash}}` | `agreement_versions.body_hash` | Şablonun ham hash'i, bkz. §5 |
| `{{dergi.ortak_1}}` | `site_settings.publisher_partner_1` | Ad Soyad; boşsa render başarısız |
| `{{dergi.ortak_2}}` | `site_settings.publisher_partner_2` | Ad Soyad; boşsa render başarısız |
| `{{dergi.adres}}` | `site_settings.publisher_address` | |
| `{{dergi.eposta}}` | `site_settings.publisher_email` | |
| `{{dergi.domain}}` | `site_settings.public_domain` | |
| `{{dergi.sehir}}` | `site_settings.jurisdiction_city` | |
| `{{yazar.ad_soyad}}` | `users.display_name` | |
| `{{yazar.dogum_tarihi}}` | `users.birth_date` | `GG.AA.YYYY`; boşsa render başarısız |
| `{{yazar.eposta}}` | `users.email` | |
| `{{yazar.mahlas}}` | `users.pen_name` | Boşsa `—` yazılır (tek istisna) |
| `{{kvkk.version}}` | `site_settings.kvkk_current_version` | |
| `{{acceptance.accepted_at}}` | Onay anı | Onaydan önceki önizlemede `(onay bekliyor)` |
| `{{acceptance.ip}}` | Onay anı | Onaydan önceki önizlemede `(onay bekliyor)` |

`site_settings` tablosu yoksa oluştur: `key` (unique), `value` (text), `updated_by`, `updated_at`. Yalnızca admin düzenler; her değişiklik `audit_log`'a düşer.

---

## 4. Render Kuralları

- Şablon markdown'dır. Yer tutucular `{{` ve `}}` arasında, boşluksuz, `a.b_c` biçiminde.
- Kullanıcıdan gelen her değer (`display_name`, `pen_name`, `email`) yerleştirilmeden önce **markdown ve HTML kaçışlanır**. `display_name = "# Ali"` girildiğinde başlık oluşmaz, `# Ali` metni görünür. `rehype-sanitize` render sonrasında da çalışır.
- Render fonksiyonu saf ve deterministiktir: aynı şablon + aynı değerler → bayt bayt aynı çıktı. Tarih ve IP dışında hiçbir değer çalışma zamanına bağlı olamaz.
- Render edilmiş metin `agreement_acceptances.rendered_markdown` alanına kaydedilir (yeni alan, `text`). Onaydan sonra bu alan değiştirilemez.
- Fonksiyon imzası: `renderAgreement(templateMarkdown, context): { markdown, hash }`. `context` zod ile doğrulanır; eksik alan → `AgreementRenderError` (hangi yer tutucunun eksik olduğunu içerir).

---

## 5. Hash Kuralları

İki ayrı hash vardır; karıştırma:

1. **`agreement_versions.body_hash`**: yer tutucuları doldurulmamış ham şablonun SHA-256'sı. Sürüm yayınlanırken bir kez hesaplanır. Şablon dosyası değişirse yeni sürüm gerekir.
2. **`agreement_acceptances.body_hash_at_acceptance`**: yazara gösterilen **doldurulmuş** metnin SHA-256'sı. Onay anında sunucu, ekranda gösterilen metni yeniden render edip hash'ler; istemciden gelen hash'e güvenmez. Sunucunun hesapladığı hash ile onay isteğindeki hash eşleşmezse onay reddedilir (409).

Hash girdisi: UTF-8, satır sonları `\n`'e normalize edilmiş, sondaki boşluklar kırpılmış markdown metni. Normalizasyon fonksiyonu tek yerde tanımlanır ve her iki hash için de kullanılır.

---

## 6. Terfi ve Sözleşme Onayı Akışı

### 6.1 Admin "Yazar yap" der
Sunucu sırayla kontrol eder; herhangi biri başarısızsa terfi reddedilir, eksikler admin'e liste olarak döner:
1. `email_verified_at` dolu
2. `birth_date` dolu ve bugün itibarıyla ≥ 18 yaş (artık yıl dahil doğru hesap)
3. `kvkk_consent_at` dolu
4. `is_banned = false`
5. `agreement_versions.is_current = true` olan bir sürüm var
6. Sözleşme bu kullanıcı için **render edilebiliyor** (`renderAgreement` hata vermiyor). Bu kontrol terfi işleminin parçasıdır; `site_settings` eksikse terfi "sözleşme ayarları eksik: dergi.ortak_2" gerekçesiyle reddedilir.

Başarılıysa: `role = writer`, `writer_status = pending_agreement`, `role_changes` kaydı, yazara e-posta (sözleşme onayı çağrısı + panel linki).

### 6.2 Yazar sözleşme sayfasını açar (`/writer/agreement`)
- Sunucu şablonu yazarın verileriyle render eder, `acceptance.*` alanlarına `(onay bekliyor)` yazar.
- Tam metin scroll ile gösterilir. En alta inmeden onay kutusu aktif olmaz (IntersectionObserver ile son paragraf görünür olunca).
- "Okudum, anladım, kabul ediyorum" kutusu + "Onayla" butonu.
- Sayfa, gösterilen metnin hash'ini gizli alanda taşır; sunucu bunu §5.2'ye göre doğrular.

### 6.3 Onay
Sunucu tek transaction içinde:
1. Şablonu yeniden render eder, hash'i doğrular.
2. `acceptance.accepted_at` ve `acceptance.ip` yer tutucularını gerçek değerlerle doldurup **son metni** üretir.
3. `agreement_acceptances` kaydı: `user_id`, `agreement_version_id`, `accepted_at`, `ip`, `user_agent`, `body_hash_at_acceptance` (adım 1'deki hash), `rendered_markdown` (adım 2'deki son metin).
4. Son metinden PDF üretir (§8), S3'e yazar, `agreement_acceptances.pdf_media_id` (yeni alan) set eder.
5. `users.writer_status = active`.
6. `audit_log` kaydı.
7. Yazara PDF ekli e-posta.

Adımlardan biri başarısız olursa hiçbiri kalıcı olmaz.

### 6.4 Yeni sürüm yayınlandığında
Ana spesifikasyon §7.1 geçerli. Ek: bekleyen Eser Onayları yeni sürüm onaylanana kadar verilemez; yazar paneli bunu açıkça yazar.

---

## 7. Eser Onayı Akışı (makale başına tek tıklama)

### 7.1 Tetikleyici
Editör makaleyi `accepted` yapınca sistem `rights_grants` kaydı oluşturur (`status = pending`), alanları güncel sözleşme sürümünün sabit değerleriyle doldurur:
`grant_type = non_exclusive_license`, `right_reproduction = true`, `right_distribution = true`, `right_communication_to_public = true`, `right_adaptation = true` (kapsam: sözleşme Madde 4.2), `channels = [web, pdf_issue, social, newsletter]`, `territory = worldwide`, `exclusivity_months = null`, `consideration = none`, `commercial_use_included = false`, `agreement_version_id` (yeni alan: onayın hangi sözleşme sürümüne dayandığı). Makale `awaiting_rights` olur. Yazara e-posta.

### 7.2 Yazar ekranı (`/writer/approvals`)
Bekleyen her makale için tek satır: makale başlığı, kabul edilen metnin SHA-256 özeti (`articles.body_markdown` üzerinden, §5'teki normalizasyonla), sözleşme sürüm no, ad gösterim tercihi (`pen_name` varsa mahlas, yoksa gerçek ad; yazar bu satırda değiştirebilir), "Bu eseri Sözleşme'nin 4. maddesindeki şartlarla ruhsatlıyorum" kutusu, "Onayla" ve "Reddet (gerekçeli)" butonları. Sözleşme Madde 4'e giden bağlantı.

Ön koşul: `writer_status = active`. Değilse ekran kilitli, gerekçe gösterilir.

### 7.3 Onay
Tek transaction:
1. Sunucu makale metninin hash'ini yeniden hesaplar; ekrandaki hash ile eşleşmezse 409 (metin onay sırasında değişmiş).
2. `rights_grants`: `status = signed`, `signed_at`, `signed_ip`, `signed_user_agent`, `form_text_hash` = makale hash'i, `byline_choice` (yeni alan: `real_name | pen_name`).
3. Onay kaydı PDF'i (§8, kısa biçim) üretilir, `form_pdf_media_id` set edilir.
4. Makale `scheduled`'a geçmeye uygun hale gelir (geçiş editörün işi; otomatik değil).
5. `audit_log`; yazara PDF ekli e-posta.

### 7.4 Ret
`status = declined`, `declined_at`, `declined_reason` (zorunlu, min 10 karakter). Makale `revision_requested`. Editöre e-posta.

### 7.5 Metin değişirse
Editör, `signed` bir makalenin `body_markdown`'ını sözleşme Madde 6.2 kapsamı dışında değiştirirse (sistem bunu bilemez; editör kaydederken "içerik değişikliği mi, düzeltme mi" seçer; seçim `article_versions.change_kind` alanına yazılır) → içerik değişikliğinde mevcut `rights_grants` `revoked` (`revoked_by = editor`), yeni `pending` kayıt, makale `awaiting_rights`'a döner. Düzeltmede onay korunur.

`rights_grants` üzerinde partial unique index: `UNIQUE (article_id) WHERE status IN ('pending','signed')`.

---

## 8. PDF Üretimi

- Kütüphane: sunucu tarafında çalışan, dış servis gerektirmeyen bir yöntem (örn. `@react-pdf/renderer` veya headless Chromium; seçimi `DECISIONS.md`'ye yaz). Türkçe karakterleri tam destekleyen gömülü font (DejaVu veya Noto). Fontlar repoda.
- Sözleşme PDF'i: render edilmiş son markdown'ın tam metni, A4, sayfa numarası, her sayfanın altbilgisinde `Sürüm {version} — {body_hash_at_acceptance ilk 16 hex} — {accepted_at}`.
- Eser Onayı PDF'i (tek sayfa): dergi adı, yazar adı, makale başlığı, makale hash'i, sözleşme sürümü ve hash'i, onay tarih-saati, IP, tarayıcı, byline tercihi, onay ifadesinin tam metni. Makale metni PDF'e konmaz.
- PDF'ler `media` tablosuna `license_type = contract_pdf` ile girer, ayrı prefix (`contracts/`), yalnızca ilgili yazar ve admin imzalı URL ile (5 dk) indirir. Editör erişemez.
- PDF üretimi deterministik olmak zorunda değildir; ispat değeri `rendered_markdown` ve hash'tedir, PDF okunabilir kopyadır.

---

## 9. Yönetici Ekranları

- **Kullanıcılar → Yazar yap:** ön koşul listesi, her biri için ✓/✗ ve eksik açıklaması; "Sözleşme önizleme" butonu (admin, terfiden önce o kullanıcı için doldurulmuş sözleşmeyi görebilir; bu önizleme kaydedilmez).
- **Sözleşme sürümleri:** yeni sürüm oluştururken şablonda geçen tüm yer tutucular listelenir ve sözlükte olmayanlar kırmızı işaretlenir; sözlük dışı yer tutucu varken yayınlanamaz.
- **Sistem → Yayıncı bilgileri:** `site_settings` alanları formu. Kaydetmeden önce "bu değerlerle örnek sözleşme render et" testi çalışır.
- **Onay raporu:** sürüm bazında kim onayladı / kim bekliyor; Eser Onayı bekleyen makaleler ve bekleme süresi; 3 günü geçenlere "hatırlat" butonu (ana spesifikasyon §12 otomatik hatırlatma da çalışır).

---

## 10. Testler

Birim (Vitest):
- `renderAgreement`: tüm yer tutucular doluyken çıktı snapshot ile birebir; eksik `birth_date` → `AgreementRenderError` mesajında `yazar.dogum_tarihi`; `display_name = "# Ali"` → çıktıda başlık yok, kaçışlanmış metin var; iki kez çağrıldığında bayt bayt aynı çıktı.
- Hash normalizasyonu: `\r\n` ve `\n` aynı hash'i verir; sondaki boşluk fark yaratmaz.
- Yaş hesabı: 29 Şubat doğumlu için 28 Şubat / 1 Mart sınır durumları; tam 18 yaş günü → geçer, bir gün öncesi → geçmez.

Uçtan uca (Playwright):
- Terfi → `site_settings.publisher_partner_2` boş → terfi reddedilir, gerekçe "dergi.ortak_2".
- Terfi → sözleşme sayfası → scroll etmeden buton pasif → en alta inince aktif → onay → `writer_status = active`, `agreement_acceptances` kaydı, PDF indirilebilir, e-posta gönderildi.
- Onay isteğinde hash oynanmış → 409, kayıt oluşmaz.
- Makale `accepted` → `rights_grants` pending → yazar onaylar → `signed` → editör `scheduled` yapabilir. Onaysız `scheduled` denemesi 409.
- Makale `signed` iken editör "içerik değişikliği" ile kaydeder → eski onay `revoked`, yeni `pending`, makale `awaiting_rights`.
- Yeni sözleşme sürümü yayınlanır → yazar `pending_agreement` → Eser Onayı ekranı kilitli → yeni sürüm onaylanır → ekran açılır.

---

## 11. Yapmayacakların

- İstemciden gelen hash, tarih veya kullanıcı bilgisine güvenmek.
- Eksik yer tutucuyu boş string ile doldurmak.
- Şablon metnini koddan değiştirmek; her metin değişikliği yeni `agreement_versions` sürümüdür.
- Editöre sözleşme veya onay PDF'lerine erişim vermek.
- Eser başına ruhsat kapsamını (haklar, mecralar, süre) değiştirilebilir yapmak; kapsam sözleşme sürümüne bağlıdır.
- Onayı `rights_grants` kaydı olmadan makale durumuna yazmak.

---

## 12. Çalışma Sırası

1. `site_settings` tablosu + migration; yer tutucu sözlüğü ve `renderAgreement` + birim testleri.
2. Hash normalizasyonu + testleri.
3. Terfi ön koşulları (render kontrolü dahil) + admin ekranı.
4. Sözleşme onay sayfası + onay transaction'ı + PDF + e-posta.
5. Eser Onayı akışı + `rights_grants` değişiklikleri + partial index.
6. Uçtan uca testler; `README.md` ve `DECISIONS.md` güncellemesi.

Her adımda çalışan bir commit bırak. Bir adımın testleri geçmeden sonrakine geçme.
