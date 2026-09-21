/**
 * Clothing as static SVG geometry (D-215).
 *
 * The corrected files ("pic/geometri-duzeltilmis-svg/") are embedded here,
 * drawn straight on the 1024 canvas. Tokens:
 *   {clothing}      the garment            -> palette.clothing
 *   {clothingLight} raised panels, lapels  -> tint(clothing, 0.09)
 * The fixed detail colours (seams, zips, cords, the blazer's shirt) and the
 * ink outlines stay as drawn, so they read on any garment colour.
 */
import { tint } from "../geometry";
import type { DrawContext } from "../canvas";
import type { Asset } from "./types";

type StaticClothing = { id: string; label: string; body: string };

function paint(markup: string, context: DrawContext): string {
  return markup
    .replaceAll("{clothingLight}", tint(context.palette.clothing, 0.09))
    .replaceAll("{clothing}", context.palette.clothing);
}

export function clothingStaticStyle(style: StaticClothing): Asset {
  return {
    id: style.id,
    label: style.label,
    layers: { clothing: (context) => paint(style.body, context) },
  };
}

export const CLOTHING_STATIC: StaticClothing[] = [
  { id: "hoodie", label: "Kapüşonlu", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q440 748 452 767 Q512 832 572 767 Q584 748 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <path d="M418 756 Q400 774 417 810 Q449 864 512 870 Q575 864 607 810 Q624 774 606 756 L572 769 Q550 812 512 819 Q474 812 452 769 Z" fill="{clothingLight}" stroke="#2a1a1d" stroke-width="4.5" />
    <path d="M430 782 Q450 841 512 849 Q574 841 594 782" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.6" />
    <path d="M482 853 Q474 902 474 952" fill="none" stroke="#cac9c9" stroke-width="5" opacity="1" />
    <path d="M474 950 L474 964" fill="none" stroke="#504d4e" stroke-width="7" opacity="1" />
    <path d="M542 853 Q550 902 550 952" fill="none" stroke="#cac9c9" stroke-width="5" opacity="1" />
    <path d="M550 950 L550 964" fill="none" stroke="#504d4e" stroke-width="7" opacity="1" />
    <path d="M371 1024 L398 975 Q512 958 626 975 L653 1024" fill="none" stroke="#504d4e" stroke-width="3.5" opacity="0.6" />` },
  { id: "tshirt", label: "Tişört", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q439 748 452 762 Q512 817 572 762 Q585 748 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <path d="M445 757 Q466 807 512 811 Q558 807 579 757 L590 764 Q564 826 512 827 Q460 826 434 764 Z" fill="#504d4e" stroke="#2a1a1d" stroke-width="3" />` },
  { id: "sweater", label: "Kazak", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q439 748 452 762 Q512 817 572 762 Q585 748 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <path d="M445 757 Q466 807 512 811 Q558 807 579 757 L590 764 Q564 826 512 827 Q460 826 434 764 Z" fill="#504d4e" stroke="#2a1a1d" stroke-width="3" />
    <path d="M456 784 L453 795" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M470 797 L467 808" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M485 806 L482 817" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M501 811 L498 822" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M523 811 L520 822" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M539 806 L536 817" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M554 797 L551 808" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />
    <path d="M568 784 L565 795" fill="none" stroke="#2a1a1d" stroke-width="2" opacity="0.65" />` },
  { id: "shirt", label: "Gömlek", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q443 748 459 755 L512 807 L565 755 Q581 748 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(0 0)">
      <path d="M457 752 L427 802 L474 839 L509 807 Z" fill="{clothingLight}" stroke="#2a1a1d" stroke-width="4.5" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M457 752 L427 802 L474 839 L509 807 Z" fill="{clothingLight}" stroke="#2a1a1d" stroke-width="4.5" />
    </g>
    <path d="M512 813 L512 1060" fill="none" stroke="#504d4e" stroke-width="3.5" opacity="1" />
    <circle cx="523" cy="866" r="4" fill="#8a8888" />
    <circle cx="523" cy="935" r="4" fill="#8a8888" />
    <circle cx="523" cy="1004" r="4" fill="#8a8888" />` },
  { id: "turtleneck", label: "Balıkçı yaka", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 L462 740 L462 699 Q512 720 562 699 L562 740 L606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <path d="M465 723 Q512 742 559 723 M466 747 Q512 765 558 747" fill="none" stroke="#504d4e" stroke-width="3" opacity="1" />` },
  { id: "blazer", label: "Ceket", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q439 746 453 758 Q512 817 571 758 Q585 746 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <path d="M453 758 Q512 817 571 758 L525 1030 L499 1030 Z" fill="#f4f1ec" stroke="#2a1a1d" stroke-width="3" />
    <g transform="translate(0 0)">
      <path d="M447 755 L397 812 L438 854 L416 876 L501 994 L474 855 Z" fill="{clothingLight}" stroke="#2a1a1d" stroke-width="4.5" />
      <path d="M291 947 L396 957" fill="none" stroke="#504d4e" stroke-width="4" opacity="0.6" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M447 755 L397 812 L438 854 L416 876 L501 994 L474 855 Z" fill="{clothingLight}" stroke="#2a1a1d" stroke-width="4.5" />
      <path d="M291 947 L396 957" fill="none" stroke="#504d4e" stroke-width="4" opacity="0.6" />
    </g>
    <circle cx="510" cy="999" r="6" fill="#504d4e" stroke="#2a1a1d" stroke-width="2.5" />` },
  { id: "bomber", label: "Bomber ceket", body: `<path d="M104 1060 C109 959 133 877 194 837 C247 802 339 784 418 752 Q440 748 452 765 Q512 830 572 765 Q584 748 606 752 C685 784 777 802 830 837 C891 877 915 959 920 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <g transform="translate(0 0)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <g transform="translate(1024 0) scale(-1 1)">
      <path d="M284 808 Q267 863 264 942" fill="none" stroke="#504d4e" stroke-width="3" opacity="0.65" />
    </g>
    <path d="M446 757 Q466 816 512 823 Q558 816 578 757 L593 765 Q573 847 512 849 Q451 847 431 765 Z" fill="#504d4e" stroke="#2a1a1d" stroke-width="4" />
    <path d="M512 849 L512 1060" fill="none" stroke="#504d4e" stroke-width="4" opacity="1" />
    <path d="M512 870 L512 890" fill="none" stroke="#c3c7cc" stroke-width="6" opacity="1" />
    <path d="M320 951 L378 990 M704 951 L646 990" fill="none" stroke="#504d4e" stroke-width="4" opacity="0.6" />` },
  { id: "tank", label: "Askılı", body: `<path d="M273 1060 L284 901 Q352 858 378 754 L418 754 Q431 804 454 823 Q512 852 570 823 Q593 804 606 754 L646 754 Q672 858 740 901 L751 1060 Z" fill="{clothing}" stroke="#2a1a1d" stroke-width="6" />
    <path d="M409 765 Q426 832 458 842 Q512 868 566 842 Q598 832 615 765" fill="none" stroke="#2a1a1d" stroke-width="3" opacity="1" />
    <path d="M385 767 Q364 862 296 907 M639 767 Q660 862 728 907" fill="none" stroke="#2a1a1d" stroke-width="3" opacity="1" />` },
];
