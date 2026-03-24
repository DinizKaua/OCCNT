from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from typing import Any, Dict, List

from ..config import EXPORTS_DIR, R_EXPORT_SCRIPT
from ..schemas import DatasusExportRequest
from .dataset_catalog import dataset_id_from_path
from .storage_names import (
    build_export_batch_name,
    build_export_dataset_file_name,
    build_export_manifest_name,
)


def run_datasus_export(request: DatasusExportRequest) -> Dict[str, Any]:
    if not R_EXPORT_SCRIPT.exists():
        raise FileNotFoundError(f"R export script not found: {R_EXPORT_SCRIPT}")

    dataset_name = _build_dataset_name(request)
    output_dir = _unique_output_dir(EXPORTS_DIR / dataset_name)
    output_dir.mkdir(parents=True, exist_ok=False)
    batch_name = output_dir.name

    tabnet_path = output_dir / build_export_dataset_file_name(batch_name, "dados_brutos")
    tidy_path = output_dir / build_export_dataset_file_name(batch_name, "dados_modelagem")
    manifest_path = output_dir / build_export_manifest_name(batch_name)

    try:
        rscript_command = resolve_rscript_command(request.rscript_bin)
        command = [
            rscript_command,
            "--vanilla",
            str(R_EXPORT_SCRIPT),
            "--system",
            request.system,
            "--uf",
            request.uf,
            "--year-start",
            str(request.year_start),
            "--year-end",
            str(request.year_end),
            "--granularity",
            request.granularity,
            "--out",
            str(tabnet_path),
            "--out-clean",
            str(tidy_path),
        ]
        if request.granularity == "month":
            command.extend(["--month-start", str(request.month_start), "--month-end", str(request.month_end)])
        if request.icd_prefix.strip():
            command.extend(["--icd-prefix", request.icd_prefix.strip()])

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError as exc:
        _cleanup_output_dir(output_dir)
        raise RuntimeError(
            f"Rscript nao encontrado/nao executavel: '{rscript_command}'."
        ) from exc
    except Exception:
        _cleanup_output_dir(output_dir)
        raise
    if result.returncode != 0:
        friendly_hint = _friendly_r_error_hint(result.stderr, result.stdout)
        _cleanup_output_dir(output_dir)
        raise RuntimeError(
            "R export failed. Check command output.\n"
            f"{friendly_hint}"
            f"Command: {' '.join(command)}\n"
            f"stderr: {result.stderr.strip()}\n"
            f"stdout: {result.stdout.strip()}"
        )

    if not tabnet_path.exists():
        _cleanup_output_dir(output_dir)
        raise RuntimeError("R export finished without generating the tabnet CSV output.")
    if not tidy_path.exists():
        tidy_path = tabnet_path

    manifest = {
        "dataset_name": output_dir.name,
        "created_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "request": request.model_dump(),
        "resolved_rscript": rscript_command,
        "command": command,
        "tabnet_file": dataset_id_from_path(tabnet_path),
        "tidy_file": dataset_id_from_path(tidy_path),
        "stdout": result.stdout[-12000:],
        "stderr": result.stderr[-12000:],
    }
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)

    preferred_dataset = dataset_id_from_path(tidy_path if tidy_path.exists() else tabnet_path)
    return {
        "dataset_name": output_dir.name,
        "output_dir": str(output_dir),
        "tabnet_file": dataset_id_from_path(tabnet_path),
        "tidy_file": dataset_id_from_path(tidy_path),
        "preferred_dataset_file": preferred_dataset,
        "command": command,
        "resolved_rscript": rscript_command,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def resolve_rscript_command(requested_value: str = "Rscript") -> str:
    return _resolve_rscript_command(requested_value)


def list_export_jobs(limit: int = 200) -> List[Dict[str, Any]]:
    jobs: List[Dict[str, Any]] = []
    if not EXPORTS_DIR.exists():
        return jobs

    for folder in EXPORTS_DIR.iterdir():
        if not folder.is_dir():
            continue
        manifest_candidates = list(folder.glob("*_resumo.json"))
        manifest_path = manifest_candidates[0] if manifest_candidates else folder / "resumo_lote.json"
        if not manifest_path.exists():
            manifest_path = folder / "manifest.json"
        if manifest_path.exists():
            try:
                with manifest_path.open("r", encoding="utf-8") as handle:
                    manifest = json.load(handle)
            except Exception:
                manifest = {}
        else:
            manifest = {}

        request_data = manifest.get("request", {})
        created_at = manifest.get("created_at")
        if not created_at:
            created_at = datetime.fromtimestamp(folder.stat().st_mtime).isoformat(timespec="seconds") + "Z"

        tabnet_file = manifest.get("tabnet_file")
        tidy_file = manifest.get("tidy_file")
        if not tabnet_file:
            for candidate in list(folder.glob("*_dados_brutos.csv")) + [folder / "dados_brutos.csv", folder / "tabnet_annual.csv", folder / "tabnet_monthly.csv"]:
                if candidate.exists():
                    tabnet_file = dataset_id_from_path(candidate)
                    break
        if not tidy_file:
            for candidate in list(folder.glob("*_dados_modelagem.csv")) + [folder / "dados_modelagem.csv", folder / "dataset_tidy.csv"]:
                if candidate.exists():
                    tidy_file = dataset_id_from_path(candidate)
                    break

        jobs.append(
            {
                "dataset_name": folder.name,
                "created_at": created_at,
                "system": request_data.get("system", ""),
                "uf": request_data.get("uf", ""),
                "granularity": request_data.get("granularity", ""),
                "year_start": request_data.get("year_start", ""),
                "year_end": request_data.get("year_end", ""),
                "icd_prefix": request_data.get("icd_prefix", ""),
                "tabnet_file": tabnet_file or "",
                "tidy_file": tidy_file or "",
                "preferred_dataset_file": tidy_file or tabnet_file or "",
            }
        )

    jobs.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return jobs[:limit]


def _build_dataset_name(request: DatasusExportRequest) -> str:
    if request.dataset_name and request.dataset_name.strip():
        return _slugify(request.dataset_name)
    return build_export_batch_name(
        system=request.system,
        uf=request.uf,
        granularity=request.granularity,
        year_start=request.year_start,
        year_end=request.year_end,
        month_start=request.month_start,
        month_end=request.month_end,
        icd_prefix=request.icd_prefix,
    )


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    return slug or "dataset"


def _unique_output_dir(base_dir: Path) -> Path:
    if not base_dir.exists():
        return base_dir
    for suffix in range(2, 1000):
        candidate = Path(f"{base_dir}_{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Unable to allocate an output directory for the export job.")


def _cleanup_output_dir(output_dir: Path) -> None:
    if output_dir.exists():
        shutil.rmtree(output_dir, ignore_errors=True)


def _resolve_rscript_command(requested_value: str) -> str:
    requested = (requested_value or "Rscript").strip()
    candidate = _existing_file(requested)
    if candidate:
        return str(candidate)

    if requested:
        found_in_path = shutil.which(requested)
        if found_in_path:
            return found_in_path

    env_candidates = [
        os.environ.get("RSCRIPT_PATH", ""),
        os.environ.get("RSCRIPT_BIN", ""),
    ]
    r_home = os.environ.get("R_HOME", "")
    if r_home:
        env_candidates.extend(
            [
                str(Path(r_home) / "bin" / "x64" / "Rscript.exe"),
                str(Path(r_home) / "bin" / "Rscript.exe"),
            ]
        )

    for value in env_candidates:
        env_file = _existing_file(value)
        if env_file:
            return str(env_file)

    windows_rscript = _find_windows_rscript()
    if windows_rscript:
        return str(windows_rscript)

    raise RuntimeError(
        "Rscript nao encontrado. Verifique PATH ou configure RSCRIPT_PATH/RSCRIPT_BIN. "
        "Caminho esperado exemplo: C:\\Program Files\\R\\R-4.5.2\\bin\\x64\\Rscript.exe"
    )


def _existing_file(value: str) -> Path | None:
    if not value:
        return None
    path = Path(value.strip('"').strip())
    if path.is_file():
        return path
    return None


def _find_windows_rscript() -> Path | None:
    base_dirs = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")),
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")),
    ]
    candidates: list[Path] = []
    for base in base_dirs:
        root = base / "R"
        if not root.exists():
            continue
        candidates.extend(root.glob("R-*\\bin\\x64\\Rscript.exe"))
        candidates.extend(root.glob("R-*\\bin\\Rscript.exe"))

    if not candidates:
        return None
    candidates = [path for path in candidates if path.is_file()]
    if not candidates:
        return None
    candidates.sort(key=lambda item: item.as_posix(), reverse=True)
    return candidates[0]


def _friendly_r_error_hint(stderr_text: str, stdout_text: str) -> str:
    merged = f"{stderr_text}\n{stdout_text}".lower()
    hints: list[str] = []

    if "there is no package called" in merged:
        hints.append(
            "Hint: faltam pacotes R. O script tenta instalar automaticamente. "
            "Se persistir, execute R como usuario com permissao de escrita na biblioteca."
        )

    if "cannot open url" in merged or "download.file" in merged:
        hints.append(
            "Hint: falha de download de pacote/dados. Verifique internet, proxy ou firewall."
        )

    if (
        "permission denied" in merged
        or "access is denied" in merged
        or "não é gravável" in merged
        or "nao e gravavel" in merged
    ):
        hints.append(
            "Hint: permissao negada na biblioteca do R ou na pasta do projeto. "
            "Rode o terminal com permissao adequada."
        )

    if "is not available for this version of r" in merged:
        hints.append(
            "Hint: pacote indisponivel para sua versao do R/repositorio. "
            "Atualize R ou ajuste repositorio CRAN."
        )

    if "rtools is required" in merged or "could not find tools necessary to compile a package" in merged:
        hints.append(
            "Hint: instale o Rtools compativel com sua versao do R para compilar pacotes fonte no Windows: "
            "https://cran.r-project.org/bin/windows/Rtools/"
        )

    if not hints:
        return ""
    return "\n".join(hints) + "\n"
