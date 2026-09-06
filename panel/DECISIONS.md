# DECISIONS

Spesifikasyonda karara bağlanmamış konularda verilen kararlar ve gerekçeleri.
Kural: belirsizlikte en muhafazakâr / en güvenli seçenek.

---

## D-001 — Uygulamanın repo içindeki yeri

**Karar:** Panel, `postscript` reposunun kökü yerine `panel/` alt klasöründe yaşar.
Bu yüzden `README.md`, `DECISIONS.md`, `docker-compose.yml` gibi teslim kriterlerinde
geçen dosyalar `panel/` altındadır.

**Gerekçe:** Reponun kökünde halihazırda yayında olan statik "çok yakında" sayfası ve
ona bağlı bir GitHub Pages dağıtımı var. Kökü Next.js uygulamasına çevirmek yayındaki
sayfayı bozardı. Panel kendi kendine yeten bir uygulama olduğu için alt klasör en az
riskli seçenek.

---

## D-002 — Veritabanı sürücüsü ve testlerde Postgres

**Karar:** Üretim/geliştirme sürücüsü `postgres` (postgres.js) + Drizzle. Testlerde
gerçek bir Postgres sunucusu yerine `@electric-sql/pglite` (süreç içi, WASM Postgres)
kullanılır. `src/db/client.ts` her iki sürücüyü de aynı Drizzle arayüzü arkasında verir.

**Gerekçe:** Şema, migration ve sorgular gerçek Postgres semantiğiyle (uuid, jsonb,
enum, kısmi index) doğrulanmalı; SQLite ile taklit etmek yanlış güven verirdi. PGlite
aynı Postgres motorunu çalıştırdığı için testler Docker gerektirmeden gerçekçi kalır.

---

## D-003 — Docker yerel olarak doğrulanamadı

**Karar:** `docker-compose.yml` (Postgres + MinIO + Mailpit + uygulama) spesifikasyona
göre yazıldı, ancak bu geliştirme makinesinde Docker kurulu olmadığı için
`docker compose up` ile uçtan uca doğrulanmadı.

**Gerekçe:** Dosyayı yazmamak teslim kriterini karşılamazdı; doğrulandı demek ise
yanlış beyan olurdu. Docker olmadan çalıştırmak isteyen için README'de PGlite tabanlı
alternatif geliştirme yolu anlatıldı.

---

## D-004 — argon2id uygulaması

**Karar:** `@node-rs/argon2` (Rust, hazır derlenmiş ikili dosyalar).
Parametreler: `memoryCost = 19456 KiB (19 MiB)`, `timeCost = 2`, `parallelism = 1`,
`outputLen = 32`, `algorithm = argon2id`.

**Gerekçe:** OWASP Password Storage Cheat Sheet'in argon2id için önerdiği asgari
profil. `node-gyp` derlemesi gerektiren `argon2` paketinin aksine Windows dahil her
platformda kurulum sorunsuz.

---

## D-005 — Oturum jetonu saklama biçimi

**Karar:** Çerezde 256 bitlik rastgele jeton (base64url) taşınır. Veritabanında
yalnızca `sha256(token + SESSION_SECRET)` saklanır. Çerez: `httpOnly`, `SameSite=Lax`,
üretimde `Secure`, path `/`.

**Gerekçe:** Veritabanı sızarsa jetonlar doğrudan kullanılamaz. Peppper (`SESSION_SECRET`)
uygulama dışında tutulduğu için tek başına veritabanı dökümü oturum çalmaya yetmez.
JWT kullanılmadı; spesifikasyon açıkça yasaklıyor ve anında iptal edilebilirlik gerekiyor.

---

## D-006 — 2FA (TOTP) saklama ve kurtarma kodları

**Karar:** `users.totp_secret` alanı `SESSION_SECRET`ten türetilen anahtarla
AES-256-GCM ile şifrelenerek saklanır. 10 adet tek kullanımlık kurtarma kodu üretilir
ve yalnızca argon2id özetleri `totp_recovery_codes` tablosunda tutulur.
`editor` ve `admin` için 2FA zorunlu: 2FA kurulmadan oturum `pending_totp_setup`
durumunda kalır ve `/editor` `/admin` dışındaki tek erişilebilir sayfa 2FA kurulum
ekranıdır.

**Gerekçe:** Spesifikasyon "2FA kurulmadan panele giriş yok" diyor ama kurulumun nasıl
yapılacağını tanımlamıyor. Kullanıcıyı dışarıda bırakmak yerine yetkisiz alana
erişemeyeceği kilitli bir kurulum akışına almak hem güvenli hem kullanılabilir.

---

## D-007 — Hız sınırlama (rate limit) deposu

**Karar:** `auth_attempts` tablosunda veritabanı tabanlı sayaç. Anahtar
`(scope, identifier)` çiftidir: `register_ip`, `login_ip`, `login_account`,
`password_reset_ip`. Redis kullanılmadı.

**Gerekçe:** Spesifikasyonun yığınında Redis yok. Tek örnekli dağıtımda veritabanı
sayacı yeterli ve doğru; Redis eklemek doğrulanmamış bir bağımlılık olurdu. Sayaçlar
`expires_at` ile temizlenir.

---

## D-008 — Spesifikasyonda olmayan ama gereken tablolar

**Karar:** Şu tablolar eklendi: `auth_attempts` (D-007), `totp_recovery_codes` (D-006),
`kvkk_versions` (§11'de sürümlenmesi isteniyor, tablo tanımı verilmemiş),
`settings` (devir formu şablonu varsayılanları ve e-posta şablon başlıkları için
anahtar/değer), `notifications` (panel içi bildirim kuyruğu; e-posta gönderimi
başarısız olsa bile kullanıcı paneli görebilsin diye).

**Gerekçe:** Her biri §9 veya §11'de istenen bir ekranın veya kuralın veri karşılığı.
Yeni tablo eklemek, mevcut tabloları amacı dışında kullanmaktan daha temiz.

---

## D-009 — Kimlik belgeleri ayrı bucket ve otomatik silme

**Karar:** Kimlik belgeleri `S3_IDENTITY_BUCKET` içinde, `media.is_identity_document`
işaretiyle tutulur; `auto_delete_at = yükleme + 90 gün`. Silme işini
`scripts/purge-identity-documents.ts` yapar (cron ile günlük çalışacak şekilde
README'de anlatıldı). İmzalı URL ömrü 5 dakika ve yalnızca `admin` üretebilir.

**Gerekçe:** Spesifikasyon 90 gün sonra otomatik silmeyi istiyor ama zamanlayıcıyı
tanımlamıyor. Uygulama içi bir zamanlayıcı, çok örnekli dağıtımda mükerrer çalışır;
dışarıdan tetiklenen idempotent bir script daha güvenli.

---

## D-010 — Yayın zamanlaması (`scheduled` -> `published`)

**Karar:** Zamanlanmış yayına alma işi `scripts/publish-scheduled.ts` ile dışarıdan
(cron) tetiklenir; her çalışmada `scheduled_at <= now()` olan makaleleri durum geçiş
fonksiyonundan geçirir. Uygulama içinde `setInterval` tabanlı zamanlayıcı yok.

**Gerekçe:** D-009 ile aynı: idempotent, tek yerden tetiklenen, birden fazla uygulama
örneğiyle güvenli çalışan çözüm.

---

## D-011 — PDF üretimi

**Karar:** Sözleşme ve hak devri PDF'leri `pdf-lib` ile üretilir; markdown metni düz
metne indirgenerek sayfaya yazılır, dipnotta sürüm numarası ve sha256 özeti bulunur.

**Gerekçe:** Headless Chrome (Puppeteer) daha zengin çıktı verirdi ama konteynere
yüzlerce megabayt ve bir tarayıcı saldırı yüzeyi eklerdi. İspat için gereken şey
metnin kendisi ve hash'i; görsel zenginlik ikincil.

---

## D-012 — Markdown render ve sanitize

**Karar:** `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` +
`rehype-sanitize` (varsayılan GitHub şeması) + `rehype-stringify`. Ham HTML
markdown içinde kabul edilmez (`allowDangerousHtml` kapalı).

**Gerekçe:** Spesifikasyon rehype-sanitize istiyor. Varsayılan şema en kısıtlayıcı
makul seçenek; editörler HTML gömmek yerine markdown kullanır.

---

## D-013 — Yaş hesabı

**Karar:** Yaş, UTC takvim günü üzerinden hesaplanır: doğum günü henüz gelmediyse yıl
farkından bir çıkarılır. 29 Şubat doğumlular artık olmayan yıllarda 1 Mart'ta yaşını
doldurmuş sayılır.

**Gerekçe:** Zaman dilimine göre kayan bir yaş hesabı, sınırdaki bir kullanıcıyı
sunucunun bulunduğu bölgeye göre kabul edip reddederdi. 18 yaş kuralı kodda zorunlu
olduğu için hesabın deterministik olması şart.

---

## D-014 — Soft delete ve benzersizlik

**Karar:** `users.email` benzersizliği kısmi indexle (`WHERE deleted_at IS NULL`)
sağlanır; `articles.slug` ve `issues.number` için de aynı yaklaşım kullanılır.
Silinen kullanıcının e-postası anonimleştirme sırasında
`deleted+<uuid>@invalid.local` biçimine çevrilir.

**Gerekçe:** Tam benzersiz index, silinmiş bir kaydın e-postasını sonsuza dek rezerve
ederdi. Kısmi index, silinen kaydı saklarken adresin yeniden kullanılmasına izin verir.

---

## D-015 — `role_changes` ve `audit_log` değişmezliği

**Karar:** Değişmezlik iki katmanda: (1) uygulama katmanında bu tablolara yalnızca
`insert` yapan yardımcı fonksiyonlar var, (2) veritabanı katmanında `UPDATE` ve
`DELETE` işlemlerini engelleyen bir trigger migration'la kuruluyor.

**Gerekçe:** Spesifikasyon "uygulama katmanında engelle" diyor; veritabanı triggerı
bunu ücretsiz bir güvenlik ağı olarak ekler. Hatalı bir migration veya elle müdahale
de böylece engellenir.

---

## D-016 — Docker'sız geliştirme yolu

**Karar:** `DATABASE_URL=pglite://<dizin>`, `S3_ENDPOINT=file://<dizin>` ve
`MAIL_TRANSPORT=file` verildiğinde uygulama sırasıyla süreç içi PostgreSQL,
yerel diske yazan bir depolama ve dosyaya yazan bir e-posta adapteri kullanır.
PGlite bağlantısı eşzamanlı açılamadığı için `src/instrumentation.ts` içinde
sunucu açılışında kurulur; bağlantı `globalThis` üzerinde tutulur.

**Gerekçe:** Docker bu makinede yok (D-003) ve uçtan uca testlerin gerçek bir
sunucu sürmesi gerekiyordu. Üç adapteri de zaten arayüz arkasına aldığımız için
maliyet küçük, kazanç büyük: kurulum gerektirmeyen bir geliştirme ve test yolu.
`globalThis` kullanımı zorunlu; Next.js `instrumentation.ts`'i route handler'lardan
ayrı bir modül grafiğinde yükler, modül düzeyi bir değişken paylaşılmaz.

---

## D-017 — Uçtan uca testler üretim derlemesine karşı çalışır

**Karar:** `pnpm test:e2e` önce `.e2e/` veri dizinini siler, seed'ler, `next build`
alır ve `next start` ile sunar.

**Gerekçe:** `next dev`, `forbidden()` çağrıldığında kendi hata kabuğunu render
ediyor; `app/forbidden.tsx` yalnızca üretim derlemesinde çıkıyor. §13.2 hem 403
durum kodunu hem de kullanıcının gördüğü sayfayı istediği için testlerin üretim
davranışını sürmesi gerekiyor. Yan fayda: testler gerçekten dağıtılacak kodu
doğruluyor.

---

## D-018 — Alan bazlı hata mesajları formun başında toplanır

**Karar:** `PanelForm` alanları sunucudan gelen sıradan `children` olarak alır;
doğrulama mesajları her alanın yanında değil, formun başında alan adıyla
listelenir.

**Gerekçe:** Alanlar sunucu bileşeni içinde render ediliyor, form durumu ise
istemci bileşeninde yaşıyor. Sunucu bileşeni istemci durumuna abone olamaz.
Render-prop ile denendi ve React "Functions cannot be passed directly to Client
Components" hatası verdi. Alternatif, her alanı istemci bileşenine çevirmekti;
bu, tüm formu istemciye taşımak demekti. Mesajları tek yerde toplamak daha az
kod ve daha az istemci JavaScript'i.

---

## D-019 — İç içe form kullanılmaz

**Karar:** `PanelForm`'un `extraActions` özelliği kaldırıldı. Bir formun
yanındaki ikincil eylem (örneğin sözleşme taslağının yayınlanması) kendi
`<form>`'unda ve formun dışında durur.

**Gerekçe:** `extraActions` içine konan `ActionButton` kendi `<form>`'unu
render ediyordu; HTML iç içe form'a izin vermediği için tarayıcı iç formu
sessizce düşürüyor, düğme dıştaki formu gönderiyordu. Sözleşme yayınlama
düğmesi bu yüzden taslağı kaydediyordu. Özelliği kaldırmak, aynı hatanın
tekrarlanmasını da engelliyor.

---

## D-020 — Kısa sözleşme metinlerinde kaydırma kilidi

**Karar:** Onay kutusu, metin kutuya sığdığı için hiç kaydırma gerekmediğinde de
açılır (`scrollHeight <= clientHeight` kontrolü ilk render'da yapılır).

**Gerekçe:** §7.1 "en alta inmeden onay butonu aktif olmaz" diyor. Metin zaten
tamamen görünüyorsa kullanıcı en alttadır; kaydırma olayı hiç tetiklenmeyeceği
için kutu sonsuza dek kilitli kalıyordu. Sunucu tarafındaki asıl güvence
değişmedi: onay, gösterilen metnin hash'i kayıtlı sürümün hash'iyle
eşleşmediğinde reddedilir.

---

## D-021 — Kurulmuş bir 2FA'yı sıfırlamak doğrulama ister

**Karar:** `/two-factor/setup` sayfası, hesapta onaylanmış bir TOTP varsa ve
oturum ikinci faktörü henüz geçmemişse `/two-factor` sayfasına yönlendirir.
Yeniden kurulum yalnızca oturum mevcut faktörü kanıtladıktan sonra mümkündür.
Cihazını kaybeden kullanıcı `/two-factor` ekranında kurtarma kodlarından birini
kullanır.

**Gerekçe:** Kurulum sayfası açıldığında yeni bir gizli anahtar üretip
`totp_confirmed_at` alanını temizliyordu. Bu, ikinci faktörü henüz geçmemiş bir
oturumun yalnızca adrese giderek 2FA'yı devre dışı bırakabilmesi demekti; çalınan
bir oturum çerezi için doğrudan bir kaçış yolu. Yönlendirme bu yolu kapatırken
meşru yeniden kurulumu engellemiyor.

---

## D-022 — Kurtarma kodlarından sonraki adım

**Karar:** Kurtarma kodları gösterildikten sonra ekranda "kaydettim" onay kutusu
ve rolün ana sayfasına giden bir "Panele devam et" düğmesi bulunur; kutu
işaretlenmeden düğme açılmaz.

**Gerekçe:** Kodlar bir kez gösteriliyor ve yalnızca özetleri saklanıyor. Önceki
hâlde ekran kodlarda bitiyordu: kullanıcı için görünür bir sonraki adım yoktu ve
sayfadan ayrılmak kodları geri getirilemez biçimde kaybetmek anlamına geliyordu.
Onay kutusu, kullanıcıyı kodları kaydetmeden ilerlemekten alıkoyan tek ucuz
engel.

---

## D-023 — İkinci faktör paneller dışında da zorunlu

**Karar:** `requireAuth()` ve `requireSession()`, oturum ikinci faktörü borçluysa
(rol gereği zorunlu ya da kullanıcı isteğe bağlı olarak açmış) isteği reddeder;
sayfa `/two-factor` adresine yönlendirir, server action 403 döner.

**Gerekçe:** Faktör yalnızca panel katmanlarında (`guardPanel`, `requireRole`)
kontrol ediliyordu. `/account` sayfası ve tüm hesap eylemleri `requireAuth()`
kullandığı için, doğrulamayı geçmemiş bir oturum profili değiştirebiliyor,
diğer oturumları düşürebiliyor ve `disableTotpAction` ile faktörü tamamen
kapatabiliyordu. Bu, D-021'de kurulum sayfasında kapatılan deliğin ikinci
kapısıydı. Kontrol artık oturumun kendisinde, tek yerde.

---

## D-024 — Normal kullanıcıya da isteğe bağlı 2FA

**Karar:** İki adımlı doğrulama kartı `/account` sayfasına da eklendi; `user` ve
`writer` rolleri faktörü açıp kapatabilir, `editor` ve `admin` için zorunludur ve
kapatılamaz. Kart tek bir bileşende (`TwoFactorCard`) toplandı.

**Gerekçe:** Spesifikasyon §5.2 yalnızca editör/yönetici (zorunlu) ve yazar
(isteğe bağlı) diyor; normal kullanıcı için sessiz. Altyapı zaten her rol için
çalışıyordu — kurulum sayfasında rol kontrolü yok ve giriş akışı açılmış bir
faktörü her rolde zorluyordu — ama `/account` sayfasında hiçbir bağlantı yoktu:
özellik yalnızca adresi elle yazarak ulaşılabilir durumdaydı. Kararsız kalınan
yerde muhafazakâr seçenek, okuyucuya da güvenliği sunmak ve yarım kalmış yolu
görünür hâle getirmek.

---

## D-025 — İki adımlı doğrulama yalnızca admin rolünde

**Karar:** TOTP yalnızca `admin` rolünde bulunur ve kapatılamaz. `editor`,
`writer` ve `user` rollerinde ikinci faktör yoktur; kurulum sayfası bu rolleri
kendi ana sayfalarına yönlendirir ve profil ekranlarında bir açma/kapama seçeneği
sunulmaz. Faktörün beklenip beklenmediğine artık yalnızca rol karar verir, bu
yüzden rolü değişmiş bir hesapta kalan gizli anahtar atıl hâle gelir ve o hesabı
kilitlemez.

**Gerekçe:** Spesifikasyon §5.2 editör için de zorunlu, yazar için isteğe bağlı
diyor. Ürün sahibi bunu daraltmayı istedi. Bu bilinçli bir güvenlik gevşemesidir:
editör makale yayınlayıp geri çekebilen, medya kütüphanesini ve duyuruları
yöneten bir rol; artık o hesaplar yalnızca şifreyle korunuyor. Karşılığında
günlük kullanım belirgin biçimde basitleşiyor. Karar kayda geçirildi ki ileride
gözden geçirilebilsin.

---

## D-026 — Şifre kuralları ve canlı denetim listesi

**Karar:** Şifre en az 8 karakter olmalı, hem büyük hem küçük harf ve en az bir
rakam içermeli. Kurallar `src/lib/password-rules.ts` içinde tek bir yerde
tanımlı; `server-only` içermez, çünkü aynı fonksiyonları hem tarayıcıdaki canlı
denetim listesi hem de sunucudaki `checkPasswordPolicy` çalıştırır. Üç kural da
sağlanmadan kayıt ve şifre yenileme düğmeleri açılmaz.

**Gerekçe:** §5.1 asgari 10 karakter diyordu, karmaşıklık şartı yoktu. Ürün
sahibi 8 karakter + büyük/küçük harf + rakam istedi. İki karakterlik kayıp,
karakter kümesi genişlemesiyle fazlasıyla telafi ediliyor. Kuralların tek yerde
durması şart: denetim listesi sunucunun reddedeceği bir şifreyi asla onaylı
gösteremez. Yaygın şifre listesi kontrolü sunucuda kaldı — listeyi canlı olarak
göstermek listeyi sızdırmak olurdu.

---

## D-027 — Yazar bağlantıları

**Karar:** Profil bağlantıları X, Instagram, TikTok ve Substack. Önceki alanlar
(`website`, `linkedin`, `mastodon`) kaldırıldı.

**Gerekçe:** Ürün sahibinin derginin fiilen kullandığı mecralara göre isteği.
Alan `jsonb` olduğu için migration gerekmedi; eski anahtarlar taşıyan kayıtlar
varsa okunmaz hâle gelir, form kaydedildiğinde temizlenir.

---

## D-028 — Sözleşme metni depoda, sürüm onun anlık görüntüsü

**Karar:** Sözleşme metni `contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`
dosyasıdır. Panelde sözleşme metni yazılmaz; yönetici "şablondan sürüm oluştur"
der, sistem dosyayı okur, ham metnin SHA-256'sını `body_hash` olarak,
metnin kendisini `body_markdown` olarak kaydeder. Aynı metinden ikinci bir sürüm
oluşturulamaz (409). Şablon her render'da diskten okunur, önbelleğe alınmaz.

**Gerekçe:** Sözleşme sürüm prompt'unun §11'i şablonun koddan değiştirilmesini
yasaklıyor ve her metin değişikliğini yeni sürüm sayıyor. Dosya olması
değişikliği gözden geçirilebilir bir diff hâline getirir. Sürümün metni
kopyalaması şart: dosya ilerlerse imzalanmış sözleşmelerin dayandığı metin
değişmemelidir. Önbellek kaldırıldı çünkü dosya değiştiği anda bayat kalıyordu
ve yeni sürüm oluşturmayı imkânsız hâle getiriyordu.

---

## D-029 — `{{kvkk.version}}` kaynağı

**Karar:** Yer tutucu, spesifikasyondaki `site_settings.kvkk_current_version`
yerine `kvkk_versions` tablosundaki güncel sürümden okunur.

**Gerekçe:** Sistemde zaten sürümlenen, hash'lenen ve yayın tarihi tutulan bir
KVKK tablosu var. Aynı bilgiyi ikinci kez elle yazılan bir ayar olarak tutmak,
iki kaynağın birbirinden sapmasına açık kapı bırakırdı: sözleşme, yayında
olmayan bir aydınlatma metni sürümüne atıf yapabilirdi. Yayınlanmış bir KVKK
metni yoksa render başarısız olur ve terfi reddedilir — sessizce yanlış sürüm
yazmaktansa açıkça durmak doğru.

---

## D-030 — Yayımlanmış eserin metni yerinde değiştirilemez

**Karar:** Editör, `published` veya `archived` bir eseri "içerik değişikliği"
olarak kaydetmeye çalışırsa 409 alır: önce geri çekmesi gerekir. `scheduled` bir
eserde içerik değişikliği onayı iptal eder ve eser `awaiting_rights`'a döner;
daha erken durumlarda yalnızca onay yenilenir.

**Gerekçe:** §7.5 içerik değişikliğinde eserin `awaiting_rights`'a dönmesini
istiyor ama durum makinesinde `published → awaiting_rights` kenarı yok ve
olmamalı. Yayındaki bir sayfayı tek adımda sessizce yeniden yazmak, o an
yayında olan metni kapsayan ruhsatın dışına çıkmak demektir. Geri çekmeyi
zorunlu kılmak bu kararı editörün önüne açıkça koyar.

---

## D-031 — Sözleşme PDF'lerine erişim

**Karar:** `license_type = contract_pdf` olan medya yalnızca üzerinde adı geçen
yazar ve admin tarafından okunabilir; editör erişemez. Depolama sürücüsü imzalı
URL üretebiliyorsa (S3/MinIO) 5 dakikalık imzalı URL'ye yönlendirilir, aksi
hâlde dosya oturum doğrulanmış rota üzerinden akıtılır.

**Gerekçe:** §8 imzalı URL istiyor; yerel disk sürücüsü imza üretemiyor.
Oturum doğrulanmış akıtma en az imzalı URL kadar kısıtlayıcı — hatta daha
fazlası, çünkü sunucudan oturumsuz çalışan hiçbir bağlantı çıkmıyor. Her iki
yolda da editör kapının dışında.

---

## D-032 — "Yayıncı ayarı eksik" senaryosu uçtan uca değil, entegrasyonda

**Karar:** §10'un "site_settings.publisher_partner_2 boş → terfi reddedilir,
gerekçe dergi.ortak_2" senaryosu Playwright yerine entegrasyon testinde.

**Gerekçe:** Ayarı boşaltmak için ya form doğrulamasını kırmak ya da testten
veritabanına ikinci bir bağlantı açmak gerekiyordu; PGlite dizini sunucu
tarafından kilitli olduğu için ikincisi mümkün değil, birincisi de test uğruna
üretim davranışını gevşetmek olurdu. Aynı kural entegrasyon testinde tam olarak
doğrulanıyor: eksik ayarla terfi reddediliyor ve gerekçe `dergi.ortak_2` yer
tutucusunu adıyla söylüyor.
