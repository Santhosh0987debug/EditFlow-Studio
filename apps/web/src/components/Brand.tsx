import { Link } from "react-router-dom";

type BrandProps = {
  to?: string;
};

export function Brand({ to = "/" }: BrandProps) {
  return (
    <Link
      to={to}
      className="flex w-fit items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-linear-to-br from-cyan-400 to-violet-500 text-sm font-bold text-slate-950">
        EF
      </span>
      <span className="text-sm font-semibold tracking-wide">
        EditFlow Studio
      </span>
    </Link>
  );
}
