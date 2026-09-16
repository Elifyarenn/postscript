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

## D-055 — Yazı alanları yönetilebilir tablo

**Karar:** D-051'deki sabit kod listesi `writer_areas` tablosuna taşındı ve
admin panelinden yönetilebilir hale getirildi (`/admin/categories` → "Yazı
alanları"): alan ekleme (ad + kontenjan), düzenleme (ad, kontenjan, sıra,
aktif/pasif), silme. `users.writer_area` metin alanı adla eşleşir; yeniden
adlandırma aynı işlemde kullanıcıları da günceller. Kurallar:

- Alan silme yalnızca **içinde yazar yokken** mümkündür; yazarları olan alan
  pasife alınır (yazarlar alan adını tarih olarak korur).
- Kontenjan, mevcut yazar sayısının altına indirilemez.
- Kamuya açık kayıt formu yalnızca aktif alanları gösterir; pasif alan ve dolu
  alan hem formda hem sunucuda reddedilir.
- Seed, tablo boşken D-051 listesini 3 kontenjanla yeniden kurar.

**Gerekçe:** Ürün sahibi alan listesini kod değişikliği olmadan güncellemek
istedi (ekleme/çıkarma/sıralama). Tek seferlik sabit liste kararı (D-051)
yönetim ekranıyla birlikte ürünün gereksinimine dönüştü; form sözleşmesi
(tek seçim, kontenjan, tek alan) aynı kaldı.

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

---

## D-052 — Her alanın 3 kontenjanı

**Karar:** Sabit alan listesinin her alanı en fazla `AREA_QUOTA = 3` yazar
alır. Kontenjan "onaylanmış yazar sayısı"dır: rolü `writer` ve silinmemiş
hesapların `writer_area` sayacı (eski lead modülündeki "onaylı aday" anlamının
karşılığı; kayıt otomatik onayladığı için onaylı = yazar). Dolu alan hem
formda devre dışı + "Kontenjan Dolu" etiketi taşır hem de kayıt servisinde
sunucuda reddedilir (formu atlayan istekler için). Sayıyı tek yerden veren
`listWriterAreasWithQuota()` ve saf kural `writerAreaSelectionIssues()` birim
testlidir.

**Gerekçe:** Ürün sahibi "her kategorinin 3 kontenjanı var, onu da yap" dedi.
Kontenjanın onaylı yazar sayması, alanı 3 onaylı yazar dolduracağı için hem
form hem sunucu aynı fonksiyonu kullanır. Doğrulanmamış adaylar (rol `user`)
sayaca katılmaz; bu, eski "onaylı aday" kuralıyla tutarlıdır.

---

## D-053 — Yazar kayıt bilgileri yönetim panelinde

**Karar:** Yazar kaydına telefon alanı geri eklendi (`users.phone`,
migration 0016; sadece rakam/`+`/boşluk/`-`/parantez, saklama kompakt biçimde
— boşluk ve ayraçlar atılır). Yönetim panelindeki kullanıcı sayfasına
(`/admin/users/[id]`) "Kayıt bilgileri" kartı eklendi: e-posta, telefon,
doğum tarihi, alan ve kayıt tarihi. Bu bilgiler yalnızca admin tarafından
görülür; public API'ye sızmaz.

**Gerekçe:** Ürün sahibi "yazarların girdikleri e-posta ve telefon gibi
bilgiler yönetim panelinde hesaplarında görünmüyor, ekle" dedi. E-posta zaten
başlıkta vardı ama telefon toplanmıyordu; alan seçimi gibi kayıt bilgileri de
tek kartta toplanarak yöneticinin işi kolaylaştı.

---

## D-054 — Telefon formda zorunlu, hesaplardan da sonradan istenebilir

**Karar:** Telefon yazar kayıt formunda zorunlu olmaya devam eder (D-053).
Ayrıca profil formuna (`/account` ve `/writer/profile` paylaşımlı
`ProfileCard`) "Telefon" alanı eklendi: yazar, kayıttan sonra numarasını
girebilir veya güncelleyebilir (zorunlu değil). Bu, telefon alanı canlıya
çıkmadan kayıt olan hesapların numarasını sonradan tamamlamasını sağlar.
`normalisePhone` artık ortak kütüphanede (`src/lib/phone.ts`); yönetim
panelindeki "Kayıt bilgileri" kartı bu değeri gösterir.

**Gerekçe:** Ürün sahibi "şimdi hesaplardan sonradan istenecek, ayrıca formda
ekle ve zorunlu olsun" dedi. Kayıtta zorunlu + profilde güncellenebilir, hem
yeni hem eski hesaplar için numarayı sistemde toplar.



## D-056 — Topluluk sohbeti panelden kaldırıldı

**Karar:** "Pasif (okunur, gönderim yok)" mod yeterli gelmedi; sohbet tamamen
görünmez ve okunamaz yapıldı:

- Kenar çubuğundaki "Topluluk sohbeti" / "Topluluk" sekmeleri tüm rollerden
  (admin, editör, yazar, okuyucu) çıkarıldı.
- `/community` sayfası artık 404 döndürür; oda bileşeni (`chat-room.tsx`)
  silindi. Sekme görünmez, sayfa okunamaz durumda.
- Servis katmanında bir güvenlik ağı kaldı: `addChatMessage` çağrısı başında
  `getChatMode` okunur; varsayılan `'disabled'` olduğu için
  `POST /api/community/messages` yeni mesajı 409 ile reddeder — arayüzü
  kaldırılmış bir sohbet, doğrudan API'den beslenemez.
- Yorumlar ve moderasyon etkilenmez: `/admin/community` "Topluluk yönetimi"
  sekmesi (yasaklı kelimeler, yorum/mesaj kaldırma) durur; oradaki "Topluluk
  sohbetini aç" bağlantısı kaldırıldı.
- Yönetici Sistem sayfasındaki sohbet aç/kapat kartı kaldırıldı: görünür alanı
  olmayan bir özelliğin anahtarı anlamsızdır. `setChatMode` servisi yalnızca
  testlerde kullanılır (`site-settings` içindeki `clearSiteSetting` ile aynı
  gerekçe); `getChatMode` gönderim engelinin kaynağı olarak canlıdır.

**Gerekçe:** Ürün sahibi "hayır, komple sekmeyi görünür yapma, kaldır,
okunmasın" dedi. Okunur-pasif mod yerine sekmenin görünmemesi ve sayfanın
okunamaması istendi. Sohbet tablosu ve servisleri kodda durur — geri getirmek
istenirse yalnızca sekme + sayfa + gönderim engeli kaldırılır, veri kaybı
olmaz. Gönderim engeli muhafazakâr güvenlik ağıdır: gizlenmiş bir arayüz,
doğrudan API çağrısını engellemez.



## D-057 — Yazarlara ikinci alan atama (yalnızca admin paneli)

**Karar:** Bir yazar en fazla iki alanda yer alır. `users.writer_area_2`
kolonu eklendi (migration 0018); yazarın ilk ve ikinci alanı yalnızca yönetim
panelinden (`/admin/users/[id]`) değiştirilir. `setWriterAreas` servisi admin
yetkisi ister, alan adlarını `writer_areas` tablosuna karşı doğrular, iki alan
aynı olamaz ve yeni eklenen bir alanın kontenjanı doluysa 409 döner. Kontenjan
sayımı her iki kolonu da sayar (D-052 ile tutarlı): alan ister ilk ister ikinci
slotta olsun, onu tutan yazar sayılır; `count(distinct user_id)` aynı adı iki
slotta tutanı tek sayar. Alan yeniden adlandırıldığında `writer_area_2` de aynı
işlemde güncellenir. Yazar hesabında alanlar salt okunur görünür; kullanıcı
kendisi değiştiremez.

**Gerekçe:** Ürün sahibi "yazarların kategorilerini admin panelinden
değiştirip 2. bir kategori ekleme alanı yap, bu yetkiye sadece admin panelinden
ulaşılabilsin" dedi. Kayıtta tek alan seçilir (D-051); ikinci alan, yazarlık
başladıktan sonra yönetimin işidir. Kontenjan kuralı yalnızca kayıt için değil
yönetim ataması için de sürer: dolu bir alana yönetim de yazar ekleyemez,
kontenjanı alan sayfasından yükseltir.



## D-058 — Yönetici kullanıcı silme

**Karar:** Yönetim panelindeki kullanıcı sayfasına "Kullanıcıyı sil" eklendi
(`deleteUserAsAdmin`). Silme, self-service hesap silmenin hukuki muamelesinin
aynısını kullanır: kişisel veriler anonimleştirilir, hesap yumuşak silinir
(`deleted_at`), tüm oturumlar iptal edilir; imzalı hak devri kayıtları ve rol
değişikliği geçmişi saklanır (yayının dayanağı). Gerekçe zorunludur ve onay
kutusu istenir; `user.deleted_by_admin` denetim kaydına gerekçe ve işlemi
yapan yönetici yazılır. Yönetici kendini silemez.

**Gerekçe:** Ürün sahibi "kullanıcıları silme özelliği getir, sadece yasaklama
var şu an" dedi. Yasaklama hesabı kilitler ama kişisel verileri durur; silme,
self-service yolun zaten tanımlı yasal çerçevesini (imzalı devirler korunur)
yöneticiye de açar. Zorunlu gerekçe + onay kutusu, geri alınamaz bir işlemi
yanlışlıkla tetiklemeyi zorlaştırır.

---

## D-059 — Editör alan atamaları ve dört aşamalı onay zinciri

**Karar:** Editörlerin sorumluluğu iki yeni kavramla düzenlendi:

- **Alan ataması.** `editor_categories` tablosu eklendi: `(editor_id, area_id,
  slot)`; `slot` 1 ("1. alan") veya 2 ("2. alan"). Alan listesi, derginin 11
  ana kategorisi olan `writer_areas` ile aynıdır. Bir alanın yalnızca **bir**
  editörü olabilir — bu, `area_id` üzerindeki unique index ile veritabanında
  zorlanır; arayüz başka editörün alanını pasifleştirir ve servis okunabilir
  bir 409 döner. Bir editör en fazla **iki** alan tutar; iki slot olduğu için
  bu, atamayı sil-yeniden-yaz yapan `setEditorDuties` servisinde kendiliğinden
  sağlanır (DB'de "en fazla iki" sayısı unique index ile zorlanamaz). Alan
  silme, editör atanmış alanı da bloklar (yazar kontenjanıyla aynı ilke).
  `users.is_main_editor` bayrağı eklendi: ana editör tüm kategorileri okur ve
  ikinci onay aşamasını yürütür. Hepsi yalnızca admin panelinden
  (`/admin/users/[id]` → "Editör görevleri" kartı) yönetilir.

- **Dört aşamalı onay zinciri.** `articles.status` enum'una
  `category_approved` ve `admin_review` eklendi ve durum makinesi yeniden
  kuruldu: `draft → in_review → category_approved → admin_review → accepted →
  awaiting_rights → scheduled → published` (+ `revision_requested`, `draft`,
  `archived`, `withdrawn`). Adımlar:
  1. **Yazar:** içeriği yazar, taslağı kaydeder, "İncelemeye gönder" der
     (`draft → in_review`). Yazar yalnızca kendi alanlarında yazabilir ve
     kendi taslağını düzenleyebilir.
  2. **Kategori editörü:** yalnızca kendi 1./2. alanına düşen yazıyı inceler,
     düzenler ve onaylar (`in_review → category_approved`); geri
     gönderebilir (`revision_requested`).
  3. **Ana editör:** kategori editöründen gelen yazıyı yönetici kuyruğuna
     aktarır (`category_approved → admin_review`).
  4. **Yönetici:** yazıyı kabul eder (`admin_review → accepted`); kabul
     otomatik olarak yayın kuyruğunu açar (`awaiting_rights` + Eser Onayı).
     Yayınlama akışı (`scheduled`, `published`, `withdrawn`) yalnızca
     yöneticinindir.

  Yetki kontrolü `rbac.ts`'te saf `canPerformTransition(actor, assignment,
  article, to)` fonksiyonundadır; durum makinesi grafiğin geçerliliğine bakar,
  bu fonksiyon "bu aktör bu kolu çekebilir mi" sorusunu çözer (yetki yoksa
  403, grafik/ön koşul hatasında 409). `listArticles` ve makale detay sayfası
  kategori editörünü yalnızca kendi alanlarına kısıtlar; ana editör ve yönetici
  tüm kategorileri okur.

**Editör paneli kapsamı (aynı kararın parçası):** Editör paneli yalnızca
"Genel bakış", "Kategoriye düşen yazılar (İnceleme/Düzenleme)" ve "Medya
kütüphanesi" modüllerinden oluşur. Sayı yönetimi, duyurular, Eser Onayı
takibi ve yazar başvuruları editör panelinden çıkarıldı; bu rotalar
(`/editor/issues`, `/editor/announcements`, `/editor/approvals`,
`/editor/applications`) ve ilgili server action'lar artık yalnızca yöneticiye
açıktır (`guardAdminWithinEditor` + `requireRole("admin")`), sayı servislerinin
mutasyonları da admin'e kısıtlandı. Admin, `/editor/*` altına düştüğünde yönetim
yan menüsünü görür (layout admin'e `ADMIN_NAV` basar), böylece hem `/admin/*`
hem taşınan `/editor/*` modülleri tek çatıda toplanır.

**Gerekçe:** Ürün sahibi, yayının baştan sona denetim altında ilerlemesini
istedi: her alanın tek sorumlu editörü olsun, editör kendi alanının dışına
karışamasın, yayın kararı sonunda yönetimde kalsın. "11 ana kategori" listesi
zaten `writer_areas` (seed 11 alan) olduğu için ayrı bir kategori tablosu
açılmadı; ek tablo açmak yerine aynı tabloya atıf yapmak, alan yeniden
adlandırma/silme kurallarını da tek yerde tutar. `canPerformTransition`'ın saf
olması, birim testlerde zincirin her kolunu aktör başına doğrulamayı sağlar.

---

## D-060 — Hibrit rol "Editor & Yazar" ve panel anahtarı

**Karar:** `role = editor` ve `writerStatus = active` aynı anda olan hesap
"Editor & Yazar"dır. Admin, kullanıcı sayfasındaki "Editör görevleri"
kartından `setHybridWriterRole` ile bunu açar/kapatır (açmak `writerStatus =
active`, kapatmak `null`). Rol değişmez (rol `editor` kalır), bu yüzden
`role_changes` yazılmaz; etkin yetki değişikliği `user.hybrid_writer_toggled`
denetim kaydına düşer. Arayüzde:

- Panel başlığında (ve yönetici kullanıcı listesinde/detayında) unvan
  "Editor & Yazar" olarak tek rozette görünür (`STATUS_LABELS.editor_writer`).
- `PanelModeSwitch` bileşeni, hibrit kullanıcıya başlıkta "Yazar Paneli" ve
  "Editör Paneli" arasında bir anahtar sunar; iki panel ayrı rota ağaçları
  olduğu için anahtar bir bağlantı çiftidir ve aktif tarafı vurgular.
- Hibrit, yazar panelinde de yazar olarak yazı yazabilir
  (`isActiveWriter`): seçilebilir kategorileri kendi `writer_area` /
  `writer_area_2` değerleri artı (editör olduğu için) `editor_categories`
  alanlarıdır.

**Gerekçe:** Ürün sahibi, hem yazar hem editör olan kişilerin iki paneli tek
oturumda, tek tıkla değiştirebilmesini istedi. Rol enum'ına yeni bir değer
eklemek (ör. `editor_writer`) sıralı rol modelini (rank) bozardı; mevcut
`writerStatus` kolonu, editörün yazarlık görevini taşımak için zaten doğru
yerdi. Unvanın tek rozette görünmesi, "iki rozet yan yana" karışıklığını
önler; anahtar ise rotaları açık tutarken keşfedilebilirliği sağlar.

---

## D-061 — Yazar tarafından makale gönderimi açıldı (önceden yasaktı)

**Karar:** "Yazar tarafından makale gönderimi yapılmaz" kuralı kaldırıldı.
Onay zincirinin 1. adımı (D-059) yazarın içeriği yazıp "İncelemeye gönder"
demesidir; yazar panelinde makale oluşturma/düzenleme/gönderme akışı
(`createArticleAsWriter`, `updateArticleAsWriter`, `draft → in_review`) eklendi.
Yazar yalnızca kendi taslağını ve revizyon isteği dönmüş yazısını düzenler;
kategorisi kendine tanımlı alanlar olmalıdır. Editörler dışarıdan gelen yazılar
için makale kaydı açmayı sürdürür (mevcut `createArticle`).

**Gerekçe:** D-059'un dört aşamalı zinciri, içeriğin ilk adımını yazarın
yazmasını gerektirir; eski "yazılar dışarıdan gelir" kuralı bu akışla çelişirdi.
Ürün sahibinin açık isteği (adım 1 = yazar yazar) spesifikasyondaki eski yasağı
bilinçli olarak günceller. Güvenlik çekirdeği korunur: yazar yalnızca kendine
atanmış alanlarda yazabilir, `role` alanı client'tan kabul edilmez ve her
mutasyon sunucuda yetki kontrolünden geçer.

---

## D-062 — PGlite geliştirme veritabanı başlangıçta otomatik migrate edilir

**Karar:** `src/instrumentation.ts`, sunucu PGlite (`pglite://…`) ile açılırken
bağlantıyı kurduktan sonra bekleyen migration'ları uygular (idempotent;
drizzle'in `__drizzle_migrations` kaydı zaten uygulanmış dosyaları atlar).
Gerçek PostgreSQL (`postgres://…`) asla otomatik migrate edilmez; orada
`pnpm db:migrate` (veya seed) açık komut olarak kalır.

**Gerekçe:** D-059'daki şema değişikliği (`users.is_main_editor` kolonu,
`editor_categories` tablosu) `pnpm dev`'i eski bir `.pglite` ile açan herkesin
giriş ekranında 500 almasına yol açtı: `db.select().from(users)` artık var
olmayan bir kolonu istiyordu. Migration'ı başlangıca taşımak, yeni bir dal
çekildiğinde `pnpm dev`'in sessizce bozulmasını bitirir; üretim davranışı
değişmez.

---

## D-063 — Kapalı erişim modu kaldırıldı; okuyucu kaydı standartlaştı

**Karar:** Yayın öncesi "kapalı erişim" kısıtlamaları kaldırıldı:

- `src/lib/access-mode.ts` ve `src/services/access-mode.ts` silindi; login/kayıt
  servisleri, oturum çözümü ve panel layout'larındaki kapalı-mod kapıları
  (kayıt reddi, admin dışı giriş yasağı, oturum iptali, `/account`'a
  yönlendirme) temizlendi. Yönetici Sistem ekranındaki "Erişim modu" kartı ve
  `setAccessMode` action'ı kaldırıldı (D-043, D-049'da anlatılan kapalı mod
  artık tarihî kayıttır).
- `/login` standartlaştı: sarı "Site henüz yayında değil" uyarısı ve yazar
  kaydı ön kutusu kaldırıldı; altında okuyucu ve yazar kaydı bağlantıları
  duruyor.
- `/register` gerçek bir okuyucu kayıt formu oldu (eskiden `/yazar-basvuru`'ya
  yönleniyordu). `registerReaderAction` eklendi; yeni hesaba sunucu her zaman
  `role = user` atar (formdan rol kabul edilmez). `/yazar-basvuru` yazar kaydı
  akışı aynen durur (D-049: e-posta doğrulaması yazar otomatik onayı).
- Giriş sonrası yönlendirme rol tabanlı kalır: admin → `/admin`, editör/ana
  editör/hibrit → `/editor` (hibrit başlıktaki panel anahtarıyla geçer), yazar
  → `/writer`, okuyucu → `/magazine`. Panel başlığındaki kullanıcı adı artık
  `/account`'a giden bir profil bağlantısıdır (her rolde sağ üstte).

**Gerekçe:** Ürün sahibi, "geçici kısıtlamalar" olarak tasarlanan yayın öncesi
kapıları kaldırmak ve siteyi standart okuyucu/yazar/yönetim rolleriyle normal
işleyişe geçirmek istedi. Kapalı modun yalnızca arayüzde gizlenmesi yetmezdi:
servis kapıları kalsaydı modu açıkken bile kod aynı kısıtlamayı uygulardı.
Mekanizmanın tamamını kaldırmak, ölü bir ayar kartı ve iki kaynaklı bir
davranış (DB ayarı vs. kod) bırakmamak içindir.

---

## D-064 — Yazar kaydı kaldırıldı; yazar/editör rolleri yalnızca yönetimden

**Karar:** Herkese açık yazar kaydı tamamen kaldırıldı. `/yazar-basvuru`
sayfası, `registerWriterCandidate`/`writerRegisterSchema` servisi,
`registerWriterAction` ve e-posta doğrulamasındaki otomatik yazar onayı
(`autoApproveWriterCandidate`) silindi. `verifyEmail` artık yalnızca adresi
doğrular, kimseyi yükseltmez; `writer_intent_at` kolonu yalnızca eski
kayıtların tarihî verisi olarak kalır (migration gerektirmez, yeni kayıt yok).

**Kalan tek kayıt:** `/register` — standart okuyucu kaydı; sunucu her zaman
`role = user` atar. Giriş sayfasındaki "Yazar kaydı" bağlantısı kaldırıldı.

**Rol ataması artık yalnızca yönetim panelinden:** `promoteToWriter`
(okuyucudan yazara), `changeRole` (herhangi bir role), `setHybridWriterRole`
(editor → "Editor & Yazar"), `setEditorDuties` (editör alanları + ana editör)
ve yazar başvurusu pipeline'ı (`/admin/applications`, admin onaylı ayrı akış)
— tümü yönetici kararıyla.

**Gerekçe:** Ürün sahibi "yazar kaydını komple kaldır, normal kayıt kalsın;
editör/yazar yapılacaksa kullanıcıyı panelden yapıyoruz" dedi. Kendi kendine
yazar olma yolunun kapanması, terfinin tek yetkili kaynağını (yönetici kararı +
`role_changes` kaydı) korur; D-049'daki otomatik onay bu kararla birlikte
geçersiz kalır. D-061'deki "yazar kendi yazısını yazar" akışı bundan
etkilenmez: zaten yazar olmuş hesaplar yazar panelinden makale göndermeye
devam eder.

---

## D-068 — İnceleme zinciri durum adları ürün hiyerarşisine göre yeniden adlandırıldı

**Karar:** `articles.status` enum'ındaki iki durum, ürün sahibinin "Yazı Kabul ve
Onay Süreci" hiyerarşisine birebir uyacak şekilde yeniden adlandırıldı:

- `category_approved` → **`pending_admin_approval`** ("Ana Editör Onayında":
  kategori editörü onayladı, yazı ana editörün kuyruğunda).
- `admin_review` → **`ready_for_publishing`** ("Yayın Kuyruğunda": ana editör
  onayladı, yazı yönetim panelinin yayın kuyruğuna aktarıldı).

Zincir artık: `draft → in_review → pending_admin_approval → ready_for_publishing
→ accepted → awaiting_rights → scheduled → published` (+ `revision_requested`,
`archived`, `withdrawn`). `accepted`, `awaiting_rights` ve `scheduled` aynen
durur: imzalı hak devri ve medya lisansı şartı (CLAUDE.md güvenlik kuralları)
bu adımları gerektirir; ürünün istediği hiyerarşi zincirin inceleme kısmıdır,
yayın akışının iç işleyişini değiştirmez. Migration (0021) eski değer taşıyan
satırları text aşamasında yeni adlara eşler — drizzle'ın ürettiği tip-yeniden
kurma akışı, veri eşleme olmadan mevcut kayıtlarda patlardı; eklenen iki UPDATE
şema sapması değil, migration'ın geçerli olması için zorunlu veri adımıdır.

**Gerekçe:** Ürün sahibi "status alanları ve geçişleri tam olarak şu hiyerarşiyi
izlemelidir: draft, in_review, revision_requested, pending_admin_approval,
ready_for_publishing/published" dedi. D-059'un iş akışı değişmedi; yalnızca
veritabanındaki adlar ürünün sözleşmesiyle hizalandı. Arayüz etiketleri de bu
adları söyler.

---

## D-065 — Doğum tarihi okuyucu kaydında alınıyor

**Karar:** Okuyucu kayıt formuna (`/register`) zorunlu "Doğum tarihi" alanı
eklendi; değer `users.birth_date` kolonuna kayıt anında yazılır.

- Alan `YYYY-AA-GG` biçiminde `type="date"` girdisidir; kayıt şeması biçimi,
  servis katmanı takvim geçerliliğini ve gelecekte olmama durumunu doğrular
  (`calculateAge` geçersiz ve gelecek tarihler için `null` döner).
- Yaş barajı kayıtta uygulanmaz: reşit olmayan okuyucular kayıt olabilir; ≥ 18
  şartı yalnızca yazar terfisinde (`checkWriterEligibility`) aranır.
- Doğum tarihi kayıtta bir kez yazılır; §5.4 gereği kullanıcı sonradan kendisi
  değiştiremez, düzeltme yalnızca yönetici (`setBirthDateAsAdmin`) yapabilir.
- Rol ataması değişmedi: kayıt yine her zaman `user` rolü verir; doğum tarihi
  hiçbir otomatik terfi tetiklemez.

**Gerekçe:** Ürün sahibi "kayıt olurken doğum tarihi al" dedi. Yazar terfisi ve
yazar başvurusu zaten doğum tarihi ve ≥ 18 ön koşuluna bağlı; alanın kayıtta
alınması sonradan profil üzerinden tamamlama adımını ortadan kaldırır ve
başvuru öncesi eksik veri sorununu baştan çözer. Alan zorunlu tutuldu çünkü
isteğe bağlı bırakılsaydı akış değişmezdi; ancak yaş barajı eklenmedi, çünkü
okuyucu kaydı reşit olmayanlara da açıktır.

---

## D-066 — Doğrulanmamış hesaplar 7 gün sonra otomatik silinir

**Karar:** `pnpm purge-unverified` adında bir zamanlanmış iş eklendi: e-posta
adresi hiç doğrulanmamış (yalnızca `user` rolünde olabilen) hesaplar, kayıt
tarihinden 7 gün sonra `anonymiseUser` ile anonimleştirilir ve yumuşak silinir.
İş idempotenttir ve her gün bir kez çalışacak şekilde önerilir; README'deki
crontab örneğine eklendi.

**Gerekçe:** Ürün sahibi "e-posta doğrulaması yapmamış kullanıcıları sil" dedi.
Doğrulama bağlantısı 24 saat geçerli ve yeniden istenebilir olduğu için 7 gün
yeterli bir lütuftur. Doğrulanmamış bir hesap hiçbir işlem yapamaz (D-034),
yazar olamaz, imzalı devir kaydı tutamaz; bu yüzden anonimleştirme hukuki
kayıtları tehlikeye atmaz. Anonimleştirme yolu, kullanıcı talepli silmeyle
aynı mekanizmadır; fark yalnızca tetikleyicinin ve gerekçenin `audit_log`'a
"user.anonymised" olarak düşmesidir.

**Sınır:** Bu iş yalnızca halihazırda var olan doğrulanmamış hesapları temizler;
yeni doğrulanmamış hesap üretimini D-067 önler.

---

## D-067 — Kayıt iki adıma bölündü: hesap doğrulama anında doğar

**Karar:** Kayıt artık hesap oluşturmaz. `/register` formu `pending_registrations`
tablosuna (şifre hash'i, doğum tarihi, KVKK sürümü, tek kullanımlık bağlantı
token'ı) yazar ve doğrulama e-postasını gönderir; hesap, bağlantı tıklandığında
`verifyEmail` içinde `email_verified_at` dolu olarak doğar. Aynı adres için yeni
bir başvuru eski kullanılmamış satırı harcar (400 "daha önce kullanılmış"),
tüketilen satır ise silinir — bu yüzden kullanılmış bir bağlantı bilinmeyen
bağlantıyla aynı 404'ü döner. Eski iki aşamalı akıştan kalan hesaplar legacy
yoldan doğrulamayı sürdürür; `requireAuth` artık "doğrulanmamış ama hesap"
durumunu yalnızca o eski hesaplar için bekler. `purge-unverified` aynı koşuda
süresi dolmuş bekleyen kayıtları da siler (D-066).

**Gerekçe:** Ürün sahibi "kullanıcılar kayıt olurken mail doğrulaması olsun
mutlaka" dedi; D-034'teki sert kapının üstüne, doğrulanmamış hesap hiç
var olmasın diye iki adımlı kayıt kuruldu. Bekleyen kayıt şifre hash'i taşıdığı
için tüketimde ve süre aşımında kalıcı olarak silinir; doğrulama anında rol
yine sunucu tarafından `user` atanır.

---

## D-069 — Yazar gönderim formu: slug ve "Alt Köşe"; kapak görseli ertelendi

**Karar:** Yazar panelindeki makale formu üç istenen alanın ikisiyle genişletildi:

- **Slug:** Yazar slug'ı kendisi girebilir; boş bırakılırsa başlıktan üretilir
  (başlık değişince onu izler). Sunucuda `slugify` çıktısıyla birebir eşleşme
  (küçük harf, rakam, tire) ve benzersizlik zorunludur — public URL'nin yazar
  eliyle bozulması veya çakışması 400/409 ile reddedilir, sessizce sonek
  eklenmez.
- **"Alt Köşe" (alt kategori):** "Kategori ve Alt Köşe seçimi (11 ana kategori
  içerisinden)" ifadesi, ana kategoriye ek olarak isteğe bağlı bir ikincil
  köşe seçimi olarak yorumlandı. `articles.subcategory` (nullable) kolonu
  eklendi (migration 0023); değer yalnızca aktif yazı alanlarından biri
  olabilir ve ana kategoriden farklı olmalıdır. İnceleme zinciri yalnızca ana
  kategoriye göre işler; alt köşe, yayında etiket/keşif amaçlı ek bilgidir
  (public API'de `subcategory` olarak döner).
- **Kapak görseli: ERTELENDİ.** Formda, serviste ve şemada kapak yükleme yok:
  `cover_media_id` hiç eklenmedi, yazar tarafına görsel yükleme akışı açılmadı.
  Ürün sahibi "şuanlık bir görsel yüklemesi olmasın" dedi.

**Gerekçe:** Ürün sahibinin alan listesi "Başlık, Slug, Kapak Görseli, Özet,
Kategori ve Alt Köşe seçimi, Zengin Metin İçeriği" idi; slug ve alt köşe bu
listeyi karşılar. "Alt Köşe" kavramı sistemde hiçbir yerde tanımlı değildi;
"(11 ana kategori içerisinden)" niteliği en tutarlı okumayı ikincil kategori
olarak verir — muhafazakâr seçenek, veri modeline yeni bir kavram eklemek
yerine mevcut alan modelinin doğal uzantısını kullanmaktır. Kapak görseli
ürün sahibinin kararıyla kapsam dışı bırakıldı; görseller yalnızca editör
kütüphanesi üzerinden girer (lisans seçimi zorunlu olan mevcut akış).






## D-070 — Rol değişikliği tek transaction; roller ve durumlar serviste zod ile doğrulanır

**Karar:** Kod gözden geçirmesinde çıkan üç bağlantılı sorun birlikte kapatıldı.

- **Atomiklik:** `promoteToWriter` ve `changeRole` artık `db.transaction`
  içinde çalışır. `users.role` güncellemesi, `changeRole`'deki
  `clearEditorAreas` temizliği ve `role_changes` kaydı (ve onun `audit_log`
  satırı) aynı işlemde commit olur. `writeAudit` ve `recordRoleChange` isteğe
  bağlı bir `Executor` parametresi alır (`lib/audit.ts`); veren çağıran kendi
  transaction'ını aşağı geçirir, vermeyen eskisi gibi ortam bağlantısına yazar.
  `clearEditorAreas` de aynı parametreyi alır.
- **Rol doğrulaması:** `changeRole` rolü `unknown` olarak alır ve içeride
  `z.enum` ile doğrular. Eskiden action katmanında `as Role` cast'i vardı;
  `role=superadmin` gibi bir gönderim `clearEditorAreas`'i çalıştırıp commit
  ediyor, sonra Postgres enum'unda patlıyordu — editörün alan atamaları silinmiş,
  rolü değişmemiş halde kalıyordu.
- **Durum doğrulaması:** `transitionArticle` hedef durumu `unknown` alır ve
  `z.enum` ile doğrular; ayrıca `scheduledAt` için `Invalid Date` kontrolü
  yapar (`new Date("abc")` eskiden veritabanına kadar gidip 500 üretiyordu).
  `editor/actions.ts`'teki `as ArticleStatus` cast'i kaldırıldı.
- **KVKK ön koşulu geri geldi:** `checkWriterEligibility` artık
  `kvkk_consent_at` arar. D-050 bu şartı, kayıt akışı KVKK onayı toplamayı
  bıraktığı için kaldırmıştı; D-065/D-067 ile kayıt onayı yeniden topluyor
  (`registerSchema.kvkkConsent`, doğrulamada `kvkkConsentAt` yazılıyor) ve
  seed/`create-admin` de dolduruyor. D-050'nin "yayınlanmış sözleşme aranmaz"
  yarısı yürürlükte kalır.

**Gerekçe:** CLAUDE.md'nin ihlal edilemez kuralları "Rol değişikliği
`role_changes` kaydı olmadan gerçekleşmez", "`writer` terfisi için … KVKK
onayı" ve "Tüm girdiler zod ile doğrulanır" diyor. Üçü de kodda karşılıksızdı:
iki ayrı yazma arasında süreç ölürse denetim izi olmadan rol değişebiliyor,
KVKK hiç kontrol edilmiyor, roller ve durumlar yalnızca TypeScript cast'iyle
geçiyordu. Doğrulamayı action yerine servise koymak CLAUDE.md'nin "İş kuralı
servis katmanında, tek yerde" kuralını da izler: ikinci bir çağıran
doğrulamayı unutamaz.

---

## D-071 — Editörün alan kapsamı yazma işlemlerinde de geçerli

**Karar:** `assertCanReadArticle` içindeki alan kontrolü
`assertEditorCoversArticle` olarak ayrıldı ve editörün makaleye dokunduğu her
yola uygulandı: `updateArticle`, `addComment`, `resolveComment`,
`setPlagiarismStatus`, `listArticleVersions`, `listComments`. Kural her yerde
aynı: admin ve ana editör her kategoriyi kapsar, düz kategori editörü yalnızca
`editor_categories`'teki kendi alanlarını.

Ek olarak `updateArticle` bir makaleyi editörün tutmadığı bir kategoriye
taşımayı reddeder (hem eski hem yeni kategori kapsamda olmalı) — aksi halde
editör yazıyı başkasının kuyruğuna atıp kendini dışarıda bırakabilirdi.

Aynı fonksiyondaki ikinci düzeltme: gönderilmeyen alanlar artık korunuyor.
`category` ve `dueDate` `input.x ?? null` ile yazılıyordu, yani kısmi bir
güncelleme bunları sessizce siliyordu; yanlarındaki `issueId` ve `subcategory`
ise `=== undefined` kontrolüyle koruyordu. Üçü de artık aynı davranıyor.

**Gerekçe:** Kapsam kontrolü yalnızca okuma tarafında vardı. Düz bir kategori
editörü alanı dışındaki bir makaleyi panelde açamıyordu ama elle hazırlanmış
bir POST ile başlığını, gövdesini, yazarını ve kategorisini değiştirebiliyordu
— ön yüzde gizlemek yetki değildir (CLAUDE.md). `transitionArticle` bunu zaten
`canPerformTransition` + `getEditorAssignment` ile doğru yapıyordu; diğer yazma
yolları aynı çizgiye getirildi.

---

## D-072 — Yasaklı/doğrulanmamış hesap için kalan kapılar kapatıldı; CSRF istisnasız

**Karar:** Oturum var diye yetki var sayılan üç yer düzeltildi.

- **Route handler'lar:** `/api/community/messages` (GET ve POST) ve
  `/api/media/[id]` `getAuthContext()` yerine `requireAuth()` kullanır. İlki
  yalnızca "oturum çerezi geçerli mi" diye sorar; ban ve e-posta doğrulaması
  `requireAuth`'ta.
- **Servis katmanı:** `addChatMessage` ve `addCommunityComment` artık
  `assertMayPost(actor)` çağırır (yasaklı değil + adres doğrulanmış). Yorum
  action'ı zaten `requireAuth`'tan geçiyordu, sohbet endpoint'i geçmiyordu;
  kural servise konunca ikinci bir çağıran atlayamaz.
- **`requireSession`:** Ban kontrolü eklendi. `guardPanel` bakıyordu ama
  `requireSession` bakmıyordu, dolayısıyla yasaklı bir okuyucu `/magazine` ve
  `/account` sayfalarında gezinmeye devam ediyordu. `guardPanel`'deki tekrar
  eden kontrol kaldırıldı.
- **CSRF istisnası kalmadı:** `logoutAction` artık `FormData` alır ve
  `assertCsrfFromForm` çağırır; token `PanelShell` (server component) tarafından
  okunup `PanelSidebar` → `SidebarFrame` üzerinden gizli alana basılır.
  `markAnnouncementsReadAction` silindi: hiçbir çağıranı yoktu, `FormData`
  almadığı için doğrulanacak token'ı da yoktu ve duyuru sayfaları okumayı
  listeleyerek zaten kaydediyor.

**Gerekçe:** CLAUDE.md "Yetki kontrolü her server action ve route handler'da
sunucu tarafında" diyor; `getAuthContext()` yetki kontrolü değil, kimlik
tespitidir. Yasaklı bir hesabın sohbete yazmaya devam edebilmesi moderasyon
kararını anlamsız kılıyordu. CSRF tarafında `csrf.ts`'in kendi başlığı "every
mutation" diyor — iki istisna vardı, ikisi de kapandı.

---

## D-073 — 2FA bileti koddan sonra harcanır; giriş ve şifre yolları sertleştirildi

**Karar:** Kimlik doğrulama akışındaki beş sorun kapatıldı.

- **2FA bileti:** `consumeLoginChallenge` ikiye ayrıldı. `readLoginChallenge`
  bileti harcamadan okur, `consumeLoginChallenge` yalnızca kod doğrulandıktan
  sonra harcar ve `consumed_at is null` koşulunu UPDATE'in içine koyarak yarışı
  önler. Eskiden bilet kod kontrolünden **önce** harcanıyordu: tek bir yanlış
  hane bileti yakıyor, kullanıcı şifre ekranına dönüyordu ve `login_2fa`'nın
  beş denemelik penceresine hiç sıra gelmiyordu — kural vardı, erişilemiyordu.
- **Giriş zamanlaması:** Hesap yokken de bir argon2 doğrulaması çalışır
  (`decoyPasswordHash`, süreç başına bir kez üretilen rastgele bir parolanın
  hash'i). Mesaj zaten aynıydı ama süre değildi: hesap yoksa cevap birkaç
  milisaniyede, varsa ~100ms'de dönüyordu; bu fark tek başına hesap
  numaralandırmaya yetiyordu.
- **E-posta token'ı:** `consumeEmailToken` artık `consumePendingRegistration`
  gibi atomik. SELECT ile UPDATE arasında koşul yoktu, yani aynı sıfırlama
  bağlantısına iki eşzamanlı tıklama ikisi birden geçebiliyordu.
- **Şifre barı tek yerde:** `assertPasswordAcceptable` politika + sızıntı
  listesini birlikte uygular; kayıt, sıfırlama ve panel içi değiştirme üçü de
  onu çağırır. Önceden yalnızca kayıt `isPwned` bakıyordu, yani kayıtta
  reddedilen bir şifre "şifremi unuttum" üzerinden kabul ediliyordu.
- **Oturum iptali servise taşındı:** `resetPassword` ve `confirmEmailChange`
  `revokeAllSessions`'ı kendileri çağırır. Çağrı action katmanındaydı; iki
  fonksiyonun doküman yorumu bunu zaten vaat ediyordu ama ikinci bir çağıran
  sessizce atlayabilirdi.

**Gerekçe:** CLAUDE.md "İş kuralı servis katmanında, tek yerde" diyor; oturum
iptali ve şifre barı bunun iki ihlaliydi. 2FA bileti ve token tüketimi ise
doğruluk hatasıydı: biri ürünü kullanılamaz hale getiriyor (tek deneme), diğeri
sessiz bir yarış bırakıyordu.

---

## D-074 — Rate limit sayacı tek deyimde (upsert), okuma-sonra-yazma değil

**Karar:** `consumeAttempt` artık tek bir `INSERT … ON CONFLICT DO UPDATE`
çalıştırır. Kilitli mi, pencere devrildi mi, limit aşıldı mı kararlarının hepsi
`CASE` ifadelerinde; JavaScript yalnızca dönen satıra bakıp `allowed`/
`retryAfterMs` üretir. `(scope, identifier)` üzerindeki mevcut unique index
upsert'in hedefi olarak kullanılır.

**Gerekçe:** Eski sürüm SELECT yapıp kararı JavaScript'te veriyor, sonra UPDATE
ediyordu. Aynı anda gelen iki istek aynı `count` değerini okuyup aynı
`count + 1`'i yazıyordu; paralel bir tahmin salvosu saldırgana tek deneme
maliyeti çıkarıyordu — yani limitin kendisi paralellikle aşılabiliyordu. Karar
veritabanına taşınınca satır kilidi zaten orada olduğu için ek bir transaction
gerekmiyor.

**Not:** Yeni `tests/integration/rate-limit.test.ts` paralel denemelerin her
birinin sayıldığını doğrular. Yerel test veritabanı PGlite tek bağlantıyla
çalıştığı için bu test gerçek eşzamanlılığı değil, sayım mantığının doğruluğunu
kanıtlar; asıl kazanç üretimdeki havuzlu bağlantıda.

---

## D-075 — Hata yanıtı CLAUDE.md'deki zarfa getirildi

**Karar:** `toErrorResponse` artık `{ error: { code, message, fields? } }`
döndürür. Önceki biçim `{ error: "<mesaj>", code, details? }` idi: mesaj
zarfın yerinde duran düz bir string, alan hataları ise `fields` yerine
`details` altındaydı. `/api/community/messages` içindeki elle yazılmış 400
dalı zaten doğru biçimi üretiyordu; o dal da `badRequest()` fırlatacak şekilde
değiştirildi, böylece biçime karar veren tek yer `errorJson` kaldı.

Yeni `tests/unit/errors.test.ts` zarfı sabitler: `fields` adı, alan yokken
`fields`'ın hiç olmaması, kod→durum eşlemesi ve beklenmeyen bir hatanın
mesajının asla dışarı sızmaması.

**Gerekçe:** CLAUDE.md kod stili bölümü biçimi açıkça yazıyor ve kod ona
uymuyordu; dahası aynı API iki farklı lehçe konuşuyordu. Bu bir ön yüz
sözleşmesi olduğu için sessiz kalmak yerine kodu belgeye uydurmak doğru yön —
public API'yi tüketen taraf CLAUDE.md'yi okuyor.

**Not:** Server action'ların döndürdüğü `ActionState.error` bir string olarak
kalır; o HTTP gövdesi değil, formun yeniden çizilmesi için kullanılan iç bir
tiptir ve `runAction` tarafından üretilir.

---

## D-076 — Yayın adı imzalı `byline_choice`'a bağlandı; gerçek ad varsayılan değil

**Karar:** Public API'de yazar adı artık imzalanmış Eser Onayındaki
`rights_grants.byline_choice`'tan çözülür:

- `real_name` → `display_name` (yazar bunu kendi imzasıyla seçti)
- `pen_name` → `pen_name` (imza akışı mahlası olmayandan bu seçimi zaten
  reddediyor, `rights.ts:284`)
- imzalı seçim yoksa → `pen_name`, o da yoksa **"İsimsiz"**

`getPublicArticle`, `getPublishedIssue` ve `listRecentArticles` imzalı hak
devrini `leftJoin` ile alır; `rights_grants` üzerindeki kısmi unique index
makale başına tek canlı devre izin verdiği için aliasing veya gruplama
gerekmez. `getPublicAuthor` mahlas slug'ıyla bulunduğu için yapısı gereği
`pen_name`.

Topluluk tarafında da aynı mantık: yorum ve sohbet listeleri
`coalesce(pen_name, display_name)` gösterir. Mahlasla yayın yapan bir yazarın
kendi yazısının altında gerçek adıyla görünmesi mahlası anlamsız kılıyordu.
Yönetici moderasyon listeleri bilerek `display_name` göstermeye devam eder —
o ekranın amacı hesabı teşhis etmek.

**Gerekçe:** Eski kod `penName ?? displayName` yazıyordu, yani mahlas
girmemiş her yazarın gerçek adı yayına çıkıyordu. CLAUDE.md "Public API …
gerçek ad … döndürmez" diyor; ama gerçek adı hiç göstermemek de doğru değil,
çünkü yazar Eser Onayında bunu açıkça seçebiliyor. Rıza zaten veritabanında
kayıtlı olduğu için doğru cevap onu okumaktı — hem kurala hem ürüne uyan tek
seçenek bu.

**Not:** Bu davranış değişikliğidir. `real_name` imzalamış, mahlası da olan bir
yazarın yayın adı artık gerçek adıdır (eskiden mahlası basılıyordu). Testler
her iki seçimi de ayrı ayrı doğrular.

---

## D-077 — CLAUDE.md gerçeğe uyduruldu; `SPEC.md` diye bir dosya yok

**Karar:** Kök `CLAUDE.md`'de koda uymayan dört madde düzeltildi. Kod
taşınmadı; belge kodun bulunduğu yere getirildi.

| Eski madde | Gerçek |
|---|---|
| `SPEC.md` ürünün tam tanımıdır, çelişkide o kazanır | Böyle bir dosya depoda hiç olmadı. Fiili tanım `DECISIONS.md` + `README.md`; çelişkide daha yeni numaralı karar kazanır. |
| Durum makinesi `src/services/articles/transitions.ts` | `src/lib/article-status.ts` |
| Yetki kontrolü `src/lib/authz.ts` | `src/lib/auth/rbac.ts` (saf fonksiyonlar) + `session.ts`'teki `requireRole` + `guard.ts`'teki `guardPanel` |
| Türkçe metinler `src/i18n/tr.ts`'de, JSX'te gömülü metin yok | `src/i18n/` yok; 64 `.tsx` dosyasında gömülü Türkçe var |

**Gerekçe:** Dosya yollarında kod belgeden daha iyi: `rbac.ts`, yanındaki
`session.ts` ve `guard.ts` ile tek bir yetki modülü oluşturuyor;
`src/lib/authz.ts`'e taşımak bu grubu dağıtırdı. Durum makinesi de saf ve
veritabanından bağımsız olduğu için `lib/` altında doğru yerde.

i18n maddesi bilinçli olarak kaldırıldı: ürün tek dilli, ikinci bir dil
planlanmıyor ve 64 dosyadaki metni bir sözlüğe taşımak, karşılığında hiçbir
davranış kazandırmadan her metni kullanıldığı yerden uzaklaştırırdı. Kural
kâğıt üstünde kalıp sürekli ihlal edilmektense kaldırılması dürüst olan.

`SPEC.md` maddesi en önemlisiydi: her oturum "çelişki varsa SPEC.md kazanır"
diye başlıyordu ve o dosya yoktu — yani otorite olarak gösterilen belge hiç
okunamıyordu. Koddaki `§8`, `§13` gibi atıflar da bu belgeye işaret ediyor;
bunlar tek tek temizlenmedi (çok yerdeler ve zararsızlar) ama yeni kodda
`D-0xx` kullanılacağı `CLAUDE.md`'ye yazıldı.

Ayrıca `rbac.ts`'teki `canPerformTransition` varsayılan dalının yorumu
düzeltildi: "`awaiting_rights` ve `withdrawn` doğrudan çağrılamaz" diyordu ama
`withdrawn` üstteki `case` listesindeydi ve doğrudan çağrılabiliyor.

---

## D-078 — D-074 geri alındı: upsert canlıda çalışmadı, sayaç eski haline döndü

**Karar:** `consumeAttempt` D-074 öncesi haline (SELECT → karar → UPDATE) geri
döndürüldü. Testler kalır; yalnızca paralellik iddiasını doğrulayan test
sıralı sayımı doğrulayacak şekilde daraltıldı.

**Ne oldu:** D-074 push edildikten sonra canlıda kayıt, giriş ve şifre
sıfırlama — yani `consumeAttempt`'ten geçen her akış — "Beklenmeyen bir hata
oluştu." vermeye başladı. `auth_attempts` tablosuna deploy'dan (13:35 UTC)
sonra tek satır yazılmadı; son satır 13:34:46'da.

**Elenen olasılıklar (hepsi canlıya karşı doğrulandı):**

- Şema/migration: bu değişiklik `src/db/` veya `drizzle/`'a dokunmadı.
- `auth_attempts_scope_identifier_unique` index'i yerinde ve upsert hedefiyle
  eşleşiyor.
- Üretilen SQL Neon'da geçerli: hem `EXPLAIN` hem `PREPARE` sorunsuz geçti,
  yani ayrıştırma ve tip çıkarımı doğru.
- Veritabanı Vercel'den erişilebilir ve yazılabilir: `/api/public/issues`
  çalışıyor, deploy öncesi yazmalar başarılı.
- `env()` sağlam: `sitemap.xml` `SITE_URL`'i okuyup üretiyor (mutasyon yolunda
  `env()` çağrılır, public API'de çağrılmaz — bu ikisi böyle ayrıldı).
- `pnpm build` yerelde temiz; paketleme hatası yok.

**Yani kök neden bulunamadı.** Geriye kalan tek fark, drizzle'ın `sql`
şablonuna ham `Date` nesnesi olarak geçirdiği parametreler ($5–$13, kolon
değerleri gibi string'e eşlenmiyor) ile postgres.js'in bunları tel üzerinde
nasıl gönderdiği. Bu yerel PGlite sürücüsünde farklı davranıyor olabilir; 327
birim testi ve 23 e2e testi PGlite üzerinde geçtiği için sorun testlerden
kaçtı.

**Alınan ders:** `pnpm typecheck && pnpm lint && pnpm test` bu hatayı
yakalayamazdı ve `pnpm build` de yakalamadı. Yerel test veritabanı PGlite,
üretim postgres.js — sürücüye duyarlı SQL (upsert, `sql` şablonu, ham tip
parametreleri) yazarken bu ikisi aynı şey değil. Böyle bir değişiklik bir Neon
dalına karşı çalıştırılmadan yayınlanmamalı.

**Sonuç:** D-074'ün çözdüğü yarış koşulu geri geldi — paralel istekler aynı
sayacı okuyup aynı değeri yazabilir, yani bir tahmin salvosu saldırgana tek
deneme maliyeti çıkarır. Bu bilinen ve kabul edilen açık bir noktadır; tekrar
denenmeden önce gerçek Postgres'e karşı doğrulanmalıdır.

---

## D-079 — Üretim şeması 3 migration geriydi; drizzle defteri de bozuktu

**Ne oldu:** 12 commit `main`'e push edildi (D-066…D-069 dahil) ama
migration'lar üretime uygulanmadı. Kod yeni şemayı bekliyordu, veritabanı eski
şemadaydı. Üç akış birden kapandı:

| Migration | Eksik olan | Kırılan |
|---|---|---|
| `0020_glorious_runaways` | `pending_registrations` tablosu | Kayıt olma |
| `0021_white_ares` | `article_status`'ta yeni adlar | İnceleme zinciri (`in_review` sonrası) |
| `0023_mean_blizzard` | `articles.subcategory` | Yazar makale formu (alt köşe) |

**İkinci sorun:** `db:migrate` bunları uygulayamıyordu, çünkü
`drizzle.__drizzle_migrations` defteri gerçekle uyuşmuyordu: **0019 fiilen
uygulanmış ama kaydı düşülmemişti** (drizzle dışından uygulanmış). Migrator
yalnızca en yüksek `created_at`'e bakar, o yüzden her çalışmada 0019'dan
başlıyor ve `enum label "category_approved" already exists` ile duruyordu.

**Yapılan:**

1. Üretim dalından snapshot alındı (`snap-late-fog-b1cxy1ir`).
2. 0019'un ürettiği altı şey tek tek doğrulandı (iki enum değeri,
   `editor_categories`, `users.is_main_editor`, iki foreign key, üç index) —
   hepsi eksiksiz. Ancak bundan sonra deftere kaydı yazıldı. Hash yöntemi
   0018 üzerinde doğrulandı: dosyanın sha256'sı üretimdeki kayıtlı hash ile
   birebir tuttu.
3. `db:migrate` çalıştırıldı; 0020, 0021, 0023 uygulandı.
4. Doğrulandı: defter 23 kayıt (journal ile birebir), 37 kullanıcı ve 1 makale
   (`draft`) korundu, enum yeni adlarda, kayıt akışı uçtan uca test edildi
   (`pending_registrations` satırı, argon2 hash, 24 saatlik token).

**Gerekçe ve ders:** Memory'deki "deploy için `main`'e push yeterli" notu
**kod** için doğru, migration için değil — `pnpm db:migrate` ayrı ve elle
çalıştırılan bir adım. Push etmeden önce üretimin migration durumu kontrol
edilmeliydi. Bu, aynı gün içindeki ikinci "gideceği ortama karşı doğrulamadım"
hatasıydı (ilki D-078).

**Açık kalan:** `0022` diye bir migration yok; journal 0021'den 0023'e
atlıyor. Zararsız (drizzle journal'ı izler, dosya adını değil) ama neden
oluştuğu bilinmiyor. Ayrıca `pending_registrations`'ta bir test satırı var
(`kayit-testi-2026@example.invalid`); 24 saatte süresi dolar ve
`purge-unverified` temizler.

---

## D-080 — Yazar formu sadeleşti; editörün makale sayfasından "Görseller" kalktı

**İstek (ürün sahibi):** "Makalelerim" → "Yazılarım"; yazı ekleme formundan
alt köşe ve etiketler kalksın; editör panelinde görseller bölümü kalksın.

**Yapılan:**

- Yazar menüsü ve `/writer/articles` başlığı "Yazılarım" oldu.
- `/writer/articles/new` ve `/writer/articles/[id]` formlarından "Alt köşe" ve
  "Etiketler" alanları çıkarıldı. İkisi aynı formun iki hâli; birinden kalkıp
  ötekinde kalması tutarsız olurdu.
- Yazar action'ları `subcategory` ve `tags` alanlarını **hiç göndermiyor**.
  Formdan kalkan alanı `listField`/`optionalText` ile okumaya devam etmek `[]`
  ve `null` döndürürdü; servis bunları "boşalt" diye yorumlayıp editörün
  girdiği değeri her yazar kaydında silerdi. `undefined` ise saklı değeri korur.
- `/editor/articles/[id]` sayfasındaki "Görseller" kartı (bağlı görsel listesi,
  "Çıkar", "Görsel ekle") kaldırıldı.

**Bilerek dokunulmayanlar:**

- Veritabanı kolonları (`articles.subcategory`, `articles.tags`) ve servis
  doğrulaması duruyor: migration yok, dergideki etiket gösterimi çalışmaya
  devam ediyor.
- Editörün kendi formları (yeni makale kaydı, makale düzenleme) alt köşe ve
  etiketleri hâlâ gösteriyor; istek yazı ekleme formuyla sınırlıydı.
- "Medya kütüphanesi" menüsü ve `attachMediaAction`/`detachMediaAction`
  yerinde. Lisans uyarısı ve yayın engeli (`allMediaLicensed`) de korunuyor;
  daha önce bağlanmış lisanssız bir görsel hâlâ yayını durdurur.
- e2e `05-media-license`: görseli makaleye bağlama adımı arayüzden kalktığı
  için o kısım çıkarıldı; yerine kartın artık görünmediğini doğrulayan test
  kondu.

---

## D-081 — Alt köşe ve etiketler editör formlarından da kalktı

**İstek (ürün sahibi):** D-080'de bilerek bırakılan editör formlarından da
alt köşe ve etiketler kaldırılsın.

**Yapılan:**

- `/editor/articles` "Yeni makale kaydı" formundan "Etiketler" çıkarıldı (bu
  formda alt köşe zaten yoktu).
- `/editor/articles/[id]` düzenleme formundan "Alt köşe" ve "Etiketler"
  çıkarıldı.
- `createArticleAction` `tags`, `updateArticleAction` `subcategory` ve `tags`
  göndermiyor. Gerekçe D-080 ile aynı: boş okunan alan saklı değeri silerdi;
  gönderilmeyen alan onu korur.

**Sonuç:** Artık hiçbir panel formu bu iki alanı yazmıyor. Kolonlar, zod
şemaları ve `assertSubcategoryAllowed` yerinde; mevcut değerler korunur ve
dergide gösterilmeye devam eder, yeni değer girilemez. Alanları tamamen
kaldırmak (migration) ayrı bir karar olur.

---

## D-082 — `articles.subcategory` ve `articles.tags` veritabanından kaldırıldı

**İstek (ürün sahibi):** D-081'de formlardan kalkan alt köşe ve etiketler
veritabanından da tamamen kalksın.

**Yapılan:**

- Şemadan iki kolon çıkarıldı; `pnpm db:generate` → `0024_ancient_korvac`
  (`DROP COLUMN "subcategory"`, `DROP COLUMN "tags"`).
- Servis: iki zod şemasından alanlar ve `assertSubcategoryAllowed` silindi.
  Şemalar `strictObject` olduğu için bu alanları gönderen bir istek artık 400
  alır (entegrasyon testi bunu doğruluyor).
- Public okuma modeli (`getPublicArticle`, `listRecentArticles`) artık
  `subcategory` ve `tags` döndürmüyor. D-069'daki "public API'de `subcategory`
  döner" sözü geçersiz. Dergi yazı sayfasındaki etiket rozetleri kalktı.

**Yayın sırası (D-079):** Önce kod, sonra migration. Yeni kod bu kolonları hiç
okumadığı için eski şemayla çalışır; tersi olursa canlıdaki eski kod var
olmayan kolonu seçip her makale sayfasını kırardı.

**Veri kaybı:** Üretimde `subcategory` dolu satır yoktu. `tags` tek makalede
doluydu ("Madde 1 - Takıntı", 12 etiket); kolon düşünce bu etiketler gider.

**Durum — ÜRETİME UYGULANMADI (bilerek bekletiliyor):** Kod yayında, yerel
pglite migrate edildi. Ürün sahibi üretim migration'ını şimdilik beklettirdi.
Üretim defteri 23 kayıtta, `0024` bekliyor. Kolonlar orada ama kod okumuyor;
bu zararsız.

**Dikkat:** Üretimde bir sonraki `pnpm db:migrate`, hangi migration için
çalıştırılırsa çalıştırılsın `0024`'ü de uygular ve etiketleri siler. Başka
bir migration'ı canlıya almadan önce ürün sahibine sor. Uygulanacaksa önce
snapshot al.

---

## D-083 — KVKK aydınlatma metni baştan yazıldı

**İstek (ürün sahibi):** Metnin 6698 sayılı Kanun açısından yeterli olup
olmadığı soruldu; inceleme sonrası yeni metin istendi.

**Tespit:** Eski metin (5 başlık, ~30 satır) KVKK m. 10'un beş zorunlu
unsurundan üçünü hiç karşılamıyordu:

- **Aktarım bilgisi yoktu.** Oysa üretim Vercel + Neon (AWS us-east-2, Ohio)
  üzerinde; bütün kişisel veri fiilen ABD'de. Bu, m. 9 anlamında yurt dışına
  aktarım ve metinde tek kelime geçmiyordu.
- **Hukuki sebep yoktu.** Amaçlar sayılmış ama hiçbirine m. 5/2 dayanağı
  gösterilmemişti; Aydınlatma Tebliği her amaç için ayrı sebep ister.
- **Veri sorumlusunun kimliği eksikti.** "postscript e-dergi" yazıyordu; açık
  unvan, adres, iletişim yoktu.

**Ayrıca metin gerçeği anlatmıyordu:**

- "Kimlik doğrulama belgesi ... 90 gün saklanır ve otomatik silinir" diyordu.
  Kimlik belgesi adımı **D-047 ile üründen çıkarıldı**; şemada böyle bir alan
  yok, 90 günlük silme işi de hiç yazılmadı. Metin iptal edilmiş bir tasarımı
  anlatıyordu.
- Fiilen işlenen ama sayılmayan veriler: `users.phone` (D-053), `bio`,
  `socialLinks`, `avatarMediaId`, topluluk yorum/mesaj içerikleri ve bunların
  `audit_log`'daki IP kayıtları, `isBanned`/`bannedReason`, TOTP anahtarı,
  başvurudaki örnek çalışma.
- Saklama süreleri fiilen sınırsızdı: `sessions` hiç temizlenmiyor, `audit_log`
  tasarım gereği hiç silinmiyor (D-015). Metinde süre yazmıyordu.

**Yapılan:** `data/kvkk-aydinlatma-metni.md` baştan yazıldı. On başlık: veri
sorumlusu, işlenen veriler, amaç–hukuki sebep tablosu, toplama yöntemi,
çerezler, yurt içi/yurt dışı aktarım, saklama süreleri, m. 11 hakları, başvuru
usulü, sürüm politikası. Her satır koda bakılarak yazıldı; tahmin yok.

**Neden şablon değil kod okundu:** Hazır bir KVKK şablonu, metnin eskiden
düştüğü tuzağın aynısına düşerdi — sistemin yapmadığı şeyi anlatmak. Metindeki
her veri kalemi, her süre ve her çerez adı şemadaki bir kolona veya koddaki bir
sabite karşılık geliyor.

**Metinde bilerek bırakılan boşluklar:** `[ORTAK 1 AD SOYAD]`, `[AÇIK ADRES]`,
`[DERGİ E-POSTA ADRESİ]`, `[NESNE DEPOLAMA SAĞLAYICISI]`, `[E-POSTA
SAĞLAYICISI]`. KVKK sayfası (`src/app/kvkk/page.tsx`) metni ham markdown olarak
basar; sözleşmedeki gibi `{{...}}` yer tutucu ikamesi yoktur, bu yüzden
değerler `site_settings`'ten otomatik gelmez. Yayınlamadan önce elle
doldurulacak.

**Yayınlanmadan önce doğru olması gerekenler (aksi hâlde metin yanlış beyan):**

1. Vercel ve Neon ile **standart sözleşme** imzalanmış ve imzadan itibaren
   5 iş günü içinde Kuruma bildirilmiş olmalı (m. 9/3). Metin bunu olmuş gibi
   yazıyor.
2. `sessions` için 1 yıllık temizlik işi yazılmalı; şu an hiç silinmiyor.
3. Köşeli parantezli alanlar doldurulmalı.

**Sonraki adımlara bırakılanlar:**

- Kayıt formundaki kutu "okudum ve **onaylıyorum**" diyor
  (`src/app/(auth)/register/page.tsx:64`). Aydınlatma onaylanmaz, bilgilendirir;
  buradaki işlemenin sebebi zaten açık rıza değil, sözleşmenin ifası. "Okudum ve
  anladım" olacak.
- `kvkkConsentVersion` kayıtta yazılıyor ama hiçbir yerde karşılaştırılmıyor.
  Yeni sürüm yayınlandığında mevcut kullanıcılara gösterilmiyor; metnin 10.
  başlığı bunu vaat ediyor, kod henüz yapmıyor.
- 5651 künyesi (`/iletisim`) ile veri sorumlusu kimliği aynı kaynaktan beslenir;
  birlikte yapılacak.

**Yayına alma:** Dosya yalnızca `pnpm seed` girdisidir. Üretimdeki metin
`kvkk_versions` tablosunda durur; yeni sürüm admin panelindeki "Sistem"
sayfasından yayınlanmadıkça canlıda hiçbir şey değişmez.

---
## D-084 — 5651 künyesi, kullanım şartları ve yasal sayfa iskeleti

**İstek (ürün sahibi):** 5651 incelemesinde çıkan eksikler uygulansın, okuyucu
kullanım şartları yazılsın, `CLAUDE.md`'ye bundan sonra ilgili kanunlara göre
hareket edileceği yazılsın.

**Sorun:** Footer'daki "iletişim", "gizlilik", "kullanım şartları" bağlantılarının
üçü de `#contact`'a, yani kendi footer'ına gidiyordu. Ana menüdeki "İLETİŞİM" de
öyle. Sitede derginin kim olduğu, adresi veya e-postası hiçbir yerde yazmıyordu —
5651 m. 3'ün açık ihlali. Kaldırma başvurusu için de bir kanal yoktu; yani m. 9
süreleri bize karşı işliyordu ama başvurunun ulaşacağı bir adres yoktu.

**Yapılan:**

- `/iletisim` — künye. Tanıtıcı bilgiler, hangi sıfatla sorumlu olduğumuz
  (içerik sağlayıcı + yer sağlayıcı), içerik kaldırma ve itiraz başvurusu usulü
  (24 saat taahhüdü), barındırma bilgisi.
- `/kullanim-sartlari` — okuyucu şartları. Hesap, topluluk kuralları, içerikten
  sorumluluk, moderasyon, FSEK durumu, hesabın sona ermesi, yetkili mahkeme.
- `src/lib/legal.ts` — `buildImprint`. Saf fonksiyon, veritabanına dokunmaz;
  eksik alanları `missing` içinde döndürür.
- `src/components/legal.tsx` — üç yasal sayfanın paylaştığı kabuk, aralarında
  çapraz bağlantı. `/kvkk` de buna taşındı.
- Footer ve ana menü gerçek adreslere bağlandı; panel footer'ına da aynı üç
  bağlantı eklendi.
- `tests/unit/legal.test.ts` — 6 test.

**Neden `site_settings`, neden ikinci bir kopya değil:** Bilgiler zaten yazar
sözleşmesi şablonu için orada tutuluyordu (`publisher_partner_1/2`,
`publisher_address`, `publisher_email`, `public_domain`, `jurisdiction_city`).
Künye aynı olguları istiyor; ikinci kopya kaçınılmaz olarak sözleşmeden ayrışırdı.

**Neden veritabanı sürümlemesi yok:** KVKK metni `kvkk_versions`'ta çünkü
kullanıcının hangi sürümü gördüğü kanıt değeri taşıyor. Künye ve kullanım
şartlarında böyle bir kanıt ihtiyacı yok; React sayfası olarak tutmak metni
git'te sürümler ve migration gerektirmez.

**Eksik alan davranışı:** `site_settings` boşsa sayfa uyarı gösterir ve boş
satırı "— belirtilmedi —" diye işaretler. Gerçek görünen ama içi boş bir künye
basmaktan iyidir; künye ancak doğru olduğunda künyedir.

**Doğrulama:** `pnpm typecheck && pnpm lint && pnpm test` → 24 dosya, 333 test
geçti. `next build` üç rotayı da dinamik (ƒ) olarak üretti. Dev sunucusunda
oturumsuz istekle üçü de 200 döndü.

**Açık kalan — ürün sahibine:**

1. Üretimdeki `publisher_address` açık adres olmalı. Yerel seed'de "Konak,
   İzmir" yazıyor; ilçe adı 5651 m. 3 anlamında adres değildir.
2. `publisher_email` gerçekten okunan bir kutu olmalı; 24 saatlik cevap süresi
   oraya bakılmasına bağlı.
3. Vercel/Neon standart sözleşmesi (D-083) hâlâ bekliyor.
4. `sessions` için 1 yıllık temizlik işi hâlâ yazılmadı.

**Sonraki adımlar:** Çizer sözleşmesi ve editör gizlilik taahhüdü
`agreement_versions`'a `kind` kolonu gerektiriyor — tablo tek doküman
destekliyor (`version` ve `isCurrent` üzerinde tekil indeks). O migration
üretildiğinde D-082'deki `0024` de canlıya uygulanacağı için ürün sahibine
sorulmadan yayınlanmaz.

**`CLAUDE.md`:** "Hukuki uyum (ihlal edilemez)" bölümü eklendi. Tabi olunan dört
kanun, her birinin fiili karşılığı ve altı çalışma kuralı. En önemlisi: kişisel
veri toplayan bir değişiklik aynı adımda aydınlatma metnini de günceller —
D-083'te metnin koddan geri kalması tam olarak bu kuralın yokluğundan oldu.

---
## D-085 — Künyedeki eksik alan uyarısı yalnızca admin'e görünür

**İstek (ürün sahibi):** "publisher_address için şu an açık adres
verebileceğim bir ofis vs yok."

**Sorun:** D-084'te künye, eksik alanları herkese "Künye bilgileri eksik" diye
uyarıyor ve boş satırı "— belirtilmedi —" diye basıyordu. Adres kısa vadede
doldurulamayacağına göre bu uyarı kalıcı hâle gelirdi: okuyucuya bozuk, denetime
ise eksikliğin ilanı gibi görünür.

**Karar:** Uyarı ve boş satırlar yalnızca `role === "admin"` için gösterilir.
Okuyucu, dolu olan satırları görür; eksik satır hiç basılmaz. Bilgi gizlenmiyor —
olmayan bilgi yokmuş gibi davranılmıyor, sadece eksiklik duyurulmuyor.

**Gerekçe:** Boş bir alan, onu doldurabilecek kişinin işidir. Okuyucunun bundan
çıkaracağı bir eylem yok.

**Uyum durumu — açıkça kayda geçiyor:** Bu bir çözüm değil, görünürlük
düzenlemesi. 5651 m. 3 gerçek kişi içerik sağlayıcıdan ikametgâh veya işyeri
adresi ister; künyede adres olmadığı sürece eksiklik sürüyor. Ev adresi
yayımlamak istenmediği için bilinçli olarak bekletiliyor. Adres bulunduğunda
`site_settings`'e girilir, sayfa kendiliğinden düzelir; kod değişikliği
gerekmez.

**Doğrulama:** typecheck + lint temiz, 24 dosya / 333 test geçti.

---
## D-086 — Giriş yapan herkes derginin ana sayfasına döner; panel başlıktan açılır

**İstek (ürün sahibi):** "Sayfaya giriş yapıldığında sadece panel gözüküyor.
Giriş yapıldıktan sonra ana dergi sayfası gözüksün ve sağ üstteki profil/panel
kısmından panele/kullanıcı profiline giriş yapılsın."

**Sorun:** D-035'e göre kök adres (`/`) oturumu olan her hesabı rolüne göre
panele (`/admin`, `/editor`, `/writer`) ya da okuma alanına (`/magazine`)
yönlendiriyordu. Giriş yapan biri derginin ön yüzünü bir daha göremiyordu.

**Karar:**

- `/` artık kimseyi yönlendirmez; oturum olsun olmasın ana sayfayı gösterir.
- Ana sayfanın sağ üstünde, oturum varsa "GİRİŞ YAP / HEMEN KATIL" yerine
  "PROFİL" (`/account`) ve paneli olan hesap için "PANEL" görünür.
- PANEL'in hedefi `panelPathFor` (`src/lib/auth/rbac.ts`): admin → `/admin`,
  editör → `/editor`, yazar → `/writer`. Okuyucunun paneli olmadığı için butonu
  da yoktur. Fonksiyon panel guard'larının kullandığı `canAccess*Panel`
  kontrollerine dayanır: dondurulmuş editöre `/writer` gösterilir, yasaklı ya
  da doğrulanmamış hesaba hiçbir panel gösterilmez — buton 403 veren bir kapıyı
  işaret etmez.
- Şifre ve 2FA girişi `/`'a döner.
- **İstisna:** İki adımlı doğrulaması kurulmamış editör ve admin girişte hâlâ
  doğrudan `/account?twoFactor=1`'e gider. D-048 "ilk girişte kurulum ekranı
  açılır" diyor; bunu PANEL'e basılana kadar ertelemek o sözü gevşetirdi.
- E-posta doğrulama ve e-posta değişikliği yönlendirmeleri değişmedi
  (`homeFor`); karşılama bandı `/magazine`'de basılıyor.

**Güvenlik:** Buton yalnızca bağlantıdır; panel layout'ları `guardPanel`'i
çalıştırmaya devam eder. Ana sayfa bir client bileşeni olduğu için ona oturum
kullanıcısı değil yalnızca `displayName` ve panel yolu geçer — e-posta, doğum
tarihi, kimlik tarayıcıya gönderilmez.

**Hukuki uyum:** Yeni kişisel veri, amaç veya saklama yok; aydınlatma metni
değişmedi. Görünen ad zaten hesap sayfasında kullanıcının kendisine gösteriliyor.

**D-035 ile ilişki:** D-035'in "kök adres rolüne göre yönlendirir" kısmının
yerini alır. Tek giriş kapısı ve `/magazine` okuma alanı aynen geçerli.

**Testler:** `panelPathFor` için birim testi eklendi. E2E'de giriş sonrası
beklenen adres `/` oldu; paneller başlıktaki PANEL bağlantısıyla açılıyor
(`waitForHome`, `openPanelFromHome`), okuyucu için PANEL'in görünmediği
doğrulanıyor.

**Doğrulama:** typecheck + lint temiz, 24 dosya / 337 birim testi, 24/24 e2e
geçti.

---
## D-087 — Admin kullanıcı listesi hesap türüne göre ayrıldı; çizer listesi şimdilik boş

**İstek (ürün sahibi):** "Admin panelinde kullanıcılar kısmında navda alt
kategoride hepsi/yazarlar/editörler/çizerler/kullanıcılar şeklinde olsun ve
kullanıcı paneli görünümü hepsinin özelliklerine barındırdığı bilgilere göre
yapılsın." Çizerler için: "Çizerleri henüz eklemedim, onu henüz çizer yok diye
ekleyebilirsin."

**Karar:**

- Kenar çubuğunda "Kullanıcılar"ın altında beş alt bağlantı var: Hepsi
  (`/admin/users`), Yazarlar (`/admin/users/writers`), Editörler
  (`/admin/users/editors`), Çizerler (`/admin/users/illustrators`), Kullanıcılar
  (`/admin/users/readers`). Adlar ve yollar tek yerde tanımlı:
  `src/lib/user-segments.ts`. `NavItem`'a `children` eklendi. Alt bağlantı
  yalnızca kendi sayfasında vurgulanır; üst öğe yalnızca bölümü işaretler.
- **Kim hangi listede** (servis: `listUsers`'ın `segment` filtresi):
  - Yazarlar: `writer` rolü ve hibrit "Editor & Yazar" hesaplar. Hibrit iki
    görevi de taşıdığı için iki listede de görünür (D-060).
  - Editörler: `editor` rolü.
  - Kullanıcılar: `user` rolü.
  - Admin yalnızca Hepsi'de görünür. Rol filtresi de yalnızca Hepsi'de kaldı.
    Genel bakıştaki sayı kartları ilgili listeye gider; Yönetici kartı
    `?role=admin` ile Hepsi'ye.
- **Sütunlar hesap türüne göre:**
  - Hepsi: değişmedi.
  - Yazarlar: yazar durumu, alanlar, yazı sayısı (silinmemiş) ve yayındaki
    yazı sayısı.
  - Editörler: editör durumu, sorumlu alanlar (slot sırasıyla), ana editör,
    2FA açık/kapalı.
  - Kullanıcılar: e-posta doğrulama, yaş (18 altı işaretli), KVKK onay sürümü
    ve tarihi, son yazar başvurusunun durumu.

  Sütun seçimi liste başına localStorage'da tutulur. Hepsi eski anahtarı
  (`admin:users:columns`) korur, önceden yapılmış seçim kaybolmaz.
- **Detay sayfası:** "Kayıt bilgileri" kartı hesabın rolüne göre dolar.
  Okuyucuda KVKK onayı ve başvuru durumu; yazar ve hibritte mahlas, alanlar ve
  yazılar; editörde sorumlu alanlar ve ana editör; editör ve admin'de iki adımlı
  doğrulama. Terfi, rol/durum ve hesap işlemleri kartları değişmedi.
- **Çizerler:** `role` enum'unda çizer yok. Rol eklemek bir migration (D-082'de
  bekletilen `0024` ile birlikte canlıya çıkar), çizer sözleşmesi
  (`agreement_versions.kind`, D-084) ve aydınlatma metni güncellemesi ister.
  Ürün sahibi rolü henüz eklemediğini söyledi. Bu yüzden sayfa "Henüz çizer
  yok." der; servis sorgu atmadan boş liste döner. Rol tanımlandığında
  `segmentCondition` ve sütun listesi doldurulur.

**Veri ve hukuk:** Yeni kişisel veri toplanmıyor, yeni bir işleme amacı yok.
Admin, detay sayfasında zaten gördüğü alanları artık listede de görüyor.
Aydınlatma metni değişmedi. TOTP sırrı sorgulanmıyor; tarayıcıya yalnızca
açık/kapalı bilgisi gidiyor.

**Sürücü (D-078):** Yeni sorgular `count()` + `groupBy` + `inArray` +
`innerJoin` kullanıyor; ham `sql` şablonu ya da upsert yok. Aynı
`count()`/`groupBy` kalıbı admin genel bakışında zaten üretimde çalışıyor.

**Bilinen fark:** Genel bakıştaki "Yazar" sayısı yalnızca `role = writer`
hesapları sayar. Yazarlar listesi hibritleri de içerdiği için liste bu sayıdan
uzun olabilir.

**Doğrulama:** typecheck + lint temiz, 25 dosya / 345 birim ve entegrasyon testi
(8 yeni: `tests/integration/user-segments.test.ts`), 25/25 e2e geçti. Yeni e2e
(`07c-admin-user-segments.spec.ts`), 08-two-factor admin'in TOTP sırrını
değiştirdiği için ondan önce koşacak şekilde adlandırıldı.

---

## D-088 — Yorum ve mesajlara 5651 trafik kaydı; kullanım şartları koda uyduruldu

**Sorun:** KVKK aydınlatma metni ve kullanım şartları, yorum ve mesajların
"5651 m. 5 gereği trafik kaydıyla" bir yıl saklandığını söylüyordu. Kodda böyle
bir kayıt yoktu: `community_comments` ve `community_messages` ne IP ne oturum
tutuyordu. IP yalnızca `sessions`'ta vardı ve bir yorumun hangi oturumdan
yazıldığı bilinmiyordu. Metin, kodun yapmadığı bir şeyi beyan ediyordu (D-083'teki
hatanın aynısı). Topluluk özellikleri genişletilmeden önce kapatıldı: ürün sahibi
topluluk tasarımının tamamını istedi (bkz. D-089 ve sonrası), yeni kullanıcı
içeriği bu borcun üstüne kurulmamalıydı.

**Karar:**

- Yeni tablo `traffic_logs`: hesap, işlem, varlık türü + kimliği, IP,
  user-agent, zaman. `audit_log`'dan ayrı tutuldu: denetim kaydı 10 yıl yaşar ve
  tetikleyici silmeyi yasaklar; trafik kaydının yasal ömrü 1 yıldır ve sonra
  silinmesi gerekir. `user_id` hesap anonimleştirilince bile kaydın kalması için
  `on delete set null`.
- `src/lib/traffic.ts` → `recordTraffic(entry, executor)`. Kullanıcı içeriği
  yazan her servis içeriği ve trafik kaydını **aynı transaction'da** yazar;
  içerik kaydı olmadan var olamaz. Şimdilik çağıranlar `addCommunityComment` ve
  `addChatMessage`; bundan sonra eklenen her kullanıcı içeriği de çağırır.
- `pnpm prune-traffic` 365 günü dolan kayıtları siler (önerilen cron: günlük).
  Tablodan silen tek yol bu betik.
- **Kullanım şartları:** "sohbet kapalıyken geçmiş mesajlar okunabilir" cümlesi
  D-056 ile çelişiyordu (sayfa 404), düzeltildi. "Editörler ve yöneticiler
  kaldırabilir" yazıyordu; `canModerateCommunity` yalnızca admin'e izin verir,
  metin "yöneticiler" oldu. Trafik kaydının içeriği ve süresi şartlara yazıldı.
- **Aydınlatma metni:** kişisel veri tablosuna "Trafik kaydı" satırı eklendi
  (hesap, IP, user-agent, işlem türü, zaman). Saklama süresi satırı zaten 1 yıl
  diyordu. Metin `kvkk_versions`'tan okunur: canlıda yeni sürümün admin
  tarafından yayınlanması gerekir.

**Hukukçu görüşü gerekiyor:** 5651 kapsamındaki trafik bilgisi uygulamada
kaynak port numarasını da kapsayabilir (CGNAT arkasındaki kullanıcıyı ayırmak
için). Vercel isteğe kaynak portunu iletmiyor; kod yalnızca IP'yi
`x-forwarded-for`'dan okuyabiliyor. Port şartı kesinleşirse barındırma
katmanında çözülmesi gerekir. O zamana kadar muhafazakâr olan uygulandı:
alınabilen her şey (IP, user-agent, zaman, hesap) kaydediliyor.

**Sürücü (D-078):** Sorgular düz `insert` / `delete ... where created_at <` /
`transaction`; upsert ve ham `sql` şablonu yok.

**Üretim:** Migration `0025` eklendi. Üretimde `0024` hâlâ bekletiliyor
(D-082); `0025` onunla birlikte çıkar, bu yüzden push öncesi ürün sahibinin
onayı ve snapshot gerekir (D-079). Push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 25 dosya / 348 test (3 yeni:
`community.test.ts` → trafik kaydı yorum, mesaj ve bir yıllık silme sınırı).

---

## D-089 — Topluluk kimliği: kullanıcı adı, profil, takip, engelleme, kaydetme, bildirimler

**İstek (ürün sahibi):** Topluluk/sosyal bölüm iki tasarımla tarif edildi
(mesajlar ekranı ve profil sayfası; kenar çubuğunda Anon Box, Messages,
Notifications, Bookmarks, Communities, Explore, Settings). "Anon box onaylı
kullanıcılar ile olsun, hepsini yap." Tamamı D-089…D-093 olarak adım adım
yapılıyor; bu adım kimlik ve sosyal grafik.

**Karar:**

- **Topluluk alanı `/social`.** Kendi layout'u var, oturum ister ama rol
  istemez (dergi gibi). Her rol aynı kenar çubuğunu görür (`socialNav`):
  toplulukta yazar da admin de bir üyedir. Dergi, yazar, editör ve admin
  menülerine "Topluluk" bağlantısı eklendi. `NavItem.badge` okunmamış sayıyı
  gösterir.
- **Kullanıcı adı (`users.username`).** Sosyal katman isteğe bağlıdır: kullanıcı
  adı seçmeyen üye takip edemez ve takip edilemez (`requireMember` → 409).
  Kural `src/lib/username.ts`'te saf fonksiyon: 3–20 karakter, `a-z0-9_`, küçük
  harfe normalize, baştaki `@` atılır. Dergiyi veya ekibi çağrıştıran adlar
  (`admin`, `postscript`, `editor`, `anonim`… ve `admin_…` biçimleri) yasak.
  Canlı hesaplarda benzersiz (kısmi unique index). Değişikliği `audit_log`'a
  yazılır: moderasyon bir hesabı sonradan bu adla arar.
- **Profilde gerçek ad yok.** Profil, takipçi listesi ve üye listeleri
  `penName ?? username` gösterir; `display_name` (kayıttaki "Ad Soyad")
  topluluk ekranlarına hiç gitmez. Yorumlardaki ad da artık
  `coalesce(pen_name, '@' || username, display_name)`: kullanıcı adı olan
  üyenin yorumunda gerçek adı görünmez (D-076'nın devamı). Kullanıcı adı
  olmayan eski hesaplarda yorum davranışı değişmedi.
- **Profil görünürlüğü:** yalnızca oturum açmış üyeler. Görünen: kullanıcı adı,
  mahlas, biyografi, rol rozeti, katılım ayı, takip sayıları. Yasaklı veya
  silinmiş hesabın profili 404. Profil görseli yüklemesi yok: üretimde nesne
  depolama yok (bkz. `production-deployment`), yerine baş harf dairesi.
  Kapak alanı düz renk.
- **Takip.** İki kez basmak hata değil. Takip edilen kişiye bildirim gider.
  Kendini takip 400.
- **Engelleme iki yönlüdür.** Engellenen, engelleyeni takip edemez (403) ve
  profilini göremez. Engellendiği ona söylenmez: profil 404 döner. Engel
  aradaki takipleri iki yönde de siler. Engellenen hesaplar
  `/social/settings`'te listelenir ve kaldırılabilir. Sonraki adımlar
  (mesaj, anon kutusu, yanıt) aynı `isBlockedEitherWay`'i kullanır.
- **Kaydetme (bookmarks).** Özel okuma listesi, kullanıcı adı istemez. Yalnızca
  yayındaki yazı kaydedilir. Yayından kalkan yazı listeden düşer.
  Yazı sayfasında "Kaydet" düğmesi, listesi `/social/bookmarks`.
- **Bildirimler.** `notifications` tablosu editoryal akışta zaten yazılıyordu
  ama hiçbir ekran göstermiyordu. `/social/notifications` ilk okuyucusu oldu,
  "tümünü okundu işaretle" var. Bildirim içerik taşımaz, yalnızca bağlantı
  taşır; yalnızca site içi (`/` ile başlayan) bağlantılar tıklanabilir.
- **Kalıcı silme istisnası.** `follows`, `user_blocks`, `bookmarks` yumuşak
  silme kuralının dışında: geri alınınca satır silinir. İçerik taşımazlar;
  geri alınmış bir takibi saklamak, kişinin geri çektiği sosyal grafik
  bilgisini tutmak olur (KVKK veri minimizasyonu). Aynı gerekçeyle takip ve
  engeller `audit_log`'a yazılmaz: o kayıt 10 yıl yaşar ve silinemez.
- **Hesap silme:** `anonymise` kullanıcı adını boşaltır, takip/engel/kaydetme
  satırlarını siler. Yumuşak silme FK cascade'ini tetiklemediği için bu açıkça
  yapılır. Boşalan kullanıcı adı yeniden alınabilir. `exportUserData` bu
  satırları ve kullanıcı adını da döndürür.

**Hukuk:**
- **Aydınlatma metni:** Profil satırına kullanıcı adı eklendi. Topluluk satırına
  takip, engel, kaydetme ve bildirim eklendi. Yeni amaç satırı (c) sözleşmenin
  ifası. Saklama: "siz geri alana kadar, geri alınca veya hesap silinince
  kalıcı silinir". Anonimleştirme cümlesi güncellendi.
- **Kullanım şartları:** kullanıcı adı kuralı ve engellemenin etkisi eklendi.
- Takip ve kaydetme kullanıcı içeriği değildir; trafik kaydı (D-088) yazılmaz.

**Sürücü (D-078):** `exportUserData`'daki ham `sql` birleşimine üç `select
row_to_json` satırı eklendi (mevcut kalıbın aynısı). Yorum adındaki `coalesce`
şablonuna `'@' || username` eklendi. İkisi de sürücüye duyarlı sayılır:
yayından önce Neon dalında çalıştırılmalı. Upsert yok; "iki kez takip"
select-then-insert ile ele alınıyor, yarış durumunda unique index korur.

**Üretim:** Migration `0026`. `0024`/`0025` ile birlikte ürün sahibi onayı ve
snapshot gerektirir (D-079, D-082). Push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 27 dosya / 366 test (18 yeni:
`tests/unit/username.test.ts`, `tests/integration/social-graph.test.ts`).

---

## D-090 — Üye gönderileri, yanıt/beğeni/yeniden paylaşım, Keşfet ve içerik bildirimi

**Bağlam:** D-089'daki topluluk tasarımının ikinci adımı. Profil tasarımında
Posts / Replies / Favorites / About sekmeleri, beğeni, yorum, yeniden paylaşım
ve kaydetme sayaçları var. Kenar çubuğunda Explore var. Ürün sahibine açık
soru soruldu: "Posts sekmesi okuyucunun kendi gönderileri mi?" Cevap "hepsini
yap" oldu. Tasarımdaki gönderiler kişisel kısa yazılar olduğu için muhafazakâr
yorum uygulandı: üyeler kısa metin gönderisi paylaşır. Bu, "yazar tarafından
makale gönderimi yok" kuralını değiştirmez; gönderi dergi yazısı değildir ve
yayın akışına girmez.

**Karar:**

- **Gönderi (`posts`).** Kullanıcı adı zorunlu, en çok 1000 karakter, düz metin
  (HTML/Markdown olarak işlenmez). Yasaklı kelimeler yazılırken maskelenir.
  Trafik kaydı aynı transaction'da yazılır (D-088). Dakikada en çok 5 gönderi
  (429). Yanıt, `reply_to_id` ile aynı tablodadır; yanıtlanan gönderinin
  sahibine bildirim gider.
- **Görsel yok.** Tasarımdaki gönderi görselleri yapılmadı: üretimde nesne
  depolama yok; ayrıca üye yüklemesi lisans, yasa dışı içerik ve kaldırma yükü
  getirir. Depolama kurulduğunda ayrı bir kararla eklenir.
- **Beğeni, yeniden paylaşım, kaydetme.** Beğeni ve yeniden paylaşım
  `post_likes` / `post_reposts`; ikisi de D-089'daki kalıcı silme istisnasına
  tabi. Kaydetme `bookmarks.post_id` (yazı ya da gönderi, ikisinden tam biri:
  `check`). İki kez basmak hata değil. Sahibine bildirim gider (kendi
  gönderisinde gitmez).
- **Beğeniler yalnızca profil sahibine görünür.** Tasarımda "Favorites" sekmesi
  herkese açık görünüyor. Birinin neyi beğendiğinin listesi, kendisinin
  yayımlamayı seçtiğinden fazlasını anlatır; muhafazakâr olan gizli tutmaktır.
  Başkası için sekme görünmez, servis 403 döner.
- **Engelleme gönderilere de uzanır.** Engelli iki taraf birbirinin gönderisini
  hiçbir listede görmez; yanıtlayamaz, beğenemez, paylaşamaz. Gizli ve
  engellenmiş gönderi aynı 404'ü döner. Yasaklı veya silinmiş hesabın
  gönderileri listelerden düşer.
- **Akış (`/social`):** kendi gönderileri + takip edilenlerin yanıt olmayan
  gönderileri + takip edilenlerin yeniden paylaşımları. Bir gönderi en son
  etkinliği anında bir kez görünür. **Keşfet (`/social/explore`):** son 30
  günün yanıt olmayan gönderileri; beğeni → yeniden paylaşım → yenilik
  sırasıyla. "Tanıyor olabilirsiniz": takip edilenlerin takip ettikleri (kaç
  kişinin takip ettiğine göre), yetmezse en çok takip edilenler. Sıralamalar
  `src/lib/ranking.ts`'te saf fonksiyon (CLAUDE.md: ML yok).
- **Zincir (`/social/posts/[id]`):** yanıtlanan gönderi, gönderi, yanıt formu,
  yanıtlar (eskiden yeniye).
- **İçerik bildirimi (`content_reports`).** Gönderi, yorum ve hesap
  bildirilebilir (`/social/report`). Enum özel mesaj ve anonim mesajı şimdiden
  içerir; sonraki adımlarda migration'da `ALTER TYPE` gerekmesin. Bildirim o
  anki metnin kopyasını (`snapshot`) tutar. Aynı üyenin açık bildirimi
  tekrarlanmaz. Kendi içeriğini bildirmek 400. Her bildirim tüm adminlere
  bildirim düşürür.
  - **Moderasyon kuyruğu** "Topluluk yönetimi"nin başında, açık bildirimler en
    eski üstte. 5651 m. 9'daki 24 saat dolanlar kırmızı işaretlidir
    (`isReportOverdue`).
  - **Kararlar:** "İçeriği kaldır" gönderi veya yorumu yumuşak siler
    (`removed_by`). "Kurallara aykırı değil" yalnızca kapatır. Karar, aynı
    içerikle ilgili tüm açık bildirimleri kapatır ve bildirenlere sonucu
    bildirir; kimin karar verdiği ve kimin bildirdiği karşı tarafa gösterilmez.
  - Hesap bildirimi "kaldırılamaz" (400); gerekiyorsa hesap mevcut kullanıcı
    sayfasından askıya alınır.
- **Admin ayrıca** son gönderileri listeleyip doğrudan kaldırabilir
  (`removePostAsModerator`, `audit_log`'a yazılır). Yeni action'lar
  `src/app/admin/community/actions.ts`'te.
- **Saklama süresinin sonu artık kodda.** Aydınlatma metni D-083'ten beri
  "kaldırılan yorum ve mesaj 1 yıl saklanır" diyordu ama o yılın sonunu hiçbir
  şey uygulamıyordu; kaldırılan içerik süresiz kalıyordu. `pnpm prune-traffic`
  (D-088) `pnpm prune-community` oldu ve dördünü siler:
  - 1 yılı dolan trafik kayıtları
  - silineli/kaldırılalı 1 yıl olan gönderiler, yorumlar ve sohbet mesajları
  - sonuçlanalı 1 yıl olan bildirimler

  Açık bildirimler hiç silinmez.
- **Hesap silme:** beğeni ve yeniden paylaşımlar silinir. Gönderiler yumuşak
  silinir, yani topluluktan kalkar ve bir yıl sonra budanır. `exportUserData`
  gönderileri, beğenileri, paylaşımları ve üyenin açtığı bildirimleri de
  döndürür.

**Hukuk:**
- **Aydınlatma metni:**
  - Topluluk veri satırına gönderi, yanıt, beğeni ve yeniden paylaşım eklendi.
  - Yeni "İçerik bildirimi" veri satırı eklendi.
  - Trafik kaydı satırı gönderileri de kapsıyor.
  - Yeni amaç: bildirimlerin incelenmesi ve 5651 kaldırma yükümlülüğü,
    (ç) + (f).
  - Saklama süreleri: silinen içerik 1 yıl, sonuçlanan bildirim 1 yıl.
    Beğeni ve paylaşım "geri alınca silinir".
  - Anonimleştirme cümlesi güncellendi.
- **Kullanım şartları:** kurallar gönderi ve yanıtları da kapsıyor. "Bildir"
  yolu, 24 saat ve bildirenin gizliliği yazıldı. Görünürlük maddesi eklendi:
  gönderiler herkese, beğeniler yalnızca size.
- **Hukukçu görüşü gerekiyor:** site içi "Bildir" düğmesinin 5651 m. 9
  anlamında bir kaldırma "başvurusu" sayılıp sayılmadığı belirsiz. Muhafazakâr
  olan uygulandı: her bildirim 24 saat kuralıyla izleniyor, künyedeki resmi
  başvuru yolu da korunuyor ve form ona bağlantı veriyor.

**Sürücü (D-078):** Sayaçlar `count()` + `groupBy` + `inArray` (D-087'de
üretimde çalışan kalıp). `notInArray`, `alias`, `check(num_nonnulls(...))`
ve `exportUserData`'ya eklenen dört `row_to_json` satırı yeni. Upsert yok.
Yayından önce Neon dalında çalıştırılmalı.

**Üretim:** Migration `0027`. f1 oturumu 0024–0025'i üretime uyguladı ve adım
17'yi push etti. 0026–0027 uygulanmadı; push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 29 dosya / 390 test. 24 yeni:
`tests/integration/posts.test.ts` ve `tests/unit/ranking.test.ts` (akış
birleştirme, Keşfet sıralaması, öneri sıralaması, 24 saat sınırı).

---

## D-091 — Özel mesajlar: yalnızca yetişkinler, alıcının tercihi, yönetici okuyamaz

**Bağlam:** Topluluk tasarımının mesajlar ekranı (sol konuşma listesi, ortada
sohbet, sağda profil + Block / Report / Delete Conversation). İlk analizde
"önce hukukçu görüşü" önerildi; ürün sahibi "hepsini yap" dedi. CLAUDE.md
gereği muhafazakâr olan uygulandı ve hukuki soru aşağıya yazıldı.

**Karar:**

- **Veri modeli:** `conversations` (sıralı çift, `member_a_id < member_b_id`
  check'i ve unique index; kim önce yazarsa yazsın tek satır),
  `conversation_states` (üye başına son okuma ve "konuşmayı sil" anı),
  `direct_messages` (1000'lik gönderiden ayrı, en çok 2000 karakter, düz
  metin, yasaklı kelime maskesi, trafik kaydı).
- **Kim yazabilir** (`src/lib/direct-messages.ts` → `directMessageProblem`, saf fonksiyon; sıra önemli):
  1. Engel iki yönde de kapatır.
  2. Gönderen de alıcı da 18 yaşını doldurmuş olmalı. Doğum tarihi yoksa
     yetişkin sayılmaz. Alıcı reşit değilse gönderene sebep söylenmez.
  3. Alıcının tercihi `users.dm_policy`: `everyone` / `following`
     (varsayılan) / `nobody`. `nobody` gerçekten kimse demektir, yanıtı da
     kapatır.
  4. Alıcı konuşmada daha önce yazdıysa yanıt serbesttir.
  5. `following`'de alıcı göndereni takip etmelidir.

  Varsayılanın `following` olması, hiç kimsenin tanımadığı birinden istemediği
  mesajı almaması içindir. Kullanıcı adı zorunlu. Dakikada en çok 20 mesaj
  (429). Engelleyen, engellediği kişi için yoktur: konuşma sayfası 404.
- **Yönetici okuyamaz.** Admin için özel mesaj listesi veya ekranı yok, olmayacak.
  Moderasyonun tek yolu D-090'daki bildirim: yalnızca konuşmanın bir üyesi bir
  mesajı bildirebilir (başkasına mesaj "yok", 404). Moderatör yalnızca o tek
  mesajın metin kopyasını görür. "Kaldır" kararı mesajı iki taraftan da siler
  (`removed_by`).
- **Okundu bilgisi yok.** Tasarımda çift tik var, yapılmadı: birinin bir mesajı
  ne zaman okuduğu, gönderenin değil onun bilgisidir. `last_read_at` yalnızca
  okuyanın kendi okunmamış sayacı için tutulur ve karşı tarafa gösterilmez.
- **"Konuşmayı sil"** yalnızca silenin görünümünü temizler (`cleared_at`).
  Karşı taraf görmeye devam eder. Yeni mesaj gelince konuşma yeniden görünür.
- **Canlılık:** WebSocket yok (barındırma sunmuyor). Açık konuşma
  `AutoRefresh` ile 5 saniyede bir `router.refresh()` yapar; Next 16 dokümanı
  bunun istemci durumunu (yarım yazılmış mesaj) koruduğunu belirtiyor. Gizli
  sekme yenilenmez. Kenar çubuğunda okunmamış konuşma sayısı rozeti var.
- **Yapılmayanlar:**
  - **Dosya/görsel ekleme ve "Shared Media / Files" paneli:** nesne depolama
    yok; özel alanda yüklenen dosyanın denetimi moderasyonsuz olurdu.
  - **Sesli arama:** WebRTC gerektirir, kapsam dışı.
  - **Emoji seçici:** klavye emojisi zaten çalışıyor.
- **Hesap silme:** gönderdiği mesajlar yumuşak silinir; karşı taraftan da
  kalkar ve bir yıl sonra `pnpm prune-community` ile kalıcı silinir. Konuşma
  durumu satırları silinir. `exportUserData` gönderilen mesajları döndürür.
- Profil başlığına "Mesaj" bağlantısı, topluluk ayarlarına özel mesaj tercihi
  eklendi.

**Hukuk:**
- **Aydınlatma metni:**
  - Yeni "Özel mesajlar" veri satırı; trafik kaydı satırına özel mesaj eklendi.
  - Yeni amaç: özel mesajlaşma ve 18 yaş sınırı, (c) + (f).
  - Saklama satırı: konuşmayı silmenin etkisi, hesap silme, bildirim sonrası
    kaldırma.
  - Yöneticilerin okuyamadığı ve doğum tarihinin yaş denetimi için
    kullanıldığı açıkça yazıldı.
- **Kullanım şartları:** 18 yaş, tercih, engel, yönetici okuyamaz ve bildirim
  yolu eklendi.
- **Hukukçu görüşü gerekiyor:**
  1. Özel mesajlar haberleşmenin gizliliği kapsamındadır (Anayasa m. 22,
     TCK m. 132). Bir tarafın bildirdiği tek mesajın moderatöre gösterilmesi,
     o tarafın kendi aldığı mesajı paylaşması olarak kurgulandı; bu kurgunun
     yeterliliği sorulmalı.
  2. Özel mesajlar için 5651 m. 5 trafik kaydı tutmak zorunlu mu, yoksa
     ölçüsüz mü? Muhafazakâr olan (tutmak) uygulandı; saklama 1 yılla sınırlı.
  3. 18 yaş sınırı beyana (kayıttaki doğum tarihi) dayanıyor.

**Sürücü (D-078):** Yeni kalıplar:
- `check` ile uuid karşılaştırması (`member_a_id < member_b_id`)
- `or(isNull, ne)`
- konuşma başına iki küçük sorgu (liste 50 konuşmayla sınırlı)

Upsert yok. İlk mesajların eşzamanlı yarışı unique index'e çarparsa istek 500
döner, yenilenince geçer. Yayından önce Neon dalında çalıştırılmalı.

**Üretim:** Migration `0028`. 0026–0028 üretime uygulanmadı; push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 31 dosya / 408 test (18 yeni:
`tests/unit/direct-messages.test.ts`, `tests/integration/direct-messages.test.ts`).

---

## D-092 — Anonim kutu: yalnızca doğrulanmış yetişkin üyeler, alıcıya karşı anonim

**İstek (ürün sahibi):** "Anon box onaylı kullanıcılar ile olsun." İlk analizde
anonim kutu en riskli parça olarak işaretlenmiş, en sona bırakılmış ve hukukçu
görüşü önerilmişti. "Onaylı kullanıcı", kodda karşılığı olan en sıkı anlamıyla
yorumlandı: e-postası doğrulanmış, yasaklı olmayan ve kullanıcı adı seçmiş hesap
(`requireMember`).

**Karar:**

- **Kutu isteğe bağlıdır** (`users.anon_box_enabled`, varsayılan kapalı). Açık
  kutunun profilde "Anonim mesaj" bağlantısı olur.
- **Kim yazabilir** (`anonMessageProblem`, `src/lib/anon-box.ts`):
  - doğrulanmış üye, kullanıcı adı olan, 18 yaşını doldurmuş gönderen
  - 18 yaşını doldurmuş alıcı, kutusu açık olmalı
  - aralarında engel yok, alıcı göndereni susturmamış olmalı
  - alıcı başına günde en çok 3, toplamda günde en çok 20 mesaj; en çok 500
    karakter, düz metin, yasaklı kelime maskesi

  Gönderene alıcıyla ilgili her ret (kutu kapalı, engel, susturma, reşit
  olmayan alıcı) **aynı cümleyle** söylenir; hangisi olduğu anlaşılmaz.
  Göndereni engellemiş alıcının kutusu 404 döner (D-089 ile aynı).
- **Anonimlik yalnızca alıcıya karşıdır.** `sender_id` saklanır ve trafik
  kaydına göndereni yazılır. Formun **üstünde**, yazmadan önce görünen uyarı
  var: "Alıcı adınızı görmez, ama anonim değilsiniz."
- **Alıcı göndereni hiçbir yoldan öğrenmez.**
  - Gelen kutusu tipi (`AnonInboxItem`) göndereni hiç taşımaz; test anahtar
    listesini sabitliyor.
  - **"Göndereni sustur"** bir engel değildir. Engel, engellenenin profilinde
    "Bu hesabı engellediniz" olarak görünür, takipleri siler ve mesajlaşmada
    hata verir; bunların her biri kimliği açığa çıkarırdı. Onun yerine
    `anon_mutes` tablosu var: yalnızca o gönderenin bu kutuya yazmasını kapatır
    ve bıraktıklarını kutudan kaldırır. Ayarlarda yalnızca susturma **sayısı**
    ve "tümünü kaldır" var; tek tek susturmalar ayırt edilemez.
  - **KVKK veri dışa aktarımı:** alıcıya gelen mesajlar göndereni olmadan
    döner (`json_build_object`, `row_to_json` değil).
- **Mevcut bir sızıntı da kapatıldı.** `exportUserData`, D-090'dan beri
  `content_reports`'u `row_to_json` ile döndürüyordu. Bu, bildirenin dışa
  aktarımına bildirilen hesabın kimliğini (`target_user_id`), karar vereni ve
  moderatör notunu koyuyordu. Anonim mesaj bildiriminde bu, alıcıya göndereni
  verirdi. Artık yalnızca bildirenin kendi bildirdiği alanlar dönüyor.
- **Moderasyon:** yalnızca alıcı bir anonim mesajı bildirebilir (başkasına 404).
  Bildirimde içerik sahibi olarak gönderen kaydedilir; bu, bir yöneticinin
  göndereni öğrendiği tek andır. "Kaldır" mesajı yumuşak siler (`removed_by`).
- **Saklama ve hesap silme:** alıcının kutudan sildiği (`hidden_at`), bildirim
  üzerine kaldırılan veya taraflardan birinin hesabı silinen mesaj bir yıl
  sonra `pnpm prune-community` ile kalıcı silinir. Hesap silmede iki yöndeki
  mesajlar yumuşak silinir, susturmalar silinir, kutu kapanır.
- **Bildirim satırı yazılmaz**, yalnızca kenar çubuğu rozeti var: bildirim
  kutusunda bir satır daha, içerik taşımasa da zamanlamasıyla bir iz bırakırdı.
- **Yapılmayanlar:** anonim mesaja herkese açık yanıt ("soru-cevap" profili).
  Tasarımda yok; alıcının yanlışlıkla göndereni ele veren bir yanıt
  yayımlaması riski var.

**Hukuk:**
- **Aydınlatma metni:**
  - Yeni "Anonim kutu" veri satırı; trafik kaydı satırına anonim mesaj eklendi.
  - Yeni amaç: (c) + (ç) 5651 m. 5 + (f).
  - Saklama satırı eklendi.
  - Anonimliğin yalnızca alıcıya karşı olduğu, bildirimde yöneticinin göndereni
    gördüğü, yetkili mercilere paylaşılabileceği ve dışa aktarımda göndereni
    göstermediği açıkça yazıldı.
  - Anonimleştirme cümlesi güncellendi.
- **Kullanım şartları:** "Anonim kutu" paragrafı eklendi. Anonimliğin sınırı ve
  kötüye kullanımın askıya almaya yol açabileceği yazıldı.
- **Hukukçu görüşü gerekiyor:**
  1. Anonim içerikte yer sağlayıcı sorumluluğu. Muhafazakâr kurgu uygulandı:
     gönderen saklanıyor ve belirlenebiliyor.
  2. "Alıcıya karşı anonim, dergiye karşı değil" beyanının KVKK m. 10
     aydınlatması için yeterliliği.
  3. 18 yaş sınırının beyana dayanması (D-091'deki gibi).

**Sürücü (D-078):** `exportUserData`'da `json_build_object` yeni.
`or(lt(deleted_at), lt(hidden_at))` ile budama yeni. Upsert yok. Yayından önce
Neon dalında çalıştırılmalı.

**Üretim:** Migration `0029`. 0026–0029 üretime uygulanmadı; push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 33 dosya / 423 test (15 yeni:
`tests/unit/anon-box.test.ts`, `tests/integration/anon-box.test.ts`; alıcının
gelen kutusunda ve dışa aktarımında gönderenin olmadığı dahil).

---

## D-093 — Topluluklar: yalnızca admin açar, üyeler katılır ve paylaşır

**Bağlam:** Tasarımın kenar çubuğunda "Communities" var. Ürün sahibine "konu
bazlı gruplar mı, kapattığımız genel sohbet mi?" diye soruldu; cevap "hepsini
yap" oldu. Genel sohbet D-056'da bilinçli olarak kapatıldığı için geri
getirilmedi. Muhafazakâr yorum uygulandı: konu grupları.

**Karar:**

- **Topluluğu yalnızca admin açar ve arşivler** ("Topluluk yönetimi" → Topluluklar).
  Üyelerin grup açması yok: grup sahipleri, grup içi moderatörler ve onların
  yetkileri ikinci bir moderasyon katmanı demek olurdu.
  - Slug addan üretilir ve benzersizdir.
  - Arşivlenen topluluk okunur ama yeni üye ve gönderi almaz.
  - Açma ve arşivleme `audit_log`'a yazılır.
- **Üyelik** (`community_memberships`) kullanıcı adı ister (D-089) ve D-089'daki
  kalıcı silme istisnasına tabidir: ayrılınca satır silinir.
- **Üye listesi hiçbir yerde gösterilmez**, yalnızca üye sayısı. Birinin hangi
  topluluklarda olduğu (ör. bir sağlık veya inanç grubu) kendi başına hassas bir
  bilgi olabilir.
- **Gönderi:** `posts.community_id`. Toplulukta paylaşmak için üyelik şarttır
  (403); arşivlenmiş toplulukta paylaşılamaz (409). Kontrol
  `assertCanPostInCommunity` ile `createPost` içinde yapılır.
  - Topluluk gönderisi olağan bir gönderidir: yazarın profilinde ve takipçilerin
    akışında da görünür, üzerinde topluluk bağlantısı taşır.
  - Engelleme, bildirim, trafik kaydı ve saklama kuralları D-090'dakiyle aynı.
- Yanıtlar topluluk taşımaz; zincir sayfasında görünür.
- **Seed:** demo verisinde bir topluluk ("Edebiyat Kulübü") açılır; üretimde
  topluluğu admin açar.

**Hukuk:**
- **Aydınlatma metni:** Topluluk veri satırına katılınan topluluklar eklendi;
  saklama ve anonimleştirme satırlarına topluluk üyeliği eklendi.
- **Kullanım şartları:** toplulukları yöneticilerin açtığı ve üyeliklerin
  başkalarına gösterilmediği yazıldı.

**Sürücü (D-078):** `leftJoin(communities)` ve `count()` + `groupBy`, üretimde
çalışan kalıplar. `exportUserData`'ya bir `row_to_json` satırı daha eklendi.
Upsert yok.

**Üretim:** Migration `0030`. 0026–0030 üretime uygulanmadı; push yapılmadı.

**Doğrulama:** typecheck + lint temiz, 34 dosya / 428 test (5 yeni:
`tests/integration/communities.test.ts`).

---

## D-094 — Topluluk alanı için uçtan uca senaryo; demo topluluğu seed'de

**Karar:**

- `tests/e2e/07d-social.spec.ts` topluluk alanını iki seed hesabıyla baştan sona
  yürütür:
  - Okur kullanıcı adı seçer, anonim kutusunu açar, özel mesaj tercihini
    "tüm üyeler" yapar.
  - Okur gönderi paylaşır, "Edebiyat Kulübü"ne katılır ve orada paylaşır.
  - Yazar kullanıcı adı seçer, okuru takip eder, gönderisini beğenir, özel
    mesaj ve anonim mesaj gönderir.
  - Okur anonim mesajı **yazarın adı ya da mahlası olmadan** görür. Özel mesajı
    konuşma listesinden açar. Takip ve beğeni bildirimlerini görür.
- **Yalnızca okur ve yazar hesaplarını kullanır**, ikinci faktör istemez.
  `08-two-factor` admin'in TOTP sırrını değiştirdiği için adı 08'den önce
  koşacak şekilde seçildi (07c ile aynı gerekçe).
- `scripts/seed.ts` demo verisinde (`SEED_DEMO_USERS=1`) bir topluluk açar:
  "Edebiyat Kulübü" (`edebiyat-kulubu`). Üretim seed'i topluluk açmaz.

**Doğrulama:**
- typecheck + lint temiz.
- **Tam e2e koşusu bellek yetersizliğinden iki kez yarıda kesildi.**
  - İlk koşuda 01–07c'deki 22 senaryonun **hepsi geçti**. Koşu 07d'ye gelince
    sistem süreci durdurdu.
  - `07d-social.spec.ts` tek başına yeniden koşturuldu: **geçti** (9,3 sn).
  - `08-two-factor.spec.ts` tek başına denendi; seed aşamasında, testlere
    gelmeden bellek yüzünden durduruldu.
- Makinede ~7,5 GB bellek var ve başka oturumlar açıktı; üretim derlemesi bu
  koşulda güvenilir çalışmadı. CLAUDE.md'deki "sonsuz düzeltme döngüsüne
  girme" kuralı gereği üçüncü deneme yapılmadı.
- **08, D-088…D-094 değişikliklerinden sonra koşturulmadı.** O senaryo
  admin'in 2FA akışını sınar. Bu adımlar o akışa dokunmadı, yalnızca admin
  menüsüne "Topluluk" bağlantısı eklendi. Yine de push öncesi bellek boşken
  `pnpm test:e2e` tam olarak yeniden koşturulmalı.
- Derleme logundaki "Ecmascript file had an error" uyarısı bu adımlardan değil:
  `src/instrumentation.ts`'in Edge çalışma ortamında `node:path` kullandığını
  söylüyor. Derleme tamamlanıyor.

---
## D-095 — `0024` ve `0025` üretime uygulandı; step 17 yayında

**İstek (ürün sahibi):** Step 17'nin (D-088, trafik kaydı) topluluk özelliğini
beklemeden tek başına yayına alınması. Öneri gerekçesi: yayındaki kullanım
şartları trafik kaydı tutulduğunu söylüyordu ama canlı kod tutmuyordu.

**Yapılan (2026-09-13):**

- D-082'nin şartı karşılandı: `0024` (etiket ve alt köşe kolonlarının silinmesi)
  için ürün sahibinin açık onayı alındı. Silinen tek veri, "Madde 1 - Takıntı"
  makalesinin 12 etiketiydi: hukuk, felsefe, takıntı, takip, ısrarlı takip,
  123/a, Türk Ceza Kanunu, Hart, adalet, kontrol, madde, arayış.
- **Yedek:** Snapshot alınamadı (ücretsiz planda tek yer var, dünkü
  `before-migrations-0020-0021-0023` dolduruyor). Yerine üretimin kopyası olan
  hesaplamasız branch açıldı: `backup-before-0024-0025-step17`
  (`br-hidden-morning-b1hzlhen`). Geri dönüş bu branch'ten yapılır.
- **Migration yalnızca `7a1c28d`'nin temiz kopyasından çalıştırıldı.** Ana çalışma
  ağacında o sırada yazılmakta olan `0026` vardı; ağaçtan çalıştırılsaydı o da
  üretime giderdi. Kopyada typecheck, lint, 348 test ve 25/25 e2e önce geçti.
- Üretim defteri 23 → 25; `traffic_logs` var, `articles.tags` ve
  `articles.subcategory` yok (Neon'dan sorgulandı).
- Ardından yalnızca `7a1c28d` push edildi (`15fd6ad..7a1c28d`). Canlı kullanım
  şartları sayfası step 17 metnini ("geçmiş mesajlar okunamaz") gösteriyor;
  `/`, `/kvkk`, `/iletisim`, `/kullanim-sartlari`, `/login` 200.

**Çalışma notu:** Windows'ta `neon-env run -- pnpm db:migrate` çalışmıyor
(`spawn pnpm ENOENT`). Çalışan biçim:
`neon-env run -- node node_modules/tsx/dist/cli.mjs --tsconfig scripts/tsconfig.json src/db/migrate.ts`.
`neon-env`'in Neon giriş anahtarının süresi dolabiliyor; `neon auth` ile
yenilenir.

**Açık — hukuki metin hatası (ürün sahibine):** Neon API'ye göre üretim
veritabanı **AWS eu-central-1 (Frankfurt, Almanya)** bölgesinde. KVKK aydınlatma
metni (`data/kvkk-aydinlatma-metni.md`, Neon satırı) ve künye (`/iletisim`,
"Barındırma") "AWS us-east-2, Ohio / Amerika Birleşik Devletleri" diyor; D-083
de aynı yanlış varsayımla yazılmıştı. Neon Inc. ABD şirketi olduğu için yurt
dışına aktarım bölümü geçerli kalır, ama veri konumu beyanı yanlış. Düzeltme
ayrı bir adımda yapılacak.

**Sıradaki üretim işi:** `main`'de push edilmemiş step 18–23 (D-089…D-094)
`0026`–`0030` migration'larını taşıyor. Push'tan önce aynı sıra gerekir: yedek,
temiz kopyada tam e2e (D-094: `08-two-factor` bu değişikliklerden sonra hiç
koşmadı), üretim migration'ı, sonra push.

---

## D-096 — Panel başlığında "Ana sayfa" düğmesi

**İstek (ürün sahibi):** "Paneldeyken ana sayfa butonu olsun, ana sayfaya gitmek
için."

**Karar:**
- `PanelShell` başlığında "Geri" düğmesinin hemen yanına "Ana sayfa" bağlantısı
  eklendi. Derginin ön sayfasına (`/`) gider.
- Aynı görünüm (`House` simgesi, "Geri" ile aynı sınıflar) kullanıldı; iki
  düğme yan yana tek bir grup gibi durur.
- `PanelShell` her panelde ortak olduğu için düğme admin, editör, yazar, dergi,
  hesap ve topluluk ekranlarının hepsinde görünür.
- **Neden ayrı bir düğme:** kenar çubuğundaki "postscript" yazısı zaten `/`'a
  gidiyordu. Logo çoğu kişiye düğme gibi görünmüyor; mobilde de menü
  kapalıyken görünmüyor.
- Düğme sunucu bileşeni içinde düz bir `Link`; istemci JavaScript'i gerekmez.
  "Geri" ise tarayıcı geçmişini kullandığı için istemci bileşeni olarak kaldı.

**Hukuk:** Yeni veri, çerez veya işleme amacı yok; aydınlatma metni değişmedi.

**Doğrulama:** typecheck + lint temiz, 34 dosya / 428 test. "Ana sayfa" adlı
başka bir bağlantı veya e2e seçici yok (arandı).

---

## D-097 — Yönetim genel bakışında "Bekleyen işler" kartı

**İstek (ürün sahibi):** Bilgisayara erişemediği zamanlarda kullanıcıları ve
yazarları telefondan kontrol edebilmek.

**Karar:**
- `/admin` sayfasının en üstüne "Bekleyen işler" kartı eklendi. Üç sayaç var,
  her biri kendi sayfasına gider:
  - Açık içerik bildirimleri → `/admin/community`
  - Yönetim onayı bekleyen yazar başvuruları (`editor_approved`) →
    `/admin/applications`
  - Yayın kuyruğundaki yazılar (`ready_for_publishing`, silinmemiş) →
    `/editor/articles?status=ready_for_publishing`
- 24 saati geçen açık bildirim varsa kartın başında kırmızı uyarı çıkar. Sınır
  `isReportOverdue` ile aynı: oluşturulmasından 24 saatten fazla geçmişse gecikmiş.
- Sayılar `src/services/admin-overview.ts` → `pendingAdminWork` içinde
  hesaplanır. Fonksiyon `canAccessAdminPanel` kontrolü yapar. Sayfa yalnızca
  sonucu gösterir.
- **Neden sayım sorgusu:** Kuyruk sayfalarının liste fonksiyonları
  (`listReports`, `listApplicationsByStatus`, `listArticles`) satırları
  birleştirmeli çeker ve limitlidir. Telefonda her açılışta yalnızca sayıya
  ihtiyaç var. Filtreler o fonksiyonlarla aynı durum değerlerini kullanır.
- `awaiting_rights` ve `scheduled` sayılmadı: ilki yazarın imzasını, ikincisi
  zamanlayıcıyı bekler; admin'in yapacağı bir şey yok.

**Hukuk:** Yeni veri, çerez veya işleme amacı yok; aydınlatma metni değişmedi.

**Doğrulama:** `tests/integration/admin-overview.test.ts` — her sayaç yalnızca
kendi kuyruğunu sayar, gecikme 24 saatten eskileri ayırır, editör 403 alır.
typecheck + lint temiz, 35 dosya / 430 test.

---

## D-098 — Yeni içerik bildirimi ve yönetim onayına düşen başvuru adminlere e-postayla bildirilir

**İstek (ürün sahibi):** Panele girmediği zamanlarda bekleyen işlerden haberdar
olmak.

**Karar:**
- `reportContent` yeni bir bildirimi kaydettikten sonra her aktif admine e-posta
  gönderir. Aktif: rolü admin, yasaklı değil, silinmemiş, e-postası doğrulanmış.
  Tekrarlanan bildirim (aynı üye, aynı içerik, hâlâ açık) e-posta göndermez.
- `editorDecideApplication` bir başvuruyu onayladığında (`editor_approved`)
  adminlere e-posta gider. Ret e-posta göndermez; sıradaki adım admin'in değil.
- **Panel içi bildirim kalıyor.** D-090'daki `moderation.report` bildirimi
  aynen yazılmaya devam ediyor. İki kanal bilerek birlikte çalışıyor: panel
  içi bildirim kaydı tutar, e-posta panele girmeyen admine ulaşır.
- **E-postada yalnızca türler var.** Şikâyet e-postasında bildirilen içeriğin
  türü (gönderi, yorum, özel mesaj, anonim mesaj, hesap) ve bildirim türü
  yazar. İçeriğin metni (`snapshot`), bildirimin açıklaması, bildiren ve
  bildirilen hesap yazmaz. Başvuru e-postasında başvuranın adı ve adresi yok.
  Gerekçe: D-091 ve D-092, özel ve anonim mesajın göndereninin yalnızca
  `/admin/community` ekranında görünmesini şart koşuyor. E-posta kutusu o
  sınırın dışında: telefonda bildirim önizlemesinde, e-posta sağlayıcısında,
  yedeklerde durur.
- E-posta, transaction commit edildikten sonra gönderilir. Geri alınan bir
  bildirim kimseye e-posta attırmaz.
- `src/services/staff-mail.ts` → `mailAdmins` hiçbir zaman hata fırlatmaz.
  Bildirim kaydedildikten sonra çalışır. Admin listesi okunamasa bile üyenin
  ekranı hata göstermemeli. `sendMail` zaten teslim hatasını yalnızca loglar.
- **Canlıda SMTP henüz kurulu değil.** Kod hazır, ama `SMTP_*` ortam
  değişkenleri girilene kadar e-postalar teslim edilmez; hata yalnızca loga
  düşer.

**Hukuk:** Aydınlatma metnine (§2, özel mesaj paragrafının ardı) e-postanın
neyi içerdiği ve neyi içermediği yazıldı. Yeni bir veri kalemi yok: alıcı
adminin kendi e-posta adresi. E-posta sağlayıcısı satırı (§6.2) zaten
"bildirim e-postalarının gönderimi"ni kapsıyor.

**Doğrulama:** `tests/integration/admin-mail.test.ts` — iki aktif admine gider,
yasaklı admine gitmez; metin, açıklama, kullanıcı adı, biyografi ve bildirenin
adı/adresi e-postada yok; tekrar bildirim e-posta göndermez; editör onayı
admine gider, başvuranın adı ve adresi yok; ret admine gitmez.
typecheck + lint temiz, 36 dosya / 433 test.

---

## D-099 — İki adımlı doğrulamaya kurtarma kodları geri eklendi

**İstek (ürün sahibi):** Bilgisayar ve telefon erişimi olmadığında panele
girememe riskinin kaldırılması.

**Sorun:** D-048'de 2FA yeniden kurulurken kurtarma kodu eklenmedi (D-033'te
2FA'nın tamamıyla birlikte kaldırılmıştı, bilinçli bir "kod olmasın" kararı
yok). Kurulu faktörü kapatmak da uygulamadaki kodu istiyor. Kimlik doğrulayıcı
uygulamanın olduğu telefon kaybolursa hesap kilitlenir. Canlıda yalnızca iki
admin var ve birbirlerinin 2FA'sını sıfırlayacak bir yol yok.

**Karar:**
- Yeni tablo `totp_recovery_codes` (migration `0031`): `user_id`, `code_hash`,
  `used_at`. `users` silinirse satırlar da silinir (cascade).
- **Üretim:** Hesabım → İki adımlı doğrulama kartı → "Kurtarma kodları".
  10 kod, `xxxxx-xxxxx` biçiminde. Karışan karakterler (0/o, 1/i/l) alfabede
  yok. Yaklaşık 50 bit.
  - Kodlar yalnızca action yanıtında bir kez gösterilir (`ActionState.codes`).
    Sunucuda yalnızca `hashToken(kod, SESSION_SECRET)` özeti durur.
  - Yeni set eskisini tamamen siler.
  - 2FA açılırken kod verilmez: açılış tüm oturumları kapatıyor, kodlar
    gösterilemeden oturum düşerdi. Açıkken ve hiç kod yokken kart uyarı gösterir.
- **Üretmek için** şifre ve ikinci faktör (uygulama kodu veya kurtarma kodu)
  gerekir. Gerekçe: D-033'ün şartı. Çalınmış bir oturum tek başına yeni bir
  giriş yolu üretememeli.
- **Kullanım yerleri:**
  - Girişte `/login/2fa` → "Telefonunuza erişemiyor musunuz?" bölümü. Aynı
    `loginTwoFactorAction`'a gider, `login_2fa` hız sınırını paylaşır (5 deneme
    / 15 dk).
  - 2FA'yı kapatırken (şifre + kurtarma kodu). Telefon kaybında yol: kurtarma
    koduyla gir → başka bir kurtarma koduyla 2FA'yı kapat → yeni telefonla
    yeniden kur. Editör ve admin kapatınca zaten kurulum ekranına yönlenir
    (D-048).
  - Yeni set üretirken.
- **Altı haneli girdi yalnızca TOTP olarak denenir.** Yanlış yazılmış bir
  uygulama kodu bir kurtarma kodunu yakamaz.
- Kod tüketimi `used_at is null` koşullu tek UPDATE ile yapılır; iki eşzamanlı
  istekten yalnızca biri kazanır.
- **Girişte kurtarma kodu kullanılınca** denetim kaydı
  (`user.recovery_code_used`, kalan sayı; kodun kendisi yazılmaz) ve hesap
  sahibine e-posta ("Kurtarma kodu kullanıldı").
- 2FA kapatılınca kodlar silinir; yeni kurulum yeni kod ister. Hesap
  anonimleştirilince kodlar silinir (soft delete cascade'i tetiklemediği için
  `anonymise` içinde).
- D-006'daki argon2id yerine peppered SHA-256: kodlar rastgele ve yüksek
  entropili, oturum/e-posta jetonlarıyla aynı yöntem yeterli. Veritabanı dökümü
  pepper olmadan işe yaramaz. Girişte deneme sayısı hız sınırıyla kısıtlı.

**Hukuk:** Aydınlatma metni güncellendi. §2 "Hesap güvenliği" satırına
kurtarma kodu özetleri ve kullanılma zamanları, §7 saklama tablosuna süre
eklendi. Amaç ve hukuki sebep aynı: güvenlik (KVKK m. 12). Yeni bir yurt dışı
aktarım yok.

**Üretim:** `0031` canlıya uygulanmadan push edilmemeli (D-079). `0026`–`0030`
de hâlâ bekliyor (D-095). Her iki adminin, push ve migration'dan sonra Hesabım
sayfasından kod üretip telefondan ayrı bir yerde saklaması gerekiyor.

**Doğrulama:** `tests/integration/recovery-codes.test.ts`:
- 10 farklı kod üretilir, yalnızca 64 karakterlik özet saklanır.
- Yeni set eskisini geçersiz kılar.
- Şifre veya faktör yanlışsa, ya da 2FA kapalıysa üretim reddedilir.
- Büyük harf ve boşlukla yazılan kod bir kez geçer, ikinci kez geçmez.
- Sahibine e-posta gider; denetim kaydında kodun kendisi yok.
- Yanlış altı haneli kod kurtarma kodu harcamaz.
- Başka hesabın kodu geçmez.
- Kurtarma koduyla 2FA kapatılır ve kodlar silinir.

Mevcut `two-factor.test.ts` değişmeden geçiyor. typecheck + lint temiz, 37
dosya / 440 test.

**e2e koşturulmadı.** `postscript-f1` oturumu aynı anda canlıya alma öncesi tam
e2e koşusu yapıyordu ve bu makinede bellek daha önce yetmemişti (D-094).
`08-two-factor` bu adımla değişen ekranlara dokunuyor:
- 2FA kartındaki kapatma alanı artık altı haneyle sınırlı değil.
- Kartın içine ikinci bir form girdi.
- Giriş sayfasına ikinci bir form girdi.

Seçiciler kontrol edildi, çakışma beklenmiyor:
- Kurtarma formunun etiketleri "Doğrulama kodu" metnini içermiyor.
- Düğme adları `/doğrulama/i` ve "Doğrula" ile eşleşmiyor.

Push öncesi `08-two-factor.spec.ts` yine de koşturulmalı.

---
## D-100 — Veritabanı konumu düzeltildi: Frankfurt, Ohio değil

**Sorun:** D-083'te yazılan KVKK aydınlatma metni ve D-084'teki künye
(`/iletisim`, "Barındırma"), veritabanının "AWS us-east-2, Ohio / Amerika Birleşik
Devletleri"nde olduğunu söylüyordu. Bu bilgi koddan ya da Neon'dan okunmamış, bir
yayın notundan varsayılmıştı. Neon API'ye göre `dawn-meadow-10300581` projesi ve
`production` branch'inin tek compute'u (`ep-frosty-truth-b1j84um8`)
**aws-eu-central-1 (Frankfurt, Almanya)** bölgesinde (D-095'te tespit edildi).
Künye step 13'ten beri canlıda bu yanlış bilgiyi gösteriyordu. Canlı `/kvkk` hâlâ
eski sürüm 1'i gösteriyor ve o sürümde bölge bilgisi hiç yok.

**Karar:**

- Aydınlatma metni §6.2, Neon satırı: "Neon Inc. (ABD merkezli; sunucu: AWS
  eu-central-1, Frankfurt) — Almanya".
- Künye: "veritabanı ABD merkezli Neon Inc. tarafından Almanya'da (AWS
  eu-central-1, Frankfurt) işletilmektedir".
- Yurt dışına aktarım bölümü değişmedi. Almanya da yurt dışı; sağlayıcı ABD
  şirketi. m. 9 standart sözleşme dayanağı aynen geçerli.

**Vercel satırı değişmedi, ama doğrulanmadı:** Depoda bölge ayarı yok (ne
`vercel.json` ne `preferredRegion`). Vercel bu durumda varsayılan ABD bölgesini
kullanır. "Amerika Birleşik Devletleri" bu varsayılana dayanıyor; Vercel
panelinden fonksiyon bölgesi okunmadı.

**Yayına alma:** Künye kodla birlikte canlıya çıkar. Aydınlatma metni dosyadan
otomatik yüklenmez: admin, Sistem sayfasına metni yapıştırıp yeni sürüm olarak
yayınlar. Metinde hâlâ `[NESNE DEPOLAMA SAĞLAYICISI]`, `[E-POSTA SAĞLAYICISI]` ve
`[ÜLKE]` yer tutucuları var; bunlar doldurulmadan metin yayınlanmamalı (D-083).

**Doğrulama:** typecheck + lint temiz, 37 dosya / 440 test geçti.

---

## D-101 — `Permissions-Policy` başlığı eklendi

**Sorun:** Yayın notundaki eksik listesi güvenlik başlıklarını ve e-posta
değiştirme ekranını "henüz yok" diye gösteriyordu. Kod okundu:
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP,
`X-Permitted-Cross-Domain-Policies` ve `poweredByHeader: false` zaten
`next.config.ts`'te; e-posta değiştirme de var (`/verify-email/change`).
Gerçekten eksik olan tek şey `Permissions-Policy` idi.

**Karar:**
- Her yanıta `Permissions-Policy` eklenir. Kapatılanlar: accelerometer,
  autoplay, bluetooth, browsing-topics, camera, display-capture, geolocation,
  gyroscope, hid, magnetometer, microphone, midi, payment, serial, usb.
- Gerekçe: `src` içinde hiçbir tarayıcı yeteneği API'si (`navigator.clipboard`,
  `geolocation`, `mediaDevices` …) ve `iframe` yok. Kapatmak bugün hiçbir ekranı
  bozmaz; CSP'yi aşan bir betiğin okuyucudan bu izinleri istemesini engeller.
  `browsing-topics` reklam hedeflemesi için ilgi alanı çıkarımıdır; kâr amacı
  gütmeyen, reklamsız bir dergide okuyucunun okuduğu yazıların tarayıcıya konu
  olarak işlenmesine gerek yok.
- `interest-cohort` (FLoC) listede yok: tarayıcılar tanımıyor ve konsola uyarı
  basıyor.
- `fullscreen` listede yok: varsayılanı zaten yalnızca aynı köken.
- `X-Permitted-Cross-Domain-Policies` satırındaki yorum yanlıştı ("sitenin
  gömülmesini engeller"); başlık Flash/PDF okuyucuların çapraz alan politika
  dosyasıyla ilgili. Yorum düzeltildi, değer aynı.
- `Strict-Transport-Security` eklenmedi: Vercel alan adlarına HSTS'yi kendisi
  koyuyor (2026-09-13'te `https://www.postscriptmag.com/` yanıtında
  `Strict-Transport-Security: max-age=63072000` görüldü). Uygulamadan ikinci bir değer göndermek, `preload` gibi geri alınması
  zor bir kararı sessizce alma riski taşır.

**Hukuk:** Yeni bir kişisel veri, amaç veya çerez yok; aydınlatma metni
değişmedi.

**Doğrulama:** `tests/unit/security-headers.test.ts` — altı başlığın tümü
`/:path*` kuralında, `Permissions-Policy` kamera/mikrofon/konum/ödeme/
browsing-topics'i kapatıyor, çerçeveleme hem `X-Frame-Options` hem CSP ile
yasak, `poweredByHeader` kapalı. typecheck + lint temiz, 38 dosya / 444 test.

---

## D-102 — `0026`–`0031` üretime uygulandı; step 18–29 yayında

**İstek (ürün sahibi):** Son eksiklerin tamamlanıp push edilmesi.

**Yapılan (2026-09-13):**

- **E2e:** `af4b294`'ün (step 29) temiz kopyasında tam koşu önce yapıldı:
  26/26 geçti, `08-two-factor` 3/3 dahil. Böylece D-094 ve D-099'da açık kalan
  "push öncesi `08-two-factor` koşturulmalı" şartı karşılandı.
- **Yedek:** `backup-before-0026-0031-step29` (`br-damp-cherry-b1es5q58`),
  hesaplamasız branch, migration'dan hemen önce üretimden açıldı. Geri dönüş
  buradan yapılır. Önceki oturumun 11:03'te açtığı
  `backup-before-0026-0031-step28` daha eski olduğu için yeterli sayılmadı.
- **Veri kaybı yok:** `0026`–`0031` taranmış, yalnızca tablo/kolon/indeks/FK
  ekliyor. Tek gevşetme `0027`'deki `bookmarks.article_id DROP NOT NULL`.
  D-082 anlamında açık onay gerektiren bir silme yok.
- **Migration** temiz kopyadan ürün sahibi tarafından çalıştırıldı. Defter
  25 → 31, son kaydın `created_at`'i `0031` journal kaydıyla aynı. `posts`,
  `content_reports`, `conversations`, `anon_messages`, `communities`,
  `totp_recovery_codes` tabloları var. Kullanıcı (71) ve makale (2) sayıları
  korunmuş (Neon'dan sorgulandı).
- Ardından `main` push edildi (step 18–29 ve bu kayıt).

**Çalışma notu — `neon-env` 401:** `neon auth` yenilendikten sonra da
`neon-env` reddedildi. Neden: kullanıcı ortamında süresi geçmiş bir
`NEON_API_KEY` tanımlı. `neon-env` sırası `--api-key` → `NEON_API_KEY` →
`credentials.json` olduğu için OAuth girişi hiç okunmuyor. Çalışan biçim
değişkeni yalnızca o komuttan kaldırmak:
`env -u NEON_API_KEY pnpm.cmd exec neon-env run -- node node_modules/tsx/dist/cli.mjs --tsconfig scripts/tsconfig.json src/db/migrate.ts`.
Kalıcı çözüm (değişkeni silmek ya da yenilemek) ürün sahibinin kararı.

**Kalan üretim işleri (koddan bağımsız):** Her iki admin Hesabım sayfasından
kurtarma kodu üretmeli (D-099). SMTP ve S3/R2 hâlâ kurulu değil. KVKK
metnindeki yer tutucular doldurulmadan yeni sürüm yayınlanmamalı (D-100).

---

## D-103 — Zamanlanmış işler Vercel Cron'a bağlandı; oturum kayıtları 1 yılda silinir

**Sorun:** Zamanlanmış işler yalnızca `pnpm` betikleri ve README'deki bir
crontab örneği olarak vardı. Üretim Vercel'de ve Vercel crontab çalıştırmaz;
depoda `vercel.json` yoktu. Canlıya alındığı 2026-09-06'dan beri şunların
hiçbiri çalışmadı:

- zamanlanmış makalelerin yayımlanması (D-010),
- eser onayı hatırlatmaları,
- 30 günü dolan silme taleplerinin anonimleştirilmesi,
- 7 günlük doğrulanmamış hesapların silinmesi,
- 1 yılı dolan trafik kayıtları, silinmiş içerik ve bildirimlerin budanması.

KVKK aydınlatma metni §7 bu sürelerin uygulandığını söylüyor. Ayrıca
"Oturum kayıtları (IP, tarayıcı bilgisi) 1 yıl" satırının kodda hiçbir
karşılığı yoktu: `sessions` satırları yalnızca `revoked_at` alır, hiç silinmez.
Bu, D-083 ve D-084'te açık kalan maddeydi. "Giriş denemesi kayıtları en çok
30 gün" satırının da çağıranı yoktu; `pruneAttempts` yazılmış ama hiçbir yerden
çağrılmıyordu.

**Karar:**

- `src/services/housekeeping.ts` → `runDailyHousekeeping`, `DAILY_TASKS`
  listesini sırayla yürütür. Bir görevin hatası kaydedilir, diğerleri çalışır.
  Gerekçe: SMTP kurulu değilken hatırlatma e-postası düşebilir. Bu, bir yıllık
  IP kaydının silinmesini engellememeli.
- **Yeni görev `prune_sessions`:** son kullanımı (`last_seen_at`) 365 günden
  eski ve süresi dolmuş oturumları siler.
  - Süre oturum açılışından değil son kullanımdan sayılır. Böylece her
    isteğin IP'si 5651 m. 5'in istediği bir yılı en az doldurur.
  - Süresi dolmamış bir oturum yaşı ne olursa olsun silinmez.
- **Yeni görev `prune_auth_attempts`:** 30 günden eski giriş denemesi
  kayıtları (KVKK §7).
- `process-deletions` ve `purge-unverified` betiklerindeki mantık servise
  taşındı. Betikler ve cron aynı fonksiyonu çağırır. Betikler artık silinen
  hesapların e-posta adreslerini konsola basmıyor, yalnızca sayı yazıyor.
- **`GET /api/cron/daily`** (`src/app/api/cron/daily/route.ts`). Kod stilindeki
  "route handler yalnızca public API, webhook, OG" kuralında webhook sayıldı:
  kullanıcı ve form yok, yalnızca Vercel'in paylaşılan anahtarı var.
  - `src/lib/cron.ts` başlığı `safeEquals` ile karşılaştırır.
  - `CRON_SECRET` tanımsızsa ya da 32 karakterden kısaysa uç kapalıdır (401).
    Yanlış yapılandırma ucu açmaz, kapatır.
- Yanıt yalnızca görev adlarını ve sonuçlarını içerir, hata metnini içermez;
  Vercel yanıtları loglarda tutar. Hata olursa 500 döner, Vercel çalışmayı
  başarısız işaretler.
- Log satırı hatanın yalnızca ilk satırını ve `cause`'un ilk satırını yazar, en
  çok 300 karakter. Sürücü hataları sonraki satırlarda sorgu parametrelerini
  (jeton özeti, adres) taşıyor. Veritabanının asıl nedeni ("relation … does not
  exist") ise `cause`'da duruyor. İlk sürüm yalnızca ilk satırı yazıyordu; yerel
  denemede beş görev yalnızca "Failed query: …" diyerek düştü ve neden
  görünmedi. Bu yüzden `cause` eklendi.
- `vercel.json`: `0 3 * * *`, yani TR 06:00.

**Bilinen sınır — Hobby planı:** Vercel Hobby cron'u günde bir kez çalıştırır
ve saati ±59 dakika kaydırabilir. README'deki `*/5` zamanlanmış yayın artık
günde bire düştü. Zamanlanmış makale en geç ertesi sabah yayımlanır. Bugün
hiç çalışmadığı için bu bir gerileme değil. Daha sık yayın gerekirse editör
elle yayımlar ya da plan yükseltilir. `vercel.json`'da günden sık bir ifade
Hobby'de bütün deploy'u düşürdüğü için `tests/unit/cron.test.ts` bunu engeller.

**Canlıda çalışması için (ürün sahibi):** Vercel → postscript → Settings →
Environment Variables → `CRON_SECRET`, Production, en az 32 karakter rastgele
değer (`.env.example`'daki komutla üretilir). Tanımlanana kadar cron her gün
çağrılır ve 401 alır; hiçbir kayıt silinmez, hiçbir makale yayımlanmaz.

**Hukuk:** Aydınlatma metni değişmedi. §7'deki süreler zaten yazılıydı; bu adım
kodu metne uydurdu. Yeni veri, amaç veya sağlayıcı yok (Vercel Cron, zaten
listede olan Vercel'in parçası).

**Doğrulama:**

- `tests/unit/cron.test.ts`:
  - doğru anahtar geçer;
  - tanımsız veya kısa anahtar, eksik, yanlış ya da öneksiz başlık reddedilir;
  - `vercel.json`'daki her yol var olan bir `route.ts`'e gider;
  - takvim günde birden sık değil.
- `tests/integration/housekeeping.test.ts`:
  - 366 günlük oturum silinir; 364 günlük ve etkin olan kalır;
  - süresi dolmamış eski oturum silinmez;
  - 31 günlük silme talebi anonimleşir, 29 günlük beklemede kalır;
  - 8 günlük doğrulanmamış hesap silinir, 6 günlük ve doğrulanmış kalır;
  - bir görev patlasa da sonraki çalışır ve hata metninde parametre yok;
  - `cause`'daki veritabanı nedeni hataya eklenir, parametreler eklenmez;
  - gerçek görev listesi boş veritabanında hatasız biter.
- typecheck + lint temiz, 40 dosya / 458 test.
- **Yerel deneme:** `pnpm housekeeping` ilk çalışmada beş budama görevinde düştü.
  Neden kod değil, yerel pglite'ın migration defterinin 24'te kalmış olmasıydı:
  `traffic_logs`, `posts`, `direct_messages`, `anon_messages`,
  `content_reports` yoktu. Testler kendi taze veritabanını kurduğu için bunu
  görmüyordu. Yerel `db:migrate` sonrası 12 görevin 12'si hatasız bitti.
- **Canlı çağrı denenmedi:** `CRON_SECRET` henüz Vercel'de yok. Push sonrası
  anahtarsız istek 401 dönmeli.

---

## D-104 — Yeni KVKK sürümü üyelere gösterilir; nesne depolama Neon; metnin kimlik alanları dolduruldu

**İstek (ürün sahibi):** Kurtarma kodları dışında kalan eksiklerin tamamlanması.

**Sorun:** D-083'ten üç madde açık kalmıştı:

1. Aydınlatma metni §10 "esaslı bir değişiklikte yeni sürüm panelde ve e-posta
   yoluyla bildirilir" diyor. Kodda karşılığı yoktu: `kvkk_consent_version`
   kayıtta yazılıyor ama hiçbir yerde karşılaştırılmıyordu.
2. Kayıt kutusu "okudum ve **onaylıyorum**" diyordu. Aydınlatma onaylanmaz,
   bilgilendirir; işlemenin dayanağı açık rıza değil.
3. Metinde `[ORTAK 1 AD SOYAD]`, `[DERGİ E-POSTA ADRESİ]` ve
   `[NESNE DEPOLAMA SAĞLAYICISI]` yer tutucuları duruyordu.

**Karar — yeni sürüm bildirimi:**

- `src/services/kvkk.ts` tek yer.
  - `publishKvkkVersion` admin action'daki iş kuralını devraldı; action
    yalnızca doğrulama + servis çağrısı (kod stili).
  - Yayın artık denetim kaydına yazılıyor (`kvkk.version_published`); eskiden
    yazılmıyordu.
  - Girdi zod ile doğrulanır.
- **Bant:** `PanelShell`, üyenin okuduğu sürüm (`kvkk_consent_version`) güncel
  sürümden eskiyse ya da boşsa her panel sayfasının üstünde bir bant gösterir:
  metne bağlantı ve "Okudum" düğmesi.
  - Bant hiçbir sayfayı kilitlemez; aydınlatma onay istemez (D-083).
  - Gösterim her yeni sürümde olur, esaslı olsun olmasın.
- **Bildirim + e-posta:** yalnızca admin yayın formunda "Esaslı değişiklik"
  kutusunu işaretlerse gider. Kutu varsayılan olarak işaretli; §10'un vaadi bu.
  - Yazım düzeltmesi herkese e-posta attırmasın diye kaldırılabilir.
  - Alıcılar: silinmemiş ve e-postası doğrulanmış her üye, yasaklılar dahil.
    Yasaklı üye de veri sahibi.
  - Commit'ten sonra gönderilir, hiç hata fırlatmaz (D-098'deki `mailAdmins`
    ile aynı gerekçe).
- **"Okudum":** `acknowledgeKvkkNotice`.
  - `kvkk_consent_version` ve `kvkk_consent_at` güncellenir. Önceki değerler
    önce denetim kaydına yazılır (`user.kvkk_notice_read`, `before`/`after`).
    Kayıttaki ilk onayın tarihi böylece kaybolmaz; `audit_log` yalnızca eklenir.
  - Bant açıkken daha yeni bir sürüm yayınlandıysa eski sürüm için gelen istek
    409 alır. Yeni metni okumamış biri onu okumuş sayılmaz.
  - Çift tıklama ikinci denetim kaydı yazmaz.
- **Migration yok:** mevcut kolonlar yeterli.
- **Mevcut duyuru sistemi neden kullanılmadı:** `announcements` hedef kitlesi
  veritabanında enum (`writers`, `editors`, `all_staff`); okuyucu yok.
  Eklemek bir enum migration'ı demek. Ayrıca zorunlu duyuru yazar panelini
  kilitliyor. Aydınlatma metni ise sürümlü ayrı bir hukuki belge ve kimseyi
  kilitlememeli. İki mekanizma farklı iş yapıyor, "aynı işi yapan ikinci
  çözüm" değil.
- **Canlıda ilk gün:** Neon'dan sorgulandı (2026-09-13). Silinmemiş 40 üyeden
  11'i sürüm 1'i okumuş. 29 yazar hesabının sürümü boş: kayıt formundan değil
  yönetimden açılmışlar ve metin onlara hiç gösterilmemiş. Deploy sonrası
  bu 29 kişi bandı bir kez görür; bu doğru davranış.

**Karar — kayıt kutusu:** "okudum ve anladım". E2e seçicisi `name="kvkkConsent"`
olduğu için testler etkilenmez.

**Karar — nesne depolama: Neon Object Storage.**

- Üretim branch'inde `postscript-media` bucket'ı açıldı (`private`). Kod zaten
  imzalı URL kullanıyor.
- **Gerekçe:**
  - Neon Inc. aydınlatma metninde veritabanı sağlayıcısı olarak zaten var ve
    m. 9 standart sözleşmesinin kapsamında. Yeni bir yurt dışı sağlayıcı
    eklenmiyor.
  - Veri Frankfurt'ta, veritabanıyla aynı bölgede kalıyor.
  - Beta süresince ücretsiz, proje başına 5 GB.
  - Mevcut S3 bağdaştırıcısı (`forcePathStyle`, SigV4, imzalı GET) kod
    değişmeden uyumlu.
- **Risk:** hizmet beta. Belgelenmiş sınırlar:
  - yoğun kullanımda `503 SlowDown`;
  - kimlik bilgisinde `expires_at` uygulanmıyor, bu yüzden iptal elle yapılır.
- Sözleşme PDF'lerinin kaybı kanıt kaybı değil: gösterilen sözleşme metni
  imzalı haliyle veritabanında da tutuluyor (`schema.ts`, "The contract exactly
  as it was shown").
- **Kimlik bilgisi Claude tarafından üretilmedi.** `neon credentials create`
  gizli anahtarı yalnızca bir kez, çıktıya basıyor; transkripte düşerdi.

**Canlıda çalışması için (ürün sahibi):**

1. Neon Console → `production` branch → Credentials → Create credential,
   `storage:read` + `storage:write`.
2. Vercel → Environment Variables (Production):
   - `S3_ENDPOINT=https://br-young-recipe-b1pi7jjp.storage.c-5.eu-central-1.aws.neon.tech`
   - `S3_REGION=eu-central-1`
   - `S3_BUCKET=postscript-media`
   - `S3_FORCE_PATH_STYLE=true`
   - `S3_ACCESS_KEY_ID` = credential'ın `token_id`'si
   - `S3_SECRET_ACCESS_KEY` = `s3_secret_access_key`
3. Redeploy.

**Karar — metin:**

- Ortak adları (Elif Yaren Çekiç, Tuanna Demir) ve e-posta
  (`iletisim@postscriptmag.com`) canlı `site_settings`'ten okunarak yazıldı.
  Künye aynı değerleri gösteriyor.
- Depolama satırı: Neon Inc., Almanya.
- **Hâlâ boş:**
  - `[AÇIK ADRES]`: `site_settings.publisher_address` yalnızca "Konak, İzmir";
    tebligata elverişli açık adres değil. Tahminle yazılmadı.
  - `[E-POSTA SAĞLAYICISI]` / `[ÜLKE]`: SMTP sağlayıcısı seçilmedi.
    `postscriptmag.com`'un MX kaydı Cloudflare Email Routing; yalnızca gelen
    postayı yönlendirir, gönderim yapmaz.
- Bu ikisi dolmadan ve S3 ortam değişkenleri girilmeden metin yeni sürüm olarak
  yayınlanmamalı. Depolama satırı ancak o zaman fiilen doğru olur.
- **Hukukçu görüşü gerekiyor:** künye 5651 m. 3 kapsamında "Konak, İzmir"
  gösteriyor. Tebligata esas adres olarak yeterli olup olmadığı belirsiz.

**Hukuk:** Yeni kolon yok. "Okudum" kaydı, kayıtta zaten tutulan
`kvkk_consent_at`/`kvkk_consent_version` kolonlarını kullanıyor. Önceki değer
denetim kaydına gidiyor; o da §7'deki "Panel işlem (denetim) kayıtları" satırında.

Metin yine de koddan geride kalmıştı ve bu adımda düzeltildi:

- **§2:** kayıttan beri tutulan "hangi sürümü ne zaman okudu" bilgisi hiç
  sayılmamıştı. Yeni satır: "Bilgilendirme". Saklama süresi §7'deki "Hesap
  verileri" satırıyla aynı.
- **§3:** bu kaydın amacı ve hukuki sebebi de yoktu. Yeni satır: yeni
  sürümlerin duyurulması ve okuma kaydı; dayanağı (ç) hukuki yükümlülük,
  KVKK m. 10 (aydınlatmanın yapıldığını ispat).
- **§10:** artık bandı anlatıyor: onay istemediği ve paneli kilitlemediği
  yazıyor. Bildirim ve e-postanın yalnızca esaslı değişikliğe gittiği de
  yazıyor.

**Doğrulama:**

- `tests/integration/kvkk.test.ts`:
  - editör yayınlayamaz;
  - kısa metin reddedilir;
  - sürümler 1, 2 diye artar ve tek güncel kalır;
  - esaslı olmayan değişiklik bildirim ve e-posta üretmez;
  - esaslı değişiklik yalnızca doğrulanmış ve silinmemiş üyelere bildirim ve
    e-posta gönderir;
  - bant yalnızca okunan sürüm gerideyken görünür;
  - "okudum" sürümü günceller ve eski sürüm denetim kaydına gider;
  - eski sürüm için "okudum" reddedilir;
  - çift gönderim tek kayıt yazar;
  - geçersiz sürüm girdisi reddedilir.
- typecheck + lint temiz, 41 dosya / 467 test.

---

## D-105 — Düzeltme: canlıda depolama Cloudflare R2, e-posta Resend; ikisi de 7 Eylül'den beri kurulu

**Sorun:** D-098, D-102 ve D-104 canlıda SMTP ve nesne depolamanın kurulu
olmadığını söylüyordu. D-104 bu varsayımla bir sağlayıcı seçti (Neon Object
Storage), üretimde bucket açtı ve aydınlatma metnine "Neon Inc., Almanya"
depolama satırını yazdı. Varsayım kodu ya da Vercel'i okuyarak değil, yayın
notundaki bir "eksikler" listesinden alınmıştı. D-100'deki hatanın aynısı.

**Kanıt (2026-09-14):**

- **Canlı veri:** `media` tablosunda 2026-09-07 tarihli iki kayıt var: bir
  başvuru örneği ve bir sözleşme PDF'i (`agreement_acceptances`'a bağlı).
  `storeGeneratedPdf` önce depolamaya yazar, sonra satırı ekler. Yazma
  başarısız olsaydı satır olmazdı.
- **Yerel diskte yok:** aynı anahtarlar ne ana ağacın `.storage`'ında ne diğer
  worktree'lerde. Kayıtlar yerelden oluşmadı.
- **Vercel → postscript → Environment Variables** (ürün sahibinin girişli
  tarayıcısından, izniyle; yalnızca gizli olmayan değerler açıldı):
  - `S3_ENDPOINT` = `https://<hesap>.r2.cloudflarestorage.com` → Cloudflare R2.
    `.eu.` alt alanı yok, yani bucket AB yargı bölgesinde değil.
  - `SMTP_HOST` = `smtp.resend.com` → Resend.
  - `MAIL_FROM` = `postscript <noreply@postscriptmag.com>`.
  - `S3_*` ve `SMTP_*` değişkenlerinin hepsi 7 Eylül'de eklenmiş, Production
    ve Preview.
- **DNS:** `send.postscriptmag.com` MX kaydı
  `feedback-smtp.ap-northeast-1.amazonses.com`, SPF `include:amazonses.com`,
  `resend._domainkey` var. Resend bu alan adı için AWS SES Tokyo bölgesinden
  gönderiyor. D-104'teki "MX Cloudflare Email Routing, yalnızca gelen posta"
  tespiti ana alan adı için doğruydu; gönderimin `send.` alt alanından
  yapıldığı gözden kaçmıştı.

**Karar:**

- **Aydınlatma metni §6.2:**
  - Depolama satırı: "Cloudflare, Inc. (ABD merkezli; R2 nesne depolama)".
    Ülke `[ÜLKE]` olarak bırakıldı: R2 bucket'ının konum ipucu Vercel'den
    okunamıyor, yalnızca Cloudflare panelinden görülür. Tahminle yazılmadı.
  - E-posta satırı: "Resend, Inc. (ABD merkezli; gönderim sunucusu:
    AWS ap-northeast-1, Tokyo)", Japonya.
- **D-104'ün "nesne depolama: Neon" kararı geri alındı.**
  - Kodda değişiklik yok; kod sağlayıcıdan bağımsız.
  - Üretim branch'inde açılan boş `postscript-media` bucket'ı kullanılmıyor.
    Silinmesi ürün sahibinin onayını bekliyor (geri alınamaz işlem).
  - D-104'teki "canlıda çalışması için" adımları uygulanmamalı.
- **D-104'ün diğer kararları geçerli:** KVKK sürüm bandı, "okudum ve anladım",
  ortak adları ve e-posta.
- Yayın notu (Claude hafızası) düzeltildi; eksik sanılan bir altyapı için önce
  Vercel ortam değişkenlerine bakılacak.

**Hukukçu görüşü / teyit gerekiyor:**

- Resend'in hesap, log ve bounce verisini gönderim bölgesi dışında (ABD)
  tutup tutmadığı doğrulanmadı. Metin yalnızca görülen gönderim bölgesini
  yazıyor. Resend'in veri işleme sözleşmesinden teyit edilmeli.
- Cloudflare ve Resend ile m. 9 standart sözleşmesi imzalanmış olmalı. D-083
  bunu yalnızca Vercel ve Neon için şart koşmuştu; iki sağlayıcı daha var.
- Metin hâlâ yayınlanmamalı: `[AÇIK ADRES]` ve R2 `[ÜLKE]` boş.

**Ayrıca:** Vercel ortam değişkenlerinde `SEED_ADMIN_PASSWORD` (Production ve
Preview) duruyor. Canlıda seed çalıştırılmıyor ve iki admin sabit. Değişken
gereksiz bir gizli değer; kaldırılması ürün sahibine önerildi, dokunulmadı.

---

## D-106 — Admin, yazının süreç geçmişini yazı sayfasında görür

**İstek (ürün sahibi):** "Admin yazının notlarının hepsini görebilsin, yazıların
adımları sadece editörde ve yazarda kalmasın."

**Tespit:**

- **Notlar:** admin bütün notları zaten görüyordu. Admin menüsündeki "Makaleler
  & yayın kuyruğu" `/editor/articles/[id]`'ye gider. `assertCanReadArticle`
  admini her kategoride geçirir; sayfa editöryal notları (çözülenler dahil),
  intihal notunu ve Eser Onayı ret gerekçesini gösteriyor. Bu konuda değişiklik
  gerekmedi.
- **Adımlar:** hiçbir ekranda yoktu, ne editörde ne yazarda.
  - Kim, ne zaman, hangi durumdan hangisine ve hangi notla geçirdi bilgisi
    yalnızca `audit_log`'da duruyordu (`article.status_changed`, `before`/`after`).
  - Revizyon gerekçesi yazara e-postayla gidiyor, sonra hiçbir sayfada
    görünmüyordu.
  - "Sürüm geçmişi" yalnızca metin sürümlerini gösteriyor, adımları değil.

**Karar:**

- **Yazı sayfasına "Süreç geçmişi" kartı eklendi**, yalnızca admin görür. Her
  satırda tarih, kim, adım (durumlarda "önceki → yeni") ve not var.
- **Kaynak** mevcut `audit_log`; yeni tablo ya da kolon yok.
  - `src/services/article-history.ts` → `listArticleHistory` şu kayıtları okur:
    yazıya ait `articles` kayıtları ve o yazının Eser Onaylarına ait
    `rights_grants` kayıtları (Eser Onayı olayları yazıya değil onaya karşı
    loglanıyor).
  - Sıra oluşturulma zamanına göre, eskiden yeniye.
- **Satırın anlamı saf fonksiyonda:** `src/lib/article-history.ts` →
  `describeStep`, durum makinesi gibi veritabanından bağımsız. Tanımadığı yeni
  bir işlem kaybolmaz, ham adıyla görünür.
- **Neden yalnızca admin:** denetim kaydını bugün yalnızca admin okuyor
  (`/admin/audit`, `canAccessAdminPanel`). Editöre veya yazara açmak ayrı bir
  karar olurdu. İstek de admin içindi. Yetki kontrolü serviste; sayfadaki
  `isAdmin` yalnızca gereksiz sorguyu atlıyor.
- **IP adresi sonuca konmaz.** Denetim kaydında var, bu ekranın ihtiyacı yok.
- Ayrı bir `/admin/articles` sayfası açılmadı. Admin yazıları zaten bu sayfadan
  yönetiyor; aynı yazının iki detay sayfası birbirinden sapardı.
- Geçmiş en fazla 500 adım. Bu bir sayfa boyutu değil, koruma sınırı.

**Hukuk:** Yeni kişisel veri, amaç veya aktarım yok. Gösterilen bilgi (işlemi
yapanın görünen adı, zaman, not) aydınlatma metni §2'deki "Denetim" satırında
zaten sayılı ve admin'in erişimi `/admin/audit`'te zaten var. Metin değişmedi.

**Doğrulama:**

- `tests/unit/article-history.test.ts`:
  - durum geçişi önceki/yeni durum ve notla okunur, boş not yok sayılır;
  - intihal sonucu ve notu;
  - Eser Onayı imzası (yayın adıyla) ve ret gerekçesi;
  - işlemi yapan yoksa "Sistem";
  - bilinmeyen işlem ham adıyla görünür.
- `tests/integration/article-history.test.ts`:
  - bir yazının bütün adımları sırayla gelir: kayıt, beş durum geçişi, not
    ekleme, Eser Onayı açılışı ve imzası;
  - kategori onayındaki not ve işlemi yapanların adları doğru;
  - IP adresi sonuçta yok;
  - başka yazının adımları karışmaz;
  - ana editöre ve yazara 403;
  - olmayan yazıya 404.
- typecheck + lint temiz, 43 dosya / 478 test.
- **E2e koşturulmadı:** `04-editorial` admin olarak bu sayfayı kullanıyor.
  Seçicileri kontrol edildi, çakışma beklenmiyor:
  - "Eser Onayı:" metni (iki nokta dahil) kartta geçmiyor;
  - durum rozeti `header span` ile okunuyor ve kart `header` içermiyor;
  - geçişler düğme adıyla seçiliyor, tablo metni düğme değil.

---

## D-107 — Süreç geçmişi editöre ve yazara da açıldı; yazar gelen kutusunun gördüğünü görür

**İstek (ürün sahibi):** "Editör ve yazar da süreç geçmişini görebilsin."

**D-106'dan değişen:** Kart yalnızca admin'e açıktı. Artık yazıyı okuyabilen
herkese açık; kural yazının notları ve sürümleriyle aynı:
- admin ve ana editör: bütün yazılar;
- kategori editörü: yalnızca alanlarına düşen yazılar;
- yazar: yalnızca kendi yazısı.

Kapı `listArticleHistory` içinde `assertCanReadArticle`. Sayfadaki kontrol yetki
değil; kapsam dışındaki editöre, başka bir yazara ve okura servis 403 döner.

**Yazarın gördüğü — neden kısıtlı:** Denetim kaydı editörler arasındaki iç
değerlendirmeyi de taşıyor. Yazarın bugüne kadar bildiği, e-postayla ona
gidenlerdi.

- `notifyAuthorOfStatus` yalnızca üç durumda ve notuyla e-posta atıyor:
  `revision_requested`, `published`, `withdrawn`.
- Kategori editörünün ya da ana editörün iç aşamalarda bıraktığı geçiş notları
  yazara hiç iletilmiyordu.
- Yazar sayfası intihal kontrolünü hiç göstermiyordu.

Kartı olduğu gibi açmak bunları yazara ilk kez gösterirdi. Muhafazakâr kural:
ekran gelen kutusundan fazlasını göstermez (`stepsForAudience`, saf fonksiyon).

- **Bütün adımlar görünür:** kim, ne zaman, hangi durumdan hangisine.
  Editörlerin görünen adları yazara zaten editöryal notların altında
  görünüyordu.
- **Geçiş notu yalnızca e-postası atılan üç durumda** görünür; diğerlerinde
  "—".
- **İntihal adımı hiç görünmez.** Sonucu da, notu da iç değerlendirme.
- **Eser Onayı adımları görünür**, ret gerekçesi dahil; gerekçe yazarın kendi
  sözü.
- **Tek kaynak:** "yazara bildirilen durumlar" listesi
  `src/lib/article-history.ts` → `AUTHOR_TOLD_STATUSES`. `notifyAuthorOfStatus`
  de bu listeyi kullanıyor. Yazara e-posta giden bir durum eklenirse notu
  geçmişte de kendiliğinden görünür; ikisi ayrışamaz.

**Editör ve admin** kısıtsız görür. İntihal notunu ve iç notları zaten aynı
sayfada okuyorlar.

**Kart tek bileşen:** `src/components/article-history.tsx` →
`ArticleHistoryCard`. Editör ve yazar sayfası aynı bileşeni kullanıyor; hangi
adım ve notun geleceği servisin kararı, kartın değil.

**IP adresi** kimseye gösterilmez (D-106'daki gibi).

**Fark edilen, değiştirilmeyen:** Yazar sayfası editöryal notları kendi
sorgusuyla okuyor ve `deleted_at` süzmüyor; `listComments` süzüyor. Kodda notu
yumuşak silen bir yol bulunmadığı için bugün görünür bir etkisi yok. Not silme
eklenirse bu sorgu da `listComments`'e çevrilmeli.

**Hukuk:** Yeni kişisel veri, amaç veya aktarım yok. Yazar kendi yazısının
işlenişini görüyor; editörlerin görünen adları zaten görünüyordu. İç
değerlendirme notları ve intihal sonucu yazara açılmadı. Aydınlatma metni
değişmedi.

**Doğrulama:**

- `tests/unit/article-history.test.ts`:
  - personel her şeyi görür;
  - yazar görünümünde intihal adımı yok;
  - iç aşama notu boş, revizyon notu ve ret gerekçesi görünür;
  - `AUTHOR_TOLD_STATUSES` e-postanın üç durumuyla aynı.
- `tests/integration/article-history.test.ts`:
  - admin ve ana editör aynı tam geçmişi görür; adımlar sırayla: revizyon
    döngüsü, intihal, not, Eser Onayı;
  - yazar görünümü bir adım eksik (intihal); revizyon notu var; iç notlar ve
    intihal notu yanıtın hiçbir yerinde yok;
  - IP adresi admin'de de yazarda da yok;
  - alanı kapsamayan kategori editörüne, başka yazara ve okura 403;
  - olmayan yazıya 404.
- typecheck + lint temiz, 43 dosya / 483 test.

---

## D-108 — Yazının önceki sürümleri açılıp bir öncekiyle karşılaştırılabilir

**İstek (ürün sahibi):** "Yazıların önceki hallerini de görüntüleyebilelim."

**Tespit:** `article_versions` her sürümün gövdesini tutuyor:
- yazı oluşturulurken;
- editör ya da yazar metni kaydedince;
- yayına alınınca.

Yanında değiştiren, not, değişikliğin türü ve yayın işareti var; başlık yok.
Editör ve yazar sayfasındaki "Sürüm geçmişi" tablosu yalnızca numara, tarih ve
notu gösteriyordu. Bir sürümün metnini açmanın yolu yoktu.

**Karar:**

- **Sürüm sayfası:** `/editor/articles/[id]/versions/[version]` ve
  `/writer/articles/[id]/versions/[version]`. Tablodaki "v1", "v2"… bu sayfaya
  bağlantı. İki sayfa aynı bileşeni kullanıyor
  (`src/components/article-version.tsx`). Sayfada:
  - kaydeden, tarih, değişikliğin türü (düzeltme / içerik değişikliği), yayın
    işareti ve not;
  - bir önceki sürüme göre eklenen ve silinen satırlar; değişmeyen uzun
    bölümler katlanır, değişikliğin iki yanında iki satır kalır;
  - sürümün metni, `renderMarkdown` ile (gömülü HTML düşer, çıktı temizlenir;
    D-012).
- **Servis:** `getArticleVersion` (`src/services/articles.ts`) sürümü ve bir
  öncekini tek sorguda getirir.
  - Kapı sürüm listesiyle aynı, `assertCanReadArticle`: admin ve ana editör
    bütün yazılar, kategori editörü kendi alanları, yazar kendi yazısı; diğerleri
    403.
  - URL'den gelen numara zod ile ayrıştırılır; sayı olmayan ya da olmayan sürüm
    404.
- **Yazar tarafı:** yazının detay sayfasındaki kuralla aynı. Yazar alanında
  yalnızca kendi yazısının sürümleri açılır, başkasınınki 404. Hibrit editör
  başkasının yazısını editör alanından okur.
- **Yazar sürümleri görebilir:** sürüm listesi ve notları ona zaten açıktı. Her
  sürüm, yazarın bugün de gördüğü metnin bir önceki hali. Gizli bir
  değerlendirme içermiyor; iç notlar `article_comments` ve denetim kaydında
  (D-107).

**Karşılaştırma — neden kütüphane eklenmedi:** Projede metin karşılaştırma
kütüphanesi yok.

- **Satır bazlı fonksiyon:** `src/lib/text-diff.ts`, en uzun ortak alt dizi
  yöntemiyle, saf fonksiyon olarak yazıldı. Markdown satır satır yazıldığı için
  editörün tanıdığı birim satır.
- **Hız:** ortak baş ve son tabloya girmez; tipik düzenleme küçük bir tablo
  demek.
- **Koruma sınırı:** `DIFF_CELL_BUDGET` (4 milyon hücre). Değişen bölüm bunu
  aşarsa karşılaştırma yapılmaz, sayfa "karşılaştırılamayacak kadar uzun" der.
  Tek bir sayfa isteği sunucuyu meşgul edemez.
- **Erişilebilirlik:** eklenen ve silinen satırlar renkten başka "+"/"−"
  işaretiyle ve ekran okuyucuya "Eklendi:"/"Silindi:" metniyle ayrılıyor.
  Projede yeşil ton yok; eklenen `accent-soft`, silinen `danger-soft`.

**Hukuk:** Yeni veri, amaç veya aktarım yok. Mevcut sürüm kayıtları, onları
zaten görebilenlere okunur biçimde gösteriliyor. `article_versions` silinmez
kuralına (5187 s. K., CLAUDE.md) dokunulmadı; yalnızca okuma eklendi.

**Doğrulama:**

- `tests/unit/text-diff.test.ts`:
  - aynı metin değişiklik üretmez;
  - ortadaki değişen satır bir silme ve bir ekleme;
  - sona ekleme ve baştan silme;
  - Windows satır sonları farksız;
  - aynı ve eklenen satırlardan yeni metin birebir yeniden kurulur;
  - sınırın üstü reddedilir;
  - katlama bağlamı korur ve uzun aynı bölümleri sayar.
- `tests/integration/article-versions.test.ts`:
  - v2 metni, kaydeden ve not ile birlikte v1'i de getirir;
  - v1'in öncesi yok;
  - yazar kendi yazısının sürümünü okur;
  - başka yazara, okura ve alanı kapsamayan kategori editörüne 403;
  - olmayan ya da geçersiz sürüm numarasına 404.
- typecheck + lint temiz, 45 dosya / 496 test.

---

## D-109 — Yazar süreç geçmişinde iç aşama notlarını da görür

**İstek (ürün sahibi):** "Yazar da iç notları görebilsin."

**D-107'den değişen:** D-107'de yazar, geçiş notlarını yalnızca e-postası
atılan üç durumda görüyordu (`revision_requested`, `published`, `withdrawn`).
Kategori editörünün ve ana editörün iç aşamalarda bıraktığı notlar yazara "—"
görünüyordu. Ürün sahibi bu kısıtı kaldırdı.

**Karar:**

- `stepsForAudience("author")` artık notlara dokunmuyor. Yazar her adımı ve her
  geçiş notunu görür; iç aşamalar da dahil.
- **İntihal adımı yazardan hâlâ gizli.** İstek "iç notlar" içindi; intihal
  sonucu ve notu ayrı bir iç değerlendirme ve yazar sayfası onu hiç
  göstermedi. Açılması istenirse aynı fonksiyondaki tek süzgeç kalkar.
- `AUTHOR_TOLD_STATUSES` yerinde duruyor. Artık yalnızca e-posta için
  kullanılıyor: yazara hangi durumlarda e-posta gideceği değişmedi. Geçmişin
  gösterdiği notlarla bağı koptu; yorumları buna göre güncellendi.
- **Editörlere etkisi:** iç aşamada yazılan not artık yazarın okuyacağı bir
  metin. Editör panelindeki not alanında bunu söyleyen bir uyarı yok; gerekirse
  ayrı adım.

**Hukuk:** Yeni veri, amaç veya aktarım yok. Notlar yazarın kendi eseri
hakkında; KVKK m. 11 kapsamında zaten talep edebileceği bilgi. Aydınlatma metni
değişmedi.

**Doğrulama:**

- `tests/unit/article-history.test.ts`: yazar görünümünde iç aşama notu ve
  revizyon notu görünür, intihal adımı yok.
- `tests/integration/article-history.test.ts`:
  - yazar ana editörün iç notunu görür;
  - yazar görünümü, intihal adımı çıkarılmış personel görünümüyle birebir aynı;
  - intihal notu yok.
- typecheck + lint temiz, 45 dosya / 496 test.

---

## D-110 — Canlıdaki iki yazı yumuşak silindi

**İstek (ürün sahibi):** "Atılan yazıları sil."

**Kapsam — ürün sahibine soruldu:** Canlıda iki yazı vardı, ikisi de
yayımlanmamış. Yerel veritabanında yazı yoktu. Ürün sahibi ikisini de ve
yöntem olarak "şimdi yumuşak sil"i seçti.

| Yazı | Durum | Sürüm | Not | Kimlik |
|---|---|---|---|---|
| Madde 1 - Hukukun Peşini Bırakmadıkları | draft | 3 | 0 | `ede5e7b1-dc34-4331-8f84-d5e2cb103ab0` |
| Kimlik Rafında | pending_admin_approval | 2 | 1 | `23d85477-2663-41ce-b417-d0fe4d88be1f` |

**Neden tamamen silinmedi:** CLAUDE.md, 5187 s. K. belirsizliği nedeniyle
hukukçu görüşü alınana kadar `article_versions`'ın silinmemesini şart koşuyor.
`articles` satırının silinmesi sürümleri de cascade ile silerdi.

**Kodda silme özelliği yok.** Yazılar `deleted_at` alanıyla yumuşak silinir.
`findArticleById` ve bütün listeler bu alanı süzer: işaretlenen yazı panelde
de, public API'de de bulunamaz (404).

**Yapılan (2026-09-14):**

- **Yedek:** `backup-before-article-soft-delete` (`br-royal-moon-b1hr15ey`),
  hesaplamasız branch.
- **Tek transaction (Neon üzerinden SQL):**
  - İki yazıya kimlikleriyle `deleted_at = now()` yazıldı.
  - `audit_log`'a her biri için `article.soft_deleted` satırı eklendi.
    İşlemi yapan kişi: boş, çünkü panel dışından yapıldı. `before` kaydında durum
    ve başlık, `after` kaydında gerekçe ve yöntem var.
  - Ürün sahibine seçeneği sunarken "denetim kaydına yazılmaz" denmişti. Kayıt
    yine de eklendi: yalnızca ekleme yapıyor, bir şeyi değiştirmiyor ve silmenin
    izini tutuyor.
- **Doğrulama (Neon'dan sorgulandı):**
  - iki yazıda `deleted_at` dolu;
  - sürümler (3 ve 2) ve editöryal not yerinde;
  - her yazı için bir denetim satırı var;
  - silinmemiş yazı kalmadı.

**Geri alma:** Gerekirse aynı iki kimlik için `deleted_at = null` yazılır ve
bir `article.restored` denetim satırı eklenir. Veri kaybı olmadığı için yedek
branch'e dönmek gerekmez; branch yalnızca güvence.

**Açık:** Admin paneline denetim kaydı yazan bir "yazıyı sil / geri al"
özelliği bu adımda eklenmedi. Tekrar gerekecekse ayrı adım olarak yapılmalı;
SQL ile silme işlemi yapanı kaydedemiyor.

---

## D-111 — Kayıt ve doğrulama e-postası formları Cloudflare Turnstile ile korunur; bot kayıtları temizlendi

**Sorun (ürün sahibi):** "Siteye sürekli bot kaydı oluyor. E-posta doğrulamasını
zorunlu yaptım ama bu sefer de e-posta doğrulaması yapılarak bot kaydı
oluşturulmuş."

**Kanıt (canlı veri, 2026-09-14; kişisel veri çekmeden okundu):**

- **11–12 Eylül dalgası:** yaklaşık 15 `user` hesabı.
  - `user.registered` IP'leri Tor çıkış düğümleri (`185.220.100/101.x`,
    `192.42.116.x`) ve kiralık sunucular (`205.185.113.x`, `204.8.96.x`,
    `45.84.107.x`, `150.40.126.x`, `147.90.234.x`).
  - Oturumlardaki tarayıcı bilgisi hepsinde aynı ve başında fazladan bir tırnak
    var (`"Mozilla/5.0 (Macintosh…`). Gerçek tarayıcı böyle göndermez.
  - Görünen adlar 18 karakter. Bu hesaplar sonradan silinip anonimleştirilmişti.
- **14 Eylül 01:48:** `rhodesstate.edu` adresli hesap.
  - Görünen adı `HbyxyxUwRhYVOBqNFstW`.
  - Doğrulama isteği AWS'den (`54.221.111.x`) geldi; hesap hiç giriş yapmadı.
- **Bekleyen 22 kayıt** (hiç doğrulanmamış, 12–14 Eylül):
  - Adresler `valvesoftware.com`, `fox.com`, `nyu.edu`, `sbcglobal.net`,
    `wcfpd.net` gibi yabancı kurumlara ait; adlar ~20 karakter.
  - Bu, kayıt spamı: bot formu başkalarının adresiyle doldurup siteye onlara
    e-posta attırıyor. Alıcılardan biri ya da kutusunun tarayıcısı tıklayınca
    hesap açılıyor. İstenmeyen e-posta Resend üzerinden gönderen alan adının
    itibarını da zedeliyor.

**Neden doğrulama yetmedi:** Doğrulama zaten bir GET değil, CSRF'li bir düğme.
Bağlantı önizlemesi token harcayamıyor. Botlar gerçek tarayıcı sürüyor
(headless): sayfayı açıyor, çerezi alıyor, düğmeye basıyor. Görünmez tuzak alan
ve en kısa doldurma süresi gibi hafif önlemler bu sınıfı durdurmaz. Ürün
sahibine üç yol sunuldu: Turnstile, Vercel BotID Basic, yalnızca hafif
önlemler. Turnstile seçildi.

**Karar — koruma:**

- **Kapsam:** yabancı bir adrese e-posta gönderten iki form, kayıt (`register`)
  ve doğrulama bağlantısını yeniden gönderme (`resend_verification`). Şifre
  sıfırlama yalnızca var olan hesaba gidiyor ve kendi hız sınırı var; bu adımda
  eklenmedi.
- **Sunucu:** `src/lib/turnstile.ts` → `assertHuman(token, ip, action)`.
  Cloudflare siteverify'a gider; token, IP ve eylem adını doğrular. Başka
  formda çözülmüş token reddedilir.
  - Servis katmanında çağrılır (`register`, `resendVerificationEmail`).
  - Kayıtta hız sınırından sonra, hiçbir şey saklanmadan ve gönderilmeden önce.
    Bot selini Cloudflare selinine çevirmez; e-posta hiç çıkmaz.
  - Token ve secret loglanmaz.
- **İstemci:** `src/components/turnstile.tsx`. Token formun `botToken` alanına
  yazılır. Her gönderimden sonra bileşen sıfırlanır; token tek kullanımlık ve
  hatayla dönen form yoksa kullanılmış token'ı tekrar yollardı.
- **Anahtarlar tanımlı değilken kontrol atlanır** (`TURNSTILE_SITE_KEY` ve
  `TURNSTILE_SECRET_KEY` ikisi de gerekli). Kodu yayına almak, anahtarlar
  Vercel'e girilmeden kaydı kapatamaz. Bileşen de bu durumda gösterilmez.
- **Anahtarlar tanımlıyken kapalı başarısız olur:** Cloudflare'e ulaşılamazsa
  form reddedilir. Kesinti sırasında botları geçirmek bu korumanın var olma
  sebebine aykırı. Kesinti boyunca kayıt yapılamaz; bu bilerek kabul edildi.
- **CSP:** `script-src` ve yeni `frame-src` yalnızca
  `https://challenges.cloudflare.com` için açıldı. `default-src` ve
  `connect-src` `'self'` kaldı; `tests/unit/security-headers.test.ts` bunu
  denetliyor.
- **Testler ve e2e:** Anahtarlar tanımlı olmadığı için mevcut testler ve e2e
  etkilenmez. Turnstile yolu enjekte edilen sahte siteverify ile sınanıyor
  (`setBotCheckFetcher`, `setMailAdapter` kalıbında).

**Karar — temizlik (ürün sahibinin seçimi):**

- **Yedek:** `backup-before-bot-cleanup` (`br-patient-shape-b1fj8dsl`).
- **Bekleyen kayıtlar:** 14 Eylül 09:30'dan önce oluşmuş, kullanılmamış 22
  bekleyen kayıt silindi. Hesap değiller; şifre özeti ve doğum tarihi
  taşıyorlardı ve süresi dolan zaten `purge_unverified` ile siliniyordu.
  Kalan: 0.
- **`rhodesstate.edu` hesabı:** admin panelinin kendi "Kullanıcıyı sil" işlemiyle
  silindi. Silme, ürün sahibinin girişli tarayıcısından ve onayıyla yapıldı;
  gerekçe girildi.
  - Hesap anonimleştirildi (`invalid.local`), açık oturum yok.
  - `user.deleted_by_admin` denetim kaydı var (Neon'dan doğrulandı).

**Hukuk:** Yeni bir işleme amacı ve yeni bir hizmet (Turnstile) var; sağlayıcı
Cloudflare zaten metinde (R2). Aydınlatma metni aynı adımda güncellendi:

- **§2 İşlem güvenliği:** bot doğrulaması için tarayıcıdan toplanan teknik
  sinyaller.
- **§3:** yeni amaç satırı; dayanak (ç) KVKK m. 12 ve (f) meşru menfaat.
- **§4:** "Bot doğrulaması sırasında" toplama yöntemi.
- **§6.2:** Cloudflare satırına Turnstile, hizmet ve aktarılan veri (IP, tarayıcı
  sinyalleri).

**Hukukçu görüşü / teyit gerekiyor:**

- **Çerez:** Turnstile'ın tarayıcıda çerez ya da yerel depolama kullanıp
  kullanmadığı Cloudflare'in gizlilik belgelerinden doğrulanmadı. §5 çerez
  tablosuna bu yüzden bir şey yazılmadı; kullanıyorsa §5 güncellenmeli.
- **m. 9 standart sözleşmesi:** Cloudflare ile imzalanmış olmalı (D-105'te zaten
  açık).

**Canlıda çalışması için (ürün sahibi):**

1. Cloudflare → Turnstile → Add widget. Hostname `www.postscriptmag.com` (ve
   `postscriptmag.com`), mod "Managed".
2. Vercel → Environment Variables (Production): `TURNSTILE_SITE_KEY` ve
   `TURNSTILE_SECRET_KEY`.
3. Redeploy. Anahtarlar girilene kadar koruma kapalıdır.

**Doğrulama:**

- `tests/unit/turnstile.test.ts`:
  - anahtarlardan biri eksikse atlanır ve Cloudflare çağrılmaz;
  - onaylanan token secret ve IP ile gönderilip geçer;
  - boş veya 2048'den uzun token Cloudflare'e sorulmadan reddedilir;
  - reddedilen token ve başka eylem için çözülmüş token reddedilir;
  - Cloudflare'e ulaşılamazsa reddedilir.
- `tests/integration/bot-check.test.ts`, anahtarlar tanımlıyken:
  - token yoksa ya da Cloudflare reddederse bekleyen kayıt oluşmaz, e-posta
    gitmez;
  - onaylanınca kayıt eskisi gibi ilerler;
  - yeniden gönderme token'sız e-posta atmaz ve kayıt token'ını kabul etmez.
- `tests/unit/security-headers.test.ts`: CSP'de yalnızca Turnstile kökeni açık.
- typecheck + lint temiz, 47 dosya / 508 test.

---

---

## D-112 — Derginin kendi çerçevesi: `postscriptui` tasarımları ana sayfaya, okuma alanına, topluluğa ve Hakkında'ya uygulandı

**İstek (ürün sahibi):** "postscriptui şuanki kod yapısına göre bu dosyaya bakarak
tasarımı ve eksiklikleri yap."

**Kaynak:** `postscriptui/` klasöründe 10 Illustrator dosyası: üyeli ve üyesiz ana
sayfa, magazines, blog (profil), about, dm, anon box, bookmarks, notifications,
settings.

- Dosyalar PDF uyumlu. pdf.js ile görüntüye çevrildiler, gömülü görseller özgün
  çözünürlükte çıkarıldı. Renkler görüntüden ölçüldü.
- "contact, about, categories" dosyasının PDF katmanında yalnızca ilk çizim alanı
  (About) var. İletişim ve kategoriler tasarımı okunamadı; o sayfalar bu adımda
  tasarıma göre yeniden çizilmedi.
- Metin katmanı özel kodlamalı yazı tipleriyle. Metinler görüntüden okundu.
- Tasarım dosyaları depoya eklenmedi (461 MB'lık dosyalar var).

**Karar — çerçeve (`src/components/site-shell.tsx`):**

- **Kapsam:** Ana sayfa, `/hakkinda`, `/magazine/*` ve `/social/*` bu çerçevede.
  Admin, editör ve yazar panelleri `PanelShell`'de kalır; onlar çalışma aracı,
  dergi değil. `/account` da panel çerçevesinde kalır, çünkü rol menüsünü
  göstermek zorunda.
- **Parçalar:** koyu üst şerit, logo, ana menü ve arama kutusu, kâğıt renkli
  sütun, üye menüsü ve bordo alt bilgi.
  - Üye menüsü geniş ekranda (≥1640 px) tasarımdaki gibi sütunun solunda
    yüzer. Daha dar ekranda sütunun üstünde yatay bir şerittir.
- **Mevcut sayfalar da paleti alır:** Panelin Tailwind renk ve yazı tipi
  değişkenleri `.ps-site` içinde yeniden tanımlandı. `ui.tsx` ile yazılmış okuma
  ve topluluk sayfaları yeniden yazılmadan paleti alıyor.
- **Üst şerit:**
  - `PROFİL` (`/account`) ve `PANEL` D-086'daki gibi, aynı adlarla (e2e bunlara
    dayanıyor).
  - Eklenenler: "Ayarlar" (`/social/settings`), "Blog" (kullanıcı adı varsa kendi
    profili) ve "Çıkış".
  - Oturum yoksa "Giriş yap" ve "Hemen katıl" görünür.
- **Üye menüsü:** tasarımdaki beş kalem ve okunmamış sayıları (anonim kutu,
  mesajlar, bildirimler, kaydedilenler, ayarlar).
  - Altında ince bir satırda Akış, Keşfet ve Topluluklar var. Tasarımda yoklar;
    konmasalar bu sayfalara yalnızca adres yazarak ulaşılırdı.
  - Sayılar eskiden `social/layout.tsx`'teydi, artık çerçevede. Yasaklı hesaba
    menü çizilmez.
- **KVKK bandı (D-104):** `src/components/kvkk-notice.tsx`'e taşındı ve iki
  çerçevede de gösterilir.
- **Dil:** Tasarımdaki İngilizce etiketler çevrildi (tek dilli ürün, D-077).
  "The things left unsaid" logonun parçası olduğu için İngilizce bırakıldı.
- **Yazı tipleri:** Tasarımdakiler (Devinne Swash, West Swashy *Free Trial*,
  Minion, Araline) web yazı tipi olarak kullanılamaz; ticari ya da deneme
  lisansındalar.
  - Yerlerine Source Serif 4, Bodoni Moda ve Cormorant Garamond kondu
    (`src/lib/fonts.ts`). `next/font` bunları kendi sunucusundan verir;
    çalışma zamanında Google'a istek gitmez.
  - Logo yazı tipi ticari. Logo tasarım görüntüsünden alfa maskesine çevrildi
    (`src/assets/design/wordmark.png`) ve CSS ile boyanır; aynı dosya başlıkta
    mürekkep, alt bilgide kâğıt rengindedir.
- **Alt bilgi:**
  - Tasarımdaki help, faq, gossip ve subscription sayfaları yok (abonelik
    "yapılmayacaklar" listesinde). Yalnızca var olan sayfalara bağlantı verildi.
  - 5651 m. 3 bağlantıları korunuyor.
  - Sosyal medya ikonları kaldırıldı. Eski ana sayfa hepsini `#`'e bağlıyordu ve
    hesap adresleri bilinmiyor; adresler gelince eklenecek.
- **Arama (tasarımda vardı, çalışmıyordu):** Başlıktaki kutu `/magazine?q=`
  adresine GET yapar. Yayımlanmış yazıların başlık ve özetinde büyük-küçük harf
  duyarsız arar (`listRecentArticles`, `articleFilterSchema`).
  - Okurun yazdığı `%`, `_` ve `\` harfiyen alınır (`src/lib/search.ts`).
  - Okuma alanı oturum istediği için oturumsuz arama giriş ekranına gider.

**Karar — ana sayfa (`src/components/homepage.tsx`):**

- **Hero:** Son yayımlanmış sayıyı gösterir. Yayımlanmış sayı yoksa tasarımdaki
  Sayı 01 / Obsession / Bırakamadıklarımız görünür. Tasarımdaki "OBSESSSION"
  yazım hatası taşınmadı. Artık bir server component; tarayıcıya oturum bilgisi
  hiç gitmiyor.
- **Kategoriler:** Tasarımda "LATEST" başlıklı şerit aslında kategori kartları;
  başlık "Kategoriler" oldu.
  - Kartlar `writer_areas` tablosundan gelir (etkin olanlar, admin sırası).
  - Görsel alanın adındaki kelimeyle seçilir (`categoryImageKey`).
  - Kart `/magazine?kategori=<ad>` açar; `articles.category` ile tam eşleşme.
- **Sayının kitabı, eseri ve çalma listesi:** Veritabanında yerleri yok ve
  migration üretime elle uygulanmak zorunda (D-079). Şimdilik sayı numarasına
  göre `src/lib/issue-extras.ts`'te duruyorlar.
  - **Kitap metni (ürün sahibi teyit etmeli):** tasarımda sayfa kenarında kesik.
    Eksik kelimeler görünen parçalardan tamamlandı.
  - **Çalma listesi:** Yalnızca parça listesi; site ses çalmaz, lisansı yok.
    Tasarımdaki oynatıcı düğmeleri çalışmayacağı için konmadı. Beş satırlık yer
    tutucu yerine tek gerçek parça yazıldı.

**Karar — Hakkında (`/hakkinda`):** Herkese açık; oturum istemez.

- **Hikâyemiz:** tasarımdaki metin ve yaratıcılar.
- **Yazarlar:** en az bir yayımlanmış yazısı olan mahlaslar
  (`listPublicAuthors`). Yalnızca mahlas gösterilir, gerçek ad hiçbir koşulda
  gösterilmez (D-076).
- **Editörler, tasarım ve illüstrasyon:** Bunlar için veri yok. Kısa bir metin
  ve künye bağlantısı var.
- **"Join us" kartı:** Tasarım "yazar, editör ya da çizer" diyor. Sitede yalnızca
  yazar başvurusu olduğu için metin buna göre daraltıldı. Bağlantı `/account`'a,
  oturum yoksa `/register`'a gider.

**Görseller — lisans teyidi gerekiyor:**

- **Kolaj:** tasarımcının işi.
- **Wojciech Weiss, "Obsession" (1899):** Ressam 1950'de öldü; eser kamu malı.
- **Kategori fotoğrafları** (heykel, plazma küresi, kırmızı iplik, ayakkabı,
  plak ve gitar): tasarım dosyasından alındı, kaynakları ve lisansları bilinmiyor.
  - Stok fotoğraf izinsiz yayımlanırsa FSEK riski doğar. Tasarımcıdan kaynaklar
    istenmeli.
  - Teyit edilemeyen görsel `src/assets/design/` altında aynı adla
    değiştirilebilir; kod değişmez.

**Hukuk:** Yeni bir kişisel veri alanı, amaç ya da yurt dışı sağlayıcı yok.
Aydınlatma metni değişmedi.

- Arama sorgusu adres çubuğunda taşınır ve saklanmaz. Vercel'in istek
  günlükleri metindeki "Vercel Inc. — barındırma" satırının kapsamında.
- Yazı tipleri kendi sunucumuzdan verilir; Google'a IP aktarımı yok.

**Testler:**

- Birim: `tests/unit/site.test.ts` (menü eşleşmesi, üye menüsü, kategori görseli,
  sayı biçimi) ve `tests/unit/search.test.ts`.
- Entegrasyon: `tests/integration/public-reading.test.ts` (kategori, arama,
  joker karakter, taslak/silinmiş, bozuk filtre, yazar listesi).
- E2E: `01-registration`'daki "Kullanıcı" rozeti kontrolü `/account`'a taşındı,
  çünkü okuma alanında artık panel başlığı yok.

**Doğrulama:** typecheck ve lint temiz; 50 dosya / 525 test.

---

## D-113 — Topluluk ekranları tasarıma göre yeniden çizildi: bildirimler, kaydedilenler, ayarlar, anonim kutu, mesajlar, profil

**İstek:** D-112'nin devamı. `postscriptui` klasöründeki notifications,
bookmarks, settings, anon box, dm ve blog (profil) tasarımları.

**Karar:**

- **Bildirimler:**
  - Sekmeler: Tümü, Takipçiler, Beğeniler, Yanıtlar ve Dergi (`?tur=`).
  - Tasarımdaki "Mentions" sekmesinin kaynağı yok; bahsetme özelliği yok.
    Üyelerden gelmeyen her şey (editoryal akış, KVKK sürümü, moderasyon)
    "Dergi" altında toplanır (`src/lib/notification-view.ts`).
  - Başlıktaki `@kullanıcı` kalın yazılır; baş harfi kare içinde gösterilir.
  - Göreli zaman gösterilir ("5 dakika önce") ve okunmamışlar nokta ile
    işaretlenir.
- **Güvenlik düzeltmesi:** Bildirim bağlantısı eskiden yalnızca `/` ile
  başlıyor mu diye bakıyordu. `//site.com` ve `/\site.com` tarayıcıda başka bir
  siteye gider; bu yüzden artık reddedilir (`isSitePath`, birim testli).
- **Kaydedilenler:** Yazılar tasarımdaki kart panosunda gösterilir. Kapak alanı
  düz renk, çünkü görsel yükleme yok (D-089). Kaydedilen gönderiler altta
  listelenir.
- **Ayarlar:**
  - Tasarımdaki sol sekme sütunu var: Profil, Anonim kutu, Mesajlar, Gizlilik,
    Hesap.
  - Tüm bölümler tek sayfada durur ve sütun bölüme atlar. Bölümleri ayrı
    sayfalara bölmek bir formu kaydederken diğerlerini kaybettirirdi; e2e de
    üç formu aynı sayfada doldurur.
  - Tasarımdaki "Bildirimler" bölümü eklenmedi, çünkü bildirim tercihi yok.
    "İlgi alanları" etiketleri de eklenmedi: yeni bir kişisel veri alanı olur,
    istenmedi.
- **Anonim kutu:**
  - Gönderme sayfası tasarımdaki bant, geniş metin kutusu, alıntı ve büyük düğme
    düzenini alır. Gelen kutusu aynı bandı kullanır.
  - **Metin tasarımdan ayrılır:** Tasarımdaki not "yazılar dergide
    yayımlanacak" diyor. Buradaki kutu bir üyeye gider ve hiçbir şey
    yayımlanmaz; not fiili davranışı ve 5651 uyarısını anlatır. "Anonim değilsiniz"
    uyarısı formdan önce kalır (D-092).
  - Dergiye anonim gönderim ve yayımlama ayrı bir özellik olur. Hukukçu görüşü
    olmadan yapılmaz (yer sağlayıcıdan içerik sağlayıcılığa geçiş, kişilik hakkı
    riski).
- **Mesajlar:**
  - Üç sütun: konuşmalar, konuşma, karşı taraf.
  - Gün çipleri ve saat Istanbul saatine göre verilir; sunucu UTC'de çalışır.
  - Tasarımdaki "online" noktası, arama, dosya/medya ekleme ve emoji
    düğmeleri konmadı.
    - Çevrimiçi durumu kişinin gününe dair bir bilgi; okundu bilgisi de bu
      yüzden yok (D-091).
    - Mesajda ek yok.
  - Arama kutusu kullanıcı adıyla yeni konuşma açar. Telefonda konuşma açıkken
    liste gizlenir ve "← Mesajlar" bağlantısı görünür.
- **Profil ("blog"):**
  - Kapak, büyük baş harf dairesi, istatistikler ve geniş "Takip et" düğmesi.
    Sekmeler koyu blok.
  - **Yan sütun:**
    - "Öne çıkan gönderi": üyenin bu sayfadaki en çok beğenilen kendi
      gönderisi.
    - "Kategoriler": yayımlanmış yazı sayıları (`listCategoryCounts`).
    - Tasarımdaki "Son yorumlar" ve sayfalama konmadı; bunları besleyecek
      sorgu yok.
  - "Gönderi sayısı" da gösterilmez; profil servisi bu sayıyı hesaplamıyor.
- **Gönderi kartı:** simgeler ve sayılar. `ActionButton`'a `display` eklendi:
  düğme simge ve sayı gösterir, erişilebilir adı yine "Beğen (3)" olarak kalır.
  Ekran okuyucu ve e2e aynı adı görür. `PanelForm`'a `submitClassName` eklendi.
- **CSS:** Tasarım kuralları `site.css`'te Tailwind katmanlarının dışında
  duruyor ve bu sayede `ui.tsx` parçalarını yerinde yeniden biçimlendirebiliyor.
  D-112'deki genel `.ps-site a { color: inherit }` kuralı bu nedenle
  kaldırıldı: `text-accent` sınıfını eziyordu.

**Hukuk:** Yeni bir kişisel veri, amaç ya da sağlayıcı yok. Aydınlatma metni
değişmedi.

**Doğrulama:**

- typecheck ve lint temiz; 52 dosya / 534 test.
- **Yeni testler:**
  - Birim: `tests/unit/community-view.test.ts` (sekmeler, `@` ayrıştırma,
    `isSitePath`, göreli zaman, Istanbul saati).
  - Entegrasyon: `tests/integration/category-counts.test.ts`.
- **Tarayıcı:** 07d senaryosu seed'li bir deneme veritabanında çalıştırıldı:
  kullanıcı adı, anonim kutu, DM tercihi, gönderi, takip, beğeni, kaydetme,
  özel mesaj, anonim mesaj ve bildirimler. e2e'nin dayandığı tüm etiket ve
  düğme adları geçti; 1920 ve 390 px'de yatay taşma yok.

---

## D-114 — Sayılar sayfası "magazines" tasarımına göre; sayı sayfası aynı çerçevede

**İstek:** D-112 ve D-113'ün devamı, `postscriptui/magazines.ai`.

**Karar:**

- **`/magazine/issues`:**
  - Koyu bantta ince italik "SAYILAR" başlığı var. Altında "Yazılar, öyküler,
    söyleşiler ve dahası…", sağda tasarımdaki alıntının çevirisi ("Daha tuhaf
    bir dünya için daha iyi hikâyeler.") ve "Tüm sayıları keşfet!" düğmesi.
  - "Öne çıkan sayılar" başlığı yıldızlı çizgiyle ayrılır; sayılar ince çizgili
    bir ızgarada listelenir.
  - En yeni sayıda "Yeni!" yazar. Başlık "POSTSCRIPT: <sayı adı>" olarak, altında
    tema ve tarih gösterilir.
- **Kapak:** Tasarımda da boş, koyu blok. Kapak görseli yüklenmediği ve medya
  herkese açık değil, `/api/media` üzerinden yetkiyle verildiği için sayı
  numarası basılır.
- **Beğeni sayacı konmadı:** Tasarımda her sayının altında var, ama sayı beğenme
  özelliği yok ve sahte sayı gösterilmez.
- **`/magazine/issues/[number]`:** Aynı bant (sayı adı; sayı no, tema, tarih) ve
  çerçeveli "İçindekiler". Yayımlanmamış sayı okura yine 404 (değişmedi).

**Hukuk:** Değişiklik yok.

**Doğrulama:**

- typecheck ve lint temiz.
- Deneme sunucusunda 1920 ve 390 px ekran görüntüsü alındı; yatay taşma yok.
- Seed'deki sayı yayımlanmamış olduğu için ızgara boş hâliyle görüldü; dolu
  ızgara üretimde ilk yayımlanan sayıyla görülecek.

---

## D-115 — Tasarım görsellerinin lisansı teyit edildi; D-112..D-114 yayına alındı

**Ürün sahibi (2026-09-15):** "Telifsiz sitelerden alındı ya da tasarımcımız
yaptı, sen yayınla ben yine de sorarım." Sayının kitabı kartındaki tamamlanmış
metin de onaylandı.

**Karar:**

- D-112'deki "lisans teyidi gerekiyor" kaydı kapandı: kategori fotoğrafları
  telifsiz kaynaklardan ya da tasarımcının kendi işinden geliyor. Ürün sahibi
  tasarımcıya ayrıca soracak; kaynağı sorunlu çıkan görsel
  `src/assets/design/` altında aynı adla değiştirilir, kod değişmez.
- `src/lib/issue-extras.ts` içindeki Masumiyet Müzesi metni olduğu gibi kalıyor.
- Step 38, 39 ve 40 `main`'e push edildi.

**Üretim:** Bu üç adımda şema değişikliği ve migration yok; üretim defteri 31'de
kalıyor (D-079 gereği kontrol edildi).

---

## D-116 — Ekranlar tasarıma yaklaştırıldı; karşılığı olmayan bölümler görünür ama boş

**İstek (ürün sahibi):** "Tasarımsal olarak yaklaştır, kod tarafında boş kısımları
boş bırak, boş sekmeleri bildir ve tamamlayalım."

Tasarım ile site yan yana karşılaştırıldı (D-112..D-114 sonrası). Görsel farklar
kapatıldı. Tasarımda olup kodda karşılığı olmayan her bölüm yerinde çizildi ama
sahte veri göstermez: içi boş durum metniyle ya da "yakında" etiketli, devre dışı
bir düğmeyle bekler.

**Karar — görsel yaklaştırmalar:**

- **Çerçeve:**
  - Kâğıt sütun 1180 → 1320 px.
  - Üye menüsü tasarımdaki boyutta (≈19rem, büyük yazı ve simgeler). ≥1400 px'de
    sütunun solunda yüzer; oturumsuz sayfalarda sütun ortalı kalır.
- **Alt bilgi:** Tasarımdaki "arkadaş olalım!" satırı ve 5 yuvarlak sosyal medya
  simgesi eklendi.
- **Ana sayfa:** Kitap, eser ve çalma listesi tasarımdaki gibi kayan tek bir şeritte.
  - Geniş ekranda şerit sona kaydırılmış açılır; kitap kartı soldan taşar.
  - Çalma listesi tasarımdaki açık renkli retro çalar görünümünde: üst bar,
    parça listesi, kaydırma çubuğu, pikap, ileri/geri/çal düğmeleri ve ses
    kaydırıcısı.
- **Sayılar:** Yayımlanmış sayı yokken ızgara boş kapaklı üç "Yakında" kartıyla
  çizilir. Kartlarda sayısı olmayan kalp var.
- **Profil:**
  - Adın yanında yıldız, "Hakkında daha fazlası" bağlantısı.
  - İstatistikler tasarımdaki sırayla: gönderi, takipçi, takip.
  - Gönderi sayısı gerçek veri: `getProfile` artık `postCount` döndürüyor
    (üyenin kendi paylaştığı, silinmemiş, yanıt olmayan gönderiler).
  - Yan sütun tasarımdaki sırayla: Son yorumlar, Kategoriler, Öne çıkan gönderi.
- **Mesajlar:**
  - Büyük avatarlar ve satırlar.
  - Konuşma başlığında arama, bilgi (profile gider) ve "daha fazla" simgeleri.
  - Ek ve emoji düğmeli yuvarlak yazma kutusu, yuvarlak simge gönder düğmesi
    (erişilebilir adı "Gönder").
  - Sağ panelde "Paylaşılan medya" ve "Dosyalar" bölümleri.
- **Anonim kutu:**
  - Düğme tasarımdaki gibi "✦ Anonim olarak gönder →" (e2e bu ada güncellendi).
  - Tasarımdaki kapanış kutusu var; metni fiili davranışı anlatır (mesaj yalnızca
    alıcıya gider, yayımlanmaz).
  - "Anonim değilsiniz" uyarısı formdan önce kalır (D-092).
- **Kaydedilenler:** Boşken de pano çerçevesi çizilir.
- **Bildirimler:**
  - Sekmeler tasarımdaki gibi: Tümü, Takipçiler, Beğeniler, Yorumlar, Bahsetmeler.
  - Derginin kendi bildirimleri (editoryal, KVKK, moderasyon) yalnızca "Tümü"de
    görünür; ayrı "Dergi" sekmesi kalktı.
  - Sayfa tasarımdaki gibi boş çizgili satırlarla dolar.
- **Ayarlar:**
  - Tasarımdaki gibi her bölümün yanında sekme sütunu var: Profil, Gizlilik,
    Bildirimler, Mesajlar, Hesap. Kendi sekmesi yanar.
  - Yalnızca ilk sütun işaret noktası (landmark) ve klavyeyle odaklanabilir;
    ekran okuyucu aynı menüyü beş kez duymaz.
  - Profil satırları "Kullanıcı adı … Kaydet →", "Biyografi … Düzenle →",
    "İlgi alanları … Düzenle →" biçiminde.
  - Anonim kutu ve engellenenler "Gizlilik" altına taşındı.
- **Form yardımcıları:** `PanelForm`'a `submitContent` eklendi. Düğme simge
  gösterirken erişilebilir adı yine etiket olur.

**Boş bırakılanlar — tamamlanacak:**

| Nerede | Boş kalan | Tamamlamak için gereken |
|---|---|---|
| Alt bilgi | 5 sosyal medya simgesi bağlantı değil | Hesap adresleri (`SOCIAL_LINKS`, `src/lib/site.ts`) |
| Ana sayfa | Çalar düğmeleri (çal, ileri/geri, ses) devre dışı; listede 1 parça | Ses çalma kararı ve lisans; parça listesi |
| Sayılar | Kalp sayısız, "Yakında" kartları | Sayı beğenme özelliği; yayımlanmış sayı |
| Profil | "Son yorumlar" boş | Üyenin gönderilerine gelen yanıtları listeleyen sorgu |
| Profil | Gönderilerde görsel, avatar ve kapak yok; öne çıkan gönderide görsel yok | Görsel yükleme (depolama) |
| Profil | Sayfalama yok | Gönderi listesine sayfalama |
| Profil | Başkasının profilinde "Beğeniler" sekmesi yok | Bilerek: beğeniler yalnızca sahibine açık (D-090) |
| Mesajlar | Sesli arama ve "daha fazla" düğmeleri devre dışı | Özellik kararı |
| Mesajlar | Dosya ekleme ve emoji düğmeleri devre dışı | Mesaj eki / emoji seçici |
| Mesajlar | Paylaşılan medya ve dosyalar boş | Mesaj eki |
| Mesajlar | "Çevrimiçi" ve okundu tikleri yok | Bilerek yok (D-091, gizlilik) |
| Bildirimler | "Bahsetmeler" sekmesi boş | Gönderide @bahsetme özelliği |
| Ayarlar | "Bildirimler" bölümü boş | Bildirim tercihleri |
| Ayarlar | "İlgi alanları" boş, düzenle kapalı | Yeni kişisel veri alanı; aydınlatma metni güncellemesi |
| Anonim kutu | Dergiye anonim gönderim ve yayımlama | Hukukçu görüşü (yer sağlayıcı → içerik sağlayıcı) |
| Alt bilgi | help, faq, gossip sayfaları | İçerik (subscription "yapılmayacaklar"da) |
| İletişim, kategoriler | Tasarımları okunamadı | Çizim alanlarının ayrı dışa aktarımı |

**Hukuk:** Yeni kişisel veri yok. `postCount` zaten herkese açık gönderilerin
sayısı. Aydınlatma metni değişmedi.

---

## D-117 — Çalma listesi Spotify çalarıyla; çalar yalnızca okur "çal"a basınca yüklenir

**İstek (ürün sahibi):** "Çalma listesine şarkı koymamız gerekiyor, Spotify'dan
şarkı çekebilir miyiz?" Üç yol sunuldu:

1. Spotify çalarını gömmek.
2. Yalnızca "Spotify'da dinle" bağlantısı vermek.
3. Spotify API ile şarkı bilgilerini çekmek.

Ürün sahibi 1'i seçti.

**Neden ses sitede çalınmıyor:** Şarkıların sesini sitede barındırıp çalmak telif
ihlalidir. Spotify'ın gömülü çaları lisansı Spotify'ın sorumluluğunda tutar.
Spotify'a girişli dinleyici şarkının tamamını, girişsiz dinleyici önizlemesini
duyar.

**Karar:**

- **Veri:** Her sayının çalma listesi, Spotify paylaşım bağlantısıyla
  `src/lib/issue-extras.ts` içinde tutulur (`playlist.spotifyUrl`).
  - Sayı 01 için bağlantı henüz yok (`null`). Çalar tasarımdaki gibi çizilir ve
    "çok yakında" der; çal düğmesi kapalıdır.
  - D-112'deki elle yazılmış tek parçalık liste kalktı. Parça listesini artık
    Spotify çaları gösteriyor.
- **Bağlantı güvenliği:** `src/lib/spotify.ts` yalnızca `https://open.spotify.com`
  üzerindeki bir çalma listesini kabul eder. Çalar adresi yalnızca liste
  kimliğinden yeniden kurulur: veri dosyasına ne yapıştırılırsa yapıştırılsın,
  çerçeve başka bir sayfaya yönlendirilemez ve ek parametre taşımaz.
- **Tıklayınca yükleme (`src/components/spotify-player.tsx`):**
  - Sayfa açıldığında Spotify'a hiçbir istek gitmez. Düğmenin yanındaki not,
    basmadan önce ne olacağını söyler: çalar Spotify'dan yüklenir, Spotify IP
    adresini ve tarayıcı bilgisini alır, kendi çerezlerini kullanabilir. Notta
    KVKK sayfasına bağlantı var.
  - Düğmeye basılınca çerçeve yüklenir.
  - Gerekçe: Spotify'ın gömülü çaları zorunlu olmayan, üçüncü taraf çerezler
    koyar. Widget kullanım şartları sitenin bunu kullanıcıya bildirmesini
    ister. Bu tür çerezler rıza olmadan yüklenmemeli.
- **Spotify widget şartları:** Çalar değiştirilmeden ve üstü örtülmeden
  gösterilir. Otomatik çalma yok; `Permissions-Policy`'deki `autoplay=()`
  zaten engelliyor. Ticari kullanım yok; dergi kâr amacı gütmüyor. Spotify
  kullanıcılarının kişisel verisi toplanmaz.
- **CSP:** `frame-src`'ye yalnızca `https://open.spotify.com` eklendi.
  `script-src`, `connect-src` ve `default-src` değişmedi.
  `tests/unit/security-headers.test.ts` bunu denetliyor. Çerçevenin kendi
  içindeki yüklemeleri Spotify'ın politikasına tabidir.

**Hukuk — aydınlatma metni aynı adımda güncellendi**
(`data/kvkk-aydinlatma-metni.md`):

- **§2:** "Müzik çalar" satırı (IP adresi, tarayıcı bilgisi; veri doğrudan
  Spotify AB'ye gider).
- **§3:** Amaç satırı; dayanak açık rıza (KVKK m. 5/1). Rıza, düğmeye basarak
  ve basmadan önce okunan notla verilir.
- **§4:** "Müzik çaları açtığınızda" toplama yöntemi.
- **§5:** Çalar açılınca Spotify'ın kendi çerezleri.
- **§6.2:** Spotify AB, İsveç satırı.

**Canlıya almadan önce (ürün sahibi):**

1. Sayı 01 için Spotify'da dergi hesabından çalma listesi oluşturulur. Paylaşım
   bağlantısı `issue-extras.ts`'e yazılır; bu tek satırlık bir değişikliktir.
2. **Bağlantı eklenmeden önce** aydınlatma metninin yeni sürümü yönetim
   panelindeki "Sistem" sayfasından yayınlanır. Canlı metin veritabanındaki
   sürümden gelir; depodaki dosyayı güncellemek canlı metni değiştirmez. Metinde
   hâlâ `[AÇIK ADRES]` ve `[ÜLKE]` yer tutucuları var ve bunlar dolmadan yeni
   sürüm yayınlanmamalı.

**Hukukçu görüşü gerekiyor:**

- **Aktarım dayanağı:** Açık rızaya dayalı yurt dışı aktarım, KVKK m. 9'un 2024
  değişikliğinden sonra yalnızca arızi aktarımlarda kullanılabiliyor. Çaları
  açan okurun tarayıcısının doğrudan Spotify'a bağlanmasının bu kapsama girip
  girmediği teyit edilmeli.
- **Ortak veri sorumluluğu:** Gömülü içerikte veri toplamaya aracılık eden site
  de sorumlu sayılabilir. Sorumluluğun paylaşımına bakılmalı.

**Doğrulama:**

- typecheck ve lint temiz.
- Yeni birim testi: `tests/unit/spotify.test.ts`.
- Tarayıcıda geçici bir herkese açık çalma listesiyle denendi: çal düğmesine
  basmadan Spotify'a istek gitmedi. Düğmeden sonra çalar yüklendi; CSP ya da
  Permissions-Policy hatası çıkmadı. Test bağlantısı geri alındı.

---

## D-118 — Nesne depolama AB veri yerleşimi garantili R2 bucket'ına taşındı

**Neden:** KVKK metnindeki `[ÜLKE]` alanı için Cloudflare'e bakıldı. İki bucket
(`postscript`, `postscript-identity`) yalnızca "Eastern Europe (EEUR)" konum
ipucu taşıyordu. Cloudflare bu ipucunda ülke belirtmiyor ve konumu garanti
etmiyor; belgeye göre "Location Hints are a best effort and not a guarantee".
Yurt dışı aktarım bildiriminde ülke yazılamıyordu. Ürün sahibi önerilen taşımayı
onayladı.

**Karar ve yapılanlar (2026-09-15):**

- **Yeni bucket:** Cloudflare'de jurisdiction **European Union (EU)** ile aynı
  adla (`postscript`) yeni bir bucket açıldı. Cloudflare panelinde doğrulandı.
  Aynı ad seçildiği için `S3_BUCKET` değişmedi.
- **Anahtar:** Mevcut R2 API anahtarı (`pstscrpt`) "All buckets / Object Read &
  Write" olduğu için yeni bucket'a erişiyor; anahtar değişmedi.
- **Dosyalar:** Eski bucket'taki iki dosya Wrangler ile (ürün sahibinin OAuth
  girişi) aynı anahtarlarla kopyalandı:
  - `contracts/2026-09-07/b9fb9d93-….pdf` (34.805 B)
  - `writer-applications/2026-09-07/7366564e-….pdf` (29 B)
  - Kopyalar AB'den geri okunup SHA-256 ile karşılaştırıldı; ikisi de eşleşti.
  - Geçici yerel kopyalar silindi. Veritabanındaki `storage_key` değerleri
    değişmedi.
- **Vercel:** Ürün sahibi Production `S3_ENDPOINT` değerini
  `https://2f1f4e90eb9c1eb27997e13e9191aa63.eu.r2.cloudflarestorage.com` yaptı ve
  redeploy etti. Deploy listesinde redeploy'un değişken güncellemesinden sonra
  "Ready" olduğu görüldü.
- **Kopyalama sırasında bir hata:** İlk kopyalama denemesi Wrangler oturumu
  henüz açılmadan çalıştı ve hiçbir şey yazmadı. Betik, çıktıyı `tail`'e
  aktardığı için hatayı yakalamadı. AB bucket'ının boş kaldığı panelden
  doğrulandı. İkinci betik her adımın çıkış kodunu, boş dosyayı ve SHA-256
  eşleşmesini denetledi.

**Hukuk:** Aydınlatma metni §6.2'deki Cloudflare satırında ülke "Avrupa Birliği
(depolama)" olarak dolduruldu; satır AB veri yerleşimi garantisini belirtiyor.
Turnstile bot doğrulaması bu garantinin kapsamında değil; o veri Cloudflare'in
küresel ağında işlenir. Metinde doldurulmayı bekleyen yalnızca `[AÇIK ADRES]`
kaldı.

**Ürün sahibine kalanlar:**

1. Taşıma doğrulandığı için eski bucket (konumu "Automatic", EEUR) ve boş
   `postscript-identity` bucket'ı Cloudflare'den silinebilir. Kalıcı silme
   olduğu için bu işi ürün sahibi yapar.
2. `[AÇIK ADRES]` doldurulunca aydınlatma metninin yeni sürümü "Sistem"
   sayfasından yayınlanır. Bu sürüm Spotify satırlarını (D-117) ve AB
   depolamasını da içerir.

---

## D-119 — Ana sayfanın alt bölümünde çalma listesi sabit, sayının kartları kayar

**İstek (ürün sahibi):** "Tasarımdaki hatayı düzelt: altta sayının kitabı, resmi
vs. olan kısımda playlist sabit olacak, geri kalanı scroll olacak. Tasarımdaki
tüm kartları çek ve scroll yap."

**Sorun:** D-116'da kitap, eser ve çalma listesi aynı kayan şeritteydi. Şerit
sona kaydırılarak açıldığı için çalma listesi de şeridin bir parçası gibi
kayıyordu. Bazı genişliklerde kolonun kenarında kesik görünebiliyordu.

**Tasarım dosyasındaki kartlar:** "ana sayfa" dosyalarının PDF katmanı çizim
alanıyla kırpılı; alanın dışında hiçbir çizim yok (sol ve sağ bölgeler görüntüye
çevrildi, boş). Kart sayısı iki kanıtla belirlendi:

- **Metin katmanı:** Alt bölümde yalnızca iki kart etiketi var. Biri x≈0'da,
  soldan taşan "(BOOK OF) THE ISSUE"; diğeri "ARTWORK OF THE ISSUE". Sayfanın
  dışına yerleştirilmiş başka metin yok.
- **Gömülü görseller:** Dosyada kolaj, 5 kategori fotoğrafı ve Weiss tablosu var;
  başka bir kart görseli yok.

Yani tasarımdaki kayan kartlar kitap ve eserdir; ikisi de sitede. Tasarımcı daha
fazla kart çizdiyse, bunlar PDF katmanına aktarılmamış. Illustrator'da çizim
alanı dışında kalan kartlar ayrı dışa aktarılırsa eklenir.

**Karar:**

- Alt bölüm iki sütun: solda kayan kart şeridi (`RailEnd`, kitap ve eser), sağda
  sabit çalma listesi. Çalma listesi artık şeridin içinde değil.
  - Geniş ekranda şerit sona kaydırılmış açılır: eser tam görünür, kitap soldan
    taşar (tasarımdaki gibi). Okur geri kaydırabilir.
  - Çalma listesi sayfa kaydırılırken kendi sütununda yapışkan kalır
    (`position: sticky`).
- Telefonda (<1000 px) şerit üstte yatay kayar, çalma listesi altına iner.
- Şeridin kaydırma çubuğu ince ve bordo; kaydırılabildiği görünür.

**Hukuk:** Değişiklik yok.

**Doğrulama (D-119):**

- typecheck ve lint temiz; üretim derlemesi başarılı.
- **Yerel tarayıcı ölçümü:** Çalma listesi hiçbir genişlikte şeridin içinde
  değil; sayfada yatay taşma yok.

  | Genişlik | Kart şeridi | Çalma listesi |
  |---|---|---|
  | 1920 px | 848 px görünür / 1208 px içerik, sona kaydırılmış | 384 px, kolonun içinde tam |
  | 1280 px | 808 / 1208 px | 384 px, kolonun içinde tam |
  | 390 px | Üstte kayar (358 / 687 px) | Altta tam genişlik |

- **Canlıya alma:** b5e417e push'u için Vercel hiç deploy oluşturmadı; GitHub'a
  durum kaydı düşmedi, Vercel durum sayfasında da kesinti yoktu. Deploy bu
  kayıtla yeniden tetiklendi.

## D-120 — Tasarımın çizim alanı dışındaki kartları da şeride eklendi

**Durum:** D-119, "postscript ana sayfa kullanıcı olan.ai" dosyasında yalnızca iki
kart (kitap ve eser) olduğunu söylüyordu. Bu yanlıştı. O sonuç yalnızca PDF
katmanına bakılarak çıkarılmıştı ve PDF katmanı çizim alanıyla kırpılıyor.

Illustrator'ın kendi verisi (`AIPrivateData`, ZStandard ile sıkıştırılmış) çözüldü:

- **Gömülü görseller:** Çizim alanının solunda üç kart görseli daha var:
  - Masumiyet Müzesi kapağı (x≈−550)
  - *You* afişi (x≈−1440)
  - *Black Swan* afişi (x≈−2336)
- **Metin belgesi:** `AI11TextDocument`, satır başında tek `%` bulunan ASCII85
  kodlaması. Kart başlıkları ve metinleri buradan okundu:
  - MOVIE OF THE ISSUE: Black Swan (2010), Darren Aronofsky
  - SERIES OF THE ISSUE: You, Greg Berlanti & Sera Gamble
  - BOOK OF THE ISSUE: Masumiyet Müzesi (2008), Orhan Pamuk. Kitap metninin tam
    hâli de burada; D-115'te görünen parçalardan tamamlanan metnin yerini aldı.
  - ARTWORK OF THE ISSUE: Obsession (1899), Wojciech Weiss

**Karar:**

- `issue-extras.ts` artık `book`/`artwork` alanları yerine sıralı bir `cards`
  listesi tutuyor.
  - Sıra tasarımdaki gibi soldan sağa: film, dizi, kitap, eser.
  - Şerit geniş ekranda sona kaydırılmış açıldığı için okur önce eseri görür
    (tasarımdaki gibi), geri kaydırdıkça kitap, dizi ve filme ulaşır.
- Kart etiketleri Türkçe: Sayının filmi, Sayının dizisi, Sayının kitabı, Sayının eseri.
- Dikey görselli kartlar (afiş, kapak) 14rem'lik dar bir görsel sütunuyla
  (`extra-poster`), yatay tablo geniş kartla (`extra-art`) çizilir. Hangisinin
  kullanılacağı görselin boyutundan anlaşılır.
- Metinlerde iki düzeltme yapıldı:
  - Tasarım *You* için "2008" diyor. Dizi 2018'de yayına başladı; 2018 yazıldı.
  - Black Swan metnindeki çift nokta ("işler..") teke indi.
- Görseller tasarım dosyasındaki ham RGB verisinden çıkarıldı, 560 px genişliğe
  indirilip WebP olarak `src/assets/design/` altına kondu.

**Hukuk (hukukçu görüşü gerekiyor):**

- Kitap kapağı (YKY) ile *You* ve *Black Swan* afişleri telifsiz görsel değil.
  Hakları yayınevine ve yapımcılara ait.
- Sahip, tasarımdaki görsellerin yayınlanmasını istedi (D-115: "sen yayınla ben
  yine de sorarım"). Kartlar eseri tanıtan ve inceleyen metinlerle birlikte
  kullanılıyor.
- Bu kullanımın FSEK m. 35 (iktibas) kapsamında kalıp kalmadığı hukukçuya
  sorulmalı. Olumsuz görüş gelirse görsel kaldırılır ya da lisanslı bir
  görselle değiştirilir; kartın metni kalır.
- Kişisel veri değişikliği yok; KVKK metni değişmedi.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 539 test geçti.
- **Yerel tarayıcı ölçümü:** Çalma listesi hiçbir genişlikte şeridin içinde değil;
  sayfada yatay taşma yok.

  | Genişlik | Kart şeridi | Çalma listesi |
  |---|---|---|
  | 1920 px | 848 px görünür / 2760 px içerik, sona kaydırılmış | 384 px, sabit |
  | 1280 px | 808 / 2760 px | 384 px, sabit |
  | 390 px | Üstte kayar (358 / 1445 px) | Altta tam genişlik |

- Dört kartın görselleri yüklendi; başlık, etiket ve alt metinleri doğru.

## D-121 — Kart şeridi baştan açılır

**Durum:** D-116 ve D-119 kart şeridini geniş ekranda sona kaydırılmış açıyordu.
Böylece tasarımdaki görüntü taklit ediliyordu: eser tam görünür, önceki kart
soldan taşar. D-120 ile şeritte dört kart oldu. Okur ilk olarak "Sayının eseri"ni,
yani son kartı görüyordu. Ürün sahibi şeridin en baştan başlamasını istedi.

**Karar:**

- Şerit her genişlikte ilk karttan (Sayının filmi) başlar.
- Sona kaydıran `RailEnd` istemci bileşeni kaldırıldı. Şerit artık sunucuda
  çizilen düz bir kaydırma kutusu; ana sayfanın bu bölümü tarayıcıya JavaScript
  göndermiyor.
- Kutu `tabIndex={0}` ile odaklanabilir. Klavye kullanan okur, kenarın ötesindeki
  kartlara ok tuşlarıyla ulaşır.
- Kaydırma yakalaması kartın ortasına değil başına hizalanır (`scroll-snap-align:
  start`). Orta hizada ilk kart açılışta içeri çekilebiliyordu.

**Hukuk:** Değişiklik yok.

## D-122 — Her kategoriye tasarımdaki kendi fotoğrafı; kategori şeridi kart şeridi gibi kayar

**Durum:** Ana sayfadaki kategori şeridinde canlıda 11 yazı alanı var. Bunlar
tasarımdaki 5 görseli sırayla paylaşıyordu (D-112). Görseller PDF katmanından,
yani yalnızca çizim alanında görünen 5 karttan alınmıştı.

"postscript ana sayfa kullanıcı olan.ai" dosyasının Illustrator verisi çözüldü
(D-120 yöntemi). Kategori sırasında 11 fotoğraf var; 6'sı çizim alanının
sağında. Her fotoğrafın ardında kartın kırpma dikdörtgeni var (301 × 163 pt).

Etiketler fotoğraflardan eşlendi, soldan sağa. İlk beşi çizim alanındaki PDF
etiketleriyle doğrulandı:

| Sıra | Tasarım etiketi | Sitedeki alan | Fotoğraf |
|---|---|---|---|
| 1 | ART & LITERATURE | Sanat & Edebiyat | Oceanus heykeli |
| 2 | SCIENCE & TECHNOLOGY | Bilim & Teknoloji | Plazma küresi |
| 3 | PSYCHOLOGY & RELATIONSHIPS | Psikoloji & İlişkiler | Kırmızı iplikli eller |
| 4 | LIFESTYLE & FASHION | Lifestyle & Fashion | Kırmızı ayakkabılar |
| 5 | POP CULTURE | Pop Culture | Plak ve gitar |
| 6 | FILM, SERIES & BOOKS | Film, Dizi & Kitap | Açık kitap ve gül |
| 7 | SOCIOLOGY & THOUGHT | Sosyoloji & Düşünce | Büst, oyuncak araba, mum |
| 8 | SOCIAL & FEMINISM | Sosyal & Feminizm | "Yes, I am feminist" yazılı sırt |
| 9 | HISTORY & WORLD | Tarih & Dünya | Anıtkabir |
| 10 | AUTHOR'S CORNER | Yazar Köşesi: P.S. | Daktilo |
| 11 | ENTERTAINMENT & GOSSIP | Eğlence & Dedikodu | Dudak telefon |

**Karar:**

- **Fotoğraflar:** Her biri tasarımın ham görsel verisinden, kendi kırpma
  dikdörtgeniyle kesildi ve 640 × 347 WebP olarak `src/assets/design/category-*.webp`
  yazıldı.
  - Önceki 5 görsel de bu tam çözünürlüklü kesimlerle değiştirildi.
  - Tasarım Anıtkabir fotoğrafını kartına sığdırırken yatayda esnetmiş; çıktı
    kart oranına doldurulduğu için bu da tasarımdaki gibi.
- **Eşleme:** `categoryImageKey` 11 anahtar tanıyor. Ad hem Türkçe hem İngilizce
  kelimelerle eşleşir; "Lifestyle", "Pop Culture" gibi adlar canlıda İngilizce.
  - Türkçe küçük harfe çevirme İngilizce büyük "I"yı "ı" yapar; eşleşmeden önce
    "ı" → "i" çevrilir.
  - "Film, Dizi & Kitap" artık pop görselini değil kendi kitap fotoğrafını alır.
  - Hiçbir kelimeyle eşleşmeyen alan 11 fotoğrafı sırayla paylaşır.
- **Şerit** kart şeridine (D-119, D-121) benzetildi:
  - baştan açılır, JavaScript yok;
  - kaydırma yakalaması `proximity`, başa hizalı;
  - kaydırma çubuğu ince ve bordo.
  - Geniş ekranda tasarımdaki gibi dört kart ve beşincinin çoğu görünür.
- **Çerçeve oranı:** Fotoğraf çerçevesi 16:9 yerine tasarımdaki 301:163.
- **Sıra:** Alanların sırası koddan değil admin panelindeki sıra alanından gelir
  (`/admin/categories`). Canlı sıra tasarımdakinden farklı, ama üretim verisine
  dokunulmadı. Tasarımdaki sıra istenirse tablodaki sırayla oradan ayarlanır.

**Hukuk:** Fotoğraflar ürün sahibinin telifsiz sitelerden aldığını belirttiği
görseller (D-115). Görsel dosya adları Unsplash ve Pexels'i gösteriyor.
Oceanus heykeli (İstanbul Arkeoloji Müzesi) fotoğrafının dosya adı
Wikimedia Commons adlandırmasına benziyor; kaynağı ve lisansı doğrulanmalı. Kişisel veri değişikliği yok.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 540 test geçti.
- **Yerel tarayıcı ölçümü:** 11 alanın her biri farklı ve doğru fotoğrafı alıyor;
  şerit baştan açık, yakalama başa hizalı, kaydırma çubuğu ince ve bordo; sayfada
  yatay taşma yok.

  | Genişlik | Görünür / içerik | Fotoğraf çerçevesi |
  |---|---|---|
  | 1920 px | 1256 / 2877 px | 234 × 127 |
  | 1280 px | 1216 / 2786 px | 226 × 122 |
  | 390 px | 358 / 2592 px | 208 × 113 |

## D-123 — Sayfa sütunu ortada, üye menüsü yanında

**Durum:** Geniş ekranda (≥1400 px) giriş yapmış okurun çerçevesi üç sütunlu bir
ızgaraydı (D-116): solda en az 16rem, ortada en çok 1320 px, sağda en az 0.

1536 px'lik bir ekranda sağ sütun sıfıra indi. Sayfa sütunu sağa itildi
(256–1521 px), üye menüsü sol kenara yapışıp bütün sol boşluğu kapladı. Üst şerit
ve alt bilgi ortalı kaldığı için sütunla da hizasızdı.

"postscript ana sayfa kullanıcı olan.ai" tasarımında ise sütun sayfanın ortasında.
Menü sol boşlukta, sütunun hemen yanında duruyor; iki yanında da boşluk var.
Ürün sahibi siteyi tasarımdaki gibi ortalamayı, menünün her yeri kaplamamasını
istedi.

**Karar (yalnızca menülü düzen, ≥1400 px):**

- **Izgara:** İki yan sütun eşit: `minmax(var(--member-rail), 1fr)`. Böylece
  sütun her genişlikte tam ortada kalır.
  - `--member-rail` genişliğin %17'si, en az 15rem, en çok 21rem.
- **Menü:** Yan sütunun sağına yaslanır.
  - Sütunla arasında `--member-gap`, sol kenarla arasında `--member-edge` boşluk
    kalır.
  - Genişliği en çok 19rem.
  - Yazı, ikon ve iç boşluklar ekran genişliğiyle ölçeklenir; hiçbir etiket
    kesilmez.
- **Başlık:** Sütun dizüstü ekranda ~920–1015 px'e daraldığı için logo, menü ve
  arama biraz küçültüldü. Başlık tasarımdaki gibi tek satırda kalır; menülü düzen
  dışında başlık aynı.
- **Dokunulmayanlar:** 1400 px altındaki düzen (menü sütunun üstünde yatay şerit)
  ve oturumu olmayan sayfalar değişmedi.

**Hukuk:** Değişiklik yok.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 540 test geçti.
- **Yerel tarayıcı ölçümü:** Demo okur hesabıyla, ana sayfada. Beş genişlikte de
  menü sütuna binmiyor, başlık tek satır, başlık menüsü ve üye menüsünde kesilme
  yok, sayfada yatay taşma yok.

  | Genişlik | Sütun | Ortadan sapma | Menü | Menü–sütun arası |
  |---|---|---|---|---|
  | 1400 px | 240–1160 | 0 | 21–229 | 11 px |
  | 1440 px | 245–1195 | 0 | 22–233 | 12 px |
  | 1536 px | 261–1275 | 0 | 23–249 | 12 px |
  | 1920 px | 326–1594 | 0 | 29–311 | 15 px |
  | 2560 px | 620–1940 (1320) | 0 | 322–604 | 16 px |

- **1400 px düzeltmesi:** İlk ölçümde başlık menüsü 13 px sığmıyordu. Logo
  genişliği 16vw'den 15vw'ye indirilince sığdı.

## D-124 — Sayının kartları şeritte birer birer görünür

**Durum:** Ana sayfadaki kart şeridinde (film, dizi, kitap, eser; D-120) kartlar
sabit genişlikteydi: afiş kartı en çok 40rem, tablo kartı 48rem. İlk görünümde
bir kart tam, bir sonrakinin bir parçası görünüyordu. Kaydırma yakalaması
`proximity` olduğu için şerit iki kartın arasında da durabiliyordu. Ürün sahibi
ilk görünümde tek kart görünmesini istedi.

**Karar:**

- Şeritteki her kart şeridin tam genişliğini kaplar (`grid-auto-columns: 100%`,
  kart `width: 100%`). İlk görünümde yalnızca Sayının filmi görünür.
- Kaydırma yakalaması `mandatory`, kart başına hizalı ve `scroll-snap-stop:
  always`. Kaydırma ya da parmakla sürükleme her zaman tek bir karta oturur, bir
  hamlede kart atlanmaz.
- Kartlar arasındaki boşluk (1.5rem) kaldı; sonraki kart görünür alanın
  dışında başlar.
- Çalma listesi ve sabit düzen (D-119) değişmedi.

**Hukuk:** Değişiklik yok.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 540 test geçti.
- **Yerel tarayıcı ölçümü:** Üç genişlikte de ilk görünümde tek kart tam görünüyor;
  kart metni taşmıyor, sayfada yatay taşma yok. Yarım kart genişliğinden fazla
  kaydırılınca şerit tam olarak ikinci karta (Sayının dizisi) oturuyor.

  | Genişlik | Şerit | İlk görünüm | Kaydırma sonrası |
  |---|---|---|---|
  | 1920 px | 848 px | Sayının filmi 848/848 | Sayının dizisi 848/848 |
  | 1000 px | 615 px | Sayının filmi 615/615 | Sayının dizisi 615/615 |
  | 390 px | 358 px | Sayının filmi 358/358 | Sayının dizisi 358/358 |

  1000 px'deki şerit genişliği, 1536 px ekranda üye düzenindeki şeride (D-123)
  yakın.

## D-125 — Sayı 01 çalma listesi bağlantısı hazır, yayını KVKK sürümüne bağlı

**Durum:** Ürün sahibi dergi hesabındaki çalma listesinin paylaşım bağlantısını
verdi (`https://open.spotify.com/playlist/5dLgq2RgLa3kR2Gag6EmFS`, izleme
parametreleriyle).

D-117'nin canlıya alma koşulu: bağlantı eklenmeden önce aydınlatma metninin
Spotify'ı anlatan yeni sürümü yönetim panelinden yayınlanmalı. Canlıdaki metin
hâlâ 6 Eylül 2026 tarihli 1. sürüm ve Spotify'dan söz etmiyor.

Depodaki metinde (`data/kvkk-aydinlatma-metni.md`) tebligat adresi yerinde hâlâ
`[AÇIK ADRES]` yer tutucusu var; yer tutucu dolmadan yeni sürüm yayınlanamaz.

**Karar:**

- Bağlantı `issue-extras.ts`'e yazıldı. Değişiklik `main`'e değil
  `spotify-playlist-issue-01` dalına commit'lendi; push edilmedi.
  - `main`'e push canlıya yayın demek. Çalar açılırsa okurun IP ve tarayıcı
    bilgisi Spotify'a (İsveç) gider, ama canlı metin bunu anlatmıyor.
  - Bu, D-083'teki "metin koddan geri kaldı" durumunun tekrarı olurdu.
- Bağlantı çözümleyiciden geçiyor. Çalar adresi yalnızca kimlikten yeniden
  kuruluyor, izleme parametreleri atılıyor. Paylaşılan bağlantının kendisiyle
  bir birim testi eklendi.

**Canlıya alma sırası:**

1. Tebligat adresi `data/kvkk-aydinlatma-metni.md`'ye yazılır.
2. Metnin yeni sürümü yönetim panelindeki "Sistem" sayfasından yayınlanır.
3. Dal `main`'e alınır ve push edilir.

**Hukuk:** D-117'deki hukukçu soruları (m. 9 aktarım dayanağı, ortak veri
sorumluluğu) hâlâ açık.

**Ürün sahibinin yayın kararı (2026-09-15):**

- **Sıra değişti:** Ürün sahibi, tebligat adresini sonra vereceğini belirterek
  bağlantının hemen yayına alınmasını istedi. Yukarıdaki sıra bu yüzden
  uygulanmadı; dal `main`'e alındı ve push edildi.
- **Canlı metin geride:** Yayındaki aydınlatma metni hâlâ 1. sürüm (6 Eylül 2026)
  ve Spotify'dan söz etmiyor. İlk kurulumdan kalma kısa metin olduğu için Cloudflare,
  Resend, Vercel ve Neon'u da anlatmıyor. Depodaki tam metin yayınlanmadı.
- **Çaların hâlâ yaptığı:** Oyna düğmesine basmadan Spotify'a hiçbir istek
  gitmiyor. Düğmenin yanındaki not, basınca Spotify'ın IP ve tarayıcı bilgisini
  alacağını ve kendi çerezlerini kullanabileceğini söylüyor (D-117). Notun
  "Ayrıntılar" bağlantısı ise şu an Spotify'ı anlatmayan metne gidiyor.
- **Kapanış koşulu:** Adres gelince md'ye yazılır ve tam metin yeni sürüm olarak
  yayınlanır; o zaman aradaki fark kapanır. Hukukçu soruları (D-117) açık.

## D-126 — Çalma listesi çalarken plak döner

**Durum:** Ana sayfadaki çalma listesinde (D-117) çal düğmesine basılınca
Spotify çaları bütün çerçeveyi kaplıyordu; tasarımdaki plak çalar kayboluyordu.
Ürün sahibi, çalma listesi başladığında plağın plak çalarda dönmesini istedi.

**İnceleme:** Spotify'ın resmî iframe API betiği
(`open.spotify.com/embed/iframe-api/v1`) çalarla yalnızca `postMessage` ile
konuşuyor:

- Çalar yüklenince `{ type: "ready" }` gönderiyor. API bu mesaja
  `{ command: "load_complete_ack" }` ile cevap veriyor.
- Çalma başlayınca, duraklayınca ya da ilerleyince
  `{ type: "playback_update", payload: { isPaused, isBuffering, position, duration } }`
  gönderiyor.
- API iframe'e `allow="autoplay; …"` izni veriyor. Canlı sitede Chrome ile
  yapılan denemede bu izin olmadan çalma başlamadı. İzin verilince `playback_update`
  mesajları geldi, `pause` komutu da çaları durdurdu.

**Karar:**

- **Betik eklenmedi:** Spotify'ın API betiği sayfaya yüklenmedi; sitenin kendi
  kökeninde üçüncü taraf kod çalışmaz. CSP değişmedi.
  - Bileşen mesajları kendisi dinliyor.
  - Yalnızca `https://open.spotify.com` kökeninden ve kendi açtığı iframe'in
    penceresinden gelen mesajları kabul ediyor.
  - Cevabı da yalnızca o kökene gönderiyor.
- **Mesaj okuma:** Tek yerde, `readEmbedMessage` (`src/lib/spotify.ts`) içinde.
  Bozuk ya da bilinmeyen mesajlar yok sayılır; birim testi eklendi.
- **Açık çalar:** Çalar açıldığında plak çalar çaların altında görünür kalır.
  - `isPaused: false` iken plak döner (1.8 sn'de bir tur) ve kol plağa iner.
  - Duraklatınca plak durur.
- **Dönüşün görünmesi:** Plağın oyukları her açıda aynı görünür. Dönüşü göstermek
  için plağa hafif bir parlama, etiketine bir nokta eklendi.
- **Hareketi azaltma:** `prefers-reduced-motion` açık olan okurda plak dönmez,
  kol hareket etmez.
- **İzin:** Iframe'in `allow` listesine `autoplay` eklendi. Çalar yine yalnızca
  okur çal düğmesine bastıktan sonra yükleniyor.

**Hukuk:** Yeni kişisel veri yok. Çalarla sayfa arasındaki mesajlar okurun
tarayıcısında kalıyor, sunucuya gitmiyor. Spotify'ın aldığı veri D-117'dekiyle
aynı; aydınlatma metni değişmedi.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 543 test geçti (`tests/unit/spotify.test.ts` 7).
- **Yerel Chrome denemesi (gerçek çalma):**

  | Durum | Plak |
  |---|---|
  | Çalar kapalı | Dönmüyor |
  | Çalar açık, çalmıyor | Dönmüyor |
  | Çalıyor | `ps-record-spin` animasyonu çalışıyor; 400 ms arayla açısı değişti |
  | Duraklatıldı | Durdu |

  CSP hatası yok.

## D-127 — Çalma listesi açılınca plak plak çalara yerleşir

**Durum:** D-126 ile plak, çalma listesi çalarken dönmeye başladı. Ama plak çalarla
yan yana dönüyordu. Ürün sahibi, çalma listesi açılınca plağın plak çalara
yerleşmesini, çalma başlayınca da orada dönmesini istedi.

**Karar:**

- **Çalar kapalıyken:** Plak eskisi gibi plak çaların yanında durur.
- **Çalar açılınca:** Plak 0.9 sn'de kayarak plak çaların tablasına yerleşir. Biraz
  küçülür (%84) ve çerçevenin içine tam ortalanır.
  - Kaydırma mesafesi bir plak çalar genişliği artı aradaki boşluk
    (`--record-shift`).
  - Yerleşme, bileşen açıldıktan hemen sonra `is-seated` sınıfıyla tetiklenir.
    Böylece plak önce yanda çizilir ve hareketi görünür.
- **Çalma başlayınca:** Plak tablada döner (D-126), kol plağın üstüne iner.
- **Dönme ve yerleşme ayrı özellikler:** Yerleşme CSS'in ayrı `translate` ve
  `scale` özellikleriyle, dönme `transform` animasyonuyla yapılır. İkisi birbirini
  ezmez; plak dönerken yerinden oynamaz.
- **Kol:** Kol ve pimi plağın üstünde çizilir (`z-index`).
- **Hareketi azaltma:** `prefers-reduced-motion` açık olan okurda plak kaymadan
  yerine geçer, dönmez (D-126).

**Hukuk:** Değişiklik yok; yalnızca görünüm.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 543 test geçti.
- **Yerel tarayıcı ölçümü (1440 px):**

  | Durum | Plak merkezi (plak çalara göre) | Plak çerçevenin içinde |
  |---|---|---|
  | Çalar kapalı | 107 px sağda | Hayır |
  | Açıldıktan 250 ms sonra (kayarken) | 31 px sağda | Hayır |
  | Açıldıktan 2.75 sn sonra | 0, 0 | Evet |

- **Dönme ve yerleşme birlikte:** Dönme sınıfı yalnızca testte elle eklendi. 450 ms
  arayla açı değişti, merkez 0,0'da kaldı. Kol plağın üstündeydi ve plağa indi.
- **Spotify ile gerçek çalma:** Mesajlar geldi ("ready", çalıyor, sonra
  duraklatıldı). Ancak art arda yapılan denemelerden sonra Spotify, oturum
  açmamış dinleyiciye "Spotify'ı edinin" penceresi gösterip önizlemeyi kendisi
  durdurdu. Bu yüzden çalma sırasındaki dönme bu adımda Spotify'la yeniden
  ölçülemedi.
  - Mesajdan plağa giden yol D-126'dan beri değişmedi ve orada gerçek çalmayla
    doğrulanmıştı.

## D-128 — Alt bilgide LinkedIn yerine Spotify

**Durum:** Alt bilgideki "arkadaş olalım!" satırında tasarımdaki beş sosyal medya
ikonu var: X, TikTok, LinkedIn, Instagram, Pinterest (D-116). Hiçbirinin adresi
bilinmediği için hepsi bağlantısız çiziliyordu. Ürün sahibi LinkedIn'in yerine
Spotify'ı istedi. Derginin Spotify hesabı açık ve Sayı 01 çalma listesinin
sahibi (D-125).

**Karar:**

- `SocialKey` içinde `linkedin` yerine `spotify` geldi; sırası aynı kaldı (üçüncü).
- **Adres:** Spotify ikonu hesabın profiline gerçek bir bağlantı:
  `https://open.spotify.com/user/31ni3zrhtxradpywcotdp4jr6k2y`.
  - Adres çalma listesinin kendi sayfasındaki sahip bağlantısından alındı.
  - Diğer ikonlar gibi yeni sekmede açılır (`target="_blank"`,
    `rel="noopener noreferrer"`).
- **İkon:** Simple Icons'ın Spotify işareti (CC0), diğer ikonlarla aynı 24 × 24
  ızgarada.
- X, TikTok, Instagram ve Pinterest adresleri hâlâ bilinmiyor; bağlantısız
  kaldılar.

**Hukuk:** Düz bir dış bağlantı: tıklanana kadar Spotify'a hiçbir istek gitmez,
tıklayınca okur Spotify'ın kendi sitesine geçer. Aydınlatma metni değişmedi.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 544 test geçti.
- **Yerel tarayıcı:** Alt bilgide LinkedIn geçmiyor. Spotify, dergi hesabına giden
  ve yeni sekmede açılan bir bağlantı; ikonu çiziliyor. Diğer dört ikon
  "hesabı yakında" etiketiyle bağlantısız.

## D-129 — Çalma listesi başlığındaki çarpı çaları kapatır, hoparlör sesi kapatıp açar

**Durum:** Çalma listesinin başlık çubuğundaki hoparlör ve çarpı ikonları süstü
(D-112); ana sayfa onları sunucuda çiziyordu. Ürün sahibi iki şey istedi:

- Çarpıya basınca Spotify görünümünden çıkılsın.
- Hoparlöre basınca ses kapanıp açılsın. Ses kapalıyken ikon, çalma listesinin
  üstündeki çarpılı hoparlör gibi görünsün.

**Kısıt:** Spotify'ın gömülü çaları sayfadan ses komutu almıyor. Resmî iframe
API'sinin komutları: `play`, `play_from_start`, `pause`, `resume`, `toggle`,
`seek`. Ses ya da sessiz komutu yok. Farklı kökenden bir iframe'in sesini sayfa
kendisi de kısamaz.

**Karar:**

- **Başlık çubuğu çalar bileşeninde:** Ana sayfa yalnızca başlığın metnini
  (`heading`) ve kimliğini (`headingId`) veriyor. Makale adını hâlâ bu başlıktan
  alıyor (`aria-labelledby="player-title"`).
- **Çarpı ("Spotify çalarını kapat"):** Spotify çalarını kaldırır, tasarımdaki
  çizili çalar geri gelir. Çalma durur, plak plak çaların yanına döner.
  - Klavye odağı kaybolmasın diye "Spotify çalarını aç" düğmesine taşınır.
  - Çalar kapalıyken düğme pasif.
- **Hoparlör ("Sesi kapat", `aria-pressed`):** Sesi kapatmak çalmayı duraklatır
  (`pause`), sesi açmak kaldığı yerden sürdürür (`resume`).
  - Ses kapalıyken ikon çarpılı hoparlöre (`VolumeX`) döner.
  - Duraklayınca plak da durur, çünkü müzik gerçekten çalmıyor.
  - Okur Spotify çalarında çal'a basarsa ses kapalı durumu kendiliğinden kalkar.
  - Düğme yalnızca çalar hazırken ve çalma sürerken ya da ses kapalıyken etkin.
- **Görünüm:** Düğmelere üzerine gelme ve klavye odağı stili eklendi. Pasif hâlde
  soluk çizilirler.

**Hukuk:** Değişiklik yok. Komutlar tarayıcıda Spotify çalarına gidiyor, sunucuya
bir şey gitmiyor.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 544 test geçti.
- **Yerel Chrome denemesi (gerçek çalma):**

  | Durum | Hoparlör | Çarpı | Spotify çaları | Plak |
  |---|---|---|---|---|
  | Çalar kapalı | Pasif | Pasif | Yok | Yanda |
  | Açık, çalmıyor | Pasif | Etkin | Var | Tablada |
  | Çalıyor | Etkin, açık ikon | Etkin | Var | Dönüyor |
  | Hoparlöre basıldı | Basılı, çarpılı ikon | Etkin | Var ("paused" geldi) | Durdu |
  | Tekrar basıldı | Açık ikon | Etkin | Var ("playing" geldi) | Dönüyor |
  | Çarpıya basıldı | Pasif | Pasif | Kaldırıldı | Yanda |

  Çarpıdan sonra odak "Spotify çalarını aç" düğmesinde.

## D-130 — Çalma listesinin üstündeki çarpılı hoparlör kaldırıldı

**Durum:** Tasarımda çalma listesi çerçevesinin üstünde, sağda süs amaçlı bir
çarpılı hoparlör ikonu vardı (D-112). D-129 ile başlık çubuğundaki hoparlör
gerçek bir sesi kapat/aç düğmesi oldu; ses kapalıyken o da çarpılı hoparlöre
dönüyor. Üstteki ikon bir işe yaramıyordu ve düğmeyle karışabiliyordu. Ürün
sahibi kaldırılmasını istedi.

**Karar:**

- `homepage.tsx`'teki `player-top` kutusu ve ondan kalan `VolumeX` içe aktarımı
  silindi.
- `site.css`'teki `.player-top` kuralları kaldırıldı.
- Sesin durumunu artık yalnızca başlık çubuğundaki düğme gösteriyor.

**Hukuk:** Değişiklik yok; yalnızca görünüm.

## D-131 — Kapalı çalarda çalma listesinin adı ve ilk üç şarkısı

**Durum:** Çalar kapalıyken çalma listesi alanında Spotify'ın ne alacağını
anlatan uzun bir not duruyordu (D-117). Ürün sahibi bunun yerine çalma listesinin
adının ve ilk üç şarkısının yazmasını istedi.

**Karar:**

- **Veri:** `issue-extras.ts`'teki çalma listesine `name` ve `tracks` (şarkı adı,
  sanatçı, süre) eklendi.
  - Bilgiler 2026-09-16'da Spotify'ın gömülü çalar sayfasındaki listeden okundu.
  - Liste değişince elle güncellenir.
  - Kapalı çalar bunları Spotify'a sormadan gösterir; ana sayfa açılırken Spotify'a
    yine hiçbir istek gitmez.
- **Görünüm:** Liste adı büyük harfle, şarkılar tasarımdaki satır düzeniyle (sıra no,
  ad ve sanatçı, süre) gösterilir. Yalnızca ilk üç şarkı listelenir.
- **Şu anki liste:** Listede iki şarkı var (Every Breath You Take – The Police,
  Hysteria – Muse); ikisi de görünüyor.

**Hukuk:** Kişisel veri yok. Notun yerini D-132 düzenledi.

## D-132 — Çalma listesini yalnızca üyeler açabilir; kapalı çalarda KVKK notu yok

**Durum:** Ürün sahibi, çalarda KVKK bilgilendirmesi gösterilmemesini istedi.
Onun yerine üye olmayan biri çaları hiç açamasın: üyeler kayıt olurken aydınlatma
metnini onaylamış oluyor.

**Karar:**

- **Kim açabilir:** Ana sayfa, okurun giriş yapmış ve yasaklı olmayan bir üye olup
  olmadığını `HomePage`'e iletir (`member`). Yasaklılar üye menüsünü de görmüyor.
- **Ziyaretçi:** Çaların Spotify adresi sunucuda hiç verilmez (`embedUrl: null`,
  `locked`).
  - Ziyaretçi şarkı listesini ve "Dinlemek için giriş yap" bağlantısını görür.
  - Çal düğmesi pasif, etiketi "Çalmak için giriş yapın".
  - Tarayıcı araçlarıyla bile açabileceği bir adres sayfada yok.
- **Üye:** Kapalı çalarda KVKK notu gösterilmez. Çalar, eskisi gibi yalnızca çal'a
  basınca yüklenir.
- **Aydınlatma metni:** Spotify satırları (§2, §3, §4, çerezler, §6.2) "yalnızca üye
  olarak giriş yapmışken" diye güncellendi.

**Hukuk — hukukçu görüşü gerekiyor:**

- **Rıza dayanağı:** D-117'de çalar için dayanak açık rızaydı. Rıza, çal'a basmadan
  önce okunan notla bilgilendirilmiş sayılıyordu. Not kaldırıldı; artık okura
  basmadan önce ne olacağı söylenmiyor.
  - Üyenin kayıtta aydınlatma metnini onaylaması aydınlatma yükümlülüğünü
    karşılayabilir. Belirli bir işleme verilmiş açık rıza sayılıp sayılmayacağı
    belirsiz.
- **Onaylanan sürüm:** Üyelerin kayıtta onayladığı canlı metin 1. sürüm ve Spotify'ı
  içermiyor (D-125).
  - Tam metin yeni sürüm olarak yayınlanınca `KvkkNotice` bandı üyelerden yeni
    metni okuduklarını onaylamalarını ister (D-104).
  - O zamana kadar üyeler Spotify'ı anlatmayan bir metni onaylamış durumda.
- Ürün sahibinin açık talebiyle uygulandı; muhafazakâr kısmı ziyaretçiye çaların hiç
  verilmemesi.

## D-133 — İmzada yalnızca "Elif Yaren Çekiç" bağlantı

**Durum:** Dergi alt bilgisinde, panellerde, yasal sayfalarda ve giriş
sayfalarında imza satırının tamamı ("Designed by Elif Yaren Çekiç & Tuanna
Demir") web sitesi bağlantısıydı. Ürün sahibi yalnızca "Elif Yaren Çekiç"
yazısına basınca web sitesine gidilmesini, satırın geri kalanının bağlantı
olmamasını istedi.

**Karar:**

- Dört yerde ("site-shell", "legal", "shell", giriş düzeni) satır düz metin oldu.
  İçindeki yalnızca "Elif Yaren Çekiç" `https://www.elifyarencekic.com/`
  bağlantısı; bağlantı yeni sekmede açılır (`noopener noreferrer`).
- Satır tek bir `span` içinde duruyor; yan yana dizilen alt bilgilerde kelimeler
  ayrı parçalara bölünmüyor.
- Ürün sahibinin genel yönergesi imza bağlantısının metnini "Designed by Elif Yaren
  Çekiç" olarak tarif ediyordu. Bu adımda ürün sahibinin açık talebi uygulandı.

**Hukuk:** Değişiklik yok.

**Doğrulama:** Yerel ana sayfada imza metni "Designed by Elif Yaren Çekiç & Tuanna
Demir"; içindeki tek bağlantı "Elif Yaren Çekiç", yeni sekmede açılıyor.
typecheck ve lint temiz; 53 dosyada 545 test geçti.

## D-134 — Tüm kategoriler için ayrı sayfa

**Durum:** Üst menüdeki "Kategoriler" bağlantısı ana sayfadaki kategori şeridine
kayıyordu (`/#kategoriler`). Ürün sahibi, bağlantının tüm kategorilerin
gösterildiği ayrı bir sayfa açmasını istedi.

**Karar:**

- **Yeni sayfa `/kategoriler`:** Etkin yazı alanlarının hepsi, admin panelindeki
  sırayla (D-122) bir ızgarada gösterilir.
  - Her kartta tasarımdaki fotoğraf, alan adı ve yayımlanmış yazı sayısı var ("n yazı"
    ya da "Henüz yazı yok").
  - Kart, alanın yazılarına (`/magazine?kategori=…`) gider.
- **Erişim:** Sayfa ana sayfa gibi herkese açık; kartların götürdüğü okuma alanı
  yine oturum ister.
- **Bağlantılar:** Üst menüdeki "Kategoriler", ana sayfadaki "Tümünü gör" ve kahraman
  alanındaki "Ve dahası…" artık bu sayfaya gider. Ana sayfadaki kategori şeridi
  yerinde kaldı.
- **Ortak kart:** Kart bileşeni (`CategoryCard`) ana sayfa şeridinden ayrıldı;
  şerit ve sayfa aynı kartı çizer.
- **Site haritası:** `/kategoriler` site haritasına eklendi.

**Hukuk:** Değişiklik yok; yeni veri işlenmiyor.

**Doğrulama:**

- typecheck ve lint temiz; 53 dosyada 547 test geçti.
- **Yerel tarayıcı:** `/kategoriler` 200 döndü, 11 alanın hepsi fotoğrafı yüklenmiş kartla görünüyor.
  - Her kartta yazı sayısı var (yerel veritabanında "Henüz yazı yok").
  - Menüde "Kategoriler" etkin görünüyor; sayfada yatay taşma yok.
- **Ana sayfa:** "Tümünü gör" ve "Ve dahası…" `/kategoriler`'e gidiyor; şerit 11 kart, sayısız.

## D-135 — Hakkında: yazarlar ve editörler hesaplardan listelenir; "Tanış" topluluğa gider

**Durum:**

- Hakkında sayfasının Yazarlar bölümü yalnızca yayımlanmış yazısı olan mahlasları
  listeliyordu (`listPublicAuthors`).
- Editörler bölümünde kimse listelenmiyordu.
- "Yazarlar" kartındaki "Tanış" düğmesi aynı sayfanın Yazarlar bölümüne gidiyordu.

Ürün sahibi yazar ve editörlerin kullanıcılardan çekilip listelenmesini,
"Tanış"ın topluluğa yönlendirmesini istedi.

**Karar:**

- **Kaynak:** `listPublicStaff(role)` rolü "writer" ya da "editor" olan hesapları
  okur. Henüz yayını olmayan yazar da listelenir.
- **Gösterilen ad:** Yalnızca herkese açık gösterilebilecek adlar.
  - Mahlas varsa mahlas, yazar sayfasına bağlantıyla.
  - Yoksa topluluk adı (`@kullanıcıadı`), profil sayfasına bağlantıyla.
  - Gerçek ad, e-posta ve doğum tarihi okunmaz (CLAUDE.md, public API kuralı).
- **Dışarıda kalanlar:** Yasaklı, askıya alınmış (`suspended`), silinmiş ya da
  anonimleştirilmiş hesaplar ve herkese açık adı hiç olmayanlar.
- **Sıra:** Türkçe alfabetik.
- **Tanış:** "Yazarlar" kartındaki "Tanış" düğmesi `/social`'a gider. Topluluk
  oturum ister; ziyaretçi giriş sayfasına yönlenir.

**Hukuk:** Yeni kişisel veri yok. Listelenen adlar, üyelerin topluluk
profillerinde zaten herkese gösterilen adlar (D-089).

**Doğrulama:** `tests/integration/public-reading.test.ts` içinde iki yeni test.
Yerel tarayıcıda "Tanış" `/social`'a gidiyor. Yerel veritabanında herkese açık adı olan yazar ya da editör olmadığı için iki bölüm de "çok yakında" metnini gösteriyor.

## D-137 — "İletişim" iletişim sayfasını açar; künye `/kunye`'de, alt bilgiden bağlı

**Durum:** `/iletisim` hem 5651 s. 3 künyesiydi hem de üst menünün "İletişim"
bağlantısının açtığı sayfaydı ("Künye ve İletişim", D-084). Ürün sahibi iki şey
istedi:

- "İletişim" bağlantısı bir iletişim sayfası açsın.
- Künye alt bilgiye eklensin.

**Karar:**

- **Künye `/kunye`'ye taşındı:** İçerik aynı; yalnızca başlığı "Künye" oldu.
  - Tanıtıcı bilgiler, sorumluluk sıfatı, içerik kaldırma usulü, kişisel veri
    başvuruları ve barındırma bilgisi burada.
  - Bilgiler yine `site_settings`'ten gelir.
- **Yeni `/iletisim`:** Dergi çerçevesinde bir iletişim sayfası.
  - Künyedeki e-posta adresi (aynı ayardan; ikinci kopya yok).
  - Yazar başvurusuna yönlendirme.
  - Künye ve KVKK sayfalarına yönlendirme.
  - Adresi bilinen hesaplar (şimdilik Spotify).
  - Form yok: buradan gönderilen bir mesaj yeni bir kişisel veri türü olurdu.
- **Künyeye giden bağlantılar `/kunye`'ye döndü:**
  - Yasal sayfaların alt menüsü ve panellerin alt bilgisi ("Künye").
  - Kullanım şartlarındaki iki bağlantı.
  - Topluluk bildirim sayfası.
  - Hakkında'daki Editörler bölümü.
- **Dergi alt bilgisi:** Dergi bağlantılarına "iletişim", yasal bağlantılara "künye"
  eklendi. Künye, ana sayfa dahil her sayfanın alt bilgisinden tek tıkla
  erişilebilir; 5651 s. 3'ün "ana sayfadan doğrudan erişim" şartı böyle karşılanıyor.
- **Site haritası:** İki sayfa da site haritasına eklendi.
- **CLAUDE.md farkı:** CLAUDE.md künyeyi `/iletisim` adresiyle anıyor. Gerçek adres
  artık `/kunye`; bu kayıt geçerli.

**Hukuk:** Künyenin içeriği değişmedi, yalnızca adresi. Eski adres
(`/iletisim`) artık künye değil. Dışarıdan künyeye eski adresle verilmiş bir
bağlantı iletişim sayfasına düşer; o sayfa da künyeye yönlendiriyor.

**Doğrulama:**

- typecheck ve lint temiz.
- **Yerel tarayıcı, `/iletisim` (200):** Dört kart: E-posta, Yazar olmak, Başvurular, Bizi takip edin.
  - E-posta bağlantısı künyedeki adresle aynı.
  - Başvurular kartı `/kunye` ve `/kvkk`'ya, takip kartı Spotify hesabına gidiyor.
  - Menüde "İletişim" etkin; yatay taşma yok.
  - Alt bilgide "iletişim=/iletisim" ve "künye=/kunye" var.
- **`/kunye` (200):** Başlık "Künye"; beş bölümün hepsi yerinde. Yasal alt menü "Künye" (bu sayfa), "Kullanım şartları", "KVKK aydınlatma metni".
- **Kullanım şartları:** Künyeye giden bütün bağlantılar `/kunye`.

## D-136 — Topluluk ayarları: tek kart, soldaki menü seçer; biyografi yerinde düzenlenir

**Durum:** Topluluk ayarları sayfası tasarımın beş bölümünü (Profil, Gizlilik,
Bildirimler, Mesajlar, Hesap) alt alta, her birinin yanında aynı sekme sütunuyla
çiziyordu. Sekmeler yalnızca sayfada o bölüme kaydırıyordu (D-116).

Profil bölümünde yalnızca kullanıcı adı düzenlenebiliyordu. Biyografinin
"Düzenle" bağlantısı Hesabım sayfasına gidiyordu. Oradaki profil formu gerçek adı
ve diğer alanları da istediği için biyografiyi değiştirmek zahmetliydi.

Ürün sahibi iki şey istedi:

- Ayarlar sayfası "çalışmıyor"; profil düzenlenebilsin.
- Beş kart yerine tek kart olsun; soldaki menüden hangisi seçilirse o görünsün.

**Karar:**

- **Tek kart:** Sayfa tek bir kart çizer. Soldaki sütun gerçek gezinme:
  `/social/settings?bolum=profil|gizlilik|bildirimler|mesajlar|hesap`.
  - Seçili bölüm `aria-current="page"` ile işaretlenir; bilinmeyen bir değer
    Profil'e düşer.
  - Her bölümün formu kendi başına kaydedilir.
- **Biyografi:** Profil bölümünde doğrudan düzenlenir.
  - Yeni `setBio` servisi yalnızca biyografiyi yazar: ad soyad, mahlas ve diğer
    alanlara dokunmaz.
  - En fazla 2000 karakter; boş bırakılırsa silinir.
  - Topluluğa yazmaya yetkisi olmayan hesap (`assertMayPost`) değiştiremez.
- **Diğer alanlar:** Ad soyad ve mahlas için Hesabım sayfasına bağlantı kaldı.
  İlgi alanları hâlâ pasif: saklanmayan yeni bir kişisel veri alanı olur (D-116).
- **Gizlilik:** Kullanıcı adı yoksa anonim kutu notu Profil bölümüne bağlanır.
- **e2e:** `07d-social.spec.ts` anonim kutu ve mesaj tercihini kendi sekmelerine
  giderek kaydediyor.

**Hukuk:** Yeni kişisel veri yok. Biyografi zaten saklanıyor ve topluluk
profilinde gösteriliyordu (D-089); yalnızca düzenlendiği yer değişti.

**Doğrulama:**

- typecheck ve lint temiz; 54 dosyada 551 test geçti.
- `tests/integration/community-bio.test.ts`: kaydetme, silme, uzunluk ve fazladan
  alan reddi, yasaklı hesap.
- **Demo sunucusu (okur hesabı), her sekmede tek kart ve seçili sekme işaretli:**

  | Sekme | Denenen | Sonuç |
  |---|---|---|
  | Profil | Kullanıcı adı | "Kullanıcı adınız @kerem_okur olarak kaydedildi." |
  | Profil | Biyografi | "Biyografiniz kaydedildi."; profil sayfasında göründü |
  | Gizlilik | Anonim kutu | "Anonim kutunuz açıldı." |
  | Bildirimler, Hesap | Açılış | Formsuz tek kart |
  | Mesajlar | Mesaj tercihi | "Özel mesaj tercihiniz kaydedildi." |

## D-138 — Konu başlıkları ve Sayı 01 için topluluklar açıldı (canlı veri)

**Durum:** Ürün sahibi toplulukların admin panelinden kurulmasını ve şimdilik
konu başlıkları (yazı alanları) ile ilk sayı için topluluk açılmasını istedi.

- Admin panelinin "Topluluk yönetimi" sayfasında "Topluluk aç" formu zaten var
  (D-093). Topluluğu yalnızca yöneticiler açar ve arşivler.
- Canlıda hiç topluluk yoktu.

**Karar:** Kod değişikliği yok. 2026-09-16'da canlı admin panelinin kendi
formuyla, ürün sahibinin admin oturumunda 12 topluluk açıldı:

| Topluluk | Adres |
|---|---|
| Sanat & Edebiyat | `/social/communities/sanat-edebiyat` |
| Bilim & Teknoloji | `/social/communities/bilim-teknoloji` |
| Psikoloji & İlişkiler | `/social/communities/psikoloji-iliskiler` |
| Lifestyle & Fashion | `/social/communities/lifestyle-fashion` |
| Pop Culture | `/social/communities/pop-culture` |
| Film, Dizi & Kitap | `/social/communities/film-dizi-kitap` |
| Sosyoloji & Düşünce | `/social/communities/sosyoloji-dusunce` |
| Sosyal & Feminizm | `/social/communities/sosyal-feminizm` |
| Tarih & Dünya | `/social/communities/tarih-dunya` |
| Yazar Köşesi: P.S. | `/social/communities/yazar-kosesi-p-s` |
| Eğlence & Dedikodu | `/social/communities/eglence-dedikodu` |
| Sayı 01: Obsession | `/social/communities/sayi-01-obsession` |

- Her birine konusunu anlatan kısa bir açıklama yazıldı.
- Her açılış servisin denetim kaydına "social.community_created" olarak düştü.
- Admin sayfası sonunda "Topluluklar (12)" gösterdi.

**Hukuk:** Yeni kişisel veri yok. Topluluk gönderileri mevcut yer sağlayıcı
düzenine tabi: bildirim, kaldırma ve trafik kaydı (D-084, D-093).

## D-139 — Kullanıcı adı seçmiş üyeler öneri olarak listelenir; önerilerden takip edilir

**Durum:** Takip etme profil sayfalarında vardı ama bulunması zordu.

- "Tanıyor olabilirsiniz" önerileri yalnızca Keşfet sayfasındaydı. Kaynakları
  takip edilenlerin takip ettikleri ve en çok takip edilenlerdi. Kimse kimseyi
  takip etmediği için liste boş kalıyordu.
- Listede takip düğmesi yoktu.

Ürün sahibi, kaydı olan ve takma ad (kullanıcı adı) oluşturan üyelerin öneri
olarak listelenmesini ve takip etme özelliğinin etkinleştirilmesini istedi.

**Karar:**

- **Öneri kaynağı:** `suggestMembers` önce takip ettiklerinin takip ettiklerini,
  sonra en çok takip edilenleri alır. Liste hâlâ dolmadıysa kullanıcı adı seçmiş
  üyelerle tamamlanır, en yeni üye önce.
  - Dışarıda kalanlar: okurun kendisi, zaten takip ettikleri, iki yönlü engel,
    yasaklı ve silinmiş hesaplar.
- **Takip düğmesi:** Öneri listelerindeki her üyenin yanında "Takip et" düğmesi var
  (`MemberList`'in `followToken`'ı). Takipçi/takip edilen listelerinde yok.
- **Görünüm:** Öneriler Keşfet'in yanı sıra Topluluk akış sayfasında da sağ sütunda
  gösterilir.
- **Yenileme:** Takip et / takibi bırak topluluk sayfalarının hepsini yeniler; takip
  edilen üye önerilerden düşer.

**Hukuk:** Yeni kişisel veri yok. Önerilen üyeler kullanıcı adı, varsa mahlas ve
rolüyle görünür; bunlar zaten topluluk profilinde herkese açık (D-089).

**Doğrulama:** `tests/integration/member-suggestions.test.ts`:

- Kimse takip etmezken kullanıcı adı olanlar en yeni önce öneriliyor.
- Kendisi, takip edilen, engellenen ve yasaklı öneriye girmiyor.
- Takip edilen öneriden düşüyor.

**Demo sunucusu (okur hesabı):**

- Akış sayfasının öneri kartında `@ada_yazar` "Takip et" düğmesiyle göründü.
- Düğmeye basınca takip edildi; akış yeniden açıldığında öneriden düşmüştü.
- Profilinde "Takibi bırak" düğmesi vardı.
- Takip bırakılınca Keşfet önerilerine geri döndü.

## D-140 — Katılım tarihi yalnızca ay ve yıl

**Durum:** Topluluk profilinde katılım tarihi iki yerde farklı gösteriliyordu:

- Başlıkta ay ve yıl ("Eylül 2026 tarihinde katıldı"), saat dilimi belirtilmeden.
- "Hakkında" sekmesinde tam gün ("7 Eyl 2026").

Ürün sahibi katılımın yalnızca ay ve yıl olarak gösterilmesini istedi.

**Karar:**

- `formatMonthYear` (`src/lib/relative-time.ts`) İstanbul saatiyle ay ve yıl
  yazar; profil başlığı ve Hakkında sekmesi bunu kullanır.
- Gün hiçbir yerde gösterilmez.
- Saat dilimi İstanbul'a sabit: sunucu UTC'de çalışıyor. İstanbul saatiyle 1 Ekim
  00:30'da katılan biri, UTC'de hâlâ 30 Eylül olduğu için "Eylül" diye
  yazılmasın.

**Hukuk:** Değişiklik yok; gösterilen bilgi azaldı.

**Doğrulama:**

- typecheck ve lint temiz; 56 dosyada 556 test geçti.
- `tests/unit/relative-time.test.ts`: ay-yıl biçimi ve İstanbul saatine göre ay
  sınırı.
- **Demo sunucusu:** Profil başlığı "@kerem_okur · Eylül 2026 tarihinde katıldı";
  Hakkında sekmesinde "Katılım: Eylül 2026". Gün hiçbir yerde yok.

## D-141 — Profil fotoğrafı ve kapak fotoğrafı

**Durum:** Topluluk profilinde fotoğraf yoktu; avatarın yerinde kullanıcı adının
ilk harfi duruyordu ve profilin üstündeki kapak alanı düz renkti (D-089).
Veritabanında `avatar_media_id` sütunu vardı ama hiç kullanılmıyordu. Ürün
sahibi profil ve kapak fotoğrafı eklemeyi istedi.

**Karar:**

- **Veri:** `users.header_media_id` sütunu eklendi; profil fotoğrafı mevcut
  `avatar_media_id`'yi kullanır. Her ikisi de `media` tablosuna işaret eder.
- **Yükleme (`src/services/profile-images.ts`):** Makale medyasından ayrı bir
  servis.
  - Yalnızca topluluğa yazabilen üye (`assertMayPost`): yasaklı ya da e-postası
    doğrulanmamış hesap yükleyemez.
  - Dosya türü içeriğinden doğrulanır (`assertUploadAcceptable`); yalnızca görsel
    kabul edilir, PDF reddedilir.
  - Sınır 5 MB (makale görsellerinde 10 MB).
  - Dosya adı sunucuda üretilir, yükleyenin verdiği ad kullanılmaz.
  - Lisans türü `own_work`: bu görsel üyenin kendi fotoğrafı, makale lisans
    kuralları uygulanmaz.
  - Her türden tek fotoğraf tutulur: yenisi yüklenince eskisi hem depodan silinir
    hem de kütüphanede silinmiş işaretlenir.
  - "Kaldır" fotoğrafı tamamen siler.
- **Sunum:** `/api/media/:id` profil görsellerini giriş yapmış her üyeye verir.
  Sözleşme PDF'leri ve kütüphane medyası için kurallar aynı kaldı; görseller
  oturumsuz okura hiç sunulmaz.
- **Görünüm:** Profil sayfasında kapak fotoğrafı üst şeride, profil fotoğrafı
  avatar dairesine yerleşir. Fotoğrafı olmayan üyede eskisi gibi ilk harf görünür.
  - Ayarlar → Profil bölümünde iki yükleme formu ve kaldırma düğmeleri var.
- **Hesap silme:** Anonimleştirme sırasında iki sütun da boşaltılır ve dosyalar
  depodan silinir.
- **Sonraki adım:** Akıştaki gönderi kartlarında, üye listelerinde ve mesajlarda
  avatar hâlâ ilk harf. Oradaki sorgulara fotoğraf alanını taşımak ayrı bir adım.

**Hukuk:**

- Profil ve kapak fotoğrafı kişisel veridir; aydınlatma metnine "Profil
  görselleri" satırı eklendi (§2) ve saklama süresi yazıldı (§7).
- Dosyalar mevcut nesne depolamasında (Cloudflare R2, AB yerleşimi — D-118)
  tutulur; metindeki Cloudflare satırı bunu zaten kapsıyor.
- Fotoğraf yüklemek zorunlu değil; yüklenen fotoğrafı giriş yapmış üyeler görür.
  Hesap silinince fotoğraflar da silinir.
- Fotoğraf içeriği için ayrı bir denetim yok; uygunsuz fotoğraf, üye bildirimi ve
  moderasyon yoluyla kaldırılır (D-084). Yükleyen hesap denetim kaydına yazılır.

**Doğrulama (D-141):**

- typecheck ve lint temiz; 57 dosyada 562 test geçti.
- `tests/integration/profile-images.test.ts`: yükleme, değiştirince eskisinin
  depodan ve kütüphaneden silinmesi, iki fotoğrafın ayrı tutulması, görsel
  olmayan dosya ve 5 MB üstü reddi, yasaklı hesap reddi, kaldırma.
- **Demo sunucusu (okur hesabı):**

  | Adım | Sonuç |
  |---|---|
  | Ayarlar → Profil, profil fotoğrafı yükleme | "Profil fotoğrafınız kaydedildi." |
  | Kapak fotoğrafı yükleme | "Kapak fotoğrafınız kaydedildi." |
  | Profil sayfası | Kapak ve avatar görselleri yüklendi (`/api/media/…`) |
  | Oturumsuz istek | 401 |
  | Kaldırma | İki fotoğraf da kalktı |

- **Migration:** `drizzle/0032_stormy_quasimodo.sql` tek satır:
  `ALTER TABLE "users" ADD COLUMN "header_media_id" uuid;` (boş bırakılabilir).
- **Düzeltme:** Kapak alanına görsel için `position: relative` verilince kapak,
  kendisinden sonra gelen avatarın üstüne çizildi ve avatarın üst yarısı kayboldu.
  Kapak konumlandırılmadan bırakıldı; avatar `z-index` ile üste alındı. Yeni
  ekran görüntüsünde avatar kapağın üstünde tam daire.

## D-142 — Fotoğraf seçimi durduğu yerde; ayarlarda profil önizlemesi

**Durum:** D-141'de iki fotoğraf da Profil bölümünün ortasında, yan yana iki
kutuda seçiliyordu. Avatar solda ayrı duruyordu ve kapak fotoğrafının nasıl
göründüğü yalnızca profil sayfasına gidince anlaşılıyordu. Ürün sahibi profil
fotoğrafı seçiminin profil kısmına taşınmasını ve ayarlara profil önizlemesi
konmasını istedi.

**Karar:**

- **Profil fotoğrafı** avatarın hemen altında seçilir; "Kaldır" düğmesi de orada.
- **Kapak fotoğrafı** kendi satırında, kullanıcı adının altında seçilir.
- **Önizleme:** Profil bölümünün en üstünde, başkalarının gördüğü profil çizilir:
  kapak şeridi, üstüne binen avatar, ad (mahlas varsa mahlas), kullanıcı adı ve
  biyografi. Altında "Topluluktaki üyeler profilinizi böyle görür" notu var.
  - Önizleme profil sayfasıyla aynı değerlerden beslenir; ikinci bir kopya yok.
  - `getMemberSettings` artık mahlası da döndürüyor.
  - Fotoğrafı, kullanıcı adı ya da biyografisi olmayan üyede önizleme boş hâli
    gösterir ("Kullanıcı adı seçilmedi", "Biyografi eklenmemiş.").

**Hukuk:** Yeni veri yok; önizleme yalnızca üyenin kendi verisini kendisine
gösterir.

## D-143 — Mesajlar sütununda takipleştikleriniz

**Durum:** Mesajlar ekranında yalnızca daha önce başlamış konuşmalar
listeleniyordu. Yeni bir konuşma açmak için kullanıcı adını ezbere yazmak
gerekiyordu (D-091, D-113). Ürün sahibi listede doğrudan karşılıklı takipleşilen
kişilerin görünmesini istedi.

**Karar:**

- **Kim listeleniyor:** `listMutualFollows` hem okurun takip ettiği hem de okuru
  takip eden üyeleri verir.
  - İki yönden biri engellemişse çift listeden düşer.
  - Yasaklı, silinmiş ve kullanıcı adı olmayan hesaplar listelenmez.
  - Kullanıcı adına göre sıralı, en çok 20 kişi.
- **Neden karşılıklı takip:** Varsayılan mesaj tercihi "takip ettiklerim". Alıcı
  göndereni takip ediyorsa mesaj gidebiliyor; karşılıklı takip bu koşulu zaten
  sağlar. Yani listedeki kişi, yazılabilecek kişidir.
  - Alıcı tercihini "kimse" yaptıysa ya da yaş sınırı varsa engeli konuşma ekranı
    söyler; kural yine tek yerde (D-091).
- **Görünüm:** Konuşma listesinin altında "Takipleştikleriniz" başlıklı bölüm.
  Zaten konuşma açılmış kişiler burada tekrar gösterilmez.
- Tıklayınca o kişiyle konuşma ekranı açılır.

**Hukuk:** Yeni veri yok; takip ilişkisi ve kullanıcı adları üyeye zaten görünür
(D-089).

**Doğrulama:**

- typecheck ve lint temiz; 59 dosyada 569 test geçti.
- `tests/integration/mutual-follows.test.ts`: yalnızca karşılıklı takip
  listeleniyor; tek yönlü takip, iki yönden engel, yasaklı ve silinmiş hesap
  listelenmiyor.
- **Demo sunucusu:** Üç hesapla karşılıklı takip kuruldu. Mesajlar sütununda
  "Takipleştikleriniz" bölümü çıktı ve konuşma geçmişi olmayan `aday_uye`'yi
  listeledi; zaten konuşulan `ada_yazar` bölümde tekrar gösterilmedi.

## D-144 — Profil topluluk içinde düzenlenir; panel yönetim için kalır

**Durum:** Topluluk profilindeki "Profili düzenle" düğmesi panele (`/account`)
gidiyordu. Yanında ayrıca "Topluluk ayarları" düğmesi vardı. Mahlas da yalnızca
paneldeki profil formundan değiştirilebiliyordu; o form ad soyad, telefon ve
doğum tarihini de istiyor.

Ürün sahibi profil düzenlemenin panele gitmemesini, panelin yalnızca yönetim
için kalmasını ve düzenlemenin Twitter'daki gibi tek yerde toplanmasını istedi.

**Karar:**

- **"Profili düzenle"** artık topluluk ayarlarının Profil bölümüne gider. Yanındaki
  ikinci düğme "Hesabım" oldu.
- **Mahlas** topluluk ayarlarından düzenlenir (`setPenName`).
  - Boş bırakılırsa mahlas silinir; profil kullanıcı adını gösterir.
  - Mahlastan yazar sayfasının adresi üretilir; adres başkasındaysa "Bu mahlas
    alınmış." denir. Panelde bu kontrol yoktu, veritabanı hatası dönerdi.
  - Yalnızca noktalama içeren bir mahlas reddedilir (adres üretilemez).
- **Profil bölümünde artık tek yerde:** fotoğraf, kapak, kullanıcı adı, mahlas ve
  biyografi.
- **Panelde kalanlar:** ad soyad, e-posta, şifre, iki adımlı doğrulama, yazar
  başvurusu — hesap ve güvenlik işleri. Ayarlarda bunlara bir bağlantı var.

**Hukuk:** Yeni veri yok. Mahlas zaten üyenin düzenleyebildiği ve yayımlanmış
işlerde görünen ad (FSEK ve künye bakımından değişmedi).

**Doğrulama:**

- `tests/integration/pen-name.test.ts`: kaydetme ve adres üretimi, silme,
  başkasının mahlasını alamama, geçersiz ad, yasaklı hesap.
- **Demo sunucusu:** Kendi profilindeki düğmeler "Profili düzenle=/social/settings"
  ve "Hesabım=/account". Mahlas topluluk ayarlarından kaydedildi
  ("Mahlasınız … olarak kaydedildi."), önizlemede göründü; boşaltılınca önizleme
  kullanıcı adına döndü.

## D-145 — İletişim sayfası tasarımdaki hâliyle: mesaj formu

**Durum:** `/iletisim` D-137'de dört bilgi kartından oluşuyordu. Tasarımda
("contact, about, categories.ai") ise iki sütun var: solda davet metni ve
adresler, sağda "SEND US A MESSAGE" formu. Ürün sahibi sayfanın tasarımla aynı
olmasını istedi.

**Tasarımdan okunanlar:** Dosyanın tek çizim alanı About ekranı; iletişim ekranı
çizim alanının dışında (x≈+2165) duruyor ve PDF katmanında yok. Metinler
Illustrator'ın kendi verisinden çıkarıldı: "GET IN TOUCH", "HAVE A QUESTION?",
"SEND US A MESSAGE", davet paragrafı, alanlar (Name *, Email*, Subject, "Choose
a topic...", Message *), "SEND" düğmesi, `magpostscript@gmail.com` ve
`postscriptmgzn`.

**Karar:**

- **Sayfa:** İki sütun. Solda "Bize ulaşın" başlığı, tasarımdaki davet paragrafı,
  e-posta adresi, adresi bilinen hesaplar, künye/KVKK yönlendirmesi ve "Aramıza
  katıl" düğmesi. Sağda "Bize mesaj gönderin" formu: Ad *, E-posta *, Konu,
  başlık seçimi, Mesaj * ve "Gönder".
- **Form ne yapıyor:** Mesaj derginin künyedeki e-posta adresine gönderilir.
  - **Veritabanına hiçbir şey yazılmaz;** mesaj yalnızca posta kutusunda kalır.
  - Bot doğrulaması (Turnstile, "contact" eylemi) ve IP başına saatte üç mesaj
    sınırı var. Sınır için `auth_scope` listesine `contact_form_ip` eklendi
    (migration 0033).
  - Form sabit bir adrese, yani bize yazar; yabancı bir adrese posta göndermek
    için kullanılamaz.
- **Tasarımdan iki sapma:**
  - Tasarımda `magpostscript@gmail.com` yazıyor. Sayfa künyedeki adresi gösterir;
    adres tek yerde (site ayarları) tutulur ve panelden değiştirilir. Gmail adresi
    gösterilecekse ayarlardan yazılması yeterli.
  - "Choose a topic..." listesinin seçenekleri tasarımda yok; liste yazı
    alanlarından (kategoriler) ve "Diğer" seçeneğinden oluşuyor.
- **Metinler Türkçe:** Tasarımın çerçevesi İngilizce, site Türkçe (D-112'den beri).
  Başlıklar aynı anlamla Türkçeye çevrildi.

**Hukuk:**

- Form yeni kişisel veri topluyor: ad, e-posta, konu, mesaj. Aydınlatma metnine
  eklendi: işlenen veri (§2), amaç ve hukuki sebep (§3, meşru menfaat — bize yazan
  kişiye cevap verebilmek), toplanma yöntemi (§4) ve saklama (§7: sitede
  saklanmaz; posta kutusunda en geç 1 yıl).
- Mesajı göndermek zorunlu değil; aynı adrese doğrudan yazılabilir.
- **Canlı metin hâlâ 1. sürüm.** Form canlıya alınmadan önce ürün sahibinin
  tebligat adresini vermesi ve tam metnin yayınlanması gerekiyor (D-125, D-132).

**Doğrulama (D-145):**

- typecheck ve lint temiz; 60 dosyada 572 test geçti.
- `tests/integration/contact-form.test.ts`: mesaj künyedeki adrese gidiyor ve
  gönderenin adresiyle metni içeriyor; kısa mesaj, bozuk e-posta ve boş ad 400
  dönüyor; aynı IP'den saatte dördüncü mesaj 429 alıyor ve sayaç
  `contact_form_ip` kapsamında tutuluyor. Veritabanına mesaj yazılmıyor.
- **Demo sunucusu (1440 px ve 390 px):**

  | Kontrol | Sonuç |
  |---|---|
  | Başlık | "İletişim" / "Bir sorunuz mu var?" |
  | Sütunlar | 1440 px'de yan yana, 390 px'de alt alta; yatay taşma yok |
  | Kart başlıkları | "Bize ulaşın", "Bize mesaj gönderin" |
  | Alanlar | Ad *, E-posta *, Konu, Başlık seçin, Mesaj *; düğme "Gönder" |
  | Başlık listesi | Yazı alanları ve "Diğer" |
  | Gönderim | "Mesajınız bize ulaştı. En kısa sürede yanıtlayacağız." |
  | Posta | Künyedeki adrese gitti; konu ve gönderenin adresi içinde |

- **Düzeltme:** İki sütun tasarımdaki gibi aynı yükseklikte olacak şekilde
  hizalandı.

**Ürün sahibinin yayın kararı (2026-09-16):** Form, KVKK metninin tam sürümü
yayınlanmadan canlıya alındı. Ürün sahibine üç seçenek sunuldu (sayfayı alıp
formu sonra açmak, hepsini şimdi yayınlamak, hiç yayınlamamak); "hepsini şimdi
push et" dendi.

- **Aradaki fark:** Canlı aydınlatma metni 1. sürüm (6 Eylül 2026) ve iletişim
  formunu anlatmıyor. Depodaki metinde satırlar hazır (§2, §3, §4, §7).
- **Formun hâli:** Sayfadaki not, gönderilen bilgilerin yalnızca cevap vermek
  için kullanıldığını ve sitede saklanmadığını söylüyor; mesaj veritabanına
  yazılmıyor, yalnızca dergi posta kutusuna gidiyor.
- **Kapanış koşulu:** Tebligat adresi gelince tam metin yeni sürüm olarak
  yayınlanır; o zaman fark kapanır (D-125, D-132).

## D-146 — Kategoriler sayfası tasarımdaki hâliyle

**Durum:** `/kategoriler` D-134'te kurulmuştu: fotoğraf, ad ve yayımlanmış yazı
sayısı. Tasarımda ("contact, about, categories.ai") kartlar farklı: adın altında
o alanın konuları yazıyor ve her kartta bir "EXPLORE" düğmesi var; sayfa başlığı
"CATEGORIES / FIND WHAT MOVES YOU". Ürün sahibi sayfanın tasarımla aynı olmasını
istedi.

**Tasarımdan okunanlar:** Kategoriler ekranı da çizim alanının dışında; metinler
Illustrator verisinden çıkarıldı. On bir kategori, on bir konu satırı ve on bir
"EXPLORE" var. Konu satırları içeriklerinden kategorilere eşlendi (örneğin
"resim, edebiyat, şiir ve dahası" → Sanat & Edebiyat).

**Karar:**

- **Başlık:** "Kategoriler / Seni harekete geçireni bul".
- **Kart:** Fotoğraf, ad, tasarımdaki konu satırı ve "Keşfet" düğmesi.
  - Konu satırı `categorySubtitle` ile fotoğrafla aynı anahtardan gelir; admin
    yeni bir alan açar ve adı hiçbir kelimeye uymazsa, fotoğrafıyla aynı satırı
    alır.
  - "Keşfet" bir düğme değil, kartın içinde yazı: kartın tamamı zaten bağlantı.
- **Yazı sayısı kaldırıldı:** Tasarımda yok. Sayfa artık sayıları sorgulamıyor.
- **Ana sayfadaki şerit** eskisi gibi kaldı: orada kartlar küçük ve tasarımda
  konu satırı yok.

**Hukuk:** Değişiklik yok.

**Doğrulama (D-146):**

- typecheck ve lint temiz; 60 dosyada 574 test geçti.
- `tests/unit/site.test.ts`: konu satırları doğru kategoriye bağlanıyor; tanımsız
  bir ad, fotoğrafıyla aynı satırı alıyor.
- **Yerel tarayıcı (1440 px ve 390 px):** Başlık "Kategoriler / Seni harekete
  geçireni bul"; 11 kartın her birinde ad, konu satırı ve "Keşfet" var; yazı
  sayısı hiçbir kartta yok; kartların yüksekliği eşit; yatay taşma yok.

## D-147 — Mesajlar ekranı: konuşmalarda arama ve tasarımdaki üçüncü hızlı işlem

**Durum:** "dm.ai" tasarımıyla karşılaştırıldığında ekran zaten üç sütundu: liste,
sohbet ve karşı tarafın paneli (D-113, D-116). İki fark kalmıştı:

- Sol sütundaki kutu tasarımda "Search conversations…" iken bizde yalnızca yeni
  konuşma açan bir kutuydu.
- Tasarımın "Quick Actions" bölümünde üç işlem var: Block, Report, Delete
  Conversation. Bizde Bildir yoktu.

**Karar:**

- **Arama:** Kutu artık konuşmalarda arıyor (`?ara=`). Kullanıcı adı ve mahlas
  üzerinden, Türkçe küçük harfe göre eşleşir; hem konuşmalar hem
  "Takipleştikleriniz" listesi süzülür.
  - Arama bir GET formu; hiçbir şeyi değiştirmez.
  - Aranan adla konuşma yoksa, aynı adla yeni konuşma açan bir bağlantı çıkar.
    Eski "to=" adresi de çalışmaya devam ediyor.
- **Bildir:** Hızlı işlemlere eklendi; mevcut bildirim akışına gider (D-084).
  Engelle ve konuşmayı sil eskisi gibi.
- **Tasarımdan bilerek ayrılan iki nokta:** "online" satırı ve okundu tikleri
  yok (D-091). Kimin ne zaman çevrimiçi olduğu ya da mesajı okuduğu, gönderenin
  göreceği bir bilgi değil.

**Hukuk:** Yeni veri yok; arama okurun kendi konuşmalarını süzüyor.

**Doğrulama:** Demo sunucusunda (3002) okur hesabıyla: liste ekranında arama
kutusu "Konuşmalarda ara…", altında konuşmalar ve "Takipleştikleriniz";
`?ara=ada` konuşmayı ve takipleşilen üyeyi süzüyor, `?ara=bulunmayan` boş liste
ile "Bu adla yeni konuşma aç" bağlantısını veriyor. Konuşma ekranı üç sütun;
hızlı işlemler: Engelle, Konuşmayı sil, Bildir (`/social/report?type=member&id=…`).
Yatay taşma yok.

## D-148 — Sayılar sayfası "magazines" tasarımındaki hâliyle

**Durum:** `/magazine/issues` D-114 ve D-116'da kurulmuştu. Tasarım
("magazines.ai") ile karşılaştırıldığında üç fark kaldı:

- Tasarımda kartlar **üçlü** dizilir; bizde geniş ekranda iki kart yan yana
  geliyordu.
- Tasarımda sayının adının altında **bir paragraf** var ("Some people stay in
  your mind forever…"); bizde yalnızca tema vardı.
- Tasarımda tarih tek başına yazıyor ("Oct 1.2026"); bizde "Sayı 01 · 1 Ekim
  2026" yazıyordu, yani numara hem kapakta hem satırda tekrar ediyordu.

**Karar:**

- **Tanıtım yazısı:** `issues` tablosuna `blurb` kolonu eklendi (boş
  bırakılabilir, en çok 600 karakter). Panelde sayı formuna "Tanıtım yazısı"
  kutusu kondu; yazan yönetici, çünkü sayı yönetimi yöneticinindir (D-059).
  Kart bu paragrafı gösterir; yoksa eskisi gibi temayı gösterir.
- **Üçlü dizi:** Izgara zaten kart genişliğine göre doluyor (`auto-fill`,
  en az 22rem); kâğıt sütunu tasarımdaki kadar genişleyince üçüncü kart kendi
  kendine yan yana geliyor. Sabit `repeat(3, 1fr)` denendi ve geri alındı: 1440
  pikselde kart metni ~130 piksele düşüp "POSTSCRIPT: BAŞLANGIÇLAR" harf harf
  bölünüyordu. Tasarımdaki üçlü sıra geniş ekranda görünür, dar ekranda ikili
  kalır.
- **Tarih:** Kartta yalnızca yayın tarihi yazıyor; numara zaten kapakta.
- **Kalan bilerek sapma:** Tasarımda her kartta kalp ve "100" beğeni sayısı var.
  Sayı beğenme özelliği yok (D-116); kimin neyi beğendiği kişisel veridir ve
  ayrı bir tablo, saklama süresi ve aydınlatma metni satırı gerektirir. Kalp
  sayısız duruyor, sayfa uydurma sayı göstermiyor.

**Hukuk:** Yeni kişisel veri yok; `blurb` derginin kendi metni. Aydınlatma
metninde değişiklik gerekmiyor.

**Üretim migration'ı (0034, D-079 gereği push'tan önce):** Uygulandı; üretim
defteri artık **34**. Neon ücretsiz planında dal ve snapshot kotası dolu olduğu
için alışılmış yedek dalı açılamadı ("branches limit exceeded", "snapshots limit
exceeded"). Onun yerine migration'ın dokunduğu tek tablo salt okunur olarak dışa
aktarıldı (`prod-issues-before-0034.json`): üretimde **hiç sayı kaydı yok** (0
satır), yani kolon ekleme boş bir tabloya yazıldı ve veri riski yoktu. Kota
açılmadan veri taşıyan bir migration uygulanmamalı; eski yedek dallarını silmek
ürün sahibinin işi.

**Bir sapma daha:** Tasarımda bölüm başlığının sağında "VIEW ALL" yazıyor. Bu
sayfa zaten bütün sayıları gösterdiği için oradaki bağlantı "Son yazılar" adıyla
kaldı; adı ne yaptığını söylüyor, tasarımdaki gibi "Tümünü gör" deseydi kendi
sayfasına işaret etmiş olurdu.

## D-149 — Ayarlar ekranı: tasarımdaki "Interest" çipleri gerçek oldu

**Durum:** "settings and community.ai" tasarımındaki Profil kartında üç satır
var: Username, Bio ve **Interest** — beş çip (art, games, books, music,
fashion) ve "Edit". Bizde kullanıcı adı ve biyografi çalışıyordu; ilgi alanları
satırı duruyordu ama "yakında" diye devre dışıydı (D-116).

**Karar:**

- **Sabit liste:** İlgi alanları serbest metin değil; `src/lib/interests.ts`
  içindeki on iki seçenekten seçilir (sanat, edebiyat, müzik, film, dizi, kitap,
  oyun, moda, bilim, tarih, psikoloji, gündem). Serbest metin olsaydı denetlenmesi
  gereken yeni bir kullanıcı içeriği alanı doğardı; liste bunu doğurmuyor.
  Listede olmayan bir değer sessizce atılmaz, reddedilir.
- **En fazla 5:** Tasarımda beş çip var; profil için de yeterli.
- **Sıra listeden gelir:** Üye hangi sırayla işaretlerse işaretlesin, çipler her
  ziyarette aynı sırada durur.
- **Saklama:** `users.interests` (metin dizisi, boş bırakılabilir); hiç seçim
  yoksa `null`. Migration 0035.
- **Şimdilik yalnızca üyenin kendisi görür:** Tasarım çipleri yalnızca ayarlar
  ekranında çiziyor. Profilde başkalarına göstermek yeni bir yayın kararıdır;
  ürün sahibi isterse eklenir. Form bunu açıkça yazıyor.

**Tasarımın topluluk yarısı:** Okunamadı. Dosyanın çizim alanında yalnızca
ayarlar ekranı var (tasarımcı aynı ekranın beş sekme hâlini alt alta koymuş);
sınır kutusu içeriğin çizim alanının çok dışına taştığını söylüyor ama PDF
katmanı çizim alanına kırpıldığı için orası boş çıkıyor ve bu dosyanın
Illustrator verisi `blog.ai`/`dm.ai` gibi açılmıyor. Topluluk ekranları
D-113/D-116'da kurulan hâliyle kaldı; tasarım dosyası okunabilir hâle gelirse
yeniden bakılacak.

**Hukuk:** İlgi alanları kişisel veridir; aydınlatma metninin §2 "Profil"
satırına eklendi ("sabit bir listeden seçtiğiniz ilgi alanları, yalnızca size
gösterilir"). Yeni bir amaç ya da aktarım yok; profil verisiyle aynı sürede
silinir.

**Doğrulama:** Demo sunucusunda okur hesabıyla: on iki çip listeleniyor; sanat,
müzik ve kitap seçilip kaydedildi ("İlgi alanlarınız kaydedildi."), sayfa
yeniden açıldığında üçü işaretli geliyor. Altı seçenek işaretlenince kayıt
reddediliyor ("İlgi alanları geçersiz.") ve eski seçim bozulmuyor. Hepsi
kaldırılınca satır boşalıyor ("İlgi alanlarınız kaldırıldı."). Yatay taşma yok.

**Üretim migration'ı (0035): UYGULANDI (2026-09-16).** Komut önce izin
sisteminde "Production Deploy" gerekçesiyle reddedildi; ürün sahibi kendisi
çalıştırdı. Neon OAuth anahtarının süresi dolduğu için önce `neon auth`
gerekti. Yedek: migration'ın dokunduğu tablonun profil kolonları salt okunur
olarak dışa aktarıldı (`prod-users-before-0035.json`, 72 satır); kolon ekleme
mevcut satırlara dokunmuyor, varsayılanı yok, hepsi `null` başlıyor.

Uygulandıktan sonra üretimden okundu: `users.interests` yerinde (ARRAY, null
olabilir), üretim defteri **35**, dolu satır yok. Kolon canlıda olmadan bu
değişiklik push edilemezdi: `getMemberSettings` artık o kolonu okuyor, yoksa
topluluk ayarları sayfası hata verirdi. Çalıştırılan komut (panel dizininde):

```
env -u NEON_API_KEY pnpm exec neon-env run -- node node_modules/tsx/dist/cli.mjs \
  --tsconfig scripts/tsconfig.json src/db/migrate.ts
```

## D-150 — Profil sayfası: yan sütundaki yorumlar gerçek, gönderiler sayfalanıyor

**Durum:** Profil ekranı ("blog.ai") D-113 ve D-116'da kurulmuştu. Tasarımla
karşılaştırıldığında iki yer eksikti:

- Yan sütundaki **"Recent comments"** kartı yer tutucuydu: her zaman "Henüz
  yorum yok." yazıyordu, çünkü üyenin gönderilerine gelen yanıtlar hiç
  toplanmıyordu.
- Tasarımda listenin altında **sayfa şeridi** var (← 1 2 3 4 5 … 10 →); bizde
  gönderiler tek seferde (en çok 50) alt alta diziliyordu.

**Karar:**

- **Son yorumlar:** Üyenin gönderilerine gelen en yeni beş yanıt listelenir.
  - **Üyenin kendi yanıtları kartta yer almaz;** kart "topluluk ne dedi"
    sorusunun cevabı. Kendi yanıtı zaten "Yanıtlar" sekmesinde duruyor.
  - Engel iki yönlü çalışır (D-089): engellediğiniz kişinin yanıtı kartta
    görünmez. Silinmiş yanıt, silinmiş/yasaklı yazar ve kullanıcı adı olmayan
    hesap da düşer.
  - Satır yanıtın kendisine gider (`/social/posts/<id>`).
  - **Yeni veri yok:** yanıtlar zaten herkese açık gönderiler; kart onları
    yalnızca bir yerde topluyor.
- **Sayfalama:** Sayfa başına on gönderi, adres `?sayfa=`.
  - Şerit düz bağlantılardan yapıldı: JavaScript olmadan da çalışır ve her
    sayfanın kendi adresi olur (paylaşılabilir, geri tuşu doğru çalışır).
  - Elle yazılan aralık dışı bir sayfa ("?sayfa=99") hata değil, son sayfadır.
  - Sayaç **üst sınırdır:** beğenilen ya da yeniden paylaşılan bir gönderi o
    okur için görünmezse listeden düşer, o yüzden son sayfa eksik kalabilir.
    Uydurma bir sayı göstermemek için sayaç olduğu gibi bırakıldı.
- **Öne çıkan gönderi** artık hangi sekmede ve hangi sayfada olursanız olun
  üyenin kendi gönderilerinden seçiliyor; eskiden açık sekmenin listesinden
  seçiliyordu ve "Yanıtlar" sekmesinde başka bir gönderi öne çıkabiliyordu.
- **Tasarımdan bilerek ayrılan nokta:** Tasarımda şerit sağ sütunda, "Featured
  post" kartının altında duruyor. Bizde taşıdığı listenin altında: sağ sütunda
  dururken sanki öne çıkan gönderiyi sayfalıyormuş gibi görünüyor.

**Hukuk:** Yeni kişisel veri toplanmıyor, yeni bir amaç doğmuyor; aydınlatma
metninde değişiklik gerekmiyor. Engelli hesapların yanıtları kartta da görünmez.

**Doğrulama:** Demo sunucusunda (3002), okur hesabıyla `kerem_okur` profilinde:
birinci sayfada 10 gönderi, şerit "← 1 2 →", etkin sayfa 1; "Son yorumlar"
kartında Ada Y. ve aday_uye'nin üç yanıtı, üyenin kendi yanıtı listede yok.
"Sayfa 2" bağlantısı adresi `?tab=posts&sayfa=2` yapıyor, 3 gönderi geliyor ve
etkin sayfa 2 oluyor; geri oku birinci sayfaya (10 gönderi) dönüyor;
`?sayfa=99` son sayfayı veriyor. Tek yanıtı olan "Yanıtlar" sekmesinde şerit
hiç çizilmiyor. Yatay taşma yok. Kapı: typecheck, lint, 584 test geçti.

**Push:** 0035 üretime uygulandıktan sonra D-149 ile birlikte push edildi.

## D-151 — Çizer: rol değil, hesaba konan bir işaret

**İstek (ürün sahibi):** "panelde çizer alanı oluştur çizerlerde ekstra bir panel
olmayacak sadece çizer olacak hem yazar hem çizer olanlar olacak."

**Durum:** D-087'de `/admin/users/illustrators` sayfası açılmış ama "Henüz çizer
yok." diye boş bırakılmıştı; gerekçe, `role` enum'unda çizer olmamasıydı.
`/hakkinda` sayfasında da "İllüstratörlerimiz ve çizerlerimiz çok yakında bu
sayfada." yazıyordu.

**Karar:**

- **Çizer bir rol değildir, bir işarettir** (`users.is_illustrator`, varsayılan
  `false`). Gerekçe doğrudan istekten geliyor: "hem yazar hem çizer olanlar
  olacak". `role` tek değer tutar; çizer role eklenseydi bir yazar aynı anda
  çizer olamazdı.
- **İşaret hiçbir yetki vermez.** `rbac` dosyalarına tek satır eklenmedi: yalnız
  çizer olan hesap okur hesabı olarak kalır ve hiçbir panele giremez; yazar olan
  yazar panelini eskisi gibi kullanır. "Çizerlerde ekstra bir panel olmayacak"
  şartı böyle sağlanıyor.
- **Rol değişikliği sayılmaz:** `role` değişmediği için `role_changes` kaydı
  yazılmaz; işaretin açılıp kapanması `audit_log`'a `user.illustrator_changed`
  olarak düşer (D-015'teki ekle-yalnızca kural geçerli).
- **Nerede görünür:**
  - `/admin/users/illustrators` artık gerçek bir sorgu: işareti taşıyan herkes.
    Liste rolü de gösterir, böylece "hem yazar hem çizer" olan ayırt edilir.
  - Admin kullanıcı ekranında **Çizer** kartı: işaretle / işareti kaldır.
    Yalnızca admin; editör yapamaz.
  - "Hepsi" listesinde seçilebilir bir **Çizer** sütunu var.
  - `/hakkinda` → "Tasarım ve illüstrasyon" bölümü çizerleri listeler. Yazarlar
    ve editörler gibi: mahlas varsa mahlas, yoksa topluluk adı; gerçek ad asla.
    Yasaklı, silinmiş, anonimleştirilmiş ya da görevi askıya alınmış hesap ve
    hiç genel adı olmayan hesap listelenmez.
- **Bilerek yapılmayanlar:** Yazıya çizer künyesi (hangi görseli kim çizdi)
  eklenmedi; çizer başvurusu ve çizer sözleşmesi yok. İkisi de yeni karar ister.

**Hukuk:**

- **KVKK:** Aydınlatma metnine iki satır eklendi — §2'de "Yazarlık" kaleminin
  içine hesabın çizer olarak işaretlenmiş olması, §4'e "Çizer olarak işaretlenmiş
  hesapların Hakkında sayfasında mahlas veya topluluk adıyla listelenmesi"
  amacı. Metin koddan geri kalmasın diye aynı adımda güncellendi (D-083).
- **FSEK:** Bu işaret bir ruhsat değildir. Bir çizerin eseri dergide
  yayımlanacaksa, yazarlarda olduğu gibi imzalı bir ruhsat gerekir; çizer
  sözleşmesi henüz yok. İşaret yalnızca "bu hesap dergiye çizer" der; tek
  başına hiçbir görselin yayımlanmasına izin vermez.

**Migration:** 0036 (`users.is_illustrator`). **Üretime uygulandı
(2026-09-16);** üretim defteri **36**. Uygulandıktan sonra kolon canlıdan
okundu: `boolean`, null olamaz, varsayılanı `false`, işaretli hesap yok. Kolon
olmadan push edilemezdi — `listUsers` ve `listPublicStaff` onu okuyor, yoksa
admin kullanıcı listeleri ve Hakkında sayfası hata verirdi. Yedek dal yine
açılamadı (ücretsiz planda kota dolu); varsayılanı olan ve mevcut satırlara
dokunmayan bir kolon eklemesi olduğu için veri riski yoktu.

**Doğrulama:** typecheck, lint ve 63 dosya / 589 test geçti. Yeni testler:
işaret rolü değiştirmiyor ve denetim kaydı bırakıyor; bir yazar işareti
taşıyabiliyor; aynı işaret ikinci kez konunca 409, admin olmayanda 403; çizer
listesi mahlasla geliyor, yasaklı ve askıdaki hesap listeye girmiyor; çizer
işareti kimseyi yazar listesinden çıkarmıyor.

## D-152 — "Kategoriye düşen yazılar" listesinde yazının hangi editöre gittiği

**İstek (ürün sahibi):** "kategoriye düşen yazılar kısmında yazının hangi
editöre gittiği de gözüksün."

**Durum:** `/editor/articles` ekranı (başlığı zaten "Kategoriye düşen yazılar")
başlık, yazar, kategori, durum ve güncelleme sütunlarını gösteriyordu. Yazının
hangi editörün kuyruğuna düştüğü ekranda hiç yazmıyordu; bilgi vardı ama
yalnızca alan atama ekranında duruyordu.

**Karar:**

- Tabloya **Editör** sütunu eklendi. Yönlendirme kuralı D-059'dan geliyor:
  yazının kategorisi bir yazı alanıdır, bir alanın tek editörü vardır, o yüzden
  alanı tutan editör yazının düştüğü editördür.
- **Ana editör aşaması ayrı yazılır.** `pending_admin_approval` durumundaki bir
  yazı artık kategori editöründe değil, ana editörün masasındadır; sütun o
  yazılarda ana editörün adını ve "· ana editör" notunu gösterir. Ana editör
  atanmamışsa bunu açıkça söyler.
- **Boşluklar gizlenmiyor:** Kategorisi olmayan yazıda "—", kategorisi bir
  alana denk gelmeyen ya da alanı tutan editörü olmayan yazıda uyarı renginde
  "Atanmamış" yazar. İkisi de gerçek bir eksiktir; liste bunu saklamamalı.
- **Kural tablo hücresinde değil**, saf bir fonksiyonda
  (`src/lib/article-editor.ts` → `editorForArticle`). Böylece veritabanı
  olmadan test edilebiliyor ve ileride başka bir ekran aynı cevabı vermek
  isterse tek yerden alır. Alan adı Türkçe küçük harfe göre eşleşir
  ("PSİKOLOJİ" ile "Psikoloji" aynı alandır).
- **Editörün görünen adı yazılır, mahlası değil.** Panel bir çalışma aracıdır,
  dergi değil; mahlas okura gösterilen addır (D-135).

**Yetki ve veri:** Yeni veri toplanmıyor, yeni yetki verilmiyor. Liste zaten
editörün kendi kapsamındaki yazıları gösteriyor (D-059); sütun yalnızca var
olan alan-editör eşlemesini okuyor. Aydınlatma metninde değişiklik gerekmiyor.

**Doğrulama:** typecheck, lint ve 64 dosya / 594 test geçti. Yeni birim testleri
kuralın beş hâlini sabitliyor: alanı tutan editör, büyük/küçük harf ve boşluk
farkıyla aynı alan, editörü olmayan alan, bilinmeyen alan adı, kategorisi
olmayan yazı ve ana editör aşaması (atanmamış hâli dahil).

Ekran da görüldü: demo sunucusunda editör hesabıyla (ikinci faktör dahil)
`/editor/articles` başlıkları "Başlık · Yazar · Kategori · Editör · Durum ·
Güncelleme" ve seed'in "Sanat & Edebiyat" alanına atadığı editör üç yazının da
satırında "Deniz Editör" olarak çıkıyor. Yatay taşma yok.

**Not — demo veritabanı:** Bu doğrulama sırasında scratchpad'deki pglite demo
veritabanı bozuktu (`58P01: could not open file`, önce `auth_attempts`, sonra
sistem kataloğu). Onarılamadı; bozuk kopya kenara alınıp veritabanı sıfırdan
kuruldu (`db:migrate` + `SEED_DEMO_USERS=1` seed + demo sosyal veri). Ders:
sunucu pglite dizininde tek yazardır, kapatılmadan o dizine yazan bir betik
çalıştırılmamalı.

## D-153 — `postscriptui` taraması: on tasarım dosyasının tamamı ekranlarla karşılaştırıldı

**İstek (ürün sahibi):** "`postscriptui` tasarımın olabildiğince yaklaştığından
emin ol."

**Yöntem:** Her tasarım dosyası karşılık geldiği ekranla eşleştirildi, ekranların
demo sunucusunda **gerçek veriyle** fotoğrafı çekildi (1440 piksel) ve tasarım
render'ıyla yan yana kondu. Daha önce hiçbir kararda adı geçmeyen üç dosya ilk
kez bu adımda karşılaştırıldı: **anon box, bookmarks, notifications**.

**Eşleme:**

| Tasarım | Ekran | Kararlar |
|---|---|---|
| postscript ana sayfa kullanıcı olmayan | `/` (üyesiz) | D-112 |
| postscript ana sayfa kullanıcı olan | `/` (üyeli) | D-112, D-113 |
| contact, about, categories | `/hakkinda`, `/iletisim`, `/kategoriler` | D-112, D-135, D-145, D-146 |
| magazines | `/magazine/issues` | D-114, D-116, D-148 |
| blog | `/social/u/<kullanıcı>` | D-113, D-116, D-150 |
| dm | `/social/messages` | D-113, D-116, D-147 |
| settings and community | `/social/settings` | D-113, D-116, D-136, D-149 |
| anon box | `/social/anon/<kullanıcı>` ve `/social/anon` | D-092, D-113, D-116 |
| bookmarks | `/social/bookmarks` | D-113, D-116 |
| notifications | `/social/notifications` | D-113, D-116, bu karar |

**Bulunan ve düzeltilen tek fark:** Bildirimler ekranında tasarım, sekmeleri ve
"mark all as read" işlemini **tek bir bant** olarak çiziyor. Bizde şerit kâğıt
sütununu kıl payı aştığı için işlem alt satıra düşüyordu. Geniş ekranda (≥900
piksel) bant artık sarmıyor; sekme şeridi gerekirse kendi içinde kayar. Dar
ekranda eski davranış (alt satıra sarma) korundu, çünkü telefonda tek bant
sıkışık olurdu.

> **Değişti (D-154):** Şeridin daralıp kendi içinde kayması, sayfa çerçevesi
> sütunu 30 piksel daraltınca son sekmeyi sessizce gizlemeye başladı. Bant
> artık sıkılaştırılmış aralıklarla 1440 piksele sığıyor; sığmadığı yerde
> kırpmak yerine sarıyor.

**Bilerek duran sapmalar (hepsi gerekçeli):**

- **Kaydedilenler:** Tasarımda kart panosu dörtlü dizilir; bizde kâğıt sütunu
  daha dar olduğu için 1440 pikselde üç kart yan yana gelir. Sabit dört sütun
  denenmedi, çünkü aynısı sayılar sayfasında kart metnini harf harf bölmüştü
  (D-148); ızgara kart genişliğine göre doluyor.
- **Anonim kutu:** Tasarımın kapanış metni yazıların "bize" gönderileceğini ve
  dergide yayımlanacağını söylüyor. Bizde anonim mesaj **tek bir üyeye** gider
  (D-092). Dergiye anonim gönderi ayrı bir ürün kararıdır ve yayımlama,
  moderasyon ve FSEK tarafı düşünülmeden açılmaz.
- **Bildirimler:** "Bahsetmeler" sekmesi tasarımda olduğu için duruyor ama
  bahsetme özelliği yok; sekme "Henüz bahsetme yok." der (D-116). Ayrıca
  "Tümünü okundu işaretle" yalnızca okunmamış bildirim varken çıkar; tasarım
  her zaman çiziyor, ama işlevsiz bir düğme göstermek istemedik.
- **Sayılar:** Tasarımdaki kalp ve beğeni sayısı yok (D-148).
- **Profil:** Sayfa şeridi sağ sütunda değil, taşıdığı listenin altında (D-150).
- **Mesajlar:** "Çevrimiçi" satırı ve okundu tikleri yok (D-091, D-147).
- **Ayarlar:** "settings and community.ai" dosyasının topluluk yarısı hâlâ
  okunamıyor (çizim alanı dışında, Illustrator verisi açılmıyor) — D-149.

**Eski bir kaydın düzeltmesi:** D-113 bildirim sekmelerini "Tümü, Takipçiler,
Beğeniler, Yanıtlar ve Dergi" diye anlatıyor ve tasarımdaki "Mentions"ın
karşılığı olmadığını söylüyordu. Kod o günden beri değişmiş: sekmeler bugün
tasarımdaki beşin karşılığı (Tümü, Takipçiler, Beğeniler, Yorumlar,
Bahsetmeler) ve "Dergi" sekmesi yok; üyeden gelmeyen bildirimler yalnızca
"Tümü" altında görünür (`notificationTab`). Kural değil gerçek doğru kabul
edildi (CLAUDE.md, oturum hijyeni).

**Doğrulama:** Demo sunucusunda okur hesabıyla, ekranlar gerçek veriyle
görüldü: anonim kutu yazma ekranı (afiş, aynı yer tutucu metin, alıntı satırı,
yıldızlı ayraç, "Anonim olarak gönder →", kapanış kutusu), kaydedilenler (iki
kayıtlı gönderi; yazı panosu boş çerçevesiyle duruyor), bildirimler (iki
bildirim satırı: kare avatar, kalın `@kullanıcı`, göreli zaman, okunmadı
noktası, altında çizgili dolgu satırları). Bant düzeltmesi ölçüldü: 1440'ta
sekmeler ve işlem aynı y'de (261) ve beş sekme de görünür; 760'ta işlem alt
satıra sarıyor. Hiçbir ekranda yatay taşma yok. Kapı: typecheck, lint, 64 dosya
/ 594 test.

---
## D-154 — Tebligat UETS'e alınır; D-085'teki "5651 adres ister" ifadesi düzeltildi

**İstek (ürün sahibi):** Fiziksel adres yok; tebligat adresi yerine UETS
kullanılabilir mi?

**Karar:** Resmî tebligat UETS (Tebligat Kanunu m. 7/a) üzerinden alınır.
Künyeye ve aydınlatma metnine ev adresi yazılmaz. Okuyucu başvurusu için
fiziksel adresin yerine bir KEP adresi alınması öneriliyor. Adres/KEP gelene
kadar `[AÇIK ADRES]` yer tutucusu durur ve tam metin yeni sürüm olarak
yayınlanmaz (D-125 kapanış koşulu değişmedi, yalnızca doldurulacak değer
değişebilir).

**Eski bir kaydın düzeltmesi:** D-085 "5651 m. 3 gerçek kişi içerik
sağlayıcıdan ikametgâh veya işyeri adresi ister" diyordu. Yönetmelik metni
(İnternet Ortamında Yapılan Yayınların Düzenlenmesine Dair Usul ve Esaslar
Hakkında Yönetmelik, RG 30.11.2007) okundu:

- Tanıtıcı bilgileri sayan m. 5, **"ticari veya ekonomik amaçlı"** içerik
  sağlayıcılara yöneliktir. Kâr amacı gütmeyen içerik sağlayıcı için ayrı hüküm
  yok; postscript kapsam dışında kalıyor olabilir.
- İstenen bilgi "tebligat adresi" değil, **"yerleşim yeri"**.
- Künyedeki adres tebligat için değil tanıtıcı bilgi olarak isteniyor; bu yüzden
  UETS o satırın yerini tutmaz, yalnızca resmî tebligatı karşılar.

**Neden UETS tek başına yetmez:** UETS'e yalnızca tebligat çıkarmaya yetkili
merciler gönderim yapar. Okuyucu, KVKK başvurusunu (Başvuru Usul ve Esasları
Tebliği) yazılı olarak, KEP, güvenli elektronik imza, mobil imza veya kayıtlı
e-posta ile iletir; UETS bu yollardan biri değildir. Aydınlatma metni §
"Başvuru" şu an yazılı yol için `[AÇIK ADRES]` gösteriyor. KEP adresi bu yolu
fiziksel adres olmadan karşılar.

**Hukukçu görüşü gerekiyor:**

1. Kâr amacı gütmeyen bir dergi olarak Yönetmelik m. 5 kapsamı dışında mıyız?
   Yorumlar nedeniyle yer sağlayıcı sayılıyorsak "ticari veya ekonomik amaçlı"
   niteliği yer sağlayıcıya da uygulanıyor mu?
2. Aydınlatma metninde veri sorumlusunun kimliği için posta adresi yerine KEP
   adresi (+ UETS + e-posta) yeterli mi; yazılı başvuru yolu metinden
   çıkarılabilir mi?
3. 5187 kapsamında internet haber sitesi sayılırsak künye yükümlülüğü ayrıca
   değerlendirilmeli (CLAUDE.md, hukuki uyum).

Görüş gelene kadar muhafazakâr olan uygulanır: metin yeni sürüm olarak
yayınlanmaz, künyedeki "Konak, İzmir" satırı olduğu gibi kalır.

**Kod:** Değişiklik yok.

---
## D-155 — Tasarımların sayfa çerçevesi: iki dikey çizgi ve alt çizgi

**Not:** Bu CSS değişikliği daha önceki bir oturumda yazıldı, ama karar kaydı
yazılmadan commit edilmeden kaldı. Yorumları "D-154"e atıf yapıyordu; o numara
bu arada tebligat kararına verildiği için (D-154) atıflar D-155'e çevrildi.

**Karar:** `postscriptui` tasarımlarının her sayfada çizdiği çerçeve
`src/app/site.css`'te uygulanır:

- Kâğıt 1446 birim genişliğinde. İki dikey çizgi kenarların 16 birim içinde
  (%1,1) duruyor. Kenarda değil içeride oldukları için dışlarında bir kâğıt
  şeridi görünür ve sayfa basılı bir sayfa gibi okunur.
  - `--site-frame-inset: clamp(0.5rem, 1.1%, 0.95rem)`.
- Üçüncü çizgi kâğıdın altından 60 birim yukarıda, iki dikeyin arasında.
  `bottom` içinde yüzde sayfa yüksekliğine göre hesaplanacağı için `vw`
  kullanıldı (`--site-frame-foot`).
- Her sayfa, alt çizgiyi taşıyan boş bir kâğıt bandıyla biter
  (`--site-frame-clear`). Böylece çizgi hiçbir zaman bir kartın veya içeriğin
  üstünden geçmez. `.site-main-padded`'ın alt boşluğu bu banda taşındı.
- Eski `box-shadow` kenar çizgileri kaldırıldı; çizgiler `::before`/`::after`
  ile çiziliyor ve tıklamayı engellemiyor (`pointer-events: none`).

**D-153 ile ilişki:** Bildirimler bandı D-153'te geniş ekranda sarmıyor, sekme
şeridi kendi içinde kayıyordu. Çerçeve 30 piksel alınca bu son sekmeyi sessizce
gizledi. Şimdi bant 1440 pikselde ikisini birlikte taşıyacak kadar sıkı
(sekme dolgusu 0,75rem, harf aralığı 0). Sığmadığı yerde işlem alt satıra
sarar, ama hiçbir sekme kesilmez.

**Hukuk:** Yalnızca görünüm; veri işleme değişmedi.

## D-154 — Tasarımdaki sayfa çerçevesi: kâğıdın içinde kıl çizgiler

**İstek (ürün sahibi):** "tüm sayfaların kenarında çizgi çerçeveler var
`postscriptui`'da, onu uygula."

**Ölçüm:** Göz kararı değil. Tasarım dosyaları pdf.js ile 1:1 çizildi ve
pikseller tarandı — yatayda "anon box" ile üyeli ana sayfa, dikeyde "anon box"
ile "bookmarks". Dört dosyada da aynı çerçeve çıktı:

- Kâğıt 1446 birim genişliğinde. **İki dikey kıl çizgi kenardan 16 birim
  içeride** (%1,1) ve kâğıdın tüm boyunca iniyor. Çizginin dışında ince bir
  kâğıt şeridi kalıyor; sayfayı basılı sayfa gibi okutan o şerit.
- **Kâğıdın kendi kenarında çizgi yok.** Bizde çizgiler tam kenardaydı
  (`box-shadow`); tasarımla asıl fark buydu.
- Üstte başlık altı çizgisi (y=162) — zaten vardı.
- **Altta üçüncü bir çizgi**: kâğıdın bittiği yerden 60 birim yukarıda (%4,15),
  iki dikeyin arasında. İçerik bu çizginin 100 birim üstünde bitiyor; çizgi
  boş kâğıtta duruyor.
- Tam-kanama içerik de çerçeveye uyuyor: ana sayfanın kapak fotoğrafı kâğıt
  kenarından değil, dikey çizginin hizasından başlıyor.

**Karar:**

- Çerçeve `SiteShell`'in kâğıt sütununda (`.site-column`) çiziliyor; o yüzden
  dergi ve topluluk tarafındaki **her sayfa** otomatik alıyor.
  - İki dikey `::before`, alt çizgi `::after`. Kâğıt `padding-inline` ile
    çizgilerin içine çekildi; başlık çizgisi de böylece iki dikeyin arasında
    kalıyor.
  - Oranlar CSS değişkeni: `--site-frame-inset` (%1,1), `--site-frame-foot`
    (alt çizgi), `--site-frame-clear` (içerikle alt çizgi arası).
- **Alt bant kâğıdın kendisinde:** Her sayfa, alt çizgiyi taşıyan boş bir kâğıt
  bandıyla bitiyor. `.site-main-padded`'ın alt boşluğu sıfırlandı, yoksa dolgulu
  sayfalarda iki boşluk üst üste binerdi, tam-kanama sayfalarda hiç olmazdı.
- **Kapsam dışı:** Admin, editör ve yazar panelleri (`PanelShell`) — çalışma
  aracı, dergi değil (D-112). `/kunye` de bu kabukta değil.

**Yolda yakalanan üç hata:**

1. `bottom: %4,15` beklendiği gibi çalışmadı: `bottom`'daki yüzde kapsayıcının
   **yüksekliğinden** çözülür, çizgi sayfanın uzunluğuyla kayıyordu (760'ta
   %7,16 ölçüldü). Değer görüntü genişliğine bağlandı.
2. İlk hâlde alt çizgi **10 sayfanın 7'sinde içerikten geçiyordu** (Hakkında
   sekmeleri, iletişim formu kartı, sayılar ızgarası, profildeki sayfa şeridi):
   içerik kâğıdın altından 3rem önce bitiyor, çizgi 3,4rem yukarıda duruyordu.
   Yukarıdaki boş bant bunun çözümü.
3. **Bildirim bandı gerilemesi:** Çerçeve sütunu 30 piksel daraltınca D-153'teki
   "şerit daralıp kendi içinde kaysın" yaklaşımı son sekmeyi ("Bahsetmeler")
   kesmeye, düğmeyi iki satıra bölmeye başladı. Kırpılmış içerik sarmaktan
   kötü olduğu için yaklaşım değiştirildi: bandın aralıkları sıkılaştırıldı
   (sekme iç boşluğu 0,75rem, harf aralığı 0) ki 1440'a sığsın; sığmadığı yerde
   bant **sarar, hiçbir sekmeyi kesmez**. Hesap: 1440'ta üye menüsüyle kâğıt
   950 px, bant 850 px; sekmeler 573 + düğme 254 + boşluk 12 = 839 px.

**Doğrulama:** Demo sunucusunda ölçüldü.

- Çerçeve, 1440'ta: dikey çizgiler kenardan 15 px (%1,15; tasarım %1,11), alt
  çizgi kâğıt sonundan 54–55 px (tasarımdaki 60 birim = 55 px), içerikle alt
  çizgi arası 91 px (tasarımdaki 100 birim = 91 px). 760'ta içeri çekme %1,1.
- On sayfada (`/`, `/hakkinda`, `/kategoriler`, `/iletisim`, `/magazine`,
  `/magazine/issues`, `/social`, profil, kaydedilenler, bildirimler) alt çizgi
  hiçbir arka planlı ya da kenarlıklı kutunun içinden geçmiyor.
- On altı sayfada kırpılmış şerit yok. Tek istisna ana sayfanın kategori rayı;
  o bilerek kaydırmalı (`overflow-x: auto`, scroll-snap).
- Bildirim bandı: 1100, 1440, 1680 ve 1920'de tek bant, beş sekme tam görünür,
  düğme tek satır. 760'ta düğme alta sarar, sekme kesilmez. 390'da (telefon)
  sekme şeridi kendi içinde kayar — bu D-113'ten beri telefondaki davranış.
- Hiçbir genişlikte yatay sayfa taşması yok.
- Kapı: typecheck, lint, 64 dosya / 594 test.

**Hukuk:** Yalnızca görünüm; yeni veri, yetki ya da metin yok.
