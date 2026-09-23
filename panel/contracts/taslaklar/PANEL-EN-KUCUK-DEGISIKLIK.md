# Panelde açık kabul — uygulanacak en küçük değişiklik

**23 Eylül 2026.** Hazırlandı, **uygulanmadı**. Canlıya dokunulmadı, onay
toplanmadı, sürüm yayımlanmadı.

Hedef dört şey: **(1)** yazar sözleşmesi için açık kabul, **(2)** her eser için
açık kabul, **(3)** kabul edilen tam metnin korunması, **(4)** yazarın kendi
kopyasına erişimi — ve **(5)** izni eksik eserin yayımlanmaması.

---

## Kodda hâlihazırda var olanlar (değişiklik gerekmiyor)

| Ne | Nerede | Durum |
|---|---|---|
| Sözleşme kabul servisi: metni yazara göre render eder, ekranda gösterilen metnin hash'ini doğrular, kabulü + IP + tarayıcı + zaman + **tam metni** (`rendered_markdown`) kaydeder, PDF üretir, **yazara e-postayla gönderir**, denetim kaydı yazar | `src/services/agreements.ts` → `acceptAgreement` | **Tam** |
| Server action | `src/app/writer/actions.ts:52` → `acceptAgreementAction` | **Tam** |
| Okuma kilitli onay bileşeni (son paragraf ekranda görünene kadar düğme kapalı, IntersectionObserver) | `src/app/writer/agreement/accept-form.tsx` | **Tam, duruyor** |
| Eser onayı servisi: hash eşleşme kontrolü, ad/mahlas tercihi, kabul kaydı + IP + zaman, PDF üretir ve **yazara e-postayla gönderir** | `src/services/rights.ts` → `approveWork` | **Tam** |
| **İzni eksik eser yayımlanamaz** | `src/lib/article-status.ts` → geçiş kontrolü: `rightsGrantStatus !== "signed"` ise `scheduled`/`published` reddedilir | **Tam** — hedef (5) zaten karşılanıyor |
| Yazarın kendi PDF'ine erişimi | `src/app/api/media/[id]/route.ts` → `ownsContract()` hem `agreement_acceptances.pdf_media_id` hem `rights_grants.form_pdf_media_id` üzerinden sahipliği kontrol ediyor | **Tam** — hedef (4) karşılanıyor |

Yani servis katmanı, server action, onay bileşeni, yayın kapısı ve yazarın kopya
erişimi **hazır**. Eksik olan üç şey var.

---

## Değişiklik 1 — `/writer/agreement` sayfasını geri getir *(hedef 1)*

**Bugün:** sayfa sabit bir yer tutucu — "Sözleşme metni şu anda hazır değil; size
ayrıca iletilecek." Metni okumuyor, onay düğmesi yok (D-050 ile boşaltıldı). Bu
yüzden **hiçbir yazar panelde sözleşmeyi kabul edemiyor.**

**Yapılacak:** `src/app/writer/agreement/page.tsx` yeniden yazılır:

1. `getCurrentAgreement()` ile yürürlükteki sürüm alınır; yoksa mevcut boş durum
   gösterilir.
2. `renderAgreementForWriter(user)` ile metin bu yazar için render edilir
   (`markdown` + `hash`).
3. Markdown, `renderMarkdown()` ile HTML'e çevrilir (çıktı `rehype-sanitize`'dan
   geçer).
4. `AgreementAcceptForm` bileşenine verilir: `action={acceptAgreementAction}`,
   `csrfToken`, `agreementVersionId={current.id}`, `renderedHash`, `html`.
5. Yazar bu sürümü zaten kabul etmişse form yerine kabul özeti gösterilir:
   sürüm, tarih ve **PDF'e bağlantı** (`/api/media/<pdfMediaId>`) —
   `listAcceptancesForUser(user.id)` bunu zaten döndürüyor.
6. Render hata verirse (`AgreementRenderError`, örn. `dergi.adres` benzeri bir
   ayar boşsa) yazara "sözleşme ayarları eksik" uyarısı, yöneticiye hangi alanın
   eksik olduğu gösterilir.

**Örnek alınacak dosya:** `src/app/writer-application/contract/page.tsx` — aynı
bileşeni aynı biçimde kullanıyor (D-050 onu korumuş).

**Büyüklük:** bir dosya, ~50 satır. Yeni servis, yeni action, yeni tablo yok.

---

## Değişiklik 2 — Eser onayında kabul edilen tam metni sakla *(hedef 3)*

**Bugün:** `rights_grants` yalnızca `form_text_hash` tutuyor. Hash, metnin
değişmediğini kanıtlar ama **metnin kendisini saklamaz.** Sözleşme tarafında
karşılığı var (`agreement_acceptances.rendered_markdown`), eser tarafında yok.

**Yapılacak:**

1. `src/db/schema.ts` → `rightsGrants` içine bir kolon:
   `acceptedBodyMarkdown: text("accepted_body_markdown")` — onay anında yazılır,
   sonradan değiştirilmez.
2. `pnpm db:generate` ile migration üretilir (elle SQL yazılmaz).
3. `src/services/rights.ts` → `approveWork` içinde, `formTextHash: currentHash`
   satırının yanına `acceptedBodyMarkdown: article.bodyMarkdown` eklenir. Metin
   zaten o fonksiyonda elde: hash'i ondan hesaplanıyor.
4. Birim testi: onaydan sonra kaydedilen metnin hash'i `form_text_hash` ile
   eşleşiyor.

**Büyüklük:** bir kolon, bir migration, iki satır servis kodu, bir test.

**Üretim notu:** D-079 gereği migration önce üretime uygulanır, sonra push
edilir. Kolon boş bırakılabilir (`null`) olduğu için veri taşımıyor ve mevcut
satırları etkilemiyor.

---

## Değişiklik 3 — Eser onayı ekranında metni göster *(hedef 2)*

**Bugün:** `/writer/approvals` satırı yazara yalnızca **başlık + SHA-256 özeti +
sözleşme sürümü** gösteriyor. Yazar, onayladığı metni aynı ekranda görmüyor.
"Açık kabul" için metnin kabul anında önünde olması gerekiyor.

**Yapılacak:**

1. `src/app/writer/approvals/page.tsx` → satıra `articleBody` da geçirilir
   (veri zaten elde: `articleHash(approval.articleBody)` orada hesaplanıyor).
2. `approval-row.tsx` → onay kutusunun **üstünde** metin gösterilir
   (`renderMarkdown` ile). Uzun metinler için kaydırmalı bir çerçeve.
3. İsteğe bağlı iyileştirme: `accept-form.tsx`'teki okuma kilidi buraya da
   taşınır (son paragraf görünene kadar onay kutusu kapalı). Zorunlu değil;
   sunucudaki hash kontrolü asıl güvence ve o çalışıyor.

**Büyüklük:** iki dosya, ~30 satır. Yeni servis veya şema yok.

---

## Sıra ve kapılar

1. Değişiklik 1 → `pnpm typecheck && pnpm lint && pnpm test`, tek commit.
2. Değişiklik 2 → şema + `pnpm db:generate` + test; **migration üretime
   uygulanır, sonra** push (D-079).
3. Değişiklik 3 → test + commit.

Üçü bittikten sonra, sözleşme metni kesinleştiğinde: `site_settings`'te
`publisher_partner_2` tam ada çevrilir, sürüm 2 yayımlanır, **ancak ondan sonra**
editörler makaleleri "kabul edildi" yapar (panelin açtığı onay kaydı o an güncel
olan sürümü yazıyor).

## Bu değişiklikten sonra panel ne verir, ne vermez

**Verir:** yazarın tam metni ekranda görüp doğrulanmış hesabıyla açık kabul
vermesi; gösterilen metnin hash'iyle doğrulanması; kabul edilen tam metnin,
tarihin, IP'nin ve tarayıcı bilgisinin saklanması; yazara PDF'in e-postayla
gitmesi ve panelden indirilebilmesi; izni eksik eserin yayımlanamaması.

**Vermez:** bir imza. Panel kaydının FSEK m. 52'deki yazılı şekil şartını
karşılayıp karşılamadığı avukat sorusudur ve bu değişiklik o soruyu
cevaplamıyor — yalnızca hangi cevap gelirse gelsin işe yarayan delil ve
operasyon katmanını kuruyor.
