# Yazar sözleşmesi ve eser izni takip tablosu (boş)

Her **eser** için bir satır. Aynı yazarın birden fazla eseri varsa yazar adı
tekrarlanır; sözleşme kolonları o satırlarda aynı değeri taşır.

Elle tutmak için aşağıdaki tablo, hesap tablosunda tutmak için aynı klasördeki
`takip-tablosu.csv` kullanılır.

## Tablo

| Yazar | Eser | Sözleşme sürümü | Sözleşme imza durumu | Sözleşme imza tarihi | Eser izni durumu | Eser izni tarihi | Son metin sürümü | Son metin özeti (SHA-256) | Son metin onayı | Ad/mahlas tercihi | Yayın durumu | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |

## Kolonların anlamı ve izin verilen değerler

| Kolon | Ne yazılır | Değerler |
|---|---|---|
| **Yazar** | Yazarın gerçek adı (arşiv kaydı; mahlas ayrı kolonda) | serbest metin |
| **Eser** | Eserin başlığı | serbest metin |
| **Sözleşme sürümü** | Yazarın imzaladığı çerçeve sözleşme sürümü | `1`, `2`, … |
| **Sözleşme imza durumu** | Çerçeve sözleşmenin hangi aşamada olduğu | `gönderilmedi` · `gönderildi` · `panelde onaylandı` · `imzalı kopya alındı` |
| **Sözleşme imza tarihi** | İmzalı kopyadaki tarih (panel onay tarihi değil) | `GG.AA.YYYY` |
| **Eser izni durumu** | Eser bazlı izin belgesinin aşaması | `hazırlanmadı` · `hazırlandı` · `yazara gönderildi` · `panelde onaylandı` · `imzalı kopya alındı` · `reddedildi` · `iptal (esaslı değişiklik)` |
| **Eser izni tarihi** | İmzalı belgedeki tarih | `GG.AA.YYYY` |
| **Son metin sürümü** | Panelde imzaya esas alınan sürüm numarası | tam sayı |
| **Son metin özeti (SHA-256)** | Belgedeki özet; paneldeki özetle aynı olmalı | 64 karakter |
| **Son metin onayı** | Yazar EK-1'deki metni son hâl olarak onayladı mı | `yok` · `var` |
| **Ad/mahlas tercihi** | O eser için sabitlenen tercih | `gerçek ad` · `mahlas: <mahlas>` |
| **Yayın durumu** | Eserin paneldeki durumu | `taslak` · `kabul edildi` · `izin bekliyor` · `yayına hazır` · `zamanlanmış` · `yayımlandı` · `geri çekildi` |
| **Not** | Neyin beklendiği, kim bekliyor | serbest metin |

## Kullanım kuralları

1. **`Yayın durumu = yayımlandı` olan bir satırda, `Sözleşme imza durumu` ve
   `Eser izni durumu` kolonlarının ikisi de `imzalı kopya alındı` olmalıdır.**
   Tablonun tek işi bunu görünür tutmaktır.
2. Esaslı bir değişiklik olursa mevcut satırın eser izni durumu
   `iptal (esaslı değişiklik)` yapılır ve **yeni bir satır** açılır; eski satır
   silinmez.
3. Son metin özeti değiştiyse imza yeniden alınır — özet kolonu bu yüzden var.
4. Panel onayı ile imzalı kopya **ayrı** izlenir; ikisi birbirinin yerine
   geçmez.
5. Tarih kolonlarına **imzanın fiilen atıldığı** tarih yazılır; geriye dönük
   tarih yazılmaz.
