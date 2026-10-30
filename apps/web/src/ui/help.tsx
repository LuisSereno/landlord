import { useEffect, useId, useState, type ReactNode } from "react";

import { UiIcon } from "./icons";

/**
 * V.d-UX · ayuda contextual desde una única fuente (spec §10). Ningún componente lleva párrafos
 * de explicación propios: pide una clave a `helpCatalog`. Los textos describen lo que el motor ya
 * hace; no prometen reglas que no existan.
 */
export type HelpTopicKey =
  | "first_steps"
  | "profitability"
  | "land_value"
  | "production_suitability"
  | "services"
  | "regulation"
  | "influence"
  | "permits"
  | "maintenance"
  | "debt"
  | "collateral"
  | "insurance"
  | "ordinance"
  | "taxes"
  | "budget"
  | "council"
  | "reputation"
  | "heat"
  | "illegal_route"
  | "intelligence"
  | "macro_climate"
  | "housing_market"
  | "employment"
  | "public_contracts"
  | "construction"
  | "crew"
  | "overlays"
  | "notifications"
  | "portfolio"
  | "auction";

export type HelpTopic = {
  title: string;
  summary: string;
  details?: string;
};

export const helpCatalog: Record<HelpTopicKey, HelpTopic> = {
  first_steps: {
    title: "Primeros pasos",
    summary:
      "Compra un solar, consigue materiales, construye y ocupa el edificio para cobrar renta.",
    details:
      "El objetivo del bucle es reinvertir los beneficios: comprar suelo, producir o comprar materiales, construir, ocupar y mantener. La partida avanza sola: pausa cuando necesites pensar.",
  },
  profitability: {
    title: "Rentabilidad",
    summary:
      "Beneficio estimado respecto al capital invertido, con los ingresos y gastos que el juego puede calcular ahora.",
    details:
      "Si la renta no cubre la deuda de mantenimiento, el activo pierde dinero aunque esté ocupado.",
  },
  land_value: {
    title: "Valor del suelo",
    summary:
      "Precio de mercado del solar: combina centralidad, comercio, servicios, frente, código urbanístico y riesgo.",
    details:
      "Un solar vacío ya valora el servicio al que podría acceder cuando construyas; el valor se mueve un 5 % al mes hacia su objetivo.",
  },
  production_suitability: {
    title: "Aptitud productiva",
    summary: "Cuánto rinde el suelo si instalas cemento, ladrillo o acero.",
    details: "La aptitud multiplica la producción base del ciclo; no cambia el coste de operación.",
  },
  services: {
    title: "Servicios municipales",
    summary:
      "Seguridad, bomberos, salud, educación, mercado, transporte y limpieza se sirven por red y capacidad.",
    details:
      "Una parcela desarrollada consume capacidad; un solar vacío sólo muestra el servicio potencial al que llegaría.",
  },
  regulation: {
    title: "Regulación",
    summary: "El código urbanístico define los usos permitidos y la altura máxima del solar.",
    details:
      "El riesgo regulatorio indica la probabilidad de que la norma municipal complique el proyecto.",
  },
  influence: {
    title: "Influencia",
    summary: "Capital político que se gasta para apoyar propuestas municipales.",
    details: "El gobierno reparte influencia cada mes según tu reputación.",
  },
  permits: {
    title: "Permisos",
    summary:
      "Cada obra necesita un permiso vigente; si caduca, hay que resolverlo antes de construir.",
    details: "Un permiso denegado no se puede promover de nuevo en ese solar.",
  },
  maintenance: {
    title: "Mantenimiento",
    summary:
      "Coste mensual de conservar los edificios; la política equilibrada evita que la condición caiga.",
    details: "La política diferida ahorra hoy y acumula deuda de mantenimiento.",
  },
  debt: {
    title: "Deuda",
    summary: "Préstamos con cuota mensual; si no se pagan, el banco ejecuta la garantía.",
    details: "Finanzas reúne ofertas, préstamos, atrasos y refinanciación.",
  },
  collateral: {
    title: "Garantía",
    summary:
      "Parcela que respalda un préstamo. Si el préstamo entra en impago, puede salir a subasta.",
  },
  insurance: {
    title: "Seguro",
    summary: "Póliza por edificio que cubre daños de incendio y colapso según cobertura y límite.",
    details: "La prima se paga cada mes; cancelar no devuelve lo ya pagado.",
  },
  ordinance: {
    title: "Ordenanza",
    summary: "Norma municipal con efectos sobre construcción, renta, impuestos y permisos.",
    details: "Se propone, se apoya con influencia y, si se aprueba, se aplica hasta su caducidad.",
  },
  taxes: {
    title: "Impuestos",
    summary:
      "La propiedad paga un porcentaje mensual del valor; la transmisión se paga al comprar.",
  },
  budget: {
    title: "Presupuesto municipal",
    summary:
      "El ayuntamiento reparte su caja entre administración, seguridad, transporte y limpieza.",
    details: "Los servicios que financia determinan la cobertura real que llega a los edificios.",
  },
  council: {
    title: "Concejo y elecciones",
    summary:
      "Los partidos ganan escaños según apoyo y participación; el gobierno resultante marca prioridades.",
  },
  reputation: {
    title: "Reputación",
    summary:
      "Cómo te valoran vecinos, gobierno y banca. Afecta al coste del préstamo y a la influencia mensual.",
  },
  heat: {
    title: "Presión policial",
    summary: "Cuanta más actividad ilegal acumulas, más probable es la detección y la multa.",
  },
  illegal_route: {
    title: "Ruta ilegal",
    summary: "Ingreso rápido con riesgo de detección, multa y presión policial.",
    details:
      "El enfriamiento indica cuándo puede repetirse; no es una misión, es una decisión con coste.",
  },
  intelligence: {
    title: "Inteligencia",
    summary: "Informes pagados sobre el rival con precisión conocida y caducidad.",
    details: "Es la única vía legítima para estimar caja o intención del rival.",
  },
  macro_climate: {
    title: "Clima económico",
    summary:
      "Eventos macro temporales que modifican materiales, rentas, obra, coste laboral o demanda.",
  },
  housing_market: {
    title: "Mercado de vivienda",
    summary: "Índices de renta y vacancia por tipo de edificio y segmento de hogares.",
  },
  employment: {
    title: "Empleo",
    summary:
      "Puestos, trabajadores y salarios del distrito; afectan al poder de compra de los hogares.",
  },
  public_contracts: {
    title: "Contratos públicos",
    summary:
      "Licitaciones municipales: presentas una oferta y la fianza sólo se cobra si te adjudican.",
  },
  construction: {
    title: "Construcción",
    summary: "Cada proyecto cuesta caja, materiales y horas de cuadrilla.",
    details:
      "La obra avanza cuando tiene cuadrilla asignada; cancelar devuelve la mitad de los materiales.",
  },
  crew: {
    title: "Cuadrillas",
    summary:
      "Equipos que ejecutan obras, mejoras y reparaciones. Una cuadrilla trabaja en una orden a la vez.",
  },
  overlays: {
    title: "Capas del mapa",
    summary: "Colorean las parcelas por propiedad, valor, uso, servicios o riesgo.",
    details: "Cada capa trae su leyenda; vista normal quita cualquier color semántico.",
  },
  notifications: {
    title: "Notificaciones",
    summary:
      "Avisos derivados del estado con acceso directo al edificio, la parcela o el hub que los origina.",
    details: "Marcar como leída es sólo presentación: no cambia la simulación.",
  },
  portfolio: {
    title: "Cartera",
    summary: "Comparador de activos, rentas, condición, deuda y seguros.",
    details:
      "La rutina resuelve lo repetitivo —ocupar vacantes y asignar cuadrillas— sin decidir por ti.",
  },
  auction: {
    title: "Subasta",
    summary: "Un préstamo impagado pone la garantía a la venta pública.",
    details: "Pujar no cobra la caja hasta la adjudicación; refinanciar retira la subasta.",
  },
};

/** Icono de ayuda con tooltip accesible por hover y por foco de teclado. */
export function HelpTooltip({ topic, label }: { topic: HelpTopicKey; label?: string }) {
  const id = useId();
  const entry = helpCatalog[topic];
  return (
    <span className="help-tooltip-wrap">
      <button
        aria-describedby={id}
        aria-label={label ?? `Ayuda: ${entry.title}`}
        className="help-dot"
        type="button"
      >
        <UiIcon name="help" size={14} />
      </button>
      <span className="help-tooltip" id={id} role="tooltip">
        <strong>{entry.title}</strong>
        <span>{entry.summary}</span>
      </span>
    </span>
  );
}

/** Popover de ayuda de panel: qué es, qué puede hacer el jugador y qué efectos tiene. */
export function HelpPopover({ topic }: { topic: HelpTopicKey }) {
  const [open, setOpen] = useState(false);
  const entry = helpCatalog[topic];
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <span className="help-popover-wrap">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Ayuda sobre ${entry.title}`}
        className="icon-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <UiIcon name="help" size={16} />
      </button>
      {open ? (
        <div aria-label={`Ayuda: ${entry.title}`} className="help-popover" role="dialog">
          <header>
            <strong>{entry.title}</strong>
            <button
              aria-label="Cerrar ayuda"
              className="icon-button"
              onClick={() => setOpen(false)}
              type="button"
            >
              <UiIcon name="close" size={14} />
            </button>
          </header>
          <p>{entry.summary}</p>
          {entry.details ? <p className="muted">{entry.details}</p> : null}
        </div>
      ) : null}
    </span>
  );
}

/** Etiqueta con explicación al pasar el ratón o al enfocar con teclado. */
export function ExplainedLabel({ children, topic }: { children: ReactNode; topic: HelpTopicKey }) {
  return (
    <span className="explained-label">
      {children}
      <HelpTooltip topic={topic} />
    </span>
  );
}
