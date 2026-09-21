# TASLAK NOTU — BELGENİN KENDİSİ DEĞİLDİR

> **AVUKAT İNCELEMESİNE SUNULACAK TASLAKTIR. İMZAYA HAZIR DEĞİLDİR.**
>
> Bu belge **her yazı için bir kez** düzenlenir ve Yazar tarafından imzalanır.
> Çerçeve sözleşmenin (`yazar-sozlesmesi-ve-ruhsat-taahhudu-v2-TASLAK.md`)
> Madde 5'inde tanımlanan "Eser İzni" belgesidir ve o sözleşmenin **ekidir**.
>
> **Panel bu belgeyi üretmiyor.** Paneldeki mevcut "Eser Onayı" akışı bir onay
> kutusu + metin özeti + IP + tarih kaydı tutuyor ve tek sayfalık bir PDF
> üretiyor (`src/services/rights.ts`); o PDF **eserin metnini ve verilen hakların
> listesini içermiyor**, "Sözleşme'nin 4. maddesi"ne atıf yapıyor. Bu belge o
> boşluğu kapatır. Belge, panel geliştirmesi beklenmeden **elle doldurulup**
> kullanılabilir: değerler panelden okunur, belge doldurulur, PDF'e çevrilir,
> Yazar imzalar, imzalı kopya Dergi'ye ulaşır.
>
> **Alanların panel karşılıkları** (dolduran kişi için):
>
> | Belgedeki alan | Panelde nerede |
> |---|---|
> | Eser başlığı | `/editor/articles/<id>` — başlık |
> | Son metin sürüm no | `/editor/articles/<id>/versions` — en yüksek sürüm |
> | Son metin özeti (SHA-256) | `/writer/approvals` — "Kabul edilen metnin özeti" |
> | Çerçeve sözleşme sürümü ve özeti | `/writer/agreement` üst bilgi |
> | Görsel sayısı ve lisansları | `/editor/media` + makaleye bağlı medya |
> | Panel kaydı (Eser Onayı no) | `rights_grants.id` — editör panelinde onay satırı |
>
> **Doldurulmadan imzaya gönderilmemesi gerekenler** köşeli parantezle
> gösterildi: `[...]`. Boş bırakılan bir alan varsa belge imzaya gönderilmez.

---

<!-- BELGE BAŞLANGICI — kullanıma alınırken bu satırdan öncesi silinir -->

# POSTSCRIPT DERGİSİ — ESER BAZLI YAYIN İZNİ VE SON METİN ONAYI

**Belge no:** [BELGE NO]
**Düzenlenme tarihi:** [GG/AA/YYYY]
**Şablon sürümü:** [ŞABLON SÜRÜMÜ]
**Panel kaydı (Eser Onayı):** [PANEL KAYIT NO]

Bu belge, 5846 sayılı Fikir ve Sanat Eserleri Kanunu'nun (FSEK) 48, 49, 51, 52 ve
56. maddeleri uyarınca düzenlenmiştir. İzin verilen mali haklar aşağıda **ayrı
ayrı** gösterilmiştir; burada gösterilmeyen hiçbir hak bu belgeyle verilmiş
sayılmaz.

Bu belge, Taraflar arasındaki **Yazar Sözleşmesi ve Kullanım Ruhsatı
Taahhüdü**'nün ekidir ve onunla birlikte yorumlanır.

---

## 1. Taraflar

**Ruhsat alan (Dergi):** Postscript Dergisi

*Postscript Dergisi, [ORTAK 1 AD SOYAD] ve [ORTAK 2 AD SOYAD] arasındaki adi
ortaklıktır ve tüzel kişiliği yoktur. Bu belge her iki ortak adına ve hesabına
düzenlenir.*

Tebligat adresi: [DERGİ TEBLİGAT ADRESİ VEYA KEP ADRESİ]
E-posta: [DERGİ E-POSTA]
İnternet adresi: [DERGİ ALAN ADI]

**Ruhsat veren (Yazar / Eser sahibi):** [YAZAR AD SOYAD]

Doğum tarihi: [GG/AA/YYYY] — E-posta: [YAZAR E-POSTA]
Mahlas (varsa): [MAHLAS]

## 2. Dayanak sözleşme

| | |
|---|---|
| Çerçeve sözleşme | Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü |
| Sürüm | [SÜRÜM NO] |
| Sözleşme metin özeti (SHA-256) | [SÖZLEŞME HASH] |
| Yazar'ın imza tarihi | [GG/AA/YYYY] |

Yazar, yukarıdaki sürümü imzaladığını ve bu belgenin o sözleşmenin Madde 5'i
uyarınca düzenlendiğini kabul eder.

## 3. Eser

| | |
|---|---|
| Başlık | [ESER BAŞLIĞI] |
| Tür / alan | [TÜR] |
| Kategori | [KATEGORİ] |
| Kelime sayısı | [KELİME SAYISI] |
| Eserde kullanılan görsel sayısı | [GÖRSEL SAYISI] |
| Panel kaydı (makale) | [MAKALE KAYIT NO] |

## 4. Son Metin Onayı

| | |
|---|---|
| Son metin sürüm numarası | [SÜRÜM NO] |
| Son metnin özeti (SHA-256) | [METİN HASH] |
| Son metnin bu belgeye eklenmiş hâli | **EK-1** |

4.1. Yazar, **EK-1'de yer alan metnin yayımlanacak son hâli** olduğunu ve
yukarıdaki özetin bu metne karşılık geldiğini beyan eder.

4.2. Yazar, EK-1'deki metni bu belgeyi imzalamadan önce okumuş ve son hâliyle
onaylamıştır.

4.3. Bu belge yalnızca EK-1'deki metin için geçerlidir. Metnin Madde 8'de
tanımlanan biçimde esaslı olarak değişmesi hâlinde bu belge hükümsüz kalır ve
yeni bir belge düzenlenir.

## 5. İzin verilen mali haklar

Aşağıdaki haklar, yalnızca **"Evet"** yazan satırlarla ve yazılı kapsamla sınırlı
olmak üzere, Madde 6'daki mecralar ile Madde 7'deki yer ve süre içinde Dergi'ye
**basit ruhsat** olarak verilir. Bu belge ile mali hak **devri yapılmamakta** ve
**münhasırlık verilmemektedir** (FSEK m. 56/1).

| Hak | FSEK | Kapsam | Verildi mi |
|---|---|---|---|
| Çoğaltma | m. 22 | Eserin dijital ortamda kopyalanması ve Dergi'nin sunucularında/nesne depolamasında barındırılması; yedekleme ve teknik kopyalar | **Evet** |
| Umuma iletim | m. 25 | Eserin Dergi'nin internet sitesinde erişime sunulması ve Madde 6'daki sınırlı tanıtım kullanımı | **Evet** |
| İşleme | m. 21 | Yalnızca: (a) yazım, noktalama ve dil düzeltmesi; (b) tanıtım için 300 kelimeyi aşmayan alıntı çıkarılması; (c) sayfa düzeni, biçim ve ekran boyutuna uyarlama dönüşümleri | **Evet — yalnızca bu üç işlem** |
| Yayma | m. 23 | — | **Hayır** |
| Temsil | m. 24 | — | **Hayır** |

Eserin çevrilmesi, dramatize edilmesi, seslendirilmesi, sesli kitap veya podcast
hâline getirilmesi, kısaltılmış ya da genişletilmiş biçimde yeniden yazılması,
başka bir eser türüne dönüştürülmesi, basılı olarak çoğaltılıp dağıtılması ve
bir yapay zekâ modelinin eğitiminde kullanılması bu belge kapsamı **dışındadır**.

Bu belge, düzenlendiği tarihte mevzuatın tanımadığı hakları ve o tarihte
bilinmeyen kullanım biçimlerini kapsamaz (FSEK m. 51).

## 6. Mecralar

| Mecra | Dahil mi | Sınır |
|---|---|---|
| Dergi'nin internet sitesi | **Evet** | Eserin tamamı |
| Dergi'nin sosyal medya hesapları — tanıtım | **Evet** | Eser başlığı, yazar adı/mahlası, eserin sayfasına bağlantı ve 300 kelimeyi aşmayan alıntı |

**Ek izin — yalnızca Yazar işaretlerse geçerlidir:**

☐ Eserin **tamamının** Dergi'nin sosyal medya hesaplarında paylaşılmasına izin
veriyorum.

Yukarıdaki kutu işaretlenmemişse eserin tamamı sosyal medyada paylaşılmaz.

Burada sayılmayan mecralar — basılı yayın, PDF sayı, e-bülten, üçüncü taraf
platformlar ve benzeri — **kapsam dışıdır** ve her biri için Yazar'ın ayrıca
yazılı izni gerekir.

## 7. Yer, süre, bedel ve ticari kullanım

| | |
|---|---|
| Yer | Dünya geneli (eser internet üzerinden erişime sunulduğu için coğrafi sınır uygulanamaz) |
| Süre | Süresiz; Madde 9 (geri çekme) ve çerçeve sözleşmenin fesih hükümleri saklıdır |
| Münhasırlık | **Yok** — basit ruhsat |
| Bedel | **Yok** — ruhsat bedelsizdir |
| Ticari kullanım | **Hariç** — eser; ücret karşılığı satılan, ödeme duvarı arkasına konulan, reklam geliri elde eden veya sponsorlu bir yayında kullanılamaz |
| Alt ruhsat / devir | **Yasak** — Dergi bu ruhsatı Yazar'ın yazılı izni olmadan üçüncü kişiye devredemez, alt ruhsat veremez (FSEK m. 49) |

## 8. Ad gösterimi tercihi

Yazar, bu eserin aşağıdaki adla yayımlanmasını **seçer** (yalnızca birini
işaretleyiniz):

☐ **Gerçek adımla:** [YAZAR AD SOYAD]

☐ **Mahlasımla:** [MAHLAS]

8.1. Tercih bu eser için sabitlenir.

8.2. Mahlas seçilmişse Yazar'ın gerçek adı, e-posta adresi ve doğum tarihi
Dergi'nin internet sitesinde, açık veri arayüzlerinde ve tanıtım materyallerinde
gösterilmez.

8.3. Dergi, seçilen adı eserden ayrı olarak sayı içindekiler listesinde, yazar
profil sayfasında ve Madde 6'daki tanıtım kullanımında kullanabilir.

## 9. Esaslı değişiklik ve yeniden onay

9.1. **Esaslı değişiklik**, aşağıdakilerden herhangi biridir: paragraf, bölüm
veya cümle eklenmesi ya da çıkarılması; başlığın değiştirilmesi; anlamı, vurguyu
veya üslubu değiştiren ifade değişiklikleri; alıntıların, kaynakların veya
görsellerin değiştirilmesi.

9.2. Yalnızca yazım ve noktalama düzeltmesi, dizgi ve biçimlendirme esaslı
değildir ve yeniden onay gerektirmez.

9.3. Esaslı bir değişiklik yapılırsa bu belge hükümsüz kalır; yeni son metin
için **yeni bir Eser İzni belgesi** düzenlenir ve Yazar tarafından imzalanır.
Yeni belge imzalanmadıkça değiştirilmiş metin yayımlanmaz.

9.4. **Yayımlanmış bir eserin metni yerinde değiştirilmez.** Esaslı bir
değişiklik gerekiyorsa eser önce yayından geri çekilir, yeni izin alındıktan
sonra yeniden yayımlanır.

9.5. Bu belgenin hükümsüz kalması, hükümsüzlük tarihine kadar hukuka uygun
olarak yapılmış kullanımları etkilemez.

## 10. Geri çekme

10.1. Yazar, yayımlanmış eserinin Dergi'nin internet sitesinden kaldırılmasını
Panel üzerinden veya e-posta ile gerekçesiyle talep edebilir. Dergi talebi en geç
**15 gün** içinde yerine getirir.

10.2. Geri çekme üzerine ruhsat, internet sitesi ve sosyal medya mecraları
bakımından sona erer; Dergi daha önce yaptığı tanıtım paylaşımlarını da kaldırır.

10.3. Eserin adresi (URL), geri çekildiği bilgisiyle açık kalır; metin yayında
kalmaz.

10.4. Geri çekme, talep tarihinden önce üçüncü kişilerin kendi imkânlarıyla
aldığı kopyaları, arama motoru önbelleklerini ve internet arşivi kayıtlarını
kapsamaz.

## 11. Yazar'ın beyanları

Yazar, çerçeve sözleşmenin Madde 3'ündeki beyanlarını bu eser için tekrar eder ve
ayrıca:

11.1. EK-1'deki metnin tamamen kendi özgün çalışması olduğunu; eseri üretirken
yapay zekâ araçlarından yararlandıysa bunu Dergi'ye bildirdiğini,

11.2. Eserde kullanılan **[GÖRSEL SAYISI]** görselin her biri için kullanım
hakkına sahip olduğunu veya bu hakkı usulüne uygun biçimde temin ettiğini ve
kaynak/lisans bilgilerini aşağıdaki tabloda doğru biçimde belirttiğini,

| # | Görsel | Kaynak | Lisans / izin dayanağı |
|---|---|---|---|
| 1 | [DOSYA ADI] | [KAYNAK] | [LİSANS] |
| 2 | [DOSYA ADI] | [KAYNAK] | [LİSANS] |

*(Eserde görsel yoksa bu tablo "görsel kullanılmamıştır" yazılarak kapatılır.)*

11.3. Alıntıların FSEK 35. maddesindeki iktibas serbestisi sınırları içinde
kaldığını ve kaynağının belirtildiğini,

11.4. Eserin üçüncü kişilerin fikri mülkiyet, kişilik veya diğer haklarını ihlal
etmediğini; eserde gerçek kişilere ilişkin bilgi varsa bunun hukuka uygun
olduğunu,

11.5. Eser daha önce başka bir yerde yayımlandıysa bunu Dergi'ye bildirdiğini ve
önceki yayının bu izne engel olmadığını: ☐ Daha önce yayımlanmadı ☐ Daha önce
yayımlandı: [NEREDE, NE ZAMAN]

11.6. Bu eser üzerinde üçüncü bir kişiye, bu belgeyle çelişen bir tam ruhsat
vermediğini veya mali hak devretmediğini

beyan eder.

## 12. Yayın izninin doğduğu an

12.1. Eserin Dergi'ye teslim edilmiş, Panel'de "kabul edildi" olarak
işaretlenmiş veya bir sayıya yerleştirilmiş olması **yayın izni sayılmaz.**

12.2. Yayın izni, bu belgenin Yazar tarafından imzalanması ve imzalı kopyanın
Dergi'ye ulaşmasıyla doğar.

12.3. Belge üzerindeki tarih, imzanın **fiilen atıldığı** tarihtir. Geriye dönük
tarihli izin düzenlenmez.

12.4. Dergi, eseri yayımlayıp yayımlamamakta serbesttir; bu belgenin imzalanması
Dergi'ye yayın yükümlülüğü getirmez.

## 13. Şekil

13.1. Bu belge, FSEK 52. maddesindeki yazılı şekil şartını karşılamak üzere
Yazar tarafından **el yazısıyla** veya **güvenli elektronik imza (e-imza / mobil
imza)** ile imzalanır.

13.2. Panel'de verilen onay kaydı (gösterilen metnin özeti, onay tarihi ve saati,
IP adresi ve tarayıcı bilgisi) bu belgenin içeriğini ve tarihini destekleyen bir
**delil kaydı** olarak saklanır; imzalı belgenin yerine geçmez.

13.3. Dergi, imzalı belgeyi teslim aldığında Panel'de eseri "izin alındı" olarak
işaretler.

## 14. Uygulanacak hukuk

Bu belge Türk hukukuna tabidir. Uyuşmazlıklarda kanunda öngörülen genel yetki ve
görev kuralları uygulanır.

---

## İmzalar

**Ruhsat veren (Yazar)**

Ad Soyad: [YAZAR AD SOYAD]
Tarih: ____ / ____ / ________
Yer: ______________________

İmza:


**Ruhsat alan — Postscript Dergisi adına**

Ad Soyad: [ORTAK AD SOYAD]
Tarih: ____ / ____ / ________

İmza:


---

## EK-1 — Yayımlanacak son metin

> Son metnin tamamı bu ekin altına konur. Ekin ilk satırına eserin başlığı, son
> satırına metnin SHA-256 özeti yazılır; özet Madde 4'teki özetle aynı olmalıdır.

**Eser:** [ESER BAŞLIĞI]
**Sürüm:** [SÜRÜM NO]

---

[SON METNİN TAMAMI]

---

**EK-1 metin özeti (SHA-256):** [METİN HASH]

<!-- BELGE SONU -->

---

# Avukata sorular (bu belge için)

1. **Son metnin ek olarak konması** FSEK m. 52 bakımından gerekli mi, yoksa
   metnin SHA-256 özetiyle tanımlanması yeterli mi? Ek koymak belgeyi çok
   uzatıyor; özet tek başına "konusu olan hakların ayrı ayrı gösterilmesi"
   şartını ve eserin belirliliğini karşılar mı?
2. **Madde 6'daki ek izin kutusu** (sosyal medyada eserin tamamı) çerçeve
   sözleşmenin kapsamını genişletiyor. Bu, çerçeve sözleşmenin "kapsam
   genişletilemez" kuralıyla çelişir mi; yoksa eser bazında verilen ayrı bir
   izin olarak geçerli mi?
3. **Madde 9'daki esaslı değişiklik tanımı** yeterince belirli mi? "Anlamı,
   vurguyu veya üslubu değiştiren ifade değişiklikleri" ölçütü uyuşmazlıkta
   işletilebilir mi?
4. **Madde 12.3'teki geriye dönük tarih yasağı** yazılı olarak konmalı mı, yoksa
   gereksiz mi?
5. **Madde 11.2'deki görsel tablosu**: yazarın beyanı yeterli mi, yoksa Dergi'nin
   ayrıca kontrol yükümlülüğü var mı?
6. **Yayma hakkının hiç verilmemesi**, eserin sitede indirilebilir olmadığı bir
   düzende doğru mu? Tarayıcının sayfayı kaydetmesi yayma sayılır mı?
7. **İki belgeli düzen** (çerçeve + eser bazlı) yerine, her eser için tek ve
   kendi kendine yeten bir sözleşme imzalamak daha güvenli olur mu?
8. **Dergi tarafında tek ortağın imzası** yeterli mi, iki ortağın da imzalaması
   mı gerekir?
