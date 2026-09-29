"use client";

import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
} from "react";
import {
  type MarcaPublica,
  marcaPredeterminada,
} from "@/lib/consultoria/marca";

const MarcaParticipanteContext = createContext<MarcaPublica>(
  marcaPredeterminada()
);

export function MarcaParticipanteProvider({
  children,
  marca,
}: {
  children: ReactNode;
  marca: MarcaPublica;
}) {
  return (
    <MarcaParticipanteContext.Provider value={marca}>
      {children}
    </MarcaParticipanteContext.Provider>
  );
}

export function useMarcaParticipante() {
  return useContext(MarcaParticipanteContext);
}

export function estiloMarca(marca: MarcaPublica): CSSProperties | undefined {
  if (!(marca.color && marca.colorTexto)) {
    return;
  }
  return {
    "--primary": marca.color,
    "--primary-foreground": marca.colorTexto,
  } as CSSProperties;
}
