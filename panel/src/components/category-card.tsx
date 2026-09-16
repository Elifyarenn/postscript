/**
 * A writing area's card with its photo from the design (D-122). The front
 * page's category rail and the categories page (D-134) draw the same card.
 */
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import categoryArt from "@/assets/design/category-art.webp";
import categoryAuthor from "@/assets/design/category-author.webp";
import categoryBooks from "@/assets/design/category-books.webp";
import categoryFeminism from "@/assets/design/category-feminism.webp";
import categoryGossip from "@/assets/design/category-gossip.webp";
import categoryHistory from "@/assets/design/category-history.webp";
import categoryLifestyle from "@/assets/design/category-lifestyle.webp";
import categoryPop from "@/assets/design/category-pop.webp";
import categoryPsychology from "@/assets/design/category-psychology.webp";
import categoryScience from "@/assets/design/category-science.webp";
import categoryThought from "@/assets/design/category-thought.webp";
import { categoryImageKey, categorySubtitle, type CategoryImageKey } from "@/lib/site";
import { Swoosh } from "./site-ui";

const CATEGORY_IMAGES: Record<CategoryImageKey, StaticImageData> = {
  art: categoryArt,
  science: categoryScience,
  psychology: categoryPsychology,
  lifestyle: categoryLifestyle,
  pop: categoryPop,
  books: categoryBooks,
  thought: categoryThought,
  feminism: categoryFeminism,
  history: categoryHistory,
  author: categoryAuthor,
  gossip: categoryGossip,
};

export function CategoryCard({
  name,
  index,
  sizes,
  count,
  detailed = false,
}: {
  name: string;
  /** The area's place in the admin's order; picks a photo for a name no keyword matches. */
  index: number;
  sizes: string;
  /** Published articles in the area; left out where the card shows no count. */
  count?: number;
  /** The design's line of topics and its "explore" invitation (D-146). */
  detailed?: boolean;
}) {
  return (
    <Link href={`/magazine?kategori=${encodeURIComponent(name)}`} className="category-card">
      <span className="category-card-art">
        <Image src={CATEGORY_IMAGES[categoryImageKey(name, index)]} alt="" fill sizes={sizes} />
      </span>
      <span className="category-name">{name}</span>
      {detailed && <span className="category-topics">{categorySubtitle(name, index)}</span>}
      {count !== undefined && (
        <span className="category-count">{count > 0 ? `${count} yazı` : "Henüz yazı yok"}</span>
      )}
      {detailed ? (
        // A span, not a button: the whole card is already the link (D-146)
        <span className="category-explore">
          Keşfet <ArrowRight aria-hidden />
        </span>
      ) : (
        <Swoosh className="category-swoosh" />
      )}
    </Link>
  );
}
