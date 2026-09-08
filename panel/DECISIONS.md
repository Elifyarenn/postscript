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

**Karar:** ~~Kimlik belgeleri `S3_IDENTITY_BUCKET` içinde, `media.is_identity_document`
işaretiyle tutulur; `auto_delete_at = yükleme + 90 gün`. Silme işini
`scripts/purge-identity-documents.ts` yapar (cron ile günlük çalışacak şekilde
README'de anlatıldı). İmzalı URL ömrü 5 dakika ve yalnızca `admin` üretebilir.~~

**İPTAL EDİLDİ — D-047:** Kimlik belgesi adımı ürün kapsamından çıkarıldı;
`S3_IDENTITY_BUCKET`, ilgili depolama yardımcıları ve env değişkeni kaldırıldı.
Bu kararın geri kalanı yalnızca tarihî kayıttır.

**Gerekçe (orijinal):** Spesifikasyon 90 gün sonra otomatik silmeyi istiyor ama zamanlayıcıyı
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

---

## D-033 — İki adımlı doğrulama geçici olarak kaldırıldı

**Karar:** TOTP tamamen kaldırıldı: `users.totp_secret`,
`users.totp_confirmed_at`, `sessions.totp_verified_at` sütunları ve
`totp_recovery_codes` tablosu düşürüldü; kurulum ve doğrulama ekranları,
`src/lib/auth/totp.ts`, `otpauth` ve `qrcode` bağımlılıkları silindi. Tüm
roller yalnızca e-posta ve şifreyle giriyor. **Yayın öncesi baştan
tasarlanacak.**

**Gerekçe:** Ürün sahibi geliştirme sırasında sürekli engellendiğini bildirdi ve
kaldırılmasını istedi. Bu, §5.2'nin editör ve yönetici için zorunlu tuttuğu bir
kontrolü kaldırmak demektir; D-021, D-022, D-023, D-024 ve D-025 bu kararla
birlikte geçersiz kalır. Yarım bırakıp bayrakla kapatmak yerine tamamen
silmeyi seçtim: kullanılmayan bir kimlik doğrulama yolu, açık bırakılmış bir
kapıdan farksızdır ve geri eklenirken yeniden gözden geçirilmesi gerekir.
Kaldırma tek bir migration'da (`0004`) toplandı, geri eklemek de öyle olacak.

**Yayın öncesi geri eklenirken:** en azından editör ve yönetici için zorunlu
olmalı, oturum ikinci faktörü geçmeden panel dışında da (`/account` ve hesap
eylemleri) iş göremez olmalı (D-023'ün kapattığı açık), ve kurulmuş bir faktörü
sıfırlamak mevcut faktörü kanıtlamayı gerektirmeli (D-021'in kapattığı açık).

---

## D-034 — Doğrulanmamış e-posta sert bir kapıdır

**Karar:** Kayıt olan hesap oturum açar ama e-posta adresini doğrulayana kadar
`/verify-email/pending` dışında hiçbir sayfayı göremez, hiçbir mutasyonu
çalıştıramaz. Kapı üç katmanda birden duruyor: `requireSession` doğrulanmamış
oturumu bu sayfaya yönlendiriyor, `requireAuth`/`requireRole` 403 veriyor, ve
`src/services/users.ts` içindeki `assertAccountUsable` profil güncelleme, hesap
silme talebi ve talebin iptalinde aynı kontrolü servis katmanında tekrar
yapıyor. Bekleme sayfasında yalnızca iki şey var: yeni bağlantı istemek
(60 saniyede bir) ve çıkış yapmak. Bağlantı aynı tarayıcıda açılırsa kullanıcı
doğrudan içeri alınır (`?verified=1`), başka bir tarayıcıda açılırsa
`/login?verified=1`'e gider.

**Gerekçe:** SPEC §5.1 kayıttan sonra oturumun açılmasını ve doğrulanmamış
hesabın profilini kullanabilmesini öngörüyordu; ürün sahibi "kullanıcılar kayıt
olurken mail doğrulaması olsun mutlaka" dedi, bu yüzden spesifikasyondan
bilerek sapıldı. Yalnızca panelleri kapatmak yetmiyordu: doğrulanmamış bir
hesap profil adını değiştirebiliyor, şifresini değiştirebiliyor, oturumlarını
iptal edebiliyor ve hesap silme talebi açabiliyordu — yani adresi hiç kendisine
ait olmayan biri hesabı kullanabiliyordu. Kontrolü servis katmanına da koymamın
sebebi, entegrasyon testinin action katmanının etrafından dolaşıp `updateProfile`
çağırabildiğini ve başarılı olduğunu göstermesiydi; iş kuralı tek yerde,
servis katmanında durmalı.

**Sınır:** Bekleme sayfası bilinçli olarak `requireSession` kullanmaz —
kullansaydı kendi kendine yönlenirdi; `getAuthContext` ile çalışır ve oturum
yoksa `/login`'e, adres doğrulanmışsa `/`'a gider.

---

## D-037 — Yazar başvuru ve onay pipeline'ı

**Karar:** "Yazar başvuru formu yok" kararı kaldırıldı; yerine dört aşamalı bir
pipeline geldi. `writer_applications` tablosu eklenir; durumlar veri olarak
tanımlı bir geçiş tablosuyla `submitted → editor_approved → admin_approved →
signed` sırasında ilerler (red: `editor_rejected` / `admin_rejected`), dışı 409.
Örnek eser dosyası medya bucket'ında `writer-applications/` ön ekiyle saklanır,
`license_type` null kalır; yalnızca başvuru sahibi, editör ve yönetici okur.
Admin onayında o anki güncel sözleşme sürümü başvuruya tanımlanır; imzada
kullanıcı güncel sürümü imzalar (arada yeni sürüm yayınlanmışsa yenisi). İmza,
`agreement_acceptances` kaydı + `role_changes` kaydı + `role=writer,
writer_status=active` geçişini tek işlemde yapar.

**Gerekçe:** Ürün sahibi, yazar kazanımını başvuru ve iki aşamalı onayla
başlatmayı istedi. Aylık sınır (son 30 günde 1 başvuru) sonucu ne olursa olsun
aynıdır: kabul edilmeyen başvuru sahibi de 30 gün bekler, böylece pipeline
yeniden denemeyle spam'lenemez. Dosya doğrulaması yalnızca sihirli baytlaradır
(PDF `%PDF-`, DOCX ZIP imzası); dosya özel bir bucket'ta durduğu ve hiçbir zaman
HTML olarak render edilmediği için bildirilen MIME ile karşılaştırma gereksizdir.
`canSubmitApplication` yalnızca rolü denetler: doğrulanmamış veya yasaklı
okuyucunun, eksikleri isimleriyle söyleyen ön koşul hatasına (409 + requirements)
ulaşması gerekir; çıplak 403 daha az bilgilendiricidir. Hesap sayfasındaki başvuru
kartı, imzalanmış başvurusu olan yazarlar için de render edilir — aksi hâlde
"yazar oldunuz" durumu hiç görünmezdi.

---

## D-038 — Demo kullanıcıları seed'de varsayılan olarak kapalı

**Karar:** `scripts/seed.ts` varsayılan olarak yalnızca ilk admini, KVKK metnini,
yayınlanmış çerçeve sözleşmeyi ve yayıncı bilgilerini oluşturur. Eski placeholder
hesaplar (editor, yazar, okur, aday, genç) ve örnek içerik yalnızca
`SEED_DEMO_USERS=1` ile açılır. E2E paketi bu bayrağı kendi ortamında açar.

**Gerekçe:** Demo hesapları bilinen, depoda yazılı şifrelerle çalışıyordu; üretim
seed'i bu yüzden "çalıştırma" diye uyarıyordu ama hesaplar yine de oluşuyordu.
Ürün sahibi placeholder kullanıcıların eski olduğunu ve kaldırılmasını istedi.
Bayrakla kapatmak, e2e testlerinin ihtiyaç duyduğu hesapları korurken üretim
seed'ini güvenli hâle getirir; geliştirmede isteyen `SEED_DEMO_USERS=1` ile
hesapları geri alabilir. Bayrak kapalıyken yazar-onayı ve örnek içerik adımları
da atlanır (bunlar demo yazar hesabına bağlıydı).

---

## D-035 — Tek giriş kapısı ve okuyucunun okuma alanı

**Karar:** Giriş ekranı artık kendini "yönetim paneli" diye tanıtmıyor;
`postscript · e-dergi` yazıyor ve herkes aynı formdan giriyor. Kök adres
girişten sonra rolüne göre yönlendiriyor: admin → `/admin`, editör →
`/editor`, yazar → `/writer`, okuyucu → `/magazine`. Okuyucu için
`/magazine` altında bir okuma alanı eklendi: son yazılar, sayılar, sayı
içindekiler, yazı ve yazar sayfaları. Okuyucunun kenar çubuğunda yalnızca
"Dergi", "Sayılar" ve "Hesabım" var.

**Gerekçe:** Ürün sahibi giriş ekranının yönetim paneli gibi görünmesini
istemedi; kayıtlı okuyucu için giriş yaptıktan sonra hesap ayarları sayfasına
düşmek de anlamsızdı. Okuma alanı yeni bir veri yolu açmıyor:
`src/services/public.ts` içindeki public read model'leri kullanıyor, bu yüzden
okuyucu ekranı public API ile aynı alanları görüyor ve yazarın e-postası, gerçek
adı, doğum tarihi hiçbir yerde geçmiyor. Tek eklenen read model
`listRecentArticles`: bir yazı, sayısı yayınlanmadan da yayınlanabildiği için
ana ekran sayı listesiyle değil son yazılarla açılıyor.

**Sınırlar:** `/magazine` oturum ister (rol istemez), çünkü bu uygulama
tümüyle `robots: noindex` ile çalışıyor ve halka açık site public API'yi
tüketiyor. Sayı kapakları listede gösterilmiyor: `/api/media/:id` sıradan medya
için editör yetkisi arıyor, okuyucuya kapak servis etmek o kuralı gevşetmek
olurdu. Geri çekilmiş yazı okuyucuya 410 yerine "bu yazı geri çekildi" uyarısıyla
gösteriliyor; 410 sözleşmesi public API'nin sözleşmesidir, ekranda insana
söylenen cümle daha yararlı.

---

## D-036 — E-posta değiştirme: bekleyen adres, değişim bağlantısıyla onaylanır

**Karar:** Kullanıcı yeni bir adres ister; `users.pending_email` alanına yazılır ve
yeni adrese bir `change_email` türünde doğrulama bağlantısı gönderilir. Bağlantı
tıklanınca adres takas edilir, `pending_email` temizlenir, adres doğrulanmış
sayılır ve tüm oturumlar kapatılır. O ana kadar mevcut doğrulanmış adres canlı
kalır; `email_tokens` tablosuna yeni adres yazılmaz, çünkü tablo yalnızca
`tokenHash` taşır — adres `users.pending_email`'de durur.

**Gerekçe:** Yeni adrese kanıt yalnızca o adrese giden bağlantıyla yapılır; adresi
değiştirebilmek için sahibin onu kontrol ettiğini göstermesi gerekir. Mevcut adres
değişim onaylanana dek canlı kaldığı için, istek yanlış bir adrese giderse bile
hesap kaybolmaz. Oturumların kapatılması şifre sıfırlamayla aynı ilkedir: kimlik
değiştiğinde eski kanıtlanmış oturumların geçerliliğini yitirmesi gerekir.

---

## D-039 — Görev dondurma: editör durumu ayrı, kendi kendine dondurma tek yönlü

**Karar:** `users.editor_status` ('active' | 'suspended') sütunu eklendi; yalnızca
`editor` rolü için anlamlıdır. `canAccessEditorPanel` dondurulmuş editörü 403'le
dışarıda bırakır; rol, kayıtlar ve sözleşmeler korunur. Yazar dondurması mevcut
`writer_status = suspended` ile aynıdır. Hesabım sayfasında yazar/editör
"Görevimi dondur" diyebilir; dondurmayı geri almak yalnızca yöneticinin
yetkisidir (kullanıcı için self-unfreeze yok). Hesap silme talebi ve 30 gün
sonraki anonimleştirme mevcut akışta zaten tüm roller için geçerliydi; imzalı
hak devri kayıtları anonimleştirmede korunur.

**Gerekçe:** Spesifikasyonda editörün askıya alınması için bir alan yoktu; yazar
alanını editörde kullanmak anlamsızdı (editörün `writer_status`'u yok).
Dondurmanın tek yönlü olması bilinçlidir: kullanıcı başlattığı dondurmayı
kendisi açabilseydi, yöneticinin koyduğu dondurma da kullanıcı tarafından
sessizce açılabilirdi. Yönetici kararı hızlı ve kayıt altındadır (audit_log),
böylece maliyet küçük, anlam korunur. Admin `editor_status`'tan hiç etkilenmez
(admin, editör görevinden üstündür ve dondurulamaz).

---

## D-040 — Topluluk modülü: "okuyucu yorum sistemi yok" kararı kaldırıldı

**Karar:** "Okuyucu yorum sistemi" yapılmayacaklar listesinden çıkarıldı; yerine
topluluk modülü geldi. Üç yeni tablo: `banned_words` (yasaklı kelime listesi,
yumuşak silme, canlı kelimede unique), `community_comments` (yayınlanmış
yazılara yorumlar) ve `community_messages` (sohbet, kendine `quoted_message_id`
ile alıntı). Her metin yazılırken yasaklı kelimeler `k****` biçiminde
yıldızlanır (ilk harf kalır) ve temiz hâli saklanır; maskeleme
`src/lib/moderation.ts`'te saf bir fonksiyondur. Eşleştirme Türkçe küçük harfe
duyarsız alt dize aramasıdır (ek almış biçimler yakalanır). Roller
(Admin/Editör/Yazar/Kullanıcı) yorum ve sohbet mesajlarında adın yanında rozet
olarak gösterilir. Moderasyon yalnızca yöneticinindir; kaldırma yumuşak silme
ile yapılır ve geçmişte kalır.

**Gerekçe:** Ürün sahibi topluluk blogu/sohbet ve moderasyon modülünü istedi;
bu, eski "okuyucu yorum sistemi yok" kararını bilinçli olarak kaldırır.
Maskeleme (yıldızlama) engellemeye tercih edildi: kullanıcı yazısını kaybetmez,
listedeki kelime her durumda görünmez olur. Alt dize eşleşmesi zararsız
kelimeleri de yakalayabileceği için liste yönetici denetimindedir ve seed
yalnızca küçük bir başlangıç seti koyar. Yumuşak silme, D-015'teki
eklenmek-bir-türde-eklenen kayıt ilkesine uygundur: denetim geçmişi korunur.

---

## D-041 — Yazar bilgi formu ve kategori kontenjanları

**Karar:** Herkese açık `/yazar-basvuru` formu eklendi; adaylar
(`writer_leads` tablosu: ad, doğum, telefon, e-posta, durum) en fazla 3
kategoriden seçer (`writer_lead_categories`; `categories` tablosu: ad,
`max_quota` varsayılan 3, `is_active`). Kontenjan "onaylanmış aday sayısı"dır:
dolu kategori hem formda pasiftir hem de sunucuda başvuruyu reddeder; onay da
kontenjanı aşamaz. Spesifikasyondaki REST uçları birebir uygulandı
(`/api/categories`, `/api/writers/apply`, `/api/admin/writers(/:id)`,
`/api/admin/categories(/:id)`); admin arayüzü aynı servisleri server action'la
çağırır. Kategori silme yumuşaktır. Seed 11 temel kategoriyi kurar.

**Gerekçe:** Bu modül, kayıtlı kullanıcı + sözleşme odaklı
`writer_applications` pipeline'ından farklıdır — dışarıdan ilgi toplamak için
ayrı bir havuzdur ve bu yüzden ayrı tablolar kullandı (isim çakışmasını önlemek
için `writer_leads`). REST uçları ürün sahibinin açık teknik isteği olduğundan
"mutasyonlar server action'dır" kuralı bu modülde bilinçli olarak esnetildi
(route handler → servis → yanıt katman düzeni korundu). Kontenjanın "onaylı
aday" sayması, başvurunun kendisi kotayı doldurmaz — ancak onay doldurur — bu
yüzden hem form hem onay kontrolü aynı fonksiyonu (`leadSelectionIssues`)
kullanır. Doğum tarihi yaş kuralı uygulanmaz: form yalnızca ilgi toplar, asıl
pipeline 18+ şartını zaten denetler.

---

## D-042 — İç duyurular: önem seviyesi ve kitleye göre okundu raporu

**Karar:** Duyuru tablosuna `severity` ('info' | 'important' | 'critical')
eklendi. **Kritik** duyurular, yazar kutu işaretlemese bile `requires_ack`
olarak kaydedilir ve onaylanmadan yazar paneli kilitlenir (mevcut kilit
mekanizması). Yayınlanmış her duyurunun okunma raporu (`readReport`) artık
yalnızca duyurunun gerçek hedef kitlesini listeler (writers → yazar,
editors → editör+admin, all_staff → tüm ekip) — rapor başka rollerden
beklenti doğurmaz. Yönetici panelinde "Duyurular" sekmesi oluşturma/yayınlama
ve raporu içerir; editör paneli aynı ortak bileşeni kullanır.

**Gerekçe:** Severity, duyurunun aciliyetini hem yazar/editor sekmesinde rozetle
gösterir hem de kritik duyuruları otomatik olarak "onay zorunlu" yapar — kritik
bir duyuruyu bilgilendirme gibi geçiştirmek mümkün olmaz. Raporun kitleye göre
filtrelenmesi düzeltmesi gereken bir tutarsızlıktı: yazarlara özel bir duyuru
için editörlerin "okumadı" görünmesi yanlış izlenim veriyordu. Admin ve editör
aynı arayüzü paylaşır; admin action'ları `requireRole("admin")` ile kendi
yetkisini korur.

---

## D-043 — Kapalı erişim modu

**Karar:** `site_settings.access_mode` ('open' | 'closed', varsayılan open)
eklendi. Kapalıyken: kayıt servisi reddeder (409), giriş yalnızca `admin`
rolüne izin verir (diğerleri 403) ve `getAuthContext` admin dışı oturumları
null döndürür — yani kapama öncesi açılmış okuyucu/yazar/editor oturumları da
anında ölür. Kapalıyken `/register` form yerine uyarı gösterir, `/login` not
gösterir. Modu yönetici Sistem sayfasındaki "Erişim modu" kartından değiştirir;
değişiklik audit_log'a yazılır.

**Gerekçe:** Ürün sahibi yayın öncesi siteyi kilitlemek istedi: yeni kayıt
alınmayacak ve yalnızca adminler girecek. "Herhangi bir girişi önleyelim"
ifadesi, giriş formunu kapatmanın ötesinde mevcut oturumları da kapsıyor —
oturum çözümünde kapı kurmak (login kapısı + session kapısı) tek taraflı kalan
bir açık bırakmaz. `isEntryAllowed` saf fonksiyon olduğundan kural tek yerde ve
birim test edilebilir. Varsayılan 'open' davranışı değiştirmez; kapanma yalnızca
yönetici kararıyla ve bilinçli olarak yapılır.

---

## D-044 — Başvuru formunda tekli kategori seçimi

**Karar:** Modül 5'teki "en fazla 3 kategori" kuralı kaldırıldı; aday **tek bir
kategori** seçer. `leadApplySchema`'da `categoryIds` dizisi yerine tek
`categoryId` geldi; `leadSelectionIssues` tek kategoriye göre çalışır; admin
başvuru düzenleme formu da radio (tek seçim) oldu. Dolu kategori hem formda
pasif + "Kontenjan Dolu" etiketi taşır hem de `POST /api/writers/apply`'te
sunucuda 400 ile reddedilir. `MAX_LEAD_CATEGORIES` 1'e indi.

**Gerekçe:** Ürün sahibi formu sadeleştirdi: her aday tek bir alanda yoğunlaşsın.
Tekli seçim radyo kartlarıyla kullanıcıya net; arka plan (kota = onaylı aday
sayısı, onay kontrolü, kitle raporu) aynı kaldığı için değişiklik yalnızca seçim
modelindedir. Bu karar D-041'deki "en fazla 3 kategori" kuralını bilinçli olarak
günceller.

---

## D-045 — SEO: Türkçe aramalar için halka açık landing sayfası indekslenir

**Karar:** Arama motoru görünürlüğü yalnızca halka açık pazarlama yüzü olan
landing sayfasına (`index.html`, `postscriptmag.com/`) uygulanır. Kök
`robots.txt` ve `sitemap.xml` eklendi; `index.html` Türkçe hedefli SEO ile
güncellendi: `lang="tr"`, Türkçe `title`/`description`, canonical, Open Graph,
Twitter kart, `theme-color` ve schema.org yapısal verisi (WebSite + Periodical +
Organization). Görünür içerik Türkçeleştirildi (nav, kategori listesi, örnek
başlıklar, footer) ve "OBSESSSION" yazım hatası "OBSESSION"a düzeltildi; tipografik
tasarım (büyük harf, harf aralığı, serif display) korundu. JSON-LD'de
`postscriptmag.com/#organization` etiketi kullanılır; sosyal paylaşım önizlemesi
için `og:image` henüz yok — kapak/logo sanatı belirlenince eklenecek.

**Gerekçe:** Panel uygulaması D-035 gereği tümüyle `robots: noindex` çalışır ve
okuma alanı oturum ister; bu yüzden panelin kendisi arama motorlarına açılmaz.
Halka açık indekslenebilir yüzey landing sayfasıdır. Türkçe aramalarda (ör.
"edebiyat dergisi", "e-dergi", "psikoloji") görünmek için sayfanın dili ve meta
içeriği Türkçe olmalıdır — İngilizce bir landing bu sorgularda sıralanamazdı.
`robots.txt` kökte landing'in `Allow: /` politikasıdır; panelin kendi
`public/robots.txt` (`Disallow: /`) uygulamayı kapalı tutar. Dağıtım aynı
origin'i paylaşırsa `/robots.txt` için hangi politikanın servis edileceği
dağıtımda netleştirilmeli (Next.js `public/robots.txt` önceliğe sahip olur);
bu çakışma bilinçli olarak yönetilmek üzere not edildi.

---

## D-046 — SEO marka standardı: "PostScript Dergi" ve kural eşlemesi

**Karar:** Arama motorlarına açık yüzeyde marka her yerde **"PostScript Dergi"**
olarak sabitlendi; tek başına "PostScript" bu yüzeyde marka olarak
kullanılmıyor. Landing (`index.html`) güncellendi:

- **Title:** `PostScript Dergi - <Sayfa/İçerik>` kalıbı (ör. "PostScript Dergi -
  Edebiyat, Kültür ve Psikoloji E-Dergisi", 58 karakter).
- **Meta description:** markayı içeriyor ve 150–160 karakter bandında (153).
- **OG / Twitter:** `og:site_name` ve `twitter:title` "PostScript Dergi".
- **Schema.org:** WebSite + Periodical + Organization düğümlerinin `name` alanı
  "PostScript Dergi"; `@id` etiketleri değişmedi
  (`postscriptmag.com/#website|#magazine|#organization`).
- **H1:** tek `h1` markayı içeriyor ("POSTSCRIPT DERGİ").

Panelin görünür markası `postscript` olarak kalır (D-035); panel D-045 gereği
tümüyle `robots: noindex` ve oturum kapılı olduğu için title/OG kuralları ona
uygulanmaz — oradaki title/metadata arama sıralamasını etkilemez.

**URL/slug standardı (kural 2):** Gelecekte halka açık içerik URL'leri için
standart: küçük harf, Türkçe karakter yok, tire ayracı, marka anahtar kelime
hiyerarşisi (ürün sahibi örneği: `/makale/postscript-dergi-makale-adi`).
Landing tek `/` adresinden ibaret olduğu için göç gerekmedi; slug üretimi
panelde zaten `src/lib/slug.ts` ile bu standarda uygun (ASCII, küçük harf,
tire). Brand ön eki (`postscript-dergi-`) içerik URL'leri netleşince slug'a
eklenip eklenmeyeceğine karar verilecek — dergi içi bağlantılar kısa slug'ı
korur, arama yüzeyi URL'yi olduğu gibi kullanır.

**Article / DiscussionForumPosting (kural 4):** Landing'de bu türlerin
açıklayabileceği bir düğüm yok (makale gövdesi ve okuyucu yorum zinciri
yok); geçersiz yapısal veri basmaktansa eklenmedi. Halka açık okuma sayfası
(makale) ve yorum akışı yayına girince sırasıyla `Article` ve
`DiscussionForumPosting` şemaları, aynı anda `generateMetadata` ile birlikte
eklenecek (D-045'in açtığı yüzeyde).

**Gerekçe:** D-035/D-045 gereği arama motorlarına açık tek yüzey landing;
SEO kuralları gerçekte dizine giren sayfalara uygulanır. Landing'i İngilizce
"postscript" markasıyla bırakmak, "PostScript Dergi" hedef anahtar kelimesinde
marka bütünlüğünü arama sonucunda kurmazdı.

---

## D-047 — Panel robots.txt halka açıldı

**Karar:** D-045'in "panelin kendi `public/robots.txt` (`Disallow: /`) uygulamayı
kapalı tutar" kararı güncellendi. `public/robots.txt` silindi; yerine Next.js
standardı `src/app/robots.ts` eklendi ve `/robots.txt` artık `User-Agent: *`
+ `Allow: /` üretiyor, `Sitemap: https://www.postscriptmag.com/sitemap.xml`
satırını taşıyor. Çakışmayı önlemek için App Router'ın metadata route'u tercih
edildi (statik `public/robots.txt` ile aynı adres için çakışır).

**Gerekçe:** Ürün sahibi Googlebot dahil tüm tarayıcıların siteyi tamamen
taramasına ve sitemap adresinin (ürün sahibinin belirttiği `www`'lu adres)
robots dosyasında geçmesine karar verdi. Kapsam dışı bırakılan iki nokta:
(1) kök layout hâlâ `robots: noindex, nofollow` meta'sı yayıyor (D-035) —
robots.txt yalnızca taramaya izin verir, sayfaların dizine girmesini engelleyen
`noindex` meta'sı kaldırılmadı; (2) sitemap adresi `www.postscriptmag.com`
olarak yazıldı, landing canonical'ı `postscriptmag.com` (www'suz) — `www`/www'suz
kanonikleştirme dağıtımda netleştirilecek.

---

## D-048 — Sayfalar dizine açıldı; canonical host `www` olarak sabitlendi

**Karar:** D-047'nin iki açık noktası kapandı.

1. **`noindex` meta'sı.** Kök layout (`src/app/layout.tsx`) artık üretimde
   `noindex, nofollow` yaymıyor; yalnızca dev/test derlemelerinde yayıyor
   (`process.env.NODE_ENV !== "production"`). NODE_ENV derleme başına sabit
   olduğu için çalışma zamanında değişmez. Sayfalar üretimde dizine girebilir.
   Aynı düzenlemede title şablonu marka standardına bağlandı (D-046 kural 1):
   varsayılan `PostScript Dergi`, kalıp `PostScript Dergi - %s`; varsayılan
   description markayı içeriyor.

2. **`www` kanonikleştirme.** Kanonik host `https://www.postscriptmag.com`
   olarak sabitlendi ve her yerde birebir kullanılıyor: landing `canonical`,
   `og:url`, JSON-LD `@id`/`url` ve CTA bağlantıları; kök `robots.txt` ve
   `sitemap.xml`; panelin `app/robots.ts` ve `app/sitemap.ts`. Panelin sitemap
   ve robots'u panel origin'ini (APP_URL) sızdırmamak için yeni `SITE_URL`
   ortam değişkenini kullanır (varsayılan `https://www.postscriptmag.com`);
   e-posta ve CSRF bağlantıları `APP_URL`'den okumaya devam eder.

**Gerekçe:** Sayfaların dizine girmesi için D-035'in paneli "noindex + oturum
kapılı" tutan kararı bu ölçüde güncellendi; oturum kapısı duruyor (otorite dışı
sayfalar hâlâ girişe yönlenir). Ürün sahibi sitemap ve canonical'ların `www`
adresinde birebir örtüşmesini istedi — farklı host'larda hem canonical hem
sitemap tutarsızlığı sıralama sinyallerini böler.

---

## D-047 — Kimlik belgesi adımı iptal edildi

**Karar:** Kimlik belgesi toplama adımı (D-009) ürün kapsamından çıkarıldı.
`S3_IDENTITY_BUCKET` env değişkeni, depolama katmanındaki identity bucket
yardımcıları ve ilgili dokümantasyon kaldırıldı; depolama artık tek bucket
("media") kullanır. D-009'da tasarlanan `purge-identity-documents` scripti hiç
oluşturulmadığı için temizlenecek kalıntı yoktur.

**Gerekçe:** Ürün sahibi adımın yükünü (belge doğrulama akışı, 90 günlük
otomatik silme, admin iş yükü) kapsam dışı bıraktı; yazar başvurusu ve terfisi
belgesiz ilerler.

---

## D-048 — Editör ve yönetici için TOTP iki adımlı doğrulama

**Karar:** TOTP 2FA uygulandı ve editor/admin rolleri için **zorunlu** kılındı
(CLAUDE.md güvenlik kuralları):

- **Saklama:** `users.totp_secret` (SESSION_SECRET pepper'ı ile AES-256-GCM
  şifreli, `encryptSecret`) + `users.totp_enabled_at`. Sır yalnızca geçerli bir
  kod doğrulandıktan sonra kaydedilir; kurulum formu sırrı bir kez gösterir.
  Kurulum kartı önce **QR kod** (`qrcode` paketi, sunucuda SVG data URL)
  gösterir; tarayamayanlar için bağlantı ve gizli anahtar metni aynı kutuda
  durur.
- **Giriş:** Şifre doğrulandıktan sonra tek kullanımlık `login_challenges`
  bileti (5 dk, sadece peppered hash saklanır, tek kullanım) düzenlenir;
  `/login/2fa` kod girişinden sonra oturum açılır. `login_2fa` rate limit
  kovası (5 deneme / 15 dk) kod kaba kuvvetini engeller; başarılı giriş kovayı
  temizler.
- **Zorunluluk:** `requireRole("editor"/"admin")` ve `guardPanel` 2FA'sız
  kullanıcıyı `/account?twoFactor=1` kurulum ekranına yönlendirir; kapatma
  (disable) da şifre + geçerli kod ister. 2FA açıldığında tüm oturumlar
  iptal edilir (öncesine ait hiçbir oturum yaşamaz); kapatıldığında oturumlar
  korunur (kullanıcı bilinçli olarak düşürüyor).
- **Doğrulama:** otplib v13 (`generateSecret`/`generateURI`/`verifySync`),
  tek adım tolerans (epochTolerance: 1). Log/audit redaksiyonunda zaten var
  olan `totp_secret` anahtarı korundu.

**Gerekçe:** Kural "zorunlu" diyordu ama uygulamada yalnızca kripto ilkelleri
vardı; giriş akışında 2FA adımı yoktu. Üretimdeki iki adminin parolası tek
faktördü. Şifre + kod yerine yalnızca koda güvenmeyen, biletli iki adımlı akış,
oturumun her zaman 2FA'dan geçmiş olmasını garanti eder (2FA açıkken şifresiz
oturum olamaz).

---

## D-049 — Yazar kaydı: ilgi formundan e-posta doğrulamalı geçici yazar hesabına

**Karar:** `writer_leads` ilgi havuzu (kategori kontenjanları, `/admin/writer-leads`,
`/admin/categories` ve ilgili REST uçlarıyla birlikte) tamamen kaldırıldı.
Halka açık `/yazar-basvuru` artık gerçek bir kayıt formudur:

- Alanlar: Ad Soyad, Doğum Tarihi, E-posta, Şifre, KVKK onayı. Telefon ve
  kategori alanı yok. **18 yaş kuralı kayıtta uygulanır** (D-041'deki "form
  yalnızca ilgi toplar, yaş denetlenmez" kararını bilinçli olarak günceller:
  artık hesap, ileride asla terfi edemeyecek şekilde açılmasın diye).
- Kayıt, **kapalı erişim modunda da açıktır**; okuyucu kaydı `/register`
  şimdilik yoktur (`/register` → `/yazar-basvuru` yönlenir). Okuyucu kaydı
  servisi (`register`) kodda durur; erişim modu açılınca yeniden kullanılır.
- Hesap `users.writer_intent_at` ile işaretlenir. E-posta doğrulandığında
  hesap **otomatik onaylanır**: rol `user → writer` (`writerStatus =
  pending_agreement`), `role_changes` kaydı yazılır, "yazar olarak
  yetkilendirildiniz" e-postası gider. Editör/yönetici onay adımı yoktur —
  adaylar dergi tarafından manuel doğrulanmış sayılır, sistemde otomatik
  onaylı görünürler (ürün sahibi kararı; D-037'nin iki aşamalı başvuru
  pipeline'ı değişmez, yalnızca yeni kayıtlar onu atlar).
  `writer_applications` pipeline'ı ve örnek eser akışı durur.
- Otomatik onay `checkPromotionReadiness` ön koşullarını yeniden doğrular;
  örneğin yayınlanmış sözleşme sürümü yoksa aday user olarak kalır, gerekçe
  audit'e yazılır (Hesabım'daki mevcut eksiklik kartı görünür).
- **Kapalı mod:** yazar izi hesaplar (aday, yazar, editör, admin) oturumlarını
  korur; düz okuyucu oturumları ölür. Kapalıyken admin dışında herkes yalnızca
  hesap alanını görür (`/account`); paneller, dergi ve topluluk `/account`'a
  yönlenir. Tek istisna: sözleşmesi onay bekleyen yazar, kilit çıkışı olan
  `/writer/agreement` sayfasına gidebilir.

**Gerekçe:** Ürün sahibi yayın öncesi yazar kazanımını, anonim ilgi kaydı
yerine doğrulanmış hesaplar üzerinden kurmak istedi; "manuel doğrulanmış
adaylar sistemde otomatik onaylı görünsün, editör/admin onayına gerek yok"
dedi. E-posta kanıtı (D-034'ün sert kapısı) kimlik güvencesini sağlar; rol
değişikliği yine `role_changes` kaydı olmadan gerçekleşmez ve terfi için
gereken tüm ön koşullar (doğrulanmış adres, 18+, KVKK, yasaklı değil) korunur.
Okuyucu kaydının kaldırılması ve yazar kanalının kapalıyken açık kalması,
yayın öncesi tek amaçlı (yazar + yönetici) giriş ekranı isteğinin sonucudur.

---

## D-050 — Sözleşme ve KVKK şimdilik panel dışında

**Karar:** Yazar kaydı ve yazar aktivasyonu artık sözleşme ya da KVKK onayına
bağlı değil; sözleşme ürün sahibi tarafından sonradan (panel dışından) iletilecek.

- **Kayıt:** `/yazar-basvuru` formunda KVKK onay kutusu yok; kayıt
  `kvkk_consent_at` yazmaz.
- **Aktivasyon:** E-posta doğrulamasındaki otomatik onay doğrudan
  `writerStatus = active` verir (`pending_agreement` adımı atlanır). Admin
  terfisi (`promoteToWriter`) ve rol değişimi de `active` verir.
- **Panel kilidi:** Yazar paneli sözleşmeyle kilitlenmez; yalnızca `suspended`
  dondurur. `guardWriterInnerPages` sözleşme yönlendirmesi yapmaz.
- **Sözleşme sayfası:** `/writer/agreement` boş durur ("metin henüz hazır
  değil; ayrıca iletilecek").
- **Ön koşullar:** `checkWriterEligibility` KVKK'yı istemez;
  `checkPromotionReadiness` yayınlanmış sözleşme sürümü şartını aramaz
  (sözleşme olmayan taze bir sistemde bile terfi/otomatik onay çalışır).
- **Sürüm yayını:** `publishAgreementVersion` aktif yazarları artık
  `pending_agreement`'a düşürmez ve kilit e-postası göndermez.
- **Korunanlar:** Yönetici sözleşme sürümleri ekranı, `writer_applications`
  imza akışı, Eser Onayı (`rights_grants`) ve seed'deki yayınlanmış sözleşme
  yerinde durur; sözleşmeler geri gelince yeniden devreye alınır.

**Gerekçe:** Ürün sahibi "sözleşmeleri şuanlık kaldır, sonradan göndereceğiz;
kayıt sırasında ne KVKK ne yazar sözleşmesi olacak, sözleşme sayfası boş
kalacak" dedi. Yayın öncesi amaç, yazarı hiçbir hukuki adıma takılmadan panele
almak; sözleşme ve KVKK süreci dışarıda yürütülecek. Güvenlik çekirdeği
korunur: rol değişikliği `role_changes` kaydı olmadan gerçekleşmez, 18+ ve
doğrulanmış adres zorunluluğu sürer, `suspended` yazarlar kilitli kalır.

---

## D-051 — Sabit yazar alan listesi

**Karar:** Yazar kaydında "alan seçme" bölümü, lead modülü kaldırılınca giden
kategori listesinin yerine **sabit, kodda tanımlı bir liste** olarak geri
geldi. `users.writer_area` kolonu eklendi; kayıt formunda tek alan seçilir
(radyo), sunucuda `WRITER_AREAS` listesine karşı doğrulanır ve hesapta
saklanır. Hesabım ve yönetici kullanıcı ekranı seçilen alanı salt okunur
gösterir.

**Gerekçe:** Ürün sahibi alan seçiminin kayıtta kalmasını istedi ama kategori
tablosu/kontenjan sistemini geri getirmek istemedi ("sabit alan listesi, tek
seçim"). Liste kodda olduğu için migration gerektirmeden düzenlenebilir;
ileride yönetilebilir bir tabloya taşınmak istenirse formun sözleşmesi
değişmez.


