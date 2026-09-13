"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type AuthActionState,
  solicitarCodigo,
  verificarCodigo,
} from "@/app/(auth)/actions";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Must match Authentication → Settings → Mailer OTP Length in Supabase. */
const CODIGO_LARGO = 8;
const ESPERA_REENVIO_S = 60;
const initialState: AuthActionState = { status: "idle" };

function Cabecera({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <Image
        alt="Majoriti"
        className="h-auto w-full max-w-[280px] object-contain object-left dark:invert"
        height={156}
        priority
        src="/images/majoriti-logo.png"
        width={1024}
      />
      {children}
    </div>
  );
}

function Aviso({ mensaje, tono }: { mensaje: string; tono: "error" | "info" }) {
  return (
    <p
      className={
        tono === "error"
          ? "text-destructive text-sm"
          : "text-muted-foreground text-sm"
      }
      role={tono === "error" ? "alert" : "status"}
    >
      {mensaje}
    </p>
  );
}

export function LoginForm({
  enlaceInvalido = false,
}: {
  enlaceInvalido?: boolean;
}) {
  const [solicitarState, solicitarAction, solicitarPending] = useActionState(
    solicitarCodigo,
    initialState
  );
  const [verificarState, verificarAction, verificarPending] = useActionState(
    verificarCodigo,
    initialState
  );

  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [esperaReenvio, setEsperaReenvio] = useState(0);

  const codigoFormRef = useRef<HTMLFormElement>(null);
  const autoEnviadoRef = useRef<string | null>(null);

  // A successful send is what moves the screen to the code step, so the email
  // never has to be retyped.
  useEffect(() => {
    if (solicitarState.status === "sent" && solicitarState.email) {
      setEmailEnviado(solicitarState.email);
      setEsperaReenvio(ESPERA_REENVIO_S);
    }
  }, [solicitarState]);

  useEffect(() => {
    if (esperaReenvio === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setEsperaReenvio((valor) => Math.max(0, valor - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [esperaReenvio]);

  const handleCodigoChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const valor = event.target.value
        .replace(/\D/g, "")
        .slice(0, CODIGO_LARGO);
      setCodigo(valor);

      // Nobody should have to hunt for a "continuar" button after typing the
      // last digit.
      if (valor.length === CODIGO_LARGO && autoEnviadoRef.current !== valor) {
        autoEnviadoRef.current = valor;
        codigoFormRef.current?.requestSubmit();
      }
    },
    []
  );

  const usarOtroCorreo = useCallback(() => {
    setEmailEnviado(null);
    setCodigo("");
    autoEnviadoRef.current = null;
  }, []);

  if (emailEnviado) {
    const errorCodigo =
      verificarState.status === "failed" ||
      verificarState.status === "invalid_data"
        ? verificarState.message
        : null;
    const errorReenvio =
      solicitarState.status === "failed" ? solicitarState.message : null;

    return (
      <>
        <Cabecera>
          <div className="flex flex-col gap-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              Revisa tu correo
            </h1>
            <p className="text-muted-foreground text-sm">
              Te enviamos un código de {CODIGO_LARGO} dígitos a{" "}
              <span className="text-foreground">{emailEnviado}</span>. Escríbelo
              aquí para entrar.
            </p>
          </div>
        </Cabecera>

        <form
          action={verificarAction}
          className="flex flex-col gap-4"
          ref={codigoFormRef}
        >
          <input name="email" type="hidden" value={emailEnviado} />

          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-muted-foreground"
              htmlFor="codigo"
            >
              Código
            </Label>
            <Input
              autoComplete="one-time-code"
              autoFocus
              className="h-12 rounded-lg border-border/50 bg-muted/50 text-center font-mono text-lg tracking-[0.4em]"
              disabled={verificarPending}
              id="codigo"
              inputMode="numeric"
              name="codigo"
              onChange={handleCodigoChange}
              placeholder="········"
              value={codigo}
            />
          </div>

          {errorCodigo ? <Aviso mensaje={errorCodigo} tono="error" /> : null}

          <Button
            className="relative"
            disabled={verificarPending || codigo.length < CODIGO_LARGO}
            type="submit"
          >
            Entrar
            {verificarPending ? (
              <span className="absolute right-4 animate-spin">
                <LoaderIcon />
              </span>
            ) : null}
          </Button>
        </form>

        <form action={solicitarAction} className="flex flex-col gap-3">
          <input name="email" type="hidden" value={emailEnviado} />
          {errorReenvio ? <Aviso mensaje={errorReenvio} tono="error" /> : null}
          <Button
            className="relative"
            disabled={solicitarPending || esperaReenvio > 0}
            type="submit"
            variant="outline"
          >
            {esperaReenvio > 0
              ? `Reenviar código (${esperaReenvio}s)`
              : "Reenviar código"}
            {solicitarPending ? (
              <span className="absolute right-4 animate-spin">
                <LoaderIcon />
              </span>
            ) : null}
          </Button>
        </form>

        <button
          className="text-left text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          onClick={usarOtroCorreo}
          type="button"
        >
          Usar otro correo
        </button>
      </>
    );
  }

  const errorEmail =
    solicitarState.status === "failed" ||
    solicitarState.status === "invalid_data"
      ? solicitarState.message
      : null;

  return (
    <>
      <Cabecera>
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            Portal de consultoría
          </h1>
          <p className="text-muted-foreground text-sm">
            Escribe tu correo y te enviamos un código para entrar. Sin
            contraseñas.
          </p>
        </div>
      </Cabecera>

      {enlaceInvalido ? (
        <Aviso
          mensaje="Ese acceso ya no sirve. Pide un código aquí y entras igual."
          tono="info"
        />
      ) : null}

      <form action={solicitarAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="font-normal text-muted-foreground" htmlFor="email">
            Email
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm"
            id="email"
            name="email"
            placeholder="tu@empresa.com"
            required
            type="email"
          />
        </div>

        {errorEmail ? <Aviso mensaje={errorEmail} tono="error" /> : null}

        <Button className="relative" disabled={solicitarPending} type="submit">
          Enviarme el código
          {solicitarPending ? (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          ) : null}
        </Button>
      </form>

      <p className="text-[13px] text-muted-foreground">
        El acceso es solo para personas invitadas por Majoriti. Si tu correo no
        está, escríbenos y lo agregamos.
      </p>

      <Link
        className="text-[13px] text-muted-foreground underline-offset-4 hover:underline"
        href="/login/admin"
      >
        Equipo Majoriti
      </Link>
    </>
  );
}
