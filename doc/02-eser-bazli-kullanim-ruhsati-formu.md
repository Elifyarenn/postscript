# POSTSCRIPT DERGİSİ — ESER BAZLI KULLANIM RUHSATI FORMU

**Form no:** {{form.id}}  
**Şablon sürümü:** {{form.template_version}}  
**Düzenlenme tarihi:** {{form.created_at}}

Bu form, 5846 sayılı Fikir ve Sanat Eserleri Kanunu'nun (FSEK) 48, 52 ve 56. maddeleri uyarınca düzenlenmiştir. Ruhsat kapsamındaki mali haklar aşağıda **ayrı ayrı** gösterilmiştir; burada gösterilmeyen hiçbir hak bu formla verilmiş sayılmaz.

------------------------------------------------------------------------

## Taraflar

**Ruhsat alan (Dergi):** Postscript Dergisi  
*(Postscript Dergisi adı altında faaliyet gösteren adi ortaklık adına ortaklar: {{dergi.ortak_1}}, {{dergi.ortak_2}}. Ortaklardan her biri Dergi adına tek başına temsile yetkilidir. Adres: {{dergi.adres}})*

**Ruhsat veren (Yazar / Eser Sahibi):** {{yazar.ad_soyad}}  
Doğum tarihi: {{yazar.dogum_tarihi}} — E-posta: {{yazar.eposta}}

------------------------------------------------------------------------

## 1. Eser

|                                     |                        |
|-------------------------------------|------------------------|
| Başlık                              | {{eser.baslik}}        |
| Tür                                 | {{eser.tur}}           |
| Kelime sayısı                       | {{eser.kelime_sayisi}} |
| Kabul edilen metnin özeti (SHA-256) | {{eser.body_hash}}     |
| Panel kaydı                         | {{eser.id}}            |

Yukarıdaki özet, Dergi tarafından kabul edilen ve bu formun konusu olan metni tek anlamlı biçimde tanımlar. Yazar, bu özete karşılık gelen metni Panel'de görüntülemiştir.

## 2. Ruhsatın Türü

|             |                           |
|-------------|---------------------------|
| Ruhsat türü | {{form.grant_type_label}} |

- **Basit ruhsat** (FSEK m. 56/1): Yazar, aynı eser için başkalarına da ruhsat verebilir ve eseri başka yerlerde yayınlayabilir. Eserin mali hakları Yazar'da kalır.
- **Tam ruhsat** (FSEK m. 56/2): Madde 5'te belirtilen süre boyunca eser yalnızca Dergi tarafından kullanılır; Yazar aynı süre içinde aynı hakları başkasına vermez.

Bu form ile mali hak **devri** yapılmamaktadır.

## 3. Ruhsat Kapsamındaki Mali Haklar

Aşağıdaki haklar, yalnızca "Evet" olarak işaretlenmiş olanlarla sınırlı olmak üzere, Madde 4'teki mecralar ve Madde 5'teki süre ve yer sınırları içinde Dergi'ye ruhsat olarak verilir:

| Hak          | FSEK   | Kapsam                                                                                     | Verildi mi                             |
|--------------|--------|--------------------------------------------------------------------------------------------|----------------------------------------|
| Çoğaltma     | m\. 22 | Eserin dijital ortamda kopyalanması, sunucuda barındırılması, PDF Sayı içinde çoğaltılması | {{form.right_reproduction}}            |
| Yayma        | m\. 23 | Eseri içeren PDF Sayının ücretsiz olarak dağıtılması                                       | {{form.right_distribution}}            |
| Umuma iletim | m\. 25 | Eserin web sitesinde, e-bültende ve sosyal medya hesaplarında erişime sunulması            | {{form.right_communication_to_public}} |
| İşleme       | m\. 21 | {{form.adaptation_scope}}                                                                  | {{form.right_adaptation}}              |

İşleme hakkı "Evet" ise kapsam sütununda yazılı sınırla verilmiştir; kapsam sütunu boşsa işleme hakkı verilmemiştir. Eserin başka bir dile çevrilmesi, dramatize edilmesi, seslendirilmesi veya başka bir eser türüne dönüştürülmesi bu form kapsamı dışındadır.

## 4. Mecralar

Ruhsat yalnızca aşağıda işaretli mecralar için geçerlidir:

| Mecra                                                                          | Dahil mi                    |
|--------------------------------------------------------------------------------|-----------------------------|
| Dergi web sitesi ({{dergi.domain}})                                            | {{form.channel_web}}        |
| PDF Sayı (ücretsiz indirme)                                                    | {{form.channel_pdf_issue}}  |
| Dergi'nin sosyal medya hesapları (tanıtım amaçlı; eserin tamamı veya alıntısı) | {{form.channel_social}}     |
| E-bülten                                                                       | {{form.channel_newsletter}} |

Burada sayılmayan mecralar için ayrı ruhsat gerekir.

## 5. Süre ve Yer

|                                   |                            |
|-----------------------------------|----------------------------|
| Yer                               | {{form.territory_label}}   |
| Ruhsat süresi                     | {{form.duration_label}}    |
| Tam ruhsat ise münhasırlık süresi | {{form.exclusivity_label}} |

Belirli süreli ruhsatın sonunda Dergi eseri web sitesinden kaldırır ve PDF Sayıyı yeni indirmelere kapatır. Süre sonuna kadar dağıtılmış PDF kopyalar Madde 8.3 uyarınca geri çağrılmaz.

## 6. Bedel

**Bedel: Yok.** Ruhsat bedelsizdir. Yazar, bu ruhsat karşılığında Dergi'den herhangi bir ödeme veya başka bir karşılık talep etmeyeceğini kabul eder.

## 7. Ticari Kullanım

|                 |                               |
|-----------------|-------------------------------|
| Ticari kullanım | {{form.commercial_use_label}} |

"Hariç" ise Dergi eseri; ücret karşılığı satışa sunulan, reklam geliri elde eden veya sponsorlu herhangi bir yayında kullanamaz. Dergi'nin kâr amacı gütmeyen olağan faaliyeti ticari kullanım sayılmaz.

## 8. Ad Gösterimi ve Geri Çekme

8.1. Eser şu şekilde yayınlanır: **{{form.byline_label}}**

8.2. Yazar, Çerçeve Yazar Sözleşmesi Madde 7 uyarınca eserin web sitesinden kaldırılmasını talep edebilir. Talep, Dergi'ye ulaşmasından itibaren en geç 15 gün içinde yerine getirilir.

8.3. Geri çekme talebi, talep tarihinden önce dağıtılmış PDF Sayıları kapsamaz.

## 9. Yazar'ın Beyanları

Yazar, bu eser için Çerçeve Yazar Sözleşmesi Madde 3'teki beyanlarını tekrar eder ve ayrıca:

9.1. Eserin tamamen kendi özgün çalışması olduğunu; daha önce başka bir yerde yayınlandıysa bunu Panel'de belirttiğini ve bu yayının işbu ruhsata engel teşkil etmediğini,

9.2. Eserde kullanılan görsellerin ({{eser.media_count}} adet) lisans bilgilerinin Panel'de doğru biçimde girildiğini,

9.3. Bu eser üzerinde üçüncü bir kişiye, bu form ile çelişen bir tam ruhsat vermediğini veya hakkı devretmediğini

beyan eder.

## 10. Değişiklik

Bu form imzalandıktan sonra içeriği değiştirilemez. Kapsam değişikliği gerekirse bu form Dergi tarafından iptal edilir ve yeni bir form düzenlenir; iptal, iptal tarihine kadar yapılan kullanımları etkilemez.

## 11. Uygulanacak Hukuk

Bu form Türk hukukuna tabidir. Uyuşmazlıklarda {{dergi.sehir}} Fikrî ve Sınaî Haklar Hukuk Mahkemeleri ve İcra Daireleri yetkilidir.

## 12. Şekil

Bu form, FSEK 52. maddesindeki yazılı şekil şartı gereği Yazar tarafından **el yazısıyla imzalanır**. Yazar, imzalı formu tarayıp Panel'e yükler. Dergi, yüklenen belgeyi inceleyip formu "imzalandı" olarak işaretlediğinde ruhsat yürürlüğe girer. Panel üzerinden yalnızca tıklama ile verilen onay bu formu yürürlüğe sokmaz.

------------------------------------------------------------------------

## İmzalar

**Ruhsat veren (Yazar)**

Ad Soyad: {{yazar.ad_soyad}}  
Tarih: \_\_\_\_ / \_\_\_\_ / \_\_\_\_\_\_\_\_  
Yer: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

İmza:

 

 

**Ruhsat alan (Postscript Dergisi adına)**

Ad Soyad: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Tarih: \_\_\_\_ / \_\_\_\_ / \_\_\_\_\_\_\_\_

İmza:

 

 

------------------------------------------------------------------------

*Form özeti (SHA-256): {{form.text_hash}} — Şablon sürümü {{form.template_version}} — Bu özet, Yazar'a gösterilen ve imzalanan metnin bütünlüğünü doğrular.*
