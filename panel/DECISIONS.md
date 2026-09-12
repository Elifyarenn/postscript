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






