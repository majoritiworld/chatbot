#!/usr/bin/env python3
"""Reads the collaborator workbook and prints identity rows as JSON.

Only the columns the load uses are emitted. Backup emails, commercial status
and observations stay in the spreadsheet.
"""

import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def texto_celda(celda, cadenas):
    tipo = celda.attrib.get("t")
    valor = celda.find("m:v", NS)
    if valor is None or valor.text is None:
        inline = celda.find("m:is", NS)
        if inline is None:
            return ""
        return "".join(nodo.text or "" for nodo in inline.iter(f"{MAIN}t"))
    if tipo == "s":
        return cadenas[int(valor.text)]
    return valor.text


def cadenas_de(libro):
    if "xl/sharedStrings.xml" not in libro.namelist():
        return []
    raiz = ET.fromstring(libro.read("xl/sharedStrings.xml"))
    return [
        "".join(nodo.text or "" for nodo in item.iter(f"{MAIN}t"))
        for item in raiz.findall("m:si", NS)
    ]


def hojas(libro):
    raiz = ET.fromstring(libro.read("xl/workbook.xml"))
    rels = ET.fromstring(libro.read("xl/_rels/workbook.xml.rels"))
    destinos = {
        nodo.attrib["Id"]: nodo.attrib["Target"]
        for nodo in rels
        if nodo.tag.endswith("Relationship")
    }
    resultado = []
    for hoja in raiz.findall("m:sheets/m:sheet", NS):
        relacion = hoja.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        destino = destinos[relacion]
        if not destino.startswith("xl/"):
            destino = f"xl/{destino}"
        resultado.append((hoja.attrib["name"], destino))
    return resultado


def columna(referencia):
    letras = []
    for caracter in referencia:
        if caracter.isalpha():
            letras.append(caracter)
    return "".join(letras)


def filas_de_hoja(libro, ruta, cadenas):
    raiz = ET.fromstring(libro.read(ruta))
    filas = []
    for fila in raiz.findall("m:sheetData/m:row", NS):
        numero = int(fila.attrib.get("r", "0"))
        celdas = {}
        for celda in fila.findall("m:c", NS):
            celdas[columna(celda.attrib.get("r", ""))] = texto_celda(celda, cadenas).strip()
        filas.append((numero, celdas))
    return filas


def clave(encabezado):
    return " ".join(encabezado.strip().lower().split())


def valor(celdas, mapa, *nombres):
    for nombre in nombres:
        columna_id = mapa.get(nombre)
        if columna_id:
            return celdas.get(columna_id, "")
    return ""


def main():
    if len(sys.argv) != 2:
        print("Uso: leer-planilla-colaboradores.py <xlsx>", file=sys.stderr)
        return 2
    ruta = Path(sys.argv[1])
    if not ruta.is_file():
        print(f"No está el archivo {ruta}", file=sys.stderr)
        return 2
    libro = zipfile.ZipFile(ruta)
    cadenas = cadenas_de(libro)
    salida = []
    for nombre, destino in hojas(libro):
        filas = filas_de_hoja(libro, destino, cadenas)
        if not filas:
            continue
        _, encabezados = filas[0]
        mapa = {clave(texto): col for col, texto in encabezados.items() if texto}
        for numero, celdas in filas[1:]:
            fila = {
                "apellido": valor(celdas, mapa, "apellido"),
                "cargo": valor(celdas, mapa, "cargo"),
                "correo": valor(celdas, mapa, "correo"),
                "empresa": valor(celdas, mapa, "empresa"),
                "fechaIngreso": valor(celdas, mapa, "fecha de ingreso"),
                "fila": numero,
                "hoja": nombre,
                "industria": valor(celdas, mapa, "industria"),
                "nombre": valor(celdas, mapa, "nombre"),
                "pais": valor(celdas, mapa, "país", "pais", "residencia"),
            }
            if any(
                fila[campo]
                for campo in ("nombre", "apellido", "correo", "empresa")
            ):
                salida.append(fila)
    json.dump(salida, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
