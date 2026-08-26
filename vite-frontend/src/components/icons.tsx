import type { ComponentType, SVGProps } from "react";
import {
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PencilSquareIcon,
  PlusIcon as HeroPlusIcon,
  Squares2X2Icon,
  SunIcon,
  TrashIcon,
  UserIcon as HeroUserIcon,
} from "@heroicons/react/24/outline";

import type { IconSvgProps } from "@/types";

function icon(
  Icon: ComponentType<SVGProps<SVGSVGElement>>,
): ComponentType<IconSvgProps> {
  return function LibraryIcon({
    size = 24,
    width,
    height,
    ...props
  }: IconSvgProps) {
    return (
      <Icon
        aria-hidden="true"
        height={height ?? size}
        width={width ?? size}
        {...props}
      />
    );
  };
}

export const Logo = icon(Squares2X2Icon);
export const MoonFilledIcon = icon(MoonIcon);
export const SunFilledIcon = icon(SunIcon);
export const SearchIcon = icon(MagnifyingGlassIcon);
export const PlusIcon = icon(HeroPlusIcon);
export const EditIcon = icon(PencilSquareIcon);
export const DeleteIcon = icon(TrashIcon);
export const UserIcon = icon(HeroUserIcon);
export const SettingsIcon = icon(Cog6ToothIcon);
