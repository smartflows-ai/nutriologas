import { test } from "node:test";
import assert from "node:assert/strict";
import { isFillerName, isPlausibleFullName } from "../src/lib/full-name";

test("real Mexican names with a surname pass", () => {
  for (const name of [
    "Ana López",
    "María de la Luz Pérez",
    "José Ángel Núñez",
    "Juan Pablo de los Santos",
    "Ximena Peña-Ortiz",
    "Patrick O'Connor",
    "  Lupita   Hernández  ",
    "Dra. Rocío Garza",
    "Lynn Smith",
    "Ma. Guadalupe Pérez",
    "J. Carlos López",
    "Ana M. López",
    "Juan Pérez Jr.",
    "Mtra. Ana Ruiz",
    "Lic. José Luis Ramírez",
    "Ana Lo\u0301pez", // accent sent as a separate mark (NFD), as some phones do
    "Ng Wei",
    "Na Young Kim",
  ]) {
    assert.equal(isPlausibleFullName(name), true, name);
  }
});

test("a single word, or a name plus particles only, is refused", () => {
  for (const name of ["Ana", "Katya", "Dra. Ana", "Ana de", "Ana de la", "María y"]) {
    assert.equal(isPlausibleFullName(name), false, name);
  }
});

test("initials, digits and symbols are not a surname", () => {
  for (const name of ["Ana L", "Ana L.", "Ana 123", "Ana López2", "Ana @lopez", "J. R."]) {
    assert.equal(isPlausibleFullName(name), false, name);
  }
});

test("keyboard mash, repeated letters and filler are refused", () => {
  for (const name of [
    "asd asd",
    "asdf qwer",
    "qwe rty",
    "aaa bbb",
    "Ana xxx",
    "desconocido",
    "Paciente Desconocido",
    "sin nombre",
    "n/a",
    "test prueba",
    "Cliente Nuevo",
    "Usuario Whatsapp",
    "Nombre Apellido",
    "prueba López",
    "Ok Ok",
    "No Se",
    "Hola Hola",
    "Ana Ana",
  ]) {
    assert.equal(isPlausibleFullName(name), false, name);
  }
});

test("a word with no vowel is refused", () => {
  assert.equal(isPlausibleFullName("Ana Brr"), false);
  assert.equal(isPlausibleFullName("Krt Lpz"), false);
});

test("empty, non-text and very long values are refused", () => {
  assert.equal(isPlausibleFullName(""), false);
  assert.equal(isPlausibleFullName("   "), false);
  assert.equal(isPlausibleFullName(null), false);
  assert.equal(isPlausibleFullName(undefined), false);
  assert.equal(isPlausibleFullName(42), false);
  assert.equal(isPlausibleFullName(`Ana ${"López ".repeat(40)}`), false);
});

test("isFillerName: a stored name with no real first name cannot be compared with a typed one", () => {
  for (const name of ["Paciente", "Desconocido", "Paciente / Cliente", "cliente", "", null]) {
    assert.equal(isFillerName(name), true, String(name));
  }
  for (const name of ["Ana", "Juan Pérez", "Ma. Guadalupe", "Dra. Rocío"]) {
    assert.equal(isFillerName(name), false, name);
  }
});
