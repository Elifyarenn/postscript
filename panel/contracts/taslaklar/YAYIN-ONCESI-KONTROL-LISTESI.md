# Yayın öncesi kontrol listesi

**Tek sayfa.** Hiçbir yazı bu listeyi geçmeden yayımlanmaz. Hiçbir adım panel
geliştirmesi gerektirmez.

**İmza ve iletme yolu henüz belirlenmedi** (avukat görüşüne bağlı). Aşağıda
"imzalı belge ulaştı" yazan kutular, seçilen yolun tamamlandığı anı gösterir.

---

## Bir kez: paketi gönderilebilir hâle getir

- [ ] **0.1** Dergi'nin bildirim adresi belirlendi ve belgelere yazıldı.
- [ ] **0.2** Dergi adına imzalayacak kişi(ler) ve temsil dayanağı belirlendi;
      imza blokları kesinleşti.
- [ ] **0.3** Atıf yapılacak aydınlatma metni sürümü belirlendi (sözleşme 7.2).
- [ ] **0.4** Avukat, imza yöntemi kararını verdi; yazar mesajındaki
      **[[İMZA VE İLETME YOLU]]** satırı yazıldı.
- [ ] **0.5** Paketler yeniden üretildi (`postscript-sozlesmeler/uret.mjs`) ve
      hiçbir `[[DOLDURULACAK]]` kalmadığı kontrol edildi.

---

## A — Yazar başına bir kez: çerçeve sözleşme

- [ ] **A1** Paket yazara gönderildi (sözleşme + eser eki birlikte).
- [ ] **A2** Yazar sözleşmeyi imzaladı ve **imzalı belge Dergi'ye ulaştı.**
- [ ] **A3** Dergi adına imzalandı.
- [ ] **A4** Takip listesine işlendi. Belge **depoya konmadı.**

> Bu adım yazar başına **bir defadır.** Sonraki yazılar için sözleşme yeniden
> imzalanmaz; yalnızca yeni bir Eser Eki gönderilir.

> **Sürüm 1'i panelde onaylamış tek yazar için:** kayıt **olduğu gibi korunur** —
> silinmez, değiştirilmez. A1–A4 diğerleriyle aynı yürür; panel onayı imzanın
> yerine konmaz. Takip listesinin Not kolonuna "sürüm 1 panel kabulü var" yazılır.

---

## B — Yazı başına: son metin

- [ ] **B1** Editör metni son hâle getirdi ve **düzenlemeyi durdurdu.**
- [ ] **B2** `/editor/articles/<id>/versions` sayfasından son sürüm numarası
      alındı ve eser ekindeki numarayla karşılaştırıldı.
- [ ] **B3** Metin, eser ekinin ilgili **EK** bölümüne olduğu gibi konuldu.

> B1'den sonra metne dokunulursa B1'e dönülür ve o yazı için izin yeniden alınır.

---

## C — Eser eki

- [ ] **C1** Ekteki her yazı için başlık, panel kaydı ve son sürüm numarası doğru.
- [ ] **C2** Her yazının **EK** bölümüne son metin eklendi.
- [ ] **C3** Yazar, izin verdiği **her yazı için** izin kutusunu işaretledi.
- [ ] **C4** Her yazı için **ad/mahlas tercihi** işaretli.
- [ ] **C5** Alıntı izni bölümü: dolduruldu ya da boş bırakıldı. **Boşsa alıntı
      izni yok** — bu yayını engellemez.
- [ ] **C6** Yazar imzaladı ve **imzalı belge Dergi'ye ulaştı.**
- [ ] **C7** Dergi adına imzalandı; takip listesine işlendi. Belge **depoya
      konmadı.**

---

## D — Yayın anı, yazı yazı

Her yazı için ayrı ayrı:

- [ ] **D1** Çerçeve sözleşme imzalı ve ulaştı (A2 ✓).
- [ ] **D2** Bu yazı, imzalı bir eser ekinde adıyla gösterilmiş ve **izin kutusu
      işaretli** (C3, C6 ✓).
- [ ] **D3** EK'teki metin ile yayımlanacak metin **aynı.**
- [ ] **D4** Yazı yayımlandı; tarih takip listesine işlendi.

> D1, D2 veya D3 işaretlenemiyorsa yazı yayımlanmaz. Panelde eksikliğin
> giderilmiş görünmesi bu kutuları karşılamaz. Aynı ekteki bir yazının izni
> işaretlenmemişse **yalnızca o yazı** yayımlanmaz; diğerleri etkilenmez.

---

## Esaslı değişiklik olursa

- [ ] O yazı için verilen izin değişmiş metni kapsamaz; B1'den başlanır ve yeni
      bir eser eki imzalanır.
- [ ] Yazı yayımlanmışsa önce yayından çekilir, yeni izinden sonra yeniden
      yayımlanır.

## Her adımda geçerli üç kural

1. Tarihler **fiilen** imza atıldığı ve belge ulaştığı tarihtir; geriye dönük
   tarih yazılmaz.
2. Yazının gönderilmiş veya panelde "kabul edildi" görünmesi izin değildir.
3. Doldurulmuş ve imzalı belgeler, dolu takip listesi ve gerçek adresler
   **depoya konmaz**; depo herkese açıktır. Bunlar
   `C:\Users\USER\Project\postscript-sozlesmeler\` altında tutulur.
