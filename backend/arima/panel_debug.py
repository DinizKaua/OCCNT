# panel_debug.py
# Script auxiliar (debug) para rodar R -> Python sem passar por Rust.
import json
import subprocess
import sys

from ccnt2 import gerar_series_anuais

def ask(prompt, default=None):
    s = input(f"{prompt}" + (f" [{default}]" if default is not None else "") + ": ").strip()
    return s if s else default

def main():
    # caminhos ficam internos (não peça caminho ao usuário)
    rscript = "Rscript"
    rfile = "datasus_export_tabnet_csv.R"

    system_ = ask("Sistema (ex: SIM-DO ou SIM-DO-PRELIM)", "SIM-DO")
    uf = ask("UF (sigla, ex: MA)", "MA")
    year_start = int(ask("Ano inicial", "2016"))
    year_end = int(ask("Ano final", "2019"))

    icd = ask("Filtro ICD prefixos (ex: I10,I11,I20) ou vazio", "")

    estado = ask("Estado para o ccnt2 (--estado). Ex: '21' ou '21 Maranhão' ou 'Maranhão'", "21")
    anos_prev = int(ask("Anos de previsão", "3"))
    alpha = float(ask("Alpha (ex: 0.95)", "0.95"))

    out_csv = "dados_tabnet.csv"

    # 1) roda R para gerar o CSV no formato que o ccnt2.py já entende
    cmd_r = [
        rscript, rfile,
        "--system", system_,
        "--uf", uf,
        "--year-start", str(year_start),
        "--year-end", str(year_end),
        "--out", out_csv
    ]
    if icd:
        cmd_r += ["--icd-prefix", icd]

    print("\n[R] Executando:", " ".join(cmd_r))
    r = subprocess.run(cmd_r, capture_output=True, text=True)
    print(r.stdout)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        sys.exit(r.returncode)

    # 2) usa o seu pipeline ARIMA (ccnt2.py)
    payload = gerar_series_anuais(out_csv, estado, anos_prev, alpha)
    print("\n[PY] Resultado JSON:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
