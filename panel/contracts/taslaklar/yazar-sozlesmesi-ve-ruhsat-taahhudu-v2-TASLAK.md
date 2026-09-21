# TASLAK NOTU — YAYINLANACAK METNE DAHİL DEĞİLDİR

> **AVUKAT İNCELEMESİNE SUNULACAK TASLAKTIR. İMZAYA / YAYINA HAZIR DEĞİLDİR.**
>
> Bu dosya `panel/contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`'nin (sürüm 1)
> yerine geçmek üzere hazırlanmış **sürüm 2 taslağıdır**. Mevcut dosya
> değiştirilmedi. Kod, veritabanı, canlı metinler ve mevcut kabul kayıtlarına
> dokunulmadı.
>
> **Yayına alınırken:** aşağıdaki `ŞABLON BAŞLANGICI` satırına kadar olan her şey
> silinir, kalan metin `panel/contracts/yazar-sozlesmesi-ve-ruhsat-taahhudu.md`
> üzerine yazılır ve admin "Sistem" sayfasından "şablondan sürüm oluştur" ile
> yayınlanır. Panel şablonu sabit dosya adıyla okuduğu için
> (`src/lib/agreement/template.ts:14`) bu taslak dosyası **canlı akışa
> karışmaz** — `taslaklar/` alt klasörü şablon yükleyicisi tarafından görülmez.
>
> **Yer tutucu kısıtı (teknik):** Şablon yalnızca şu 18 anahtarı tanır ve
> tanımadığı bir `{{...}}` görürse sürüm oluşturmayı **hata ile reddeder**
> (`src/lib/agreement/render.ts:180`): `dergi.ortak_1`, `dergi.ortak_2`,
> `dergi.adres`, `dergi.eposta`, `dergi.domain`, `dergi.sehir`,
> `yazar.ad_soyad`, `yazar.dogum_tarihi`, `yazar.eposta`, `yazar.mahlas`,
> `agreement.version`, `agreement.published_at`, `agreement.body_hash`,
> `kvkk.version`, `acceptance.accepted_at`, `acceptance.ip`. Bu taslak yalnızca
> bu anahtarları kullanır; **köşeli parantezli yer tutucu bırakılmadı**, çünkü
> `[...]` şablonda hata vermez, olduğu gibi yayımlanır.
>
> **Doldurulması gereken tek veri:** `{{dergi.adres}}`, `site_settings`'ten
> gelir ve canlıda bugün "Konak, İzmir" yazıyor. Bu bir açık adres değildir
> (bkz. `panel/HUKUK-RAPORU.md` §5.3, Ç3). Karar verilmeden sürüm yayınlanırsa
> sözleşme eksik adresle imzalanır. KEP adresi alınırsa aynı alana yazılabilir,
> ancak ayrı bir "KEP" alanı yoktur; ayrı alan istenirse `site_settings` ve
> yer tutucu sözlüğü genişletilmelidir (ürün işi, bu taslağın ön koşulu değil).

## Sürüm 1'e göre değişenler (özet)

| # | Değişiklik | Gerekçe |
|---|---|---|
| 1 | **PDF Sayı** mecrası ve **yayma hakkı (m. 23)** tamamen çıkarıldı | Üründe PDF sayı yok ve "Yapılmayacaklar" listesinde. Kullanılmayan mecra için hak istenmez |
| 2 | **E-bülten** mecrası çıkarıldı | Üründe e-bülten yok |
| 3 | Sosyal medyada **eserin tamamının** yayımlanması izni kaldırıldı; tanıtım amaçlı sınırlı alıntıyla sınırlandı | Dergiye gereken bu; tamamının paylaşımı istenirse eser bazlı izinde ayrıca işaretlenir |
| 4 | Temsil yetkisi beyanı değişti: Sözleşme **her iki ortak adına ve hesabına** kurulur, ortaklar birlikte sorumludur | "Ortaklardan her biri tek başına temsile yetkilidir" beyanının yazılı bir ortaklık sözleşmesi dayanağı yok |
| 5 | **Şekil ve imza maddesi baştan yazıldı:** ıslak imza veya güvenli elektronik imza esas; panel onayı destekleyici delil kaydı | FSEK m. 52'deki yazılı şekil şartını tartışmasız karşılamak için |
| 6 | **Teyit maddesi** eklendi: daha önce panelde verilmiş onayların konusu eserler bakımından bu Sözleşme ve eser bazlı izin uygulanır | Geçmişi geçerli/geçersiz ilan etmeden yazılı zemine almak için |
| 7 | **Arşivde tutma** maddesi eklendi | v1'de yoktu; eserin sayı arşivinde kalması, geri çekilen eserin adresinin açık kalması ve sürüm geçmişinin saklanması yazılı hâle geldi |
| 8 | **Alt ruhsat ve devir yasağı** eklendi (FSEK m. 49) | Dergi ruhsatı üçüncü kişiye aktaramaz; yazar lehine |
| 9 | **İleride doğacak haklar ve bilinmeyen kullanım biçimleri** kapsam dışı bırakıldı (FSEK m. 51) | Böyle bir kapsam batıl olurdu |
| 10 | **Esaslı değişiklik** tanımlandı ve yeniden onay usulü yazıldı | v1 "içerik değişikliği" diyordu, tanımı yoktu |
| 11 | Yetkili mahkeme kaydı **çıkarıldı**, yerine genel yetki kuralları | Taraflar tacir olmadığı için yetki sözleşmesi HMK m. 17 karşısında tartışmalı |
| 12 | **Ekler** maddesi eklendi: her eser izni Sözleşme'nin ekidir | İki belgeli yapıyı hukuken bağlar |
| 13 | Yazarın kamuya açık olmayan verileri (gerçek ad, e-posta, doğum tarihi) açıkça sayıldı | Kodun fiilen yaptığı şey (public API bunları hiç döndürmüyor) yazıya geçti |
| 14 | "Sözleşmenin kabulü yayın izni değildir" ve "eserin teslimi izin sayılmaz" açıkça yazıldı | En kritik yanlış anlaşılma riski |

**Avukat kontrolü gereken noktalar bu dosyanın en sonunda, "Avukata sorular"
başlığı altındadır.**

---

<!-- ŞABLON BAŞLANGICI — yayına alınırken bu satırdan öncesi silinir -->

# POSTSCRIPT DERGİSİ — YAZAR SÖZLEŞMESİ VE KULLANIM RUHSATI TAAHHÜDÜ

**Sürüm:** {{agreement.version}}
**Yayın tarihi:** {{agreement.published_at}}

---

## Taraflar

**Dergi (Ruhsat alan):** Postscript Dergisi

*Postscript Dergisi, {{dergi.ortak_1}} ve {{dergi.ortak_2}} arasındaki adi
ortaklıktır ve tüzel kişiliği yoktur. Bu Sözleşme, her iki ortak adına ve
hesabına kurulur; ortaklar Sözleşme'den doğan borçlardan birlikte sorumludur.
Dergi adına yapılacak bildirimler aşağıdaki e-posta adresine yapılır.*

Tebligat adresi: {{dergi.adres}}
E-posta: {{dergi.eposta}}
İnternet adresi: {{dergi.domain}}

**Yazar (Eser sahibi, Ruhsat veren):** {{yazar.ad_soyad}}
Doğum tarihi: {{yazar.dogum_tarihi}} — E-posta: {{yazar.eposta}} — Mahlas: {{yazar.mahlas}}

Aşağıda Dergi ve Yazar birlikte "Taraflar" olarak anılır.

---

## Madde 1 — Konu, Kapsam ve Belge Düzeni

1.1. Bu Sözleşme, Yazar'ın Postscript Dergisi'ne gönüllü olarak yazı katkısında
bulunmasına ilişkin genel şartları ve Yazar'ın Dergi'ye yayımlanmak üzere teslim
edeceği yazılı eserler üzerinde Dergi'ye vereceği kullanım ruhsatına ilişkin
taahhüdünü düzenler.

1.2. Bu Sözleşme, 5846 sayılı Fikir ve Sanat Eserleri Kanunu'nun (FSEK) 50.
maddesi anlamında, Yazar'ın ileride vücuda getireceği ve Dergi'ye teslim edeceği
yazılı eserlerden oluşan muayyen bir nevi eser hakkında verilmiş bir **ruhsat
taahhüdüdür**.

1.3. **Bu Sözleşme'nin imzalanması, hiçbir eser için yayın izni değildir.** Her
bir eser üzerindeki ruhsat, ancak o eser vücuda getirilip Dergi'ye teslim
edildikten ve Madde 5'teki usulle **"Eser Bazlı Yayın İzni ve Son Metin
Onayı"** belgesi düzenlenip Yazar tarafından imzalandıktan sonra doğar.

1.4. **Bir eserin Dergi'ye teslim edilmiş, panelde "kabul edildi" olarak
işaretlenmiş veya bir sayıya yerleştirilmiş olması yayın izni sayılmaz.**
Madde 5'teki belge imzalanmadıkça eser hiçbir mecrada yayımlanmaz.

1.5. Madde 5 uyarınca imzalanan her Eser İzni bu Sözleşme'nin **ekidir** ve
Sözleşme ile birlikte yorumlanır. Sözleşme ile bir Eser İzni arasında çelişki
olması hâlinde, o eser bakımından Eser İzni'nin daha dar olan hükmü uygulanır.

1.6. Madde 4'te gösterilmeyen hiçbir hak, Madde 4.3'te sayılmayan hiçbir mecra
ve Madde 4.6'da izin verilmeyen hiçbir kullanım bu Sözleşme ile verilmiş
sayılmaz.

## Madde 2 — Tanımlar

- **Eser:** Yazar tarafından Dergi'ye yayımlanmak üzere teslim edilen, FSEK
  kapsamında korunan yazılı metin.
- **Panel:** Dergi'nin yazar ve editörlerin kullandığı web tabanlı yönetim
  sistemi.
- **Eser İzni:** Madde 5'te tanımlanan, belirli bir eser için düzenlenen ve
  Yazar tarafından imzalanan "Eser Bazlı Yayın İzni ve Son Metin Onayı" belgesi.
- **Son Metin:** Eser İzni'ne ek olarak konulan ve özeti (SHA-256) belgede
  gösterilen, yayımlanacak metnin son hâli.
- **Sayı:** Dergi'nin belirli bir dönemde birlikte yayımladığı eserler bütünü.
- **Esaslı Değişiklik:** Madde 6.3'te tanımlanan değişiklik.

## Madde 3 — Yazar'ın Beyanları

Yazar, bu Sözleşme'yi imzalamakla ve her Eser İzni'nde o eser için tekrar etmek
üzere aşağıdakileri beyan ve taahhüt eder:

3.1. On sekiz yaşını doldurmuş olduğunu ve tam fiil ehliyetine sahip
bulunduğunu.

3.2. Teslim ettiği her eserin kendi özgün fikri çalışması olduğunu; başkasına
ait bir eserin tamamını veya bir kısmını kendi eseri gibi sunmadığını; eseri
üretirken yapay zekâ araçlarından yararlandıysa bunu Dergi'ye bildirdiğini.

3.3. Eserlerinde yer verdiği alıntıların FSEK 35. maddesindeki iktibas
serbestisi sınırları içinde kaldığını ve kaynağının belirtildiğini.

3.4. Eserle birlikte teslim ettiği görsel, fotoğraf, grafik ve benzeri
materyalin kullanım hakkına sahip olduğunu veya bu hakkı usulüne uygun biçimde
temin ettiğini; her birinin kaynağını ve lisans bilgisini Panel'de ve Eser
İzni'nde belirttiğini.

3.5. Eserin üçüncü kişilerin fikri mülkiyet, kişilik veya diğer haklarını ihlal
etmediğini; eserde gerçek kişilere ilişkin bilgi yer alıyorsa bunun hukuka uygun
olduğunu; eser daha önce başka bir yerde yayımlanmışsa bunu bildirdiğini ve
önceki yayının bu ruhsata engel olmadığını; eser üzerinde bu Sözleşme ile
çelişen bir tam ruhsat vermediğini veya mali hak devretmediğini.

3.6. İhlal iddiası hâlinde Dergi'nin, bildirim üzerine eseri yayından kaldırma
hakkı bulunduğunu; kaldırmanın Dergi bakımından bir ihlal kabulü sayılmadığını
ve bu iddialardan doğan sorumluluğun Yazar'a ait olduğunu.

## Madde 4 — Ruhsat Taahhüdünün Kapsamı

Yazar, Madde 5 uyarınca imzaladığı her Eser İzni ile o eser için Dergi'ye
aşağıdaki şartlarla kullanım ruhsatı vermeyi taahhüt eder. Bu şartlar asgari ve
azami kapsamdır; bir Eser İzni bu kapsamı daraltabilir, **genişletemez**.

### 4.1. Ruhsatın türü

**Basit ruhsat** (FSEK m. 56/1). Eserin mali hakları Yazar'da kalır. Yazar, aynı
eser için başkalarına da ruhsat verebilir ve eseri başka yerlerde yayımlayabilir.
Bu Sözleşme ile mali hak **devri yapılmamakta** ve **hiçbir münhasır (tam)
ruhsat verilmemektedir**. Aksi açıkça kararlaştırılmadığı için ruhsat her hâlde
basit ruhsat sayılır.

### 4.2. Ruhsat kapsamındaki mali haklar

FSEK 52. maddesi gereği haklar ayrı ayrı gösterilmiştir:

| Hak | FSEK | Kapsam | Verildi mi |
|---|---|---|---|
| Çoğaltma | m. 22 | Eserin dijital ortamda kopyalanması ve Dergi'nin sunucularında/nesne depolamasında barındırılması; yedekleme ve teknik kopyalar | **Evet — yalnızca bu amaçlarla** |
| Umuma iletim | m. 25 | Eserin Dergi'nin internet sitesinde ({{dergi.domain}}) erişime sunulması ve Madde 4.3'teki sınırlı tanıtım kullanımı | **Evet** |
| İşleme | m. 21 | Yalnızca: (a) yazım, noktalama ve dil düzeltmesi; (b) tanıtım için 300 kelimeyi aşmayan alıntı çıkarılması; (c) sayfa düzeni, biçim ve ekran boyutuna uyarlama dönüşümleri | **Sınırlı — yalnızca kapsam sütunundaki işlemler** |
| Yayma | m. 23 | — | **Hayır — verilmedi** |
| Temsil | m. 24 | — | **Hayır — verilmedi** |

Eserin başka bir dile çevrilmesi, dramatize edilmesi, seslendirilmesi, sesli
kitap veya podcast hâline getirilmesi, kısaltılmış veya genişletilmiş biçimde
yeniden yazılması, başka bir eser türüne dönüştürülmesi, basılı olarak
çoğaltılması ve dağıtılması ile bir yapay zekâ modelinin eğitiminde
kullanılması bu Sözleşme kapsamı **dışındadır**.

### 4.3. Mecralar

| Mecra | Dahil mi | Sınır |
|---|---|---|
| Dergi'nin internet sitesi ({{dergi.domain}}) | **Evet** | Eserin tamamı |
| Dergi'nin sosyal medya hesapları | **Evet — yalnızca tanıtım** | Eser başlığı, yazar adı/mahlası, eserin sayfasına bağlantı ve Madde 4.2'deki 300 kelimeyi aşmayan alıntı. Eserin tamamının paylaşılması bu Sözleşme kapsamında **değildir**; yalnızca Eser İzni'nde ayrıca işaretlenmişse yapılabilir |

Burada sayılmayan mecralar — basılı yayın, PDF sayı, e-bülten, üçüncü taraf
platformlar, uygulama içi yayın ve benzeri — kapsam dışıdır ve her biri için
Yazar'ın ayrıca yazılı izni gerekir. Dergi ileride yeni bir mecra kullanmak
isterse bu Sözleşme'nin yeni bir sürümünü yayımlar veya ilgili eser için ek bir
izin belgesi düzenler.

### 4.4. Yer ve süre

- **Yer:** Dünya geneli. Eser internet üzerinden erişime sunulduğu için coğrafi
  sınır uygulanamaz.
- **Süre:** Ruhsat, Eser İzni tarihinden itibaren **süresizdir**; Madde 9 (geri
  çekme), Madde 10 (arşiv) ve Madde 14 (fesih) hükümleri saklıdır.

### 4.5. Bedel

**Bedel: Yok.** Ruhsat bedelsizdir. Yazar bu ruhsat karşılığında Dergi'den
herhangi bir ödeme, telif ücreti veya başka bir karşılık talep etmeyeceğini
kabul eder. Dergi de Yazar'dan herhangi bir ödeme talep etmez.

### 4.6. Ticari kullanım

**Hariç.** Dergi eseri; ücret karşılığı satışa sunulan, ödeme duvarı arkasına
konulan, reklam geliri elde eden veya sponsorlu herhangi bir yayında kullanamaz.
Dergi'nin kâr amacı gütmeyen olağan yayın faaliyeti ticari kullanım sayılmaz.
Dergi ileride gelir elde eden bir modele geçerse bu Sözleşme'nin yeni bir
sürümünü yayımlar ve Yazar'ın onayını alır.

### 4.7. İleride doğacak haklar ve bilinmeyen kullanım biçimleri

Bu Sözleşme, imzalandığı tarihte mevzuatın tanımadığı hakları ve o tarihte
bilinmeyen kullanım biçimlerini kapsamaz (FSEK m. 51). Böyle bir kullanım
gerekirse Taraflar ayrıca anlaşır.

### 4.8. Alt ruhsat ve devir yasağı

Dergi, bu Sözleşme ve Eser İzni ile edindiği kullanma ruhsatını Yazar'ın yazılı
izni olmaksızın üçüncü bir kişiye devredemez ve alt ruhsat veremez (FSEK m. 49).
Barındırma, depolama ve e-posta gibi teknik hizmet sağlayıcıların eseri Dergi
adına ve Dergi'nin talimatıyla işlemesi devir sayılmaz.

## Madde 5 — Ruhsatın Her Eser İçin Doğması (Eser İzni)

5.1. FSEK 48/3 uyarınca henüz vücuda getirilmemiş bir eser üzerinde tasarrufta
bulunulamaz. Bu nedenle her eser için ruhsat, o eser Dergi'ye teslim edildikten
ve Dergi tarafından yayına kabul edildikten sonra düzenlenen **Eser İzni**
belgesinin Yazar tarafından imzalanmasıyla doğar.

5.2. Eser İzni belgesinde en az şunlar bulunur: Yazar'ın kimliği, eserin
başlığı, **yayımlanacak son metnin sürüm numarası ve SHA-256 özeti**, son metnin
belgeye eklenmiş hâli (EK-1), izin verilen mali hakların ayrı ayrı listesi,
mecralar, yer, süre, bedel, ticari kullanım durumu, Yazar'ın ad/mahlas tercihi,
eserde kullanılan görseller ve lisans bilgileri, imza yeri ve **tarih**.

5.3. Yazar, Eser İzni'ni imzalamakla EK-1'deki metnin yayımlanacak **son hâl**
olduğunu ve belgedeki özetin bu metne karşılık geldiğini teyit eder.

5.4. **Eser İzni imzalanmamış hiçbir eser Dergi tarafından hiçbir mecrada
yayımlanmaz.** Bu kural, eserin daha önce teslim edilmiş, kabul edilmiş veya
bir sayıya yerleştirilmiş olması hâlinde de uygulanır.

5.5. Belge üzerindeki tarih, imzanın **fiilen atıldığı** tarihtir. Geriye dönük
tarihli izin düzenlenmez.

5.6. Yazar, Eser İzni vermeyi gerekçesiyle reddedebilir. Ret hâlinde eser
yayımlanmaz; Dergi eseri iade eder veya Yazar'la yeniden görüşür.

5.7. Eser İzni verildikten sonra o eserin ruhsat kapsamı değiştirilemez. Kapsam
değişikliği gerekirse Dergi mevcut izni iptal eder ve Yazar'dan yeni bir Eser
İzni ister; iptal, iptal tarihine kadar hukuka uygun olarak yapılmış
kullanımları etkilemez.

5.8. Dergi, imzalanmış her Eser İzni'nin bir kopyasını Yazar'a e-posta ile
gönderir ve Panel'den indirilebilir hâlde tutar.

## Madde 6 — Editoryal Süreç ve Eserde Değişiklik

6.1. Dergi, teslim edilen eseri yayımlayıp yayımlamamakta serbesttir. Eserin
Panel'de "kabul edildi" olarak işaretlenmesi veya Eser İzni'nin imzalanmış
olması yayın taahhüdü doğurmaz; Dergi eseri erteleyebilir veya yayından
vazgeçebilir.

6.2. Dergi editörleri, Madde 4.2'deki sınırlı işleme yetkisi çerçevesinde
yazım, noktalama, dil ve biçim düzeltmesi yapabilir. **İçeriği, anlamı, üslubu
veya yapıyı değiştiren müdahaleler Yazar'ın ayrıca onayına bağlıdır**
(FSEK m. 16). Editörler Panel üzerinden revizyon talep edebilir; Yazar talebi
kabul edip etmemekte serbesttir.

6.3. **Esaslı Değişiklik**, Madde 4.2'deki (a) ve (c) bentleri kapsamına
girmeyen her değişikliktir. Özellikle şunlar esaslıdır: paragraf, bölüm veya
cümle eklenmesi ya da çıkarılması; başlığın değiştirilmesi; anlamı, vurguyu veya
üslubu değiştiren ifade değişiklikleri; alıntıların, kaynakların veya
görsellerin değiştirilmesi. Yalnızca yazım/noktalama düzeltmesi, dizgi ve
biçimlendirme esaslı değildir.

6.4. Bir Esaslı Değişiklik yapılırsa mevcut Eser İzni iptal edilir ve yeni son
metin için **yeni bir Eser İzni** düzenlenir. Yeni izin imzalanmadıkça eser
yayımlanmaz; yayımlanmışsa değiştirilmiş metin yayına alınmaz.

6.5. **Yayımlanmış bir eserin metni yerinde değiştirilmez.** Esaslı bir
değişiklik gerekiyorsa eser önce yayından geri çekilir; yeni izin alındıktan
sonra yeniden yayımlanır.

6.6. Eserin bir Sayı içindeki sırası, başlığın tipografik sunumu ve sayfa
düzeni Dergi'nin takdirindedir.

## Madde 7 — Ad Belirtme

7.1. Eserler, Yazar'ın Eser İzni'nde belirlediği tercihe göre gerçek adıyla veya
mahlasıyla yayımlanır (FSEK m. 15). Tercih her eser için ayrı ayrı yapılır ve o
eser için sabitlenir.

7.2. Mahlas tercih edilmişse Yazar'ın gerçek adı, e-posta adresi ve doğum tarihi
Dergi'nin internet sitesinde, açık veri arayüzlerinde ve tanıtım materyallerinde
**hiçbir koşulda** gösterilmez.

7.3. Dergi, Yazar'ın adını veya mahlasını eserden ayrı olarak Sayı içindekiler
listesinde, yazar profil sayfasında ve Madde 4.3'teki sınırlı tanıtım
kullanımında kullanabilir.

7.4. Yazar, sonradan yaptığı bir ad/mahlas değişikliğinin yayımlanmış
eserlerine de uygulanmasını Dergi'den talep edebilir. Dergi bu talebi en geç 15
gün içinde yerine getirir.

## Madde 8 — Bedel ve İlişkinin Niteliği

8.1. Postscript Dergisi kâr amacı gütmez. Yazar'ın katkısı gönüllüdür; Yazar'a
herhangi bir bedel, telif ücreti veya başka bir karşılık ödenmez.

8.2. Bu Sözleşme Taraflar arasında iş, hizmet, vekâlet, ortaklık veya temsil
ilişkisi doğurmaz. Yazar, Dergi adına beyanda bulunamaz; Dergi de Yazar'a
çalışma saati, yer veya miktar yükümlülüğü getirmez.

8.3. Yazar, Dergi'ye eser teslim etmek zorunda değildir; Dergi de Yazar'dan eser
istemek zorunda değildir.

## Madde 9 — Geri Çekme

9.1. Yazar, yayımlanmış bir eserinin Dergi'nin internet sitesinden
kaldırılmasını Panel üzerinden veya e-posta ile gerekçesiyle talep edebilir.
Dergi talebi en geç **15 gün** içinde yerine getirir.

9.2. Geri çekilen eser için ruhsat, kaldırma tarihinden itibaren internet sitesi
ve sosyal medya mecraları bakımından sona erer. Dergi, sosyal medyada daha önce
yaptığı tanıtım paylaşımlarını da aynı süre içinde kaldırır.

9.3. Eserin adresi (URL), eserin geri çekildiği bilgisiyle birlikte açık kalır;
metin yayında kalmaz.

9.4. Geri çekme, talep tarihinden önce üçüncü kişilerin kendi imkânlarıyla
aldığı kopyaları, arama motoru önbelleklerini ve internet arşivi
hizmetlerindeki kayıtları kapsamaz. Dergi, kendi kontrolündeki kopyaları
kaldırmakla yükümlüdür; üçüncü kişilerin elindeki kopyalar için Yazar'a yardımcı
olur ancak sonuç taahhüdü vermez.

## Madde 10 — Arşiv ve Kayıtların Saklanması

10.1. Yayımlanan eser, geri çekilmediği sürece Dergi'nin sayı arşivinin bir
parçası olarak erişilebilir kalır.

10.2. Dergi, eserin Panel'deki **sürüm geçmişini** ve editoryal kayıtlarını, bu
Sözleşme sona erdikten sonra da mevzuatın öngördüğü süreler boyunca saklar. Bu
kayıtlar yayımlanmaz; yalnızca Dergi'nin hukuki yükümlülüklerini yerine
getirmesi ve ruhsatın kapsamının ispatı için tutulur.

10.3. İmzalanmış Sözleşme ve Eser İzni belgeleri, ruhsatın dayanağı olduğu için
Sözleşme sona erdikten sonra da saklanır. Saklama süreleri ve dayanakları
Dergi'nin aydınlatma metninde açıklanmıştır (Madde 12).

## Madde 11 — Gizlilik

Yazar; Panel'de gördüğü editör notlarını, diğer yazarların yayımlanmamış
eserlerini, Sayı planlarını ve Dergi'nin iç yazışmalarını üçüncü kişilerle
paylaşmaz. Bu yükümlülük Sözleşme sona erdikten sonra da devam eder.

## Madde 12 — Kişisel Veriler

12.1. Yazar'ın kişisel verileri, Dergi'nin "Kişisel Verilerin Korunması
Aydınlatma Metni"nde (yürürlükteki sürüm: {{kvkk.version}}) açıklanan amaç,
hukuki sebep ve şartlarla işlenir. Aydınlatma metni Dergi'nin internet
sitesinde herkese açıktır.

12.2. Yazar, mahlasının, kısa biyografisinin, profil görselinin, yazı alanının
ve Panel'de girdiği sosyal medya bağlantılarının Dergi'nin internet sitesindeki
yazar profil sayfasında kamuya açık olarak yayımlanmasını kabul eder.

12.3. Yazar'ın **gerçek adı** (mahlas kullanıyorsa), **e-posta adresi**,
**doğum tarihi** ve **telefon numarası** hiçbir koşulda kamuya açık gösterilmez
ve Dergi'nin açık veri arayüzlerinde yer almaz.

12.4. Bu Madde bir aydınlatma metni değildir ve aydınlatma metninin yerine
geçmez.

## Madde 13 — Bildirimler

13.1. Taraflar arasındaki bildirimler bu Sözleşme'de belirtilen e-posta
adreslerine yapılır. Dergi ayrıca Panel'deki duyuru sistemini kullanır; "onay
gerektiren" olarak işaretlenmiş duyurular Yazar tarafından okunup onaylanana
kadar Panel'in diğer işlevleri kullanılamaz.

13.2. Yazar, e-posta adresi değişikliğini Panel üzerinden günceller;
güncellenmemiş adrese yapılan bildirimler geçerli sayılır.

## Madde 14 — Süre ve Fesih

14.1. Bu Sözleşme belirsiz sürelidir.

14.2. Taraflardan her biri, diğer tarafa e-posta ile bildirmek suretiyle bu
Sözleşme'yi feshedebilir. Fesih, Madde 4 ve 5'teki ruhsat taahhüdü bakımından
FSEK 50. maddesi uyarınca ihbar tarihinden **bir yıl** sonra; diğer hükümler
bakımından ihbar tarihinden **15 gün** sonra hüküm ifade eder. Bir yıllık süre
içinde Yazar yeni eser teslim etmekle yükümlü değildir.

14.3. Fesih, feshe kadar Eser İzni imzalanmış eserlerin ruhsatlarını etkilemez;
bu ruhsatlar Madde 4, 5, 9 ve 10 hükümlerine göre devam eder.

14.4. Dergi, Madde 3 veya Madde 11'in ihlali hâlinde Sözleşme'yi derhal
feshedebilir ve Yazar'ın Panel erişimini kapatabilir.

14.5. FSEK 50/3'te sayılan hâllerde (Yazar'ın ölümü, eseri tamamlama yeteneğini
yitirmesi, kusuru olmaksızın tamamlamanın imkânsızlaşması) ruhsat taahhüdü,
henüz Eser İzni imzalanmamış eserler bakımından kendiliğinden sona erer.

## Madde 15 — Sözleşme Sürümleri

15.1. Dergi bu Sözleşme'nin yeni bir sürümünü yayımlayabilir. Yeni sürüm
Yazar'a e-posta ve Panel üzerinden bildirilir.

15.2. Yeni sürüm Yazar tarafından imzalanana kadar Yazar'ın Panel'deki
yazarlık işlevleri askıya alınır; bekleyen Eser İzinleri yeni sürüm
imzalandıktan sonra verilebilir.

15.3. Yeni sürüm, önceki sürüm altında imzalanmış Eser İzinlerinin ruhsat
kapsamını değiştirmez.

15.4. Yazar, imzaladığı her sürümün ve her Eser İzni'nin bir kopyasını
Panel'den indirebilir.

## Madde 16 — Şekil ve İmza

16.1. FSEK 52. maddesi, mali haklara dair sözleşme ve tasarrufların **yazılı
olmasını** ve konuları olan hakların **ayrı ayrı gösterilmesini** şart koşar.
Tarafların amacı bu şartı tartışmaya yer bırakmayacak biçimde karşılamaktır.

16.2. Bu Sözleşme ve her Eser İzni, Yazar tarafından aşağıdaki yollardan
**biriyle** imzalanır:

   (a) **El yazısıyla imza:** Yazar belgeyi çıktı alıp imzalar, imzalı belgeyi
   tarar veya fotoğraflar ve Dergi'ye Panel üzerinden ya da e-posta ile
   iletir. Belgenin aslını kendisi saklar; Dergi talep ederse aslını ibraz
   eder.

   (b) **Güvenli elektronik imza:** Yazar belgeyi nitelikli elektronik
   sertifikaya dayalı güvenli elektronik imza veya mobil imza ile imzalar ve
   imzalı dosyayı Dergi'ye iletir.

16.3. Dergi, kendi adına Madde "Taraflar" bölümünde gösterilen ortaklar
tarafından aynı yollardan biriyle imzalar.

16.4. **Panel onayının işlevi.** Yazar'ın Panel'de bir onay kutusunu
işaretleyerek verdiği onay, imzalanan belgenin yerine geçmez. Panel onayı;
Yazar'a hangi metnin gösterildiğini, onayın hangi tarih ve saatte verildiğini,
hangi IP adresinden ve hangi tarayıcıdan geldiğini ve metnin SHA-256 özetini
kaydederek imzalı belgenin içeriğini ve tarihini **destekleyen bir delil
kaydı** olarak tutulur. Taraflar bu kaydın delil değerini kabul eder.

16.5. Dergi, imzalı belgeyi teslim aldığında Panel'de eseri "izin alındı"
olarak işaretler. Eser, imzalı belge Dergi'ye ulaşmadan yayımlanmaz.

16.6. **Teyit.** Taraflar, bu Sözleşme'nin imzalanmasıyla, Yazar'ın daha önce
Panel üzerinden verdiği onayların konusunu oluşturan eserler bakımından da bu
Sözleşme ile o eserler için düzenlenecek Eser İzinlerinin hükümlerinin
uygulanacağını kabul ve teyit eder. Bu teyit, önceki onayların hukuki
niteliğine ilişkin bir kabul veya feragat değildir.

16.7. Taraflar, bu Sözleşme'nin ve Eser İzinlerinin elektronik ortamda
düzenlenmesine, iletilmesine ve saklanmasına muvafakat eder.

## Madde 17 — Uygulanacak Hukuk ve Uyuşmazlık

17.1. Bu Sözleşme Türk hukukuna tabidir.

17.2. Uyuşmazlıklarda kanunda öngörülen genel yetki ve görev kuralları
uygulanır. Taraflar arasında yetki sözleşmesi yapılmamıştır.

## Madde 18 — Sözleşmenin Bütünlüğü

18.1. Bu Sözleşme, imzalanmış Eser İzinleri ile birlikte Taraflar arasındaki
anlaşmanın tamamını oluşturur.

18.2. Bir hükmün geçersiz olması diğer hükümlerin geçerliliğini etkilemez.
Geçersiz hüküm, tarafların amacına en yakın geçerli hükümle tamamlanır.

18.3. Dergi'nin bir hakkını kullanmaması o haktan feragat sayılmaz.

---

## İmzalar

**Yazar (Ruhsat veren)**

Ad Soyad: {{yazar.ad_soyad}}
Tarih: ____ / ____ / ________
Yer: ______________________

İmza:


**Dergi (Ruhsat alan) — Postscript Dergisi adına**

Ad Soyad: {{dergi.ortak_1}}
Tarih: ____ / ____ / ________

İmza:


Ad Soyad: {{dergi.ortak_2}}
Tarih: ____ / ____ / ________

İmza:


---

*Sürüm {{agreement.version}} — Metin özeti (SHA-256): {{agreement.body_hash}} —
Panel kaydı: {{acceptance.accepted_at}} / {{acceptance.ip}}*

<!-- ŞABLON SONU -->

---

# Avukata sorular (bu taslak için)

1. **Madde 16'nın kurgusu doğru mu?** Islak imza veya güvenli elektronik imza
   esas, panel onayı destekleyici delil. Panel onayının tek başına FSEK m. 52'deki
   yazılı şekli karşılayıp karşılamadığı tartışmalı olduğu için bu yol seçildi;
   daha basit ve yeterli bir kurgu var mı?
2. **Madde 16.6'daki teyit yeterli mi?** Daha önce panelde onay veren 29 yazar
   bakımından geçmişi geçerli/geçersiz ilan etmeden yazılı zemine almak
   isteniyor. Bu ifade amacı karşılıyor mu, yoksa her eser için ayrı bir teyit
   metni mi gerekir?
3. **Madde 3.6'daki sorumluluk kaydı** gönüllü bir yazar bakımından aşırı mı?
   Tazminat ve rücu bakımından bir üst sınır konmalı mı?
4. **Madde 4.2'de yayma hakkının hiç verilmemesi** ileride bir baskı veya PDF
   sayı ihtiyacı doğarsa sorun yaratır mı; yoksa o gün yeni sürüm çıkarmak doğru
   yol mu?
5. **Madde 4.8'de teknik hizmet sağlayıcıların devir sayılmaması** ifadesi FSEK
   m. 49 karşısında yeterli mi?
6. **Madde 17.2'de yetki sözleşmesinden vazgeçilmesi** doğru mu; tarafların tacir
   olmaması nedeniyle mi, başka bir gerekçeyle mi?
7. **Taraflar bölümündeki adi ortaklık ifadesi** doğru mu? Ortaklar arasında
   yazılı ortaklık sözleşmesi henüz yok; "her iki ortak adına ve hesabına" ifadesi
   tek ortağın imzasıyla imzalanan bir sözleşmede yeterli mi, yoksa iki imza da
   zorunlu mu?
8. **Madde 4.2'deki yapay zekâ eğitimi hariç tutması** ve Madde 3.2'deki yapay
   zekâ bildirimi yükümlülüğü yerinde mi?
9. **Madde 10.2'de sürüm geçmişinin saklanması**: dayanak olarak 5187 sayılı
   Kanun'a (internet haber sitesi sayılırsak) atıf yapılmalı mı, yoksa mevcut
   genel ifade yeterli mi?
10. **Madde 12.4**: sözleşme içinde KVKK maddesi tutmak ile ayrı aydınlatma metni
    arasındaki sınır doğru çizilmiş mi?
