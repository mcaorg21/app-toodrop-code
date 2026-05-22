import { ReactNode } from "react";

type PersonaType = "dropper" | "dropper_one" | "toodroper";

interface PersonaLabelProps {
  type: PersonaType;
  className?: string;
  showIcon?: boolean;
  icon?: ReactNode;
}

const personaConfig: Record<PersonaType, { label: string; tooltip: string }> = {
  dropper: {
    label: "Dropper",
    tooltip: "Entregador, Deliver, Motorista"
  },
  dropper_one: {
    label: "Dropper one",
    tooltip: "Comprador, Consumidor, Consumer"
  },
  toodroper: {
    label: "Toodroper",
    tooltip: "Receiver, Recebedor"
  }
};

export function PersonaLabel({ type, className = "", showIcon, icon }: PersonaLabelProps) {
  const config = personaConfig[type];
  
  return (
    <span 
      className={`relative group cursor-help ${className}`}
      title={config.tooltip}
    >
      <span className="inline-flex items-center gap-1.5">
        {showIcon && icon}
        <span className="border-b border-dotted border-current">{config.label}</span>
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {config.tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800"></span>
      </span>
    </span>
  );
}

// Helper function for table headers and labels
export function getPersonaLabel(type: "consumer" | "receiver" | "driver" | "hub"): { label: string; tooltip: string; persona: PersonaType } {
  switch (type) {
    case "consumer":
      return { label: "Dropper one", tooltip: "Comprador, Consumidor, Consumer", persona: "dropper_one" };
    case "receiver":
    case "hub":
      return { label: "Toodroper", tooltip: "Receiver, Recebedor", persona: "toodroper" };
    case "driver":
      return { label: "Dropper", tooltip: "Entregador, Deliver, Motorista", persona: "dropper" };
    default:
      return { label: type, tooltip: "", persona: "dropper" };
  }
}

// Simple tooltip wrapper for existing content
export function TooltipLabel({ children, tooltip, className = "" }: { children: ReactNode; tooltip: string; className?: string }) {
  return (
    <span 
      className={`relative group cursor-help ${className}`}
      title={tooltip}
    >
      <span className="border-b border-dotted border-current">{children}</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800"></span>
      </span>
    </span>
  );
}
