import type { SVGProps } from "react";
import type { CategoryId } from "@/lib/tools";

/**
 * The icon set.
 *
 * Inline rather than an icon package: the whole set is a few hundred bytes,
 * it inherits `currentColor` so both themes are handled by the colour tokens,
 * and nothing has to be loaded before the first paint.
 *
 * Every icon is decorative — it sits next to a text label that already says
 * the same thing — so `aria-hidden` is the default and a caller that means an
 * icon to carry meaning has to pass a label explicitly.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      {children}
    </svg>
  );
}

/* --- Category marks ------------------------------------------------------ */

export function GeldanlageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15 6.5h6v6" />
      <path d="M3 21h18" />
    </Icon>
  );
}

export function SteuernIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.5h14a1 1 0 0 1 1 1V21l-3-1.5L14 21l-3-1.5L8 21l-3-1.5V4.5a1 1 0 0 1 1-1Z" />
      <path d="m9.5 14.5 5-5" />
      <circle cx="9.5" cy="9.5" r=".6" fill="currentColor" />
      <circle cx="14.5" cy="14.5" r=".6" fill="currentColor" />
    </Icon>
  );
}

export function EinkommenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
      <path d="M3 8.5V7a2 2 0 0 1 1.4-1.9l10-3.02" />
      <path d="M21 11.5h-3.5a1.75 1.75 0 0 0 0 3.5H21" />
    </Icon>
  );
}

export function KreditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5.5 9.2V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.2" />
      <path d="M9.75 21v-5.5h4.5V21" />
    </Icon>
  );
}

const categoryIcons: Record<CategoryId, (props: IconProps) => React.ReactElement> = {
  geldanlage: GeldanlageIcon,
  steuern: SteuernIcon,
  einkommen: EinkommenIcon,
  kredit: KreditIcon,
};

export function CategoryIcon({
  category,
  ...props
}: IconProps & { category: CategoryId }) {
  const Mark = categoryIcons[category];
  return <Mark {...props} />;
}

/* --- Interface ----------------------------------------------------------- */

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
    </Icon>
  );
}

export function SystemIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4" width="19" height="12.5" rx="1.75" />
      <path d="M8 20.5h8m-4-4v4" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 5 7 7-7 7" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function PrintIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14.5" width="10" height="6" rx="1" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Icon>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13.5 2 4 13.5h6.5L10 22l9.5-11.5H13Z" />
    </Icon>
  );
}
