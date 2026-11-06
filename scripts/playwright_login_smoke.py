"""Validación visual del login interno STECH mediante Playwright.

Ejecutar desde PC020: py scripts/playwright_login_smoke.py
No realiza autenticación con credenciales ni crea cuentas.
Opcional: --google para verificar solo la redirección al proveedor.
"""
from __future__ import annotations
import argparse
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:5175/")
    parser.add_argument("--google", action="store_true")
    args = parser.parse_args()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        try:
            page = browser.new_page()
            response = page.goto(args.url, wait_until="networkidle", timeout=30000)
            assert response is not None and response.status == 200, "El CRM no respondió HTTP 200"
            login = page.get_by_role("button", name="Continuar con Google")
            assert login.count() == 1, "Debe existir un único botón de login con Google"
            assert page.get_by_text("Registrarte", exact=True).count() == 0, "Registro público prohibido"
            assert page.get_by_text("demostración", exact=False).count() == 0, "No se permiten demos en UI"
            print("OK: login Google exclusivo, sin registro ni demo")
            if args.google:
                login.click(timeout=15000)
                page.wait_for_timeout(1700)
                assert urlparse(page.url).hostname == "accounts.google.com", "OAuth no llegó a Google"
                print("OK: Google OAuth inició y redirigió a accounts.google.com")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
