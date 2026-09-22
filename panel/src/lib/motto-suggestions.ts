/**
 * Ready lines for the team form's "kendinizden bir söz" (D-227).
 *
 * The product owner wrote them, grouped by what the person does. They are a
 * starting point, not a list to choose from: the field stays free text and
 * picking one only fills it in.
 *
 * Every line must fit `MOTTO_MAX`; a test holds that.
 */
export type MottoGroup = {
  id: "writer" | "illustrator" | "editor";
  label: string;
  lines: readonly string[];
};

export const MOTTO_SUGGESTIONS: readonly MottoGroup[] = [
  {
    id: "writer",
    label: "Yazarlar",
    lines: [
      "Her hikâye, başka bir bakışla başlar.",
      "Kelimelerle yeni pencereler açarız.",
      "Yazdıkça düşüncelerimiz birbirine yaklaşır.",
      "Bir cümle, yeni bir dünyaya açılan kapıdır.",
      "Merak ettiğimiz her şey bir hikâyeye dönüşür.",
      "Bazen tek bir kelime, uzun bir yolculuk başlatır.",
      "İyi bir hikâye, okurunda yaşamaya devam eder.",
    ],
  },
  {
    id: "illustrator",
    label: "Tasarımcılar ve çizerler",
    lines: [
      "Her çizgi, anlatılacak hikâyeye yeni bir yol açar.",
      "Parçaları birleştirir, hikâyeye biçim veririz.",
      "Bir sayfa, fikirlerin buluştuğu yeni bir dünya.",
      "Çizgiler ve renkler, kelimelere eşlik eder.",
      "Her kolaj, ayrı parçaların ortak hikâyesi.",
      "Hayal ettiğimiz dünyayı sayfaya taşırız.",
      "Görsel bir ayrıntı, koca bir hikâye anlatır.",
    ],
  },
  {
    id: "editor",
    label: "Editörler",
    lines: [
      "İyi bir cümle, doğru dokunuşla güçlenir.",
      "Kelimeleri inceltir, fikri daha görünür kılarız.",
      "Her metnin kendi sesini bulmasına yardım ederiz.",
      "Bir metni parlatan şey, ayrıntılara gösterilen özen.",
      "Doğru kelime, bir fikri yerli yerine oturtur.",
      "Her cümlede anlatılmak istenene biraz yaklaşırız.",
      "İyi bir hikâye, özenli bir okumayla tamamlanır.",
    ],
  },
];

/**
 * The groups worth showing this person. Someone can hold two duties — a writer
 * who also draws is marked as an illustrator — so both lists are offered
 * rather than one being guessed at. An admin runs the magazine, so the
 * editors' lines are theirs.
 */
export function mottoGroupsFor(duty: { role: string; isIllustrator: boolean }): MottoGroup[] {
  const wanted = new Set<MottoGroup["id"]>();
  if (duty.role === "writer") wanted.add("writer");
  if (duty.isIllustrator) wanted.add("illustrator");
  if (duty.role === "editor" || duty.role === "admin") wanted.add("editor");
  // Nothing matched: better every line than none
  if (wanted.size === 0) return [...MOTTO_SUGGESTIONS];
  return MOTTO_SUGGESTIONS.filter((group) => wanted.has(group.id));
}
