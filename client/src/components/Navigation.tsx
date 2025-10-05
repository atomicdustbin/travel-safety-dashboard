import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Map, Search, List, Menu, Check } from "lucide-react";

const pages = [
  { path: "/", label: "Search", icon: Search },
  { path: "/map", label: "Threat Map", icon: Map },
  { path: "/countries", label: "Country List", icon: List },
];

export function Navigation() {
  const [location] = useLocation();

  return (
    <DropdownMenu modal={true}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
          data-testid="button-navigation-menu"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-[9999]">
        {pages.map((page) => {
          const Icon = page.icon;
          const isActive = location === page.path;
          
          return (
            <Link key={page.path} href={page.path}>
              <DropdownMenuItem className="cursor-pointer" data-testid={`menu-item-${page.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span>{page.label}</span>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </div>
              </DropdownMenuItem>
            </Link>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
