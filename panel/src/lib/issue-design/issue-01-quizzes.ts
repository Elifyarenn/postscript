/**
 * Issue 01's quizzes, written in code like its pages (D-297).
 *
 * The text is the delivered document's ("SAYI1 HANGİ KURGUSAL KARAKTERİN
 * TAKINTISINA SAHİPSİN"), set in sentence case for the screen; the character
 * named after each option there is the answer key, so it lives in `outcomeId`
 * and never reaches the reader.
 */
import type { QuizInput } from "../issue-quiz";

export const OBSESSION_QUIZ_TITLE = "Hangi kurgusal karakterin takıntısına sahipsin?";

type Persona = "monica" | "joe" | "nina" | "beth";

/** One question; the four options are always in the order Monica, Joe, Nina, Beth. */
function question(id: string, text: string, options: [string, string, string, string]): QuizInput["questions"][number] {
  const order: Persona[] = ["monica", "joe", "nina", "beth"];
  return {
    id,
    text,
    // The option id reaches the browser, so it names a letter, not the
    // character: a name there would be the answer key (D-309)
    options: options.map((option, index) => ({ id: `${id}-${"abcd"[index]!}`, text: option, outcomeId: order[index]! })),
  };
}

function outcome(id: Persona, title: string, paragraphs: string[]): QuizInput["outcomes"][number] {
  return { id, title, body: paragraphs.join("\n\n"), min: 0, max: 0 };
}

export const OBSESSION_QUIZ: QuizInput = {
  kind: "persona",
  title: OBSESSION_QUIZ_TITLE,
  intro: null,
  questions: [
    question("s1", "Evine misafir geldiğinde seni en çok ne gerer?", [
      "Kirli kıyafetleriyle koltuklarıma oturması",
      "Kişisel eşyalarımın karıştırılması",
      "Misafirimin iyi bir ev sahibi olmadığımı düşünmesi",
      "Güvenli alanımda başkasının dikkatimi dağıtıyor olması",
    ]),
    question("s2", "Bir partiye katıldın, içeriye girdiğin an yaptığın ilk şey ne?", [
      "Organizasyonun ve yemeklerin nasıl olduğuna bakarım",
      "Kimlerin partiye katıldığı ve kimlerle konuştuğunu gözlemlerim",
      "En yakın ayna nerede diye bakınır, duruşumu dikleştiririm",
      "Parti işleyişini tahmin eder ve kaçta evde olacağımı hesaplarım",
    ]),
    question("s3", "Arkadaşın beraber yaptığınız planı son anda iptal etti, tepkin ne olur?", [
      "Tüm günümü bu plana göre ayarlamıştım, her şey mahvoldu diye düşünürüm",
      "Arkadaşımın planı neden iptal ettiğini sorgular, şüphe duyarım",
      "Sorun bende mi acaba diye düşünürüm",
      "Planın iptal olmasına sevinir, kendimle vakit geçiririm",
    ]),
    question("s4", "Bir işle uğraşırken seni en çok hangisi zorlar?", [
      "Sürecin dağınık ve benim planıma uygun ilerlememesi",
      "İşe odaklanamayıp başka şeyler düşünmeye başlamak",
      "İş bittiği zaman hayalimdeki kadar mükemmel olmayacağını düşünmek",
      "Tam odaklanmışken dışarıdan bir sesle odağımın dağılması",
    ]),
    question("s5", "Gece yatağa yattığında uyumanı en çok ne engeller?", [
      "Etraftaki toparlanmamış yarım işler",
      "Telefon/sosyal medya mesaisi",
      "Gün içinde yaptığım saçma bir hareketi kafamda büyütmek",
      "Zihnimde sürekli dönen ihtimal zincirleri",
    ]),
  ],
  outcomes: [
    outcome("monica", "Monica’nın kontrol ve düzen takıntısı", [
      "“Kurallar eğlenceyi kontrol altında tutmaya yarar!”",
      "Sen tam anlamıyla bir Monica Geller’sın! Sehpa üzerinde bardak altlığı görmeyince nabzı hafiften yükselen, dolap içi düzenleyicileri ve kategorize edilmiş dosyaları görünce içi kıpır kıpır olan o kişi kesinlikle sensin.",
      "Hayat senin için öyle ‘akışına bırakılabilecek’ kadar başıboş bir süreç değil; baştan sona kusursuz yönetilmesi gereken dev bir organizasyon. Zihninin rahat etmesi için her şey önceden planlanmalı, üstelik o planın bozulma ihtimaline karşı bir B ve C planın da mutlaka hazırda beklemeli.",
      "Arkadaş grubunun hem toparlayıcısı hem de gizli diktatörüsün diyebiliriz. Bazen etrafındakileri kontrol manyaklığınla delirtiyor olabilirsin ama dürüst olalım; sen olmasan o tatil asla bu kadar kusursuz geçmezdi!",
    ]),
    outcome("joe", "Joe’nin merak ve gözlem takıntısı", [
      "“Merhaba, sen.”",
      "Sen tam anlamıyla bir Joe Goldberg’sin! “Sadece profiline bakacağım” cümlesi senin en büyük yalanın; çünkü kendini bir anda o kişinin anneannesinin profilinde ya da LinkedIn’de çalışma geçmişini incelerken buluyorsun.",
      "Başkalarının ‘öylesine söylenmiş’ dediği bir kelime ya da profildeki ufacık bir şarkı detayı, senin için çözülmesi gereken kocaman bir ipucu aslında.",
      "Arkadaş grubunun “Müge Anlı bile bulamaz” dediği ne varsa, birkaç dakikalık stalk ile hemen önlerine serebilirsin. Bazen sınırları biraz zorluyor ve ürkütücü görünüyor olabilirsin kabul; ama dürüst olalım; sen olmasan o masada insan sarrafı unvanını kim taşıyacak, arkadan dönen işleri kim bir bakışta çözecekti?",
    ]),
    outcome("nina", "Nina’nın mükemmeliyetçilik takıntısı", [
      "“Hissettim. Kusursuzdu. Kusursuzdum.”",
      "Sen tam anlamıyla bir Nina Sayers’sın! Herkesin seni takdir ettiği bir işin hemen ardından bile kenara çekilip “Kimse fark etmedi ama şurada küçük bir hata yaptım” diye kendine haksızlık eden o kişi kesinlikle sensin.",
      "Senin dünyanda ‘olduğu kadar’ gibi yarım laflara kesinlikle yer yok. Bir şey ortaya çıkacaksa ya kafandaki o kusursuz çıtaya ulaşmalı ya da hiç yapılmamış sayılmalı.",
      "Arkadaş grubunda herkesin ‘oldu işte ya’ dediği şeylere senin kolay kolay onay vermeyeceğini herkes çok iyi bilir. Bazen her şey istediğin gibi mükemmel olsun diye kendini gereksiz yere tüketiyorsun, doğru; ama dürüst olalım, ortaya koyduğun hiçbir iş de öyle alelade olmuyor.",
    ]),
    outcome("beth", "Beth’in hiper-odağı", [
      "“Beraberlik için oynamam; kazanmak için oynarım.”",
      "Sen tam anlamıyla bir Beth Harmon’sın! Bir şeye kafayı taktığında yanında davul çalsalar duymayan, biri daha lafını bitirmeden konunun nereye bağlanacağını çoktan çözmüş o kişi sensin.",
      "Senin dünyanda ‘şöyle böyle idare edelim’ gibi yarım yamalak çözümlere yer yok; bir yola girdiysen tek amacın net bir sonuç almak. Sonunu göremediğin ya da kestiremediğin hiçbir şeye öyle körü körüne atlayamazsın. En dayanamadığın şey de tam bir konuya odaklanmışken birinin gelip dikkatini darmadağın etmesi.",
      "Arkadaş grubunun kriz anlarında paniğe kapılmayıp en mantıklı yolu bulan kişisisin. Bazen kendi dünyana çekilip insanları biraz duymazdan geliyorsun, doğru; ama dürüst olalım, işler sarpa sardığında akıl danışmak için gidilen ilk kişi de yine sensin!",
    ]),
  ],
};
